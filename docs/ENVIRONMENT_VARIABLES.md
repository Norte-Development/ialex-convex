# Environment Variables - iAlex Billing System

This document lists all required environment variables for the billing and payment system.

## 🔑 Required for Billing

### Stripe Configuration

These variables are **required** for the billing system to function.

#### `STRIPE_SECRET_KEY`
- **Description**: Your Stripe secret API key
- **Where to get it**: [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
- **Format**: 
  - Test mode: `sk_test_...`
  - Live mode: `sk_live_...`
- **Usage**: Used by `@raideno/convex-stripe` to communicate with Stripe API
- **Example**: `sk_test_51Abc123...`

#### `STRIPE_WEBHOOK_SECRET`
- **Description**: Webhook signing secret for verifying Stripe webhook events
- **Where to get it**: 
  1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
  2. Create or select your webhook endpoint
  3. Click "Reveal" on the signing secret
- **Format**: `whsec_...`
- **Usage**: Validates webhook requests are from Stripe
- **Example**: `whsec_xyz789...`

#### `VITE_APP_URL`
- **Description**: The base URL where your application is hosted
- **Usage**: Used for Stripe checkout success/cancel redirect URLs
- **Format**: Full URL with protocol
- **Examples**:
  - Development: `http://localhost:5173`
  - Production: `https://ialex.example.com`

## 🧪 Development Mode

### `DISABLE_PLAN_LIMITS`
- **Description**: Disables all billing plan limits in development mode
- **Values**: `"true"` or unset
- **Usage**: When set to `"true"`, bypasses all plan limits for:
  - Case creation limits
  - Document upload limits
  - Escrito creation limits
  - Team creation limits
  - Team member limits
  - AI message limits
  - Storage limits
  - Library access checks
- **Important**: 
  - Only set this in your **dev deployment**, never in production
  - Automatically enabled if CONVEX_SITE_URL contains `.cloud-dev.` or `localhost`
  - Does not affect production deployments
- **Example**: `DISABLE_PLAN_LIMITS=true`

## 📝 How to Set Environment Variables

### For Local Development

1. **In Convex Dashboard**:
   - Go to your project in [Convex Dashboard](https://dashboard.convex.dev)
   - Navigate to Settings → Environment Variables
   - Add each variable
   - **For dev deployment**: Add `DISABLE_PLAN_LIMITS=true`

2. **For Frontend (Vite)**:
   - Create a `.env` file in `apps/application/`
   - Add: `VITE_APP_URL=http://localhost:5173`

### For Production Deployment

1. **Convex Dashboard**:
   - Set `STRIPE_SECRET_KEY`
   - Set `STRIPE_WEBHOOK_SECRET`
   - Set `VITE_APP_URL` (your production URL)

2. **Vercel/Netlify/etc**:
   - Set `VITE_APP_URL` in your deployment platform's environment variables

## 🔐 Security Best Practices

### ✅ DO:
- Use test mode keys (`sk_test_`, `whsec_test_`) during development
- Keep secret keys in environment variables, never in code
- Use different Stripe accounts for dev/staging/production
- Rotate webhook secrets if compromised
- Use HTTPS URLs in production for `VITE_APP_URL`

### ❌ DON'T:
- Commit `.env` files to version control
- Share secret keys in chat, email, or Slack
- Use production keys in development
- Hardcode keys in your application code

## 🧪 Testing the Setup

### 1. Verify Stripe Keys

```bash
# Test your Stripe key (from terminal)
curl https://api.stripe.com/v1/balance \
  -u YOUR_SECRET_KEY:
```

### 2. Test Webhook Locally

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to your local Convex deployment
stripe listen --forward-to https://YOUR_CONVEX_URL/stripe/webhook
```

### 3. Verify Environment Variables in Convex

Check that variables are set correctly:
1. Go to Convex Dashboard
2. Navigate to Logs
3. Deploy a function that logs environment variables
4. Check the logs to confirm values are present

## 📋 Required vs Optional

### Required for Billing ✅
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_APP_URL`

### Optional (Development)
- `DISABLE_PLAN_LIMITS` - Disables plan limits in dev mode (development only)

### Optional (Other Features)
These are for other parts of the application, not billing:
- `OPENAI_API_KEY` - For AI features
- `QDRANT_URL` - For vector search
- `QDRANT_API_KEY` - For vector search
- `GOOGLE_CLOUD_STORAGE_BUCKET` - For document storage
- Firebase credentials - For authentication

See main project documentation for complete setup.

## 🚨 Troubleshooting

### "No such customer" error
- Check that `STRIPE_SECRET_KEY` is set correctly
- Verify you're using the right Stripe mode (test vs live)

### Webhook signature verification failed
- Check that `STRIPE_WEBHOOK_SECRET` is correct
- Ensure webhook endpoint URL in Stripe matches your deployment
- Verify webhook is enabled in Stripe Dashboard

### Redirect URL not working after checkout
- Verify `VITE_APP_URL` is set to your application's base URL
- Ensure URL includes protocol (http:// or https://)
- Check that URL doesn't have trailing slash

### Environment variable not found
- Ensure variable is set in Convex Dashboard
- Wait a few minutes after setting for changes to propagate
- Redeploy your Convex functions after setting variables

## 📚 Additional Resources

- [Stripe API Keys Documentation](https://stripe.com/docs/keys)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Convex Environment Variables](https://docs.convex.dev/production/environment-variables)
- [@raideno/convex-stripe Documentation](https://raideno.github.io/convex-stripe/)

