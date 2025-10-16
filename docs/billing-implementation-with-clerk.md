# Plan de Implementación: Sistema de Facturación con Clerk Billing

## Resumen Ejecutivo

Este documento detalla la implementación de suscripciones utilizando Clerk Billing (Beta), aprovechando su integración nativa con Clerk Auth.

**Tiempo estimado:** 2-3 semanas  
**Complejidad:** Media  
**Control:** Limitado pero más simple

---

## Arquitectura del Sistema

### Stack Tecnológico

- **Clerk Billing** - Gestión de planes, features y suscripciones
- **Stripe** - Procesamiento de pagos (manejado por Clerk)
- **Convex** - Base de datos y lógica de backend
- **Clerk Auth** - Autenticación (ya implementado)

### Flujo de Datos

```
Usuario → Clerk Auth → Clerk Billing → Stripe
                ↓           ↓
              Convex    Webhooks
                ↓
           Feature Checks
```

---

## Limitaciones de Clerk Billing

### Lo que Clerk Billing NO puede hacer

1. **No soporta equipos personalizados directamente**
   - Clerk Billing B2C es solo para usuarios individuales
   - Clerk Billing B2B usa sus propias "Organizations", no nuestros equipos
   
2. **No permite facturación dual (usuario + equipo)**
   - Es B2C o B2B, no ambos simultáneamente
   
3. **No soporta compra de créditos one-time**
   - Solo suscripciones recurrentes

### Solución Híbrida Requerida

Usaremos **Clerk Billing para usuarios individuales** + **Stripe directo para equipos**.

---

## Fase 1: Configuración de Clerk Dashboard (Semana 1)

### 1.1 Habilitar Billing en Clerk

1. Ir a Clerk Dashboard → Billing Settings
2. Enable Billing (Beta)
3. Seleccionar gateway:
   - Development: Usar "Clerk development gateway" (para testing)
   - Production: Conectar cuenta de Stripe propia

### 1.2 Crear Features en Clerk

Navegar a: Clerk Dashboard → Billing → Features

Crear las siguientes features:

**unlimited_cases**
- Name: "Casos Ilimitados"
- Description: "Crear casos sin límite"
- Publicly available: Yes

**unlimited_documents**
- Name: "Documentos Ilimitados"
- Description: "Subir documentos sin límite"
- Publicly available: Yes

**gpt5_access**
- Name: "Acceso a GPT-5"
- Description: "Usar modelo GPT-5 avanzado"
- Publicly available: Yes

**unlimited_ai_messages**
- Name: "Mensajes IA Ilimitados"
- Description: "Sin límite de conversaciones con IA"
- Publicly available: Yes

**unlimited_escritos**
- Name: "Escritos Ilimitados"
- Description: "Crear escritos legales sin límite"
- Publicly available: Yes

**private_templates**
- Name: "Plantillas Privadas"
- Description: "Crear y usar plantillas privadas"
- Publicly available: Yes

**legal_db_unlimited**
- Name: "Base de Datos Legal Ilimitada"
- Description: "Búsquedas ilimitadas en legislación"
- Publicly available: Yes

**semantic_search**
- Name: "Búsqueda Inteligente"
- Description: "Búsqueda semántica con IA"
- Publicly available: Yes

**pdf_exports**
- Name: "Exportar a PDF"
- Description: "Exportar documentos y escritos"
- Publicly available: Yes

**50gb_storage**
- Name: "50 GB Almacenamiento"
- Description: "Espacio de almacenamiento extendido"
- Publicly available: Yes

**create_small_team**
- Name: "Crear Equipo Pequeño"
- Description: "Crear equipo de hasta 3 personas"
- Publicly available: Yes

**invite_external_user**
- Name: "Invitar Usuario Externo"
- Description: "Invitar usuarios externos a casos"
- Publicly available: Yes

### 1.3 Crear Plans en Clerk

Navegar a: Clerk Dashboard → Billing → Plans → Plans for Users

**Plan: Free**
- Name: "Plan Gratuito"
- Description: "Para empezar con iAlex"
- Price: $0/month
- Publicly available: Yes
- Features: (ninguna - todas bloqueadas)

