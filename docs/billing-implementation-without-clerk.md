# Plan de Implementación: Sistema de Facturación sin Clerk Billing

## Resumen Ejecutivo

Este documento detalla la implementación completa de un sistema de suscripciones personalizado usando Stripe directamente, sin utilizar Clerk Billing.

**Tiempo estimado:** 6-8 semanas  
**Complejidad:** Alta  
**Control:** Total sobre el sistema de facturación

---

## Arquitectura del Sistema

### Stack Tecnológico

- **Stripe SDK** - Procesamiento de pagos y gestión de suscripciones
- **Convex** - Base de datos y lógica de backend
- **Clerk** - Solo autenticación (sin billing)
- **Webhooks** - Sincronización Stripe ↔ Convex
- **React/Next.js** - Componentes de UI de facturación

### Flujo de Datos

```
Usuario → Clerk Auth → Convex → Stripe API
                        ↓
                    Webhooks ← Stripe
                        ↓
                    Convex DB actualizada
```

---

## Fase 1: Extensión del Schema de Convex (Semana 1)

### 1.1 Agregar Campos de Suscripción a Users

```typescript
// convex/schema.ts - Agregar a tabla users:

users: defineTable({
  // ... campos existentes ...
  
  // SUSCRIPCIÓN INDIVIDUAL
  individualSubscription: v.optional(v.object({
    plan: v.union(
      v.literal("free"),
      v.literal("premium_individual")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("trialing"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("unpaid")
    ),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    trialEnd: v.optional(v.number()),
  })),
  
  // LÍMITES DE USO (PLAN GRATUITO)
  usageLimits: v.optional(v.object({
    casesCount: v.number(),
    documentsCount: v.number(),
    aiMessagesThisMonth: v.number(),
    lastResetDate: v.number(),
    storageUsedBytes: v.number(),
    libraryDocumentsCount: v.number(),
    escritosCount: v.number(),
  })),
  
  // CRÉDITOS DE IA (PACKS ADICIONALES)
  aiCredits: v.optional(v.object({
    purchased: v.number(), // Créditos comprados
    used: v.number(), // Créditos usados
    expiresAt: v.optional(v.number()),
  })),
})
.index("by_stripe_customer_id", ["individualSubscription.stripeCustomerId"])
.index("by_stripe_subscription_id", ["individualSubscription.stripeSubscriptionId"])
```

### 1.2 Nueva Tabla: Team Subscriptions

```typescript
// convex/schema.ts - Nueva tabla:

teamSubscriptions: defineTable({
  teamId: v.id("teams"),
  plan: v.union(
    v.literal("premium_team"),
    v.literal("enterprise")
  ),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("trialing"),
    v.literal("incomplete"),
    v.literal("incomplete_expired"),
    v.literal("unpaid")
  ),
  
  // Stripe
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
  stripePriceId: v.string(),
  
  // Facturación
  billingOwnerId: v.id("users"), // Quien paga
  billingEmail: v.string(),
  
  // Período
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  trialEnd: v.optional(v.number()),
  
  // Límites
  maxMembers: v.number(),
  maxStorageGB: v.number(),
  
  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_team", ["teamId"])
.index("by_billing_owner", ["billingOwnerId"])
.index("by_stripe_customer_id", ["stripeCustomerId"])
.index("by_stripe_subscription_id", ["stripeSubscriptionId"])
.index("by_status", ["status"])
```

### 1.3 Nueva Tabla: Payment History

```typescript
// convex/schema.ts - Nueva tabla:

paymentHistory: defineTable({
  userId: v.optional(v.id("users")),
  teamId: v.optional(v.id("teams")),
  
  // Stripe
  stripeInvoiceId: v.string(),
  stripePaymentIntentId: v.optional(v.string()),
  
  // Detalles
  amount: v.number(),
  currency: v.string(),
  status: v.union(
    v.literal("paid"),
    v.literal("pending"),
    v.literal("failed"),
    v.literal("refunded")
  ),
  
  // Tipo
  type: v.union(
    v.literal("subscription"),
    v.literal("ai_credits"),
    v.literal("one_time")
  ),
  
  // Fechas
  paidAt: v.optional(v.number()),
  createdAt: v.number(),
  
  // Detalles adicionales
  description: v.optional(v.string()),
  receiptUrl: v.optional(v.string()),
})
.index("by_user", ["userId"])
.index("by_team", ["teamId"])
.index("by_stripe_invoice", ["stripeInvoiceId"])
.index("by_status", ["status"])
.index("by_created_at", ["createdAt"])
```

### 1.4 Nueva Tabla: AI Credit Purchases

