# Stripe Backend — Setup & Environment

This repository contains a small Express server that creates Stripe PaymentIntents and handles Stripe webhooks to update Firestore.

## Firebase Service Account Setup
1. Open the Firebase Console: https://console.firebase.google.com/
2. Select your project, then open **Project settings (gear icon)** → **Service accounts**.
3. Click **Generate new private key** and download the JSON file.
4. From that JSON, copy these values into your Render environment variables:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

Important: `FIREBASE_PRIVATE_KEY` must include the full PEM block headers and newlines. If Render's UI collapses newlines, replace each real newline with `\n` when pasting.

## Required Render Environment Variables
Add the following environment variables to your Render service (Environment settings):

- `FIREBASE_PROJECT_ID` — your Firebase `project_id`
- `FIREBASE_CLIENT_EMAIL` — your Firebase `client_email`
- `FIREBASE_PRIVATE_KEY` — your Firebase `private_key` (use `\n` for newline characters if needed)
- `STRIPE_SECRET_KEY` — your Stripe secret key (starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET` — your Stripe webhook signing secret (starts with `whsec_`)

Note: `STRIPE_SECRET_KEY` is required at server start; `STRIPE_WEBHOOK_SECRET` is required to verify incoming webhooks.

## `.env.example` (template)
See `.env.example` in this folder for a copy-paste-ready template.

## Testing Webhooks with the Stripe CLI
Install the Stripe CLI and forward events to your running service to test locally or capture webhook payloads for testing:

```bash
# Forward events to your deployed service
stripe listen --forward-to https://<your-render-url>/webhook

# Or forward to a local server during dev
stripe listen --forward-to http://localhost:3000/webhook

# Send a test payment_intent.succeeded event
stripe trigger payment_intent.succeeded
```

## Useful Notes
- Make sure `index.js` uses `process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')` when initializing `firebase-admin` so encoded newlines are restored.
- Register the webhook URL in the Stripe Dashboard (Developer → Webhooks) for events such as `payment_intent.succeeded`.

If you want, I can:
- walk you through creating the service account and pasting values into Render, or
- run webhook tests using the Stripe CLI and verify Firestore writes.
# mort-backend