<!-- 256a0cc1-67cf-42b9-9963-ceedea7169fd 36267cb4-f983-4921-8550-d96756304469 -->
# 14-Day Free Trial with Automated Email Reminders

## Implementation Strategy

**Convex-Only Trial with Scheduler-Based Email Reminders**

Use Convex's built-in scheduler to send personalized email reminders at key trial milestones. No cron jobs needed - everything is scheduled when the user starts their trial.

**Key Features:**

- Trial activated via URL parameter (`?trial=true`)
- Lazy expiration checking (timestamp-based)
- Automated emails at day 7, 12, and 14
- Automatic payment attempt if user has saved payment method
- Prevents trial re-use by email
- Full analytics tracking

---

## Implementation Steps

### 1. Database Schema Changes

**File:** `apps/application/convex/schema.ts`

Add trial tracking fields to the `users` table:

```typescript
users: defineTable({
  // ... existing fields ...
  
  // Trial tracking
  trialStatus: v.optional(v.union(
    v.literal("active"),      // Currently in trial
    v.literal("expired"),     // Trial ended, no conversion
    v.literal("converted"),   // Upgraded to paid
    v.literal("none")         // Never had trial
  )),
  trialStartDate: v.optional(v.number()),
  trialEndDate: v.optional(v.number()),
  trialPlan: v.optional(v.union(
    v.literal("premium_individual"),
    v.literal("premium_team")
  )),
  hasUsedTrial: v.boolean(), // Prevents re-use (default false for existing users)
})
.index("by_trial_status", ["trialStatus"])
.index("by_trial_end_date", ["trialEndDate"])
.index("by_email_trial", ["email", "hasUsedTrial"])
```

**Migration Note:** Existing users will need `hasUsedTrial: false` as default.

---

### 2. Signup Flow with Trial Parameter

**File:** `apps/application/src/pages/SignUpPage.tsx`

Detect trial parameter and pass it to the signup flow:

```typescript
import { useSearchParams } from 'react-router-dom';

export default function SignUpPage() {
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.get('trial') === 'true';
  
  return (
    <CustomSignUp 
      redirectUrl="/onboarding" 
      startTrial={isTrial}
    />
  );
}
```

**File:** `apps/application/src/components/Auth/CustomSignUp.tsx`

Update to accept and pass trial parameter:

```typescript
interface CustomSignUpProps {
  redirectUrl?: string;
  onSuccess?: () => void;
  teamName?: string;
  startTrial?: boolean; // NEW
}

// In the signup success handler, pass startTrial to syncUser:
await getOrCreateUser({
  clerkId: clerkUser.id,
  email,
  name,
  startTrial: props.startTrial,
});
```

---

### 3. User Creation with Trial Initialization

**File:** `apps/application/convex/functions/users.ts`

Update `getOrCreateUser` to handle trial initialization and schedule emails:

```typescript
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    startTrial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    if (identity.subject !== args.clerkId) {
      throw new Error("Unauthorized: ClerkId mismatch");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingUser) {
      // Update user data if changed
      if (existingUser.name !== args.name || existingUser.email !== args.email) {
        await ctx.db.patch(existingUser._id, {
          name: args.name,
          email: args.email,
        });
      }
      return existingUser._id;
    }

    // For new users: Check if starting a trial
    if (args.startTrial) {
      // Check if email has used trial before
      const previousUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .filter((q) => q.eq(q.field("hasUsedTrial"), true))
        .first();
      
      if (previousUser) {
        throw new Error("Este email ya ha usado una prueba gratuita");
      }
    }

    const now = Date.now();
    const trialEndDate = args.startTrial ? now + (14 * 24 * 60 * 60 * 1000) : undefined;

    // Create new user
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      isActive: true,
      isOnboardingComplete: false,
      onboardingStep: 1,
      hasUsedTrial: args.startTrial || false,
      trialStatus: args.startTrial ? "active" : "none",
      trialStartDate: args.startTrial ? now : undefined,
      trialEndDate: trialEndDate,
      trialPlan: args.startTrial ? "premium_individual" : undefined,
      preferences: {
        // ... existing default preferences ...
      },
    });

    // Set up Stripe customer
    await ctx.scheduler.runAfter(0, internal.billing.subscriptions.setupCustomerInternal, {
      userId: userId,
      email: args.email,
      clerkId: args.clerkId,
      name: args.name,
    });

    // Schedule trial reminder emails if trial started
    if (args.startTrial && trialEndDate) {
      // Day 7: Mid-trial check-in
      await ctx.scheduler.runAfter(
        7 * 24 * 60 * 60 * 1000,
        internal.billing.trials.sendTrialReminder,
        { 
          userId: userId,
          email: args.email,
          name: args.name,
          reminderType: "mid_trial"
        }
      );

      // Day 12: Final warning
      await ctx.scheduler.runAfter(
        12 * 24 * 60 * 60 * 1000,
        internal.billing.trials.sendTrialReminder,
        { 
          userId: userId,
          email: args.email,
          name: args.name,
          reminderType: "final_warning"
        }
      );

      // Day 14: Trial expiration + conversion attempt
      await ctx.scheduler.runAfter(
        14 * 24 * 60 * 60 * 1000,
        internal.billing.trials.handleTrialExpiration,
        { 
          userId: userId,
          email: args.email,
          name: args.name
        }
      );
    }

    return userId;
  },
});
```