```typescript
// convex/schema.ts - Nueva tabla:

aiCreditPurchases: defineTable({
  userId: v.id("users"),
  
  // Paquete
  packSize: v.number(), // 50 mensajes
  priceUSD: v.number(), // 3 USD
  
  // Stripe
  stripePaymentIntentId: v.string(),
  stripeInvoiceId: v.optional(v.string()),
  
  // Estado
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("refunded")
  ),
  
  // Fechas
  purchasedAt: v.number(),
  expiresAt: v.number(), // 90 días desde compra
})
.index("by_user", ["userId"])
.index("by_status", ["status"])
.index("by_stripe_payment_intent", ["stripePaymentIntentId"])
```

---

## Fase 2: Configuración de Stripe (Semana 1-2)

### 2.1 Crear Productos en Stripe Dashboard

**Premium Individual**
- Producto: "iAlex Premium Individual"
- Precio: $45,000 ARS/mes (o USD equivalente)
- ID: `price_premium_individual_monthly`
- Facturación: Recurrente mensual

**Premium Team**
- Producto: "iAlex Premium Equipo"
- Precio: $350,000 ARS/mes
- ID: `price_premium_team_monthly`
- Facturación: Recurrente mensual

**AI Credits Pack**
- Producto: "Pack 50 Mensajes IA"
- Precio: $3 USD
- ID: `price_ai_credits_50`
- Facturación: One-time

### 2.2 Configurar Variables de Entorno

```bash
# .env.local

# Stripe Keys
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Stripe Price IDs
STRIPE_PRICE_PREMIUM_INDIVIDUAL=price_premium_individual_monthly
STRIPE_PRICE_PREMIUM_TEAM=price_premium_team_monthly
STRIPE_PRICE_AI_CREDITS_50=price_ai_credits_50

# Stripe Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL
NEXT_PUBLIC_APP_URL=https://ialex.app
```

### 2.3 Configurar Webhooks en Stripe

**Endpoint:** `https://ialex.app/api/webhooks/stripe`

**Eventos a escuchar:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.created`
- `customer.updated`

---

## Fase 3: Backend - Funciones de Convex (Semana 2-3)

### 3.1 Utilidades de Suscripción

```typescript
// convex/stripe/subscriptionUtils.ts

export async function getUserSubscription(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
) {
  const user = await ctx.db.get(userId);
  
  return {
    plan: user?.individualSubscription?.plan || "free",
    status: user?.individualSubscription?.status || "active",
    isActive: user?.individualSubscription?.status === "active",
    isPremium: user?.individualSubscription?.plan === "premium_individual" &&
               user?.individualSubscription?.status === "active",
    currentPeriodEnd: user?.individualSubscription?.currentPeriodEnd,
  };
}

export async function getTeamSubscription(
  ctx: QueryCtx | MutationCtx,
  teamId: Id<"teams">
) {
  const subscription = await ctx.db
    .query("teamSubscriptions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .first();
  
  return {
    exists: !!subscription,
    plan: subscription?.plan,
    status: subscription?.status,
    isActive: subscription?.status === "active",
    isPremium: subscription?.plan === "premium_team" &&
               subscription?.status === "active",
    maxMembers: subscription?.maxMembers || 0,
  };
}

export async function checkFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  feature: string
): Promise<{ allowed: boolean; reason?: string }> {
  const user = await ctx.db.get(userId);
  const subscription = await getUserSubscription(ctx, userId);
  
  // Usuario Premium tiene todo
  if (subscription.isPremium) {
    return { allowed: true };
  }
  
  // Usuario gratuito - verificar límites
  const limits = user?.usageLimits || {
    casesCount: 0,
    documentsCount: 0,
    aiMessagesThisMonth: 0,
    lastResetDate: Date.now(),
    storageUsedBytes: 0,
    libraryDocumentsCount: 0,
    escritosCount: 0,
  };
  
  switch (feature) {
    case "create_case":
      if (limits.casesCount >= 2) {
        return { 
          allowed: false, 
          reason: "Plan gratuito limitado a 2 casos. Upgrade a Premium." 
        };
      }
      break;
      
    case "upload_document":
      if (limits.documentsCount >= 10) {
        return { 
          allowed: false, 
          reason: "Plan gratuito limitado a 10 documentos. Upgrade a Premium." 
        };
      }
      break;
      
    case "ai_message":
      const totalMessages = limits.aiMessagesThisMonth + (user?.aiCredits?.purchased || 0) - (user?.aiCredits?.used || 0);
      if (totalMessages >= 50) {
        return { 
          allowed: false, 
          reason: "Has alcanzado tu límite mensual. Compra más créditos o upgrade a Premium." 
        };
      }
      break;
      
    case "create_team":
      return { 
        allowed: false, 
        reason: "Solo usuarios Premium pueden crear equipos." 
      };
      
    case "gpt5_access":
      return { 
        allowed: false, 
        reason: "GPT-5 solo disponible en plan Premium." 
      };
  }
  
  return { allowed: true };
}
```

### 3.2 Funciones de Stripe

```typescript
// convex/stripe/createCheckoutSession.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export const createCheckoutSession = action({
  args: {
    priceId: v.string(),
    mode: v.union(v.literal("subscription"), v.literal("payment")),
    teamId: v.optional(v.id("teams")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    // Crear o recuperar Stripe Customer
    let stripeCustomerId = user.individualSubscription?.stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: identity.email!,
        metadata: {
          convexUserId: user._id,
          clerkUserId: identity.subject,
        },
      });
      stripeCustomerId = customer.id;
    }
    
    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: args.mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/canceled`,
      metadata: {
        convexUserId: user._id,
        teamId: args.teamId || "",
      },
    });
    
    return { url: session.url };
  },
});

export const createCustomerPortalSession = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    const stripeCustomerId = user.individualSubscription?.stripeCustomerId;
    if (!stripeCustomerId) {
      throw new Error("No tienes una cuenta de facturación");
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });
    
    return { url: session.url };
  },
});
```