**Plan: Premium Individual**
- Name: "Premium Individual"
- Description: "Para abogados profesionales"
- Price: $30,000 ARS/month (o USD equivalente)
- Publicly available: Yes
- Features: Agregar todas las 12 features creadas arriba

### 1.4 Configurar Stripe (si usas tu propia cuenta)

1. Conectar cuenta de Stripe en Clerk Dashboard
2. Clerk creará automáticamente los productos en Stripe
3. Los precios se sincronizan automáticamente

---

## Fase 2: Schema de Convex - Simplificado (Semana 1)

### 2.1 Extensión Mínima de Users Table

```typescript
// convex/schema.ts

users: defineTable({
  // ... campos existentes de Clerk ...
  
  // LÍMITES DE USO (solo para plan gratuito)
  usageLimits: v.optional(v.object({
    casesCount: v.number(),
    documentsCount: v.number(),
    aiMessagesThisMonth: v.number(),
    lastResetDate: v.number(),
    storageUsedBytes: v.number(),
    libraryDocumentsCount: v.number(),
    escritosCount: v.number(),
  })),
  
  // CRÉDITOS DE IA (compra directa vía Stripe)
  aiCredits: v.optional(v.object({
    purchased: v.number(),
    used: v.number(),
    expiresAt: v.optional(v.number()),
  })),
})
```

### 2.2 Tabla para Suscripciones de Equipo (Stripe directo)

```typescript
// convex/schema.ts - Nueva tabla para equipos (no usa Clerk)

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
    v.literal("trialing")
  ),
  
  // Stripe (manejado directamente, no por Clerk)
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.string(),
  stripePriceId: v.string(),
  
  billingOwnerId: v.id("users"),
  billingEmail: v.string(),
  
  currentPeriodStart: v.number(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  
  maxMembers: v.number(),
  maxStorageGB: v.number(),
  
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_team", ["teamId"])
.index("by_billing_owner", ["billingOwnerId"])
.index("by_stripe_subscription_id", ["stripeSubscriptionId"])
```

### 2.3 Tabla para Créditos IA (Stripe directo)

```typescript
aiCreditPurchases: defineTable({
  userId: v.id("users"),
  packSize: v.number(),
  priceUSD: v.number(),
  stripePaymentIntentId: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("failed")
  ),
  purchasedAt: v.number(),
  expiresAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_status", ["status"])
```

---

## Fase 3: Backend - Verificación de Features (Semana 1-2)

### 3.1 Utilidades con Clerk Billing

```typescript
// convex/billing/clerkUtils.ts

import { auth } from "@clerk/nextjs/server";

export async function checkUserFeature(feature: string): Promise<boolean> {
  const { has } = await auth();
  return has({ feature });
}

export async function requireFeature(feature: string, errorMessage: string) {
  const hasFeature = await checkUserFeature(feature);
  if (!hasFeature) {
    throw new Error(errorMessage);
  }
}
```

### 3.2 Verificación de Límites para Plan Gratuito

```typescript
// convex/billing/limits.ts

export async function checkFeatureAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  feature: string
): Promise<{ allowed: boolean; reason?: string }> {
  
  const user = await ctx.db.get(userId);
  
  // Obtener info de Clerk sobre features
  // Nota: En el servidor de Convex necesitamos el clerkId
  const clerkId = user?.clerkId;
  if (!clerkId) {
    throw new Error("Usuario no tiene Clerk ID");
  }
  
  // IMPORTANTE: Clerk Billing verifica features en el cliente
  // En el servidor, asumimos que el cliente ya verificó
  // Aquí solo verificamos límites numéricos para usuarios gratuitos
  
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
          reason: "Plan gratuito limitado a 10 documentos por caso." 
        };
      }
      break;
      
    case "ai_message":
      const totalMessages = 
        limits.aiMessagesThisMonth + 
        (user?.aiCredits?.purchased || 0) - 
        (user?.aiCredits?.used || 0);
        
      if (totalMessages >= 50) {
        return { 
          allowed: false, 
          reason: "Límite mensual alcanzado. Compra créditos o upgrade." 
        };
      }
      break;
  }
  
  return { allowed: true };
}
```

