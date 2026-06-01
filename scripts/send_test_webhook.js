const Stripe = require('stripe');
const { argv } = require('process');

// Usage:
// TARGET_URL=https://your-url/webhook STRIPE_WEBHOOK_SECRET=whsec_... node scripts/send_test_webhook.js --orderId=ORDER123

const targetUrl = process.env.TARGET_URL || 'http://localhost:3000/webhook';
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripeApiKey = process.env.STRIPE_SECRET_KEY || '';

const args = argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.split('=');
  acc[k.replace(/^--/, '')] = v || true;
  return acc;
}, {});

const orderId = args.orderId || 'test-order-001';

async function run() {
  if (!webhookSecret) {
    console.warn('No STRIPE_WEBHOOK_SECRET found in env — the server will reject the signature.');
  }

  // We only need the webhooks helper; provide a harmless dummy API key if none present
  const stripe = Stripe(stripeApiKey || 'sk_test_dummy_key_for_local');

  const paymentIntent = {
    id: `pi_test_${Date.now()}`,
    object: 'payment_intent',
    amount: 1000,
    currency: 'usd',
    metadata: { orderId },
    status: 'succeeded',
  };

  const event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2022-11-15',
    created: Math.floor(Date.now() / 1000),
    data: { object: paymentIntent },
    livemode: false,
    pending_webhooks: 1,
    type: 'payment_intent.succeeded',
  };

  const payload = JSON.stringify(event);

  let header;
  try {
    header = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  } catch (e) {
    header = '';
    console.warn('Could not generate Stripe test header string; continuing without signature header.');
  }

  console.log(`Posting test event to ${targetUrl}`);

  try {
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(header ? { 'Stripe-Signature': header } : {}),
      },
      body: payload,
    });

    const text = await resp.text();
    console.log('Response status:', resp.status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Failed to send test webhook:', err.message || err);
  }
}

run();