### 3.3 Webhook Handler

```typescript
// convex/http.ts (agregar endpoint)
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

const http = httpRouter();

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400 });
    }
    
    // Procesar evento
    await ctx.runMutation(internal.stripe.webhooks.handleStripeEvent, {
      event: JSON.stringify(event),
    });
    
    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

```typescript
// convex/stripe/webhooks.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const handleStripeEvent = internalMutation({
  args: { event: v.string() },
  handler: async (ctx, args) => {
    const event = JSON.parse(args.event);
    
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(ctx, event.data.object);
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(ctx, event.data.object);
        break;
        
      case "invoice.paid":
        await handleInvoicePaid(ctx, event.data.object);
        break;
        
      case "invoice.payment_failed":
        await handlePaymentFailed(ctx, event.data.object);
        break;
        
      case "payment_intent.succeeded":
        await handleOneTimePayment(ctx, event.data.object);
        break;
    }
  },
});

async function handleSubscriptionUpdate(ctx, subscription: any) {
  const userId = subscription.metadata.convexUserId;
  const teamId = subscription.metadata.teamId;
  
  if (teamId) {
    // Actualizar suscripción de equipo
    const existing = await ctx.db
      .query("teamSubscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", subscription.id)
      )
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("teamSubscriptions", {
        teamId: teamId as Id<"teams">,
        plan: determinePlanFromPriceId(subscription.items.data[0].price.id),
        status: subscription.status,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        billingOwnerId: userId as Id<"users">,
        billingEmail: subscription.customer_email,
        currentPeriodStart: subscription.current_period_start * 1000,
        currentPeriodEnd: subscription.current_period_end * 1000,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        maxMembers: 6,
        maxStorageGB: 200,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  } else {
    // Actualizar suscripción individual
    const user = await ctx.db.get(userId as Id<"users">);
    if (user) {
      await ctx.db.patch(user._id, {
        individualSubscription: {
          plan: "premium_individual",
          status: subscription.status,
          stripeCustomerId: subscription.customer,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          currentPeriodStart: subscription.current_period_start * 1000,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    }
  }
}

async function handleInvoicePaid(ctx, invoice: any) {
  // Registrar pago en historial
  await ctx.db.insert("paymentHistory", {
    userId: invoice.metadata.convexUserId as Id<"users"> | undefined,
    teamId: invoice.metadata.teamId as Id<"teams"> | undefined,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    status: "paid",
    type: "subscription",
    paidAt: invoice.status_transitions.paid_at * 1000,
    createdAt: Date.now(),
    receiptUrl: invoice.hosted_invoice_url,
  });
}

function determinePlanFromPriceId(priceId: string) {
  if (priceId === process.env.STRIPE_PRICE_PREMIUM_TEAM) {
    return "premium_team";
  }
  return "premium_team"; // Default
}
```

---

## Fase 4: Frontend - UI de Facturación (Semana 3-4)

### 4.1 Página de Precios

```tsx
// app/pricing/page.tsx

"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PricingPage() {
  const createCheckout = useAction(api.stripe.createCheckoutSession.createCheckoutSession);
  
  const handleSubscribe = async (priceId: string) => {
    const { url } = await createCheckout({
      priceId,
      mode: "subscription",
    });
    window.location.href = url;
  };
  
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold text-center mb-12">
        Elige tu plan
      </h1>
      
      <div className="grid md:grid-cols-3 gap-8">
        {/* Plan Gratuito */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Gratuito</h2>
          <p className="text-4xl font-bold mb-6">$0<span className="text-lg">/mes</span></p>
          
          <ul className="space-y-3 mb-6">
            <li>✓ 2 casos activos</li>
            <li>✓ 10 documentos por caso</li>
          <li>✓ 20 mensajes IA/mes</li>
            <li>✓ GPT-4o-mini</li>
            <li>✓ 500 MB almacenamiento</li>
          </ul>
          
          <Button variant="outline" className="w-full">
            Plan Actual
          </Button>
        </Card>
        
        {/* Premium Individual */}
        <Card className="p-6 border-primary border-2">
          <h2 className="text-2xl font-bold mb-4">Premium Individual</h2>
          <p className="text-4xl font-bold mb-6">$30.000<span className="text-lg">/mes</span></p>
          
          <ul className="space-y-3 mb-6">
            <li>✓ Casos ilimitados</li>
            <li>✓ Documentos ilimitados</li>
            <li>✓ GPT-5 para ti</li>
            <li>✓ IA ilimitada</li>
            <li>✓ 50 GB almacenamiento</li>
            <li>✓ Crear equipo (3 personas)</li>
          </ul>
          
          <Button 
            className="w-full"
            onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_INDIVIDUAL!)}
          >
            Comenzar
          </Button>
        </Card>
        
        {/* Premium Equipo */}
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Premium Equipo</h2>
          <p className="text-4xl font-bold mb-6">$200.000<span className="text-lg">/mes</span></p>
          
          <ul className="space-y-3 mb-6">
            <li>✓ Todo lo de Individual</li>
            <li>✓ GPT-5 para todos</li>
            <li>✓ Hasta 6 miembros</li>
            <li>✓ 200 GB compartidos</li>
            <li>✓ Biblioteca de equipo</li>
            <li>✓ Panel de admin</li>
          </ul>
          
          <Button 
            className="w-full"
            onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_TEAM!)}
          >
            Comenzar
          </Button>
        </Card>
      </div>
    </div>
  );
}
```

### 4.2 Portal de Facturación del Usuario

```tsx
// app/settings/billing/page.tsx