### 3.3 Funciones de Stripe para Equipos

```typescript
// convex/stripe/teamSubscriptions.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export const createTeamCheckout = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    // Verificar que usuario es owner del equipo
    const team = await ctx.runQuery(internal.functions.teams.getTeamById, {
      teamId: args.teamId,
    });
    
    if (team.createdBy !== user._id) {
      throw new Error("Solo el creador del equipo puede suscribirse");
    }
    
    // Crear o recuperar Stripe Customer para el equipo
    const customer = await stripe.customers.create({
      email: identity.email!,
      metadata: {
        convexUserId: user._id,
        convexTeamId: args.teamId,
        type: "team",
      },
    });
    
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: args.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/teams/${args.teamId}/billing/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/teams/${args.teamId}/billing`,
      metadata: {
        convexUserId: user._id,
        convexTeamId: args.teamId,
        type: "team_subscription",
      },
    });
    
    return { url: session.url };
  },
});

export const purchaseAICredits = action({
  args: {
    packSize: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_AI_CREDITS_50!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/credits/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/credits`,
      metadata: {
        convexUserId: user._id,
        type: "ai_credits",
        packSize: args.packSize.toString(),
      },
    });
    
    return { url: session.url };
  },
});
```

### 3.4 Webhook Handler (solo para equipos y créditos)

```typescript
// convex/http.ts
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
      console.error("Webhook error:", err);
      return new Response("Invalid signature", { status: 400 });
    }
    
    // Solo procesar eventos de equipos y créditos
    // Clerk maneja los eventos de suscripciones individuales
    const metadata = (event.data.object as any).metadata;
    
    if (metadata?.type === "team_subscription" || metadata?.type === "ai_credits") {
      await ctx.runMutation(internal.stripe.webhooks.handleStripeEvent, {
        event: JSON.stringify(event),
      });
    }
    
    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

```typescript
// convex/stripe/webhooks.ts

export const handleStripeEvent = internalMutation({
  args: { event: v.string() },
  handler: async (ctx, args) => {
    const event = JSON.parse(args.event);
    const metadata = event.data.object.metadata;
    
    // Solo manejar eventos de equipos y créditos
    if (metadata.type === "team_subscription") {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleTeamSubscriptionUpdate(ctx, event.data.object);
          break;
          
        case "customer.subscription.deleted":
          await handleTeamSubscriptionDeleted(ctx, event.data.object);
          break;
      }
    } else if (metadata.type === "ai_credits") {
      if (event.type === "payment_intent.succeeded") {
        await handleAICreditsPurchase(ctx, event.data.object);
      }
    }
  },
});

async function handleTeamSubscriptionUpdate(ctx, subscription: any) {
  const teamId = subscription.metadata.convexTeamId as Id<"teams">;
  
  const existing = await ctx.db
    .query("teamSubscriptions")
    .withIndex("by_team", (q) => q.eq("teamId", teamId))
    .first();
  
  const subscriptionData = {
    plan: "premium_team" as const,
    status: subscription.status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0].price.id,
    billingOwnerId: subscription.metadata.convexUserId as Id<"users">,
    billingEmail: subscription.customer_email,
    currentPeriodStart: subscription.current_period_start * 1000,
    currentPeriodEnd: subscription.current_period_end * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    maxMembers: 6,
    maxStorageGB: 200,
    updatedAt: Date.now(),
  };
  
  if (existing) {
    await ctx.db.patch(existing._id, subscriptionData);
  } else {
    await ctx.db.insert("teamSubscriptions", {
      ...subscriptionData,
      teamId,
      createdAt: Date.now(),
    });
  }
}

async function handleAICreditsPurchase(ctx, paymentIntent: any) {
  const userId = paymentIntent.metadata.convexUserId as Id<"users">;
  const packSize = parseInt(paymentIntent.metadata.packSize);
  
  await ctx.db.insert("aiCreditPurchases", {
    userId,
    packSize,
    priceUSD: 3,
    stripePaymentIntentId: paymentIntent.id,
    status: "completed",
    purchasedAt: Date.now(),
    expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
  });
  
  const user = await ctx.db.get(userId);
  const currentCredits = user?.aiCredits || { purchased: 0, used: 0 };
  
  await ctx.db.patch(userId, {
    aiCredits: {
      purchased: currentCredits.purchased + packSize,
      used: currentCredits.used,
      expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
    },
  });
}
```

---

## Fase 4: Frontend - Componentes (Semana 2)

### 4.1 Página de Precios (usa componente de Clerk)

```tsx
// app/pricing/page.tsx

import { PricingTable } from '@clerk/nextjs';

export default function PricingPage() {
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold text-center mb-12">
        Elige tu plan
      </h1>
      
      {/* Clerk maneja todo el UI y checkout para planes individuales */}
      <PricingTable />
      
      {/* Plan de Equipo - custom (no usa Clerk) */}
      <div className="mt-12">
        <h2 className="text-3xl font-bold text-center mb-8">
          Para Equipos
        </h2>
        
        <TeamPricingCard />
      </div>
    </div>
  );
}
```

### 4.2 Card de Pricing para Equipos (Custom)

```tsx
// components/billing/TeamPricingCard.tsx

