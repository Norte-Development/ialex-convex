# Billing System Setup Guide

This guide explains how to configure and use the billing system with Stripe integration.

## 🎯 Quick Setup

### 1. Create Stripe Products

Go to your [Stripe Dashboard](https://dashboard.stripe.com/products) and create two products:

#### Premium Individual Plan
- **Name**: Premium Individual
- **Price**: $45,000 ARS / month (recurring)
- **Features**: 
  - Unlimited cases, documents, and escritos
  - GPT-5 access
  - Can create teams (up to 3 members each)
  - 100 library documents
  - 50 GB storage

#### Premium Team Plan  
- **Name**: Premium Team
- **Price**: $350,000 ARS / month (recurring)
- **Features**:
  - All Premium Individual features
  - Up to 6 team members
  - GPT-5 for ALL team members
  - 200 library documents
  - 200 GB storage

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Stripe Price IDs to `.env`:
   ```env
   VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL=price_1234567890abcdef
   VITE_STRIPE_PRICE_PREMIUM_TEAM=price_0987654321fedcba
   ```

3. Make sure your Convex has the Stripe webhook configured (see Convex docs)

### 3. Update Redirect URLs

In `convex/billing/subscriptions.ts`, update the success and cancel URLs for your domain:

```typescript
// For development
success: {
  url: `http://localhost:5173/billing/success?session_id={CHECKOUT_SESSION_ID}`,
},
cancel: {
  url: `http://localhost:5173/pricing`,
},

// For production
success: {
  url: `https://your-domain.com/billing/success?session_id={CHECKOUT_SESSION_ID}`,
},
cancel: {
  url: `https://your-domain.com/pricing`,
},
```

## 🚀 Usage

### In React Components

```tsx
import { useUpgrade } from "@/components/Billing";

function MyComponent() {
  const { upgradeToIndividual, upgradeToTeam, isUpgrading } = useUpgrade();

  return (
    <Button 
      onClick={upgradeToIndividual}
      disabled={isUpgrading}
    >
      {isUpgrading ? "Procesando..." : "Upgrade to Premium"}
    </Button>
  );
}
```

### With UpgradeModal

```tsx
import { UpgradeModal } from "@/components/Billing";

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <UpgradeModal
      open={showModal}
      onOpenChange={setShowModal}
      currentPlan="free"
      recommendedPlan="premium_individual"
      reason="You've reached your case limit"
    />
  );
}
```

### For Team Upgrades

```tsx
import { useUpgrade } from "@/components/Billing";

function TeamSettings({ teamId }) {
  const { upgradeToTeam, isUpgrading } = useUpgrade({ teamId });

  return (
    <Button onClick={() => upgradeToTeam(teamId)}>
      Upgrade Team
    </Button>
  );
}
```

## 📝 How It Works

1. **User clicks upgrade button** → `useUpgrade` hook is triggered
2. **Hook calls Convex action** → `createCheckoutSession` or `subscribeTeam`
3. **Convex creates Stripe checkout** → Returns checkout URL
4. **User is redirected to Stripe** → Completes payment
5. **Stripe webhook updates Convex** → User plan is updated
6. **User redirected back to app** → Now has premium access

## 🔐 Security

- All checkout sessions are created server-side in Convex
- Price IDs are only stored in environment variables
- User authentication is verified before creating checkout sessions
- Stripe webhooks validate all subscription changes

## 🧪 Testing

### Test Mode
1. Use Stripe test mode Price IDs in `.env`
2. Use test credit cards from [Stripe Testing Docs](https://stripe.com/docs/testing)
3. Trigger webhooks manually or use Stripe CLI

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

## 🐛 Troubleshooting

### "Price ID not found"
- Make sure you've set the environment variables correctly
- Restart your Vite dev server after changing `.env`
- Verify the Price IDs in your Stripe Dashboard

### "No autenticado" error
- User must be logged in to upgrade
- Check that Clerk/Auth is properly configured

### Webhook not working
- Verify webhook endpoint is configured in Stripe Dashboard
- Check Convex logs for webhook errors
- Ensure webhook secret is configured in Convex

### Types not found for billing functions
- Run `pnpm convex dev` to regenerate Convex API types
- The billing functions should appear in `api.billing.subscriptions`

## 📚 Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Convex Stripe Integration](https://docs.convex.dev/stripe)
- [Project Billing Documentation](./docs/BILLING_README.md)

## 🆘 Need Help?

If you run into issues:
1. Check the Convex logs in your dashboard
2. Review Stripe webhook logs
3. Verify all environment variables are set
4. Check browser console for errors