"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingPage() {
  const user = useQuery(api.functions.users.getCurrentUser);
  const createPortalSession = useAction(api.stripe.createCheckoutSession.createCustomerPortalSession);
  
  const handleManageSubscription = async () => {
    const { url } = await createPortalSession();
    window.location.href = url;
  };
  
  if (!user) return <div>Cargando...</div>;
  
  const subscription = user.individualSubscription;
  const plan = subscription?.plan || "free";
  
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Facturación</h1>
      
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Plan Actual</h2>
        <p className="text-3xl font-bold mb-2">
          {plan === "free" ? "Gratuito" : "Premium Individual"}
        </p>
        
        {subscription?.status === "active" && (
          <p className="text-muted-foreground mb-4">
            Próximo pago: {new Date(subscription.currentPeriodEnd!).toLocaleDateString()}
          </p>
        )}
        
        {plan !== "free" && (
          <Button onClick={handleManageSubscription}>
            Gestionar Suscripción
          </Button>
        )}
      </Card>
      
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Uso del Plan Gratuito</h2>
        <div className="space-y-2">
          <div>Casos: {user.usageLimits?.casesCount || 0} / 2</div>
          <div>Documentos: {user.usageLimits?.documentsCount || 0} / 10</div>
          <div>Mensajes IA este mes: {user.usageLimits?.aiMessagesThisMonth || 0} / 50</div>
        </div>
      </Card>
    </div>
  );
}
```

---

## Fase 5: Protección de Features (Semana 4-5)

### 5.1 Actualizar Mutaciones con Checks

```typescript
// convex/functions/cases.ts

export const createCase = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // VERIFICAR ACCESO
    const access = await checkFeatureAccess(ctx, currentUser._id, "create_case");
    if (!access.allowed) {
      throw new Error(access.reason);
    }
    
    // Crear caso
    const caseId = await ctx.db.insert("cases", { /* ... */ });
    
    // INCREMENTAR CONTADOR si es usuario gratuito
    const subscription = await getUserSubscription(ctx, currentUser._id);
    if (!subscription.isPremium) {
      const limits = currentUser.usageLimits || { casesCount: 0, /* ... */ };
      await ctx.db.patch(currentUser._id, {
        usageLimits: {
          ...limits,
          casesCount: limits.casesCount + 1,
        },
      });
    }
    
    return caseId;
  },
});
```

### 5.2 Selector Dinámico de Modelo de IA

```typescript
// convex/agents/case/agent.ts