"use client";

import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function TeamPricingCard() {
  const createTeamCheckout = useAction(api.stripe.teamSubscriptions.createTeamCheckout);
  
  const handleSubscribe = async () => {
    // Necesitas tener un equipo creado primero
    const teamId = "..."; // Obtener del contexto o props
    
    const { url } = await createTeamCheckout({
      teamId,
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_TEAM!,
    });
    
    window.location.href = url;
  };
  
  return (
    <Card className="p-6 max-w-md mx-auto">
      <h3 className="text-2xl font-bold mb-4">Premium Equipo</h3>
      <p className="text-4xl font-bold mb-6">
        $200.000<span className="text-lg">/mes</span>
      </p>
      
      <ul className="space-y-3 mb-6">
        <li>✓ Todo lo de Premium Individual</li>
        <li>✓ GPT-5 para todos</li>
        <li>✓ Hasta 6 miembros</li>
        <li>✓ 200 GB compartidos</li>
        <li>✓ Biblioteca de equipo</li>
        <li>✓ Panel de admin</li>
      </ul>
      
      <Button className="w-full" onClick={handleSubscribe}>
        Suscribir Equipo
      </Button>
    </Card>
  );
}
```

### 4.3 Protección de Rutas con Clerk

```tsx
// app/premium-content/page.tsx

import { Protect } from '@clerk/nextjs';

export default function PremiumContentPage() {
  return (
    <Protect
      feature="unlimited_cases"
      fallback={
        <div className="text-center p-12">
          <h1 className="text-2xl mb-4">Contenido Premium</h1>
          <p>Necesitas Premium Individual para acceder.</p>
          <a href="/pricing" className="text-primary underline">
            Ver planes
          </a>
        </div>
      }
    >
      <h1>Contenido Premium</h1>
      <p>Este contenido solo es visible para usuarios Premium.</p>
    </Protect>
  );
}
```

### 4.4 Billing Dashboard del Usuario

```tsx
// app/settings/billing/page.tsx

"use client";

import { UserProfile } from '@clerk/nextjs';

export default function BillingPage() {
  return (
    <div className="container mx-auto py-12">
      {/* Clerk UserProfile ya incluye sección de billing */}
      <UserProfile />
      
      {/* Custom: Compra de créditos IA */}
      <div className="mt-8">
        <AICreditsPurchase />
      </div>
    </div>
  );
}
```

---

## Fase 5: Protección de Features (Semana 2-3)

### 5.1 Protección en el Cliente (UI)

```tsx
// components/cases/CreateCaseButton.tsx

"use client";

import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export function CreateCaseButton() {
  const { has } = useAuth();
  
  const canCreateUnlimited = has({ feature: 'unlimited_cases' });
  
  if (!canCreateUnlimited) {
    return (
      <Button disabled>
        Upgrade para crear más casos
      </Button>
    );
  }
  
  return (
    <Button onClick={handleCreateCase}>
      Crear Caso
    </Button>
  );
}
```

### 5.2 Protección en el Servidor (Mutations)

```typescript
// convex/functions/cases.ts

