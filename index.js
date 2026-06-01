const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET; // set this in Render for webhooks

if (!stripeSecret) {
  console.error('Missing STRIPE_SECRET_KEY environment variable.');
  process.exit(1);
}

const stripe = Stripe(stripeSecret);

app.use(cors());
// Preserve raw body for Stripe webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Initialize Firebase Admin SDK if service account env vars are provided
if (!admin.apps.length) {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin initialized from environment service account.');
  } else {
    try {
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials.');
    } catch (e) {
      console.warn('Firebase Admin not initialized (no credentials). Firestore updates will fail until configured.');
    }
  }
}

/**
 * Create PaymentIntent
 * Optional: pass `orderId` in the body to attach to PaymentIntent.metadata.orderId
 */
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, orderId } = req.body; // amount in cents

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const params = {
      amount: amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    };
    if (orderId) params.metadata = { orderId };

    const paymentIntent = await stripe.paymentIntents.create(params);

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('create-payment-intent error:', err);
    res.status(500).json({ error: err.message });
  }
});


/**
 * Stripe Webhook endpoint
 * Set `STRIPE_WEBHOOK_SECRET` in your Render environment variables to verify signatures
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // If express.raw middleware was applied at the route, use req.body; otherwise use req.rawBody
    const raw = req.body && Buffer.isBuffer(req.body) ? req.body : req.rawBody;
    event = stripe.webhooks.constructEvent(raw, sig, stripeWebhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the payment intent succeeded event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('payment_intent.succeeded:', paymentIntent.id);

    // Update Firestore if available
    try {
      if (admin.apps.length) {
        const db = admin.firestore();
        const orderId = paymentIntent.metadata && paymentIntent.metadata.orderId;
        if (orderId) {
          await db.collection('orders').doc(orderId).set({ paid: true, paymentIntentId: paymentIntent.id }, { merge: true });
          console.log(`Order ${orderId} marked as paid in Firestore.`);
        } else {
          console.warn('No orderId in paymentIntent.metadata; skipping Firestore update.');
        }
      } else {
        console.warn('Firebase Admin not initialized; cannot update Firestore.');
      }
    } catch (e) {
      console.error('Failed to update Firestore for payment intent:', e);
    }
  }

  res.json({ received: true });
});

app.get('/', (req, res) => res.send('Server is alive!'));

app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));