import { getUserSubscription } from "../stripe/subscriptionUtils";

export const getAgentForUser = async (ctx, userId: Id<"users">) => {
  const subscription = await getUserSubscription(ctx, userId);
  
  const modelToUse = subscription.isPremium 
    ? openai.responses('gpt-5')
    : openai.responses('gpt-4o-mini');
  
  return new Agent(components.agent, {
    name: "iAlex - Agente Legal de tu caso",
    languageModel: modelToUse,
    // ... resto de configuración
  });
};
```

---

## Fase 6: Compra de Créditos de IA (Semana 5)

### 6.1 Función de Compra

```typescript
// convex/stripe/purchaseAICredits.ts

export const purchaseAICredits = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    // Crear sesión de checkout para pago único
    const { url } = await ctx.runAction(internal.stripe.createCheckoutSession.createCheckoutSession, {
      priceId: process.env.STRIPE_PRICE_AI_CREDITS_50!,
      mode: "payment",
    });
    
    return { url };
  },
});
```

### 6.2 Webhook para Créditos

```typescript
// En convex/stripe/webhooks.ts - agregar caso:

async function handleOneTimePayment(ctx, paymentIntent: any) {
  if (paymentIntent.metadata.type === "ai_credits") {
    const userId = paymentIntent.metadata.convexUserId as Id<"users">;
    
    // Registrar compra
    await ctx.db.insert("aiCreditPurchases", {
      userId,
      packSize: 50,
      priceUSD: 3,
      stripePaymentIntentId: paymentIntent.id,
      status: "completed",
      purchasedAt: Date.now(),
      expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 días
    });
    
    // Actualizar créditos del usuario
    const user = await ctx.db.get(userId);
    const currentCredits = user?.aiCredits || { purchased: 0, used: 0 };
    
    await ctx.db.patch(userId, {
      aiCredits: {
        purchased: currentCredits.purchased + 50,
        used: currentCredits.used,
        expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
```

---

## Fase 7: Testing y QA (Semana 6-7)

### 7.1 Tests de Integración

- Test de flujo completo de suscripción
- Test de webhooks con Stripe CLI
- Test de cancelación y reactivación
- Test de límites de plan gratuito
- Test de compra de créditos

### 7.2 Casos de Prueba

1. Usuario gratuito intenta crear 3er caso → Bloqueado
2. Usuario compra Premium → Puede crear casos ilimitados
3. Usuario cancela Premium → Vuelve a límites gratuitos
4. Pago fallido → Estado "past_due"
5. Usuario compra créditos IA → Contador actualizado
6. Equipo alcanza límite de miembros → Bloqueado

---

## Fase 8: Deployment y Monitoreo (Semana 8)

### 8.1 Deployment Checklist

- [ ] Configurar Stripe en producción
- [ ] Crear productos y precios en Stripe prod
- [ ] Configurar webhooks en Stripe prod
- [ ] Variables de entorno en producción
- [ ] Testing en producción con modo test de Stripe
- [ ] Migración de usuarios existentes

### 8.2 Monitoreo

**Métricas clave:**
- Tasa de conversión free → premium
- Churn rate mensual
- MRR (Monthly Recurring Revenue)
- Fallos de pago
- Uso promedio por plan

**Alertas:**
- Webhook failures
- Pagos fallidos
- Errores en checkout

---

## Estimación de Esfuerzo

| Fase | Tiempo | Recursos |
|------|--------|----------|
| Schema & DB | 1 semana | 1 dev backend |
| Stripe Setup | 1 semana | 1 dev backend |
| Backend Functions | 2 semanas | 1 dev backend |
| Frontend UI | 1 semana | 1 dev frontend |
| Feature Protection | 1 semana | 1 dev backend |
| AI Credits | 1 semana | 1 dev backend |
| Testing & QA | 2 semanas | 1 QA + 1 dev |
| Deployment | 1 semana | 1 dev ops |

**Total: 6-8 semanas**  
**Equipo: 2-3 desarrolladores**

---

## Ventajas

- Control total del sistema de facturación
- Flexibilidad completa en pricing
- Sin dependencias de terceros (excepto Stripe)
- Personalización ilimitada
- Sin comisiones extras (solo Stripe)

## Desventajas

- Desarrollo y mantenimiento complejo
- Mayor tiempo de implementación
- Responsabilidad de manejar edge cases
- Necesitas mantener sincronización Stripe ↔ Convex
- Mayor superficie de bugs potenciales