export const createCase = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // NOTA: Clerk features se verifican en el cliente
    // Aquí solo verificamos límites numéricos para free users
    
    const access = await checkFeatureAccess(ctx, currentUser._id, "create_case");
    if (!access.allowed) {
      throw new Error(access.reason);
    }
    
    // Crear caso
    const caseId = await ctx.db.insert("cases", { /* ... */ });
    
    // Incrementar contador solo si no es premium
    // (Clerk ya maneja el estado de suscripción)
    const limits = currentUser.usageLimits || { casesCount: 0, /* ... */ };
    await ctx.db.patch(currentUser._id, {
      usageLimits: {
        ...limits,
        casesCount: limits.casesCount + 1,
      },
    });
    
    return caseId;
  },
});
```

### 5.3 Selector de Modelo IA

```typescript
// lib/getAIModel.ts

import { auth } from '@clerk/nextjs/server';
import { openai } from '@ai-sdk/openai';

export async function getAIModelForUser() {
  const { has } = await auth();
  
  const hasGPT5 = has({ feature: 'gpt5_access' });
  
  return hasGPT5 
    ? openai.responses('gpt-5')
    : openai.responses('gpt-4o-mini');
}
```

---

## Fase 6: Testing (Semana 3)

### 6.1 Test Mode de Clerk

- Usar Clerk development gateway en dev
- Crear suscripciones de prueba
- Verificar feature checks
- Probar límites de plan gratuito

### 6.2 Test de Stripe para Equipos

- Usar Stripe test mode
- Webhook testing con Stripe CLI
- Probar flujo de suscripción de equipo
- Probar compra de créditos IA

---

## Fase 7: Deployment (Semana 3)

### 7.1 Configuración Production

**Clerk:**
- Cambiar a production gateway
- Conectar Stripe account en producción
- Verificar products y prices sincronizados

**Stripe:**
- Configurar webhook en producción para equipos
- Variables de entorno actualizadas

**Convex:**
- Deploy funciones
- Migración de datos si es necesario

---

## Comparación: Con Clerk vs Sin Clerk

| Aspecto | Con Clerk Billing | Sin Clerk Billing |
|---------|------------------|-------------------|
| Tiempo | 2-3 semanas | 6-8 semanas |
| Complejidad | Media | Alta |
| UI Pricing | Built-in | Custom |
| UI Billing | Built-in | Custom |
| Webhooks | Solo equipos | Todos |
| Schema | Mínimo | Extenso |
| Flexibilidad | Limitada | Total |
| Mantenimiento | Bajo | Alto |
| Equipos | Requiere híbrido | Nativo |
| Créditos IA | Stripe directo | Stripe directo |
| Costos extra | 0.7% Clerk | Solo Stripe |

---

## Ventajas de Usar Clerk Billing

1. Implementación rápida (2-3 semanas vs 6-8)
2. UI de pricing y billing incluido
3. Menos código custom
4. Feature checks simples con `has()`
5. Integración perfecta con Clerk Auth
6. Mantenimiento reducido
7. Testing más simple

## Desventajas

1. Solo funciona para usuarios individuales (B2C)
2. No soporta facturación dual nativa
3. Requiere híbrido con Stripe para equipos
4. Menos control sobre UX de billing
5. Dependencia de Clerk (vendor lock-in)
6. Features limitadas a modelo de suscripción
7. Costo adicional 0.7% por transacción

---

## Recomendación Final

**Usa Clerk Billing si:**
- Quieres lanzar rápido (MVP)
- La mayoría de tus usuarios son individuales
- No necesitas customización extrema
- Valoras simplicidad sobre control

**Usa Stripe Directo si:**
- Equipos son tu mercado principal
- Necesitas facturación dual compleja
- Requieres control total del flujo
- Tienes recursos de desarrollo

**Híbrido (Recomendado para iAlex):**
- Clerk Billing para individuales
- Stripe directo para equipos
- Best of both worlds
- 70% menos código que full custom