---

### 4. Billing Logic with Trial Check

**File:** `apps/application/convex/billing/features.ts`

Update `_getUserPlan` to check trial status first (lazy expiration):

```typescript
export async function _getUserPlan(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<PlanType> {
  // Get user to check trial status FIRST
  const user = await ctx.db.get(userId);
  
  // Check if user has ACTIVE trial (timestamp-based, lazy evaluation)
  if (user?.trialStatus === "active" && user.trialEndDate && user.trialEndDate > Date.now()) {
    return user.trialPlan || "premium_individual";
  }
  
  // If trial expired but status not updated yet, mark as expired (only in mutation context)
  if (user?.trialStatus === "active" && user.trialEndDate && user.trialEndDate <= Date.now()) {
    if ('scheduler' in ctx) {
      // MutationCtx - can update
      await ctx.db.patch(userId, { trialStatus: "expired" });
    }
  }
  
  // Continue with existing Stripe subscription check
  const customer = await ctx.db
    .query("stripeCustomers")
    .withIndex("byEntityId", (q) => q.eq("entityId", userId))
    .first();

  if (!customer) return "free";

  // ... rest of existing Stripe logic ...
}
```

---

### 5. Trial Management Functions

**File:** `apps/application/convex/billing/trials.ts` (NEW FILE)

Create comprehensive trial management with email sending:

```typescript
import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import Stripe from "stripe";

const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Send trial reminder emails (day 7 and day 12)
 */
export const sendTrialReminder = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    reminderType: v.union(v.literal("mid_trial"), v.literal("final_warning")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify user still has active trial
    const user = await ctx.runQuery(internal.billing.trials.getTrialUser, {
      userId: args.userId,
    });

    if (!user || user.trialStatus !== "active") {
      console.log(`⏭️  Skipping ${args.reminderType} email - user ${args.userId} no longer in trial`);
      return null;
    }

    const daysLeft = Math.ceil((user.trialEndDate - Date.now()) / (1000 * 60 * 60 * 24));
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    let subject: string;
    let htmlContent: string;

    if (args.reminderType === "mid_trial") {
      subject = `Tu prueba gratuita de iAlex - ${daysLeft} días restantes 🎉`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Hola ${args.name}!</h1>
          <p>Te quedan <strong>${daysLeft} días</strong> de tu prueba gratuita de iAlex Premium.</p>
          <p>¿Cómo va tu experiencia? Estás disfrutando de:</p>
          <ul>
            <li>Casos ilimitados</li>
            <li>Documentos ilimitados</li>
            <li>Acceso a GPT-5</li>
            <li>Y mucho más...</li>
          </ul>
          <p>¿Tienes alguna pregunta? Estamos aquí para ayudarte.</p>
          <a href="${baseUrl}/preferencias?section=billing" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Ver opciones de actualización
          </a>
        </div>
      `;
    } else {
      subject = `⏰ ¡Última oportunidad! Tu prueba gratuita termina en ${daysLeft} días`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #DC2626;">¡Última oportunidad!</h1>
          <p>Tu prueba gratuita de iAlex Premium termina en <strong>${daysLeft} días</strong>.</p>
          <p>No pierdas acceso a todas las funciones Premium que has estado disfrutando.</p>
          <p><strong>Actualiza ahora y mantén:</strong></p>
          <ul>
            <li>✅ Casos y documentos ilimitados</li>
            <li>✅ Acceso completo a GPT-5</li>
            <li>✅ Todas las funciones Premium</li>
          </ul>
          <a href="${baseUrl}/preferencias?section=billing&trial=upgrade" 
             style="display: inline-block; background: #DC2626; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0; font-size: 16px;">
            Actualizar a Premium ahora
          </a>
          <p style="color: #6B7280; font-size: 14px;">
            Si no actualizas, volverás al plan gratuito el ${new Date(user.trialEndDate).toLocaleDateString('es-AR')}.
          </p>
        </div>
      `;
    }

    // Send email using your email service
    await sendEmail({
      to: args.email,
      subject,
      html: htmlContent,
    });

    console.log(`📧 Sent ${args.reminderType} email to ${args.email}`);
    return null;
  },
});

/**
 * Handle trial expiration - send email and attempt conversion
 */
export const handleTrialExpiration = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.billing.trials.getTrialUser, {
      userId: args.userId,
    });

    if (!user || user.trialStatus !== "active") {
      console.log(`⏭️  Skipping expiration - user ${args.userId} already processed`);
      return null;
    }

    // Check if user has payment method
    const customer = await ctx.runQuery(internal.billing.trials.getCustomerPaymentMethod, {
      userId: args.userId,
    });

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    if (customer?.hasPaymentMethod) {
      // Attempt to create subscription
      try {
        await ctx.runAction(internal.billing.trials.createSubscriptionForExpiredTrial, {
          userId: args.userId,
          customerId: customer.customerId,
        });

        // Send success email
        await sendEmail({
          to: args.email,
          subject: "¡Bienvenido a iAlex Premium! 🎉",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #10B981;">¡Bienvenido a Premium!</h1>
              <p>Hola ${args.name},</p>
              <p>Tu prueba gratuita ha terminado y hemos procesado exitosamente tu suscripción Premium.</p>
              <p>Continúa disfrutando de todas las funciones ilimitadas de iAlex.</p>
              <a href="${baseUrl}/casos" style="display: inline-block; background: #4F46E5; 
                     color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Ir a mis casos
              </a>
            </div>
          `,
        });

        console.log(`✅ Converted trial user ${args.userId} to paid`);
      } catch (error) {
        console.error(`❌ Failed to convert trial user ${args.userId}:`, error);
        // Fall through to expired flow
      }
    }

    // If no payment method or conversion failed, mark as expired
    await ctx.runMutation(internal.billing.trials.markTrialExpired, {
      userId: args.userId,
    });

    // Send trial expired email
    await sendEmail({
      to: args.email,
      subject: "Tu prueba gratuita de iAlex ha terminado",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Tu prueba gratuita ha terminado</h1>
          <p>Hola ${args.name},</p>
          <p>Esperamos que hayas disfrutado de iAlex Premium durante los últimos 14 días.</p>
          <p>Tu cuenta ha vuelto al plan gratuito, pero puedes actualizar en cualquier momento para recuperar:</p>
          <ul>
            <li>Casos y documentos ilimitados</li>
            <li>Acceso completo a GPT-5</li>
            <li>Todas las funciones Premium</li>
          </ul>
          <a href="${baseUrl}/preferencias?section=billing" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Actualizar a Premium
          </a>
          <p style="color: #6B7280; font-size: 14px;">
            ¿Necesitas ayuda? <a href="${baseUrl}/soporte">Contacta a nuestro equipo</a>
          </p>
        </div>
      `,
    });

    console.log(`📧 Sent trial expired email to ${args.email}`);
    return null;
  },
});

/**
 * Get trial user info (internal query)
 */
export const getTrialUser = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      trialStatus: v.union(v.literal("active"), v.literal("expired"), v.literal("converted"), v.literal("none")),
      trialEndDate: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.trialStatus || !user.trialEndDate) {
      return null;
    }
    return {
      trialStatus: user.trialStatus,
      trialEndDate: user.trialEndDate,
    };
  },
});

/**
 * Check if customer has payment method
 */
export const getCustomerPaymentMethod = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      hasPaymentMethod: v.boolean(),
      customerId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();

    if (!customer) {
      return null;
    }

    return {
      hasPaymentMethod: customer.stripe?.invoice_settings?.default_payment_method != null,
      customerId: customer.customerId,
    };
  },
});

/**
 * Create subscription for expired trial user
 */
export const createSubscriptionForExpiredTrial = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const priceId = process.env.VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL;
    if (!priceId) {
      throw new Error("VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL not configured");
    }

    // Create subscription (will charge immediately)
    const subscription = await stripeSDK.subscriptions.create({
      customer: args.customerId,
      items: [{ price: priceId }],
      metadata: {
        userId: args.userId,
        convertedFromTrial: "true",
      },
    });

    // Mark as converted
    await ctx.runMutation(internal.billing.trials.markTrialConverted, {
      userId: args.userId,
    });

    return null;
  },
});

/**
 * Mark trial as expired
 */
export const markTrialExpired = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      trialStatus: "expired",
    });
    return null;
  },
});

/**
 * Mark trial as converted
 */
export const markTrialConverted = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      trialStatus: "converted",
    });
    return null;
  },
});

/**
 * Email sending helper - implement with your email service
 */
async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  // TODO: Implement with Resend, SendGrid, or your email service
  // Example with Resend:
  /*
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  await resend.emails.send({
    from: 'iAlex <noreply@ialex.com>',
    to: [to],
    subject,
    html,
  });
  */
  
  console.log(`📧 Email would be sent to ${to}: ${subject}`);
}
```

---

### 6. UI Components

**File:** `apps/application/src/components/Trial/TrialBanner.tsx` (NEW)

```typescript
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.trialStatus !== "active" || !user.trialEndDate) {
    return null;
  }

  const now = Date.now();
  const daysLeft = Math.ceil((user.trialEndDate - now) / (1000 * 60 * 60 * 24));

  // Don't show if trial expired
  if (daysLeft <= 0) {
    return null;
  }

  const isUrgent = daysLeft <= 3;

  return (
    <Alert className={isUrgent ? "border-red-500 bg-red-50" : "border-blue-500 bg-blue-50"}>
      <div className="flex items-center gap-4">
        {isUrgent ? (
          <Clock className="h-5 w-5 text-red-600" />
        ) : (
          <Sparkles className="h-5 w-5 text-blue-600" />
        )}
        <div className="flex-1">
          <AlertTitle className={isUrgent ? "text-red-900" : "text-blue-900"}>
            {isUrgent ? "¡Tu prueba gratuita termina pronto!" : "Prueba gratuita activa"}
          </AlertTitle>
          <AlertDescription className={isUrgent ? "text-red-700" : "text-blue-700"}>
            Te quedan <strong>{daysLeft} días</strong> de acceso Premium Individual.
          </AlertDescription>
        </div>
        <Button 
          onClick={() => navigate("/preferencias?section=billing")}
          variant={isUrgent ? "destructive" : "default"}
        >
          Actualizar ahora
        </Button>
      </div>
    </Alert>
  );
}
```

**File:** `apps/application/src/App.tsx` or main layout

Add TrialBanner to your layout:

```typescript
import { TrialBanner } from "@/components/Trial/TrialBanner";

// In your layout component:
<div>
  <TrialBanner />
  {/* rest of your app */}
</div>
```

**File:** `apps/application/src/pages/SignUpPage.tsx`

Add trial CTA:

```typescript
<div className="mt-4 text-center">
  <p className="text-sm text-gray-600">
    ¿Quieres probar Premium?{" "}
    <a href="/signup?trial=true" className="text-primary font-semibold hover:underline">
      Inicia tu prueba gratuita de 14 días
    </a>
  </p>
</div>
```

---

### 7. Analytics

**File:** `apps/application/convex/billing/analytics.ts` (NEW)

```typescript
import { v } from "convex/values";
import { query } from "../_generated/server";

export const getTrialMetrics = query({
  args: {},
  returns: v.object({
    active: v.number(),
    converted: v.number(),
    expired: v.number(),
    conversionRate: v.number(),
    activeUsers: v.array(v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      daysLeft: v.number(),
    })),
  }),
  handler: async (ctx) => {
    const activeTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "active"))
      .collect();

    const convertedTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "converted"))
      .collect();

    const expiredTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "expired"))
      .collect();

    const now = Date.now();
    const activeUsers = activeTrials.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      daysLeft: Math.ceil((user.trialEndDate! - now) / (1000 * 60 * 60 * 24)),
    }));

    const totalTrials = convertedTrials.length + expiredTrials.length;
    const conversionRate = totalTrials > 0 
      ? (convertedTrials.length / totalTrials) * 100 
      : 0;

    return {
      active: activeTrials.length,
      converted: convertedTrials.length,
      expired: expiredTrials.length,
      conversionRate: Math.round(conversionRate * 100) / 100,
      activeUsers,
    };
  },
});
```

---

## Environment Variables

Add to your `.env` and Convex deployment:

```bash
# Email Service (choose one)
RESEND_API_KEY=re_...
# or
SENDGRID_API_KEY=SG...

# App URL for email links
VITE_APP_URL=https://ialex.com  # or http://localhost:5173 for dev

# Stripe (existing)
VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL=price_...
STRIPE_SECRET_KEY=sk_...
```

---

## Testing Checklist

- [ ] User can access `/signup?trial=true`
- [ ] Trial user sees Premium Individual features immediately
- [ ] Cannot reuse trial with same email
- [ ] Trial banner displays correct days remaining
- [ ] Day 7 email scheduled and sent (test with short duration)
- [ ] Day 12 email scheduled and sent
- [ ] Day 14 expiration handled correctly
- [ ] User with payment method converts automatically
- [ ] User without payment method downgrades to free
- [ ] Analytics show correct trial metrics
- [ ] Emails cancelled if user converts early

---

## Implementation Timeline

**Total Estimated Time: 3-4 hours**

1. **Phase 1 (1 hour):** ✅ **COMPLETED** - Schema + signup flow + billing logic
2. **Phase 2 (1.5 hours):** ✅ **COMPLETED** - Trial management functions + email templates
3. **Phase 3 (0.5 hours):** 🔄 **PENDING** - UI components (banner + CTA)
4. **Phase 4 (1 hour):** 🔄 **PENDING** - Testing + email service integration

### Current Status: Phase 1 & 2 Complete ✅

- ✅ Database schema updated with trial tracking fields
- ✅ Signup flow integrated with trial parameter detection
- ✅ User creation logic handles trial initialization
- ✅ Billing logic checks trial status before Stripe subscriptions
- ✅ Trial management functions created with email automation
- ✅ Email scheduling integrated with existing Resend service

### Next Steps:

- Create TrialBanner component for UI
- Add trial analytics and metrics
- Implement end-to-end testing

---

## Email Service Integration

Choose one:

### Option 1: Resend (Recommended)

```bash
pnpm add resend
```

### Option 2: SendGrid

```bash
pnpm add @sendgrid/mail
```

### Option 3: Nodemailer (SMTP)

```bash
pnpm add nodemailer
```

Update the `sendEmail` function in `trials.ts` with your chosen service.

---

## Migration for Existing Users

Add a migration to set `hasUsedTrial: false` for existing users:

```typescript
// convex/migrations/addTrialFields.ts
export const addTrialFieldsToUsers = internalMutation({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.hasUsedTrial === undefined) {
        await ctx.db.patch(user._id, {
          hasUsedTrial: false,
          trialStatus: "none",
        });
      }
    }
  },
});
```

#### ✅ Phase 1 - Core Trial Infrastructure (COMPLETED)

- [x] Add trial tracking fields to users table in schema.ts (trialStatus, trialStartDate, trialEndDate, trialPlan, hasUsedTrial) with appropriate indexes
- [x] Update getOrCreateUser mutation to detect trial parameter and initialize trial for new users, checking for previous trial usage by email
- [x] Modify _getUserPlan helper in features.ts to check active trial status before checking Stripe subscriptions
- [x] Create convex/billing/trials.ts with functions to check expired trials, verify payment methods, and handle conversion or downgrade
- [x] Update SignUpPage.tsx to detect trial parameter and show trial-specific UI
- [x] Update OnboardingWrapper.tsx to pass trial parameter to user creation process
- [x] Integrate with existing Resend email service for automated trial reminders

#### 🔄 Phase 2 - UI Components & Analytics (PENDING)

- [ ] Create TrialBanner component to display trial status and days remaining in the UI
- [ ] Add trial metrics query to track active trials, conversions, and conversion rates for business analytics
- [ ] Add trial CTA to other relevant pages (pricing, features, etc.)

#### 🔄 Phase 3 - Advanced Features (PENDING)

- [ ] Set up daily cron job in convex/crons.ts to automatically expire trials and process conversions/downgrades
- [ ] Add trial analytics dashboard for business insights
- [ ] Implement trial extension functionality for customer success
- [ ] Add A/B testing capabilities for trial messaging

#### 🔄 Phase 4 - Testing & Optimization (PENDING)

- [ ] End-to-end testing of trial flow
- [ ] Email template optimization based on performance
- [ ] Conversion rate optimization
- [ ] Performance monitoring and alerting
- [ ] Test full trial flow: signup with trial, feature access, expiration handling, and conversion/downgrade scenarios

### To-dos

- [ ] Add trial tracking fields to users table in schema.ts (trialStatus, trialStartDate, trialEndDate, trialPlan, hasUsedTrial) with appropriate indexes
- [ ] Update getOrCreateUser mutation to detect trial parameter and initialize trial for new users, checking for previous trial usage by email
- [ ] Modify _getUserPlan helper in features.ts to check active trial status before checking Stripe subscriptions
- [ ] Create convex/billing/trials.ts with functions to check expired trials, verify payment methods, and handle conversion or downgrade
- [ ] Set up daily cron job in convex/crons.ts to automatically expire trials and process conversions/downgrades
- [ ] Create TrialBanner component to display trial status and days remaining in the UI
- [ ] Add trial metrics query to track active trials, conversions, and conversion rates for business analytics
- [ ] Test full trial flow: signup with trial, feature access, expiration handling, and conversion/downgrade scenarios