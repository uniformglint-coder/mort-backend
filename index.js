/**
 * Cloud Functions entry point for Stripe Connect Express account creation.
 *
 * This function uses `functions.config().stripe.secret` to initialize Stripe
 * and stores the created Stripe account ID in Firestore.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();

exports.createStripeAccount = functions.https.onCall(async (data, context) => {
  const uid = (data && data.uid) ? data.uid : null;

  if (!uid || typeof uid !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a valid uid in request data."
    );
  }

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  if (context.auth.uid !== uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "The authenticated user UID must match the uid in request data."
    );
  }

  // Check if user already has an account
  const userDoc = await admin.firestore().collection("users").doc(uid).get();
  if (userDoc.exists && userDoc.data().stripeAccountId) {
    return { stripeAccountId: userDoc.data().stripeAccountId };
  }

  const account = await stripe.accounts.create({
    type: "express",
  });

  const stripeAccountId = account.id;

  await admin.firestore().collection("users").doc(uid).set(
    {
      stripeAccountId,
    },
    { merge: true }
  );

  return { stripeAccountId };
});
