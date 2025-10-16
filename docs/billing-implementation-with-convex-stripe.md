# Plan de Implementación: Sistema de Facturación con @raideno/convex-stripe

## Resumen Ejecutivo

Este documento detalla la implementación usando la librería `@raideno/convex-stripe`, que automatiza la sincronización Stripe ↔ Convex y proporciona helpers pre-construidos.

**Tiempo estimado:** 3-4 semanas  
**Complejidad:** Media  
**Control:** Alto (no vendor lock-in)

**Librería:** [convex-stripe](https://raideno.github.io/convex-stripe/)  
**Demo:** [convex-stripe-demo.vercel.app](https://convex-stripe-demo.vercel.app/)

---

## Ventajas de esta Aproximación

### Lo que la librería hace por ti:

- ✅ **Sincronización automática** Stripe ↔ Convex
- ✅ **Webhooks pre-configurados** - Manejo de eventos de Stripe
- ✅ **Tablas de Convex** - Schema predefinido (products, prices, customers, subscriptions)
- ✅ **Helper functions** - `setup()`, `subscribe()`, `portal()`, `pay()`
- ✅ **HTTP routes** - Endpoints configurados automáticamente
- ✅ **Type-safe** - Todo tipado con TypeScript
- ✅ **Soporta B2C y B2B** - Usuarios individuales y equipos nativamente

### Lo que debes hacer:

- Feature protection (verificar límites)
- UI de pricing
- Lógica de negocio (qué features por plan)
- Contadores de uso para plan gratuito

---

## Arquitectura del Sistema

### Stack Tecnológico

- **@raideno/convex-stripe** - Librería de integración
- **Stripe** - Procesamiento de pagos
- **Convex** - Base de datos y backend
- **Clerk** - Solo autenticación (sin billing)
- **React/Next.js** - Frontend

### Flujo de Datos

```
Usuario → Clerk Auth → Convex → @raideno/convex-stripe → Stripe
                        ↓              ↓
                  Feature checks   Auto-sync
                        ↓              ↓
                   usageLimits    stripe_* tables
```

---

## Fase 1: Instalación y Configuración (Semana 1 - Días 1-3)

### 1.1 Instalar Dependencias

```bash
# Instalar librería y Stripe SDK
pnpm add @raideno/convex-stripe stripe

# O con npm
npm install @raideno/convex-stripe stripe
```

### 1.2 Configurar Stripe

**En Stripe Dashboard:**

1. Crear productos y precios:

**Producto: Premium Individual**
- Name: "iAlex Premium Individual"
- Precio: $30,000 ARS/mes (recurring)
- Price ID: `price_premium_individual_monthly`
- Metadata:
  ```json
  {
    "plan": "premium_individual",
    "features": "unlimited_cases,unlimited_documents,gpt5_owner"
  }
  ```

**Producto: Premium Equipo**
- Name: "iAlex Premium Equipo"
- Precio: $200,000 ARS/mes (recurring)
- Price ID: `price_premium_team_monthly`
- Metadata:
  ```json
  {
    "plan": "premium_team",
    "features": "unlimited_cases,unlimited_documents,gpt5_all,team_library"
  }
  ```

**Producto: AI Credits Pack**
- Name: "Pack 50 Mensajes IA"
- Precio: $3 USD (one-time)
- Price ID: `price_ai_credits_50`
- Metadata:
  ```json
  {
    "type": "ai_credits",
    "credits": "50"
  }
  ```

2. Configurar webhook:
   - URL: `https://<tu-deployment>.convex.site/stripe/webhook`
   - Eventos: Todos los eventos (la librería los filtra)

3. Habilitar Billing Portal en Stripe Dashboard

### 1.3 Configurar Variables de Entorno

```bash
# En desarrollo
npx convex env set STRIPE_SECRET_KEY "sk_test_..."
npx convex env set STRIPE_WEBHOOK_SECRET "whsec_..."

# También agregar al .env.local para Next.js
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Stripe Price IDs (para el frontend)
NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_INDIVIDUAL=price_premium_individual_monthly
NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_TEAM=price_premium_team_monthly
NEXT_PUBLIC_STRIPE_PRICE_AI_CREDITS_50=price_ai_credits_50
```

### 1.4 Extender Schema de Convex

```typescript
// convex/schema.ts

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { stripeTables } from "@raideno/convex-stripe/server";

export default defineSchema({
  // ✨ Agrega automáticamente:
  // - stripe_products
  // - stripe_prices
  // - stripe_customers
  // - stripe_subscriptions
  // - stripe_invoices
  ...stripeTables,
  
  // Tus tablas existentes
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    // ... otros campos existentes ...
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),
  
  teams: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    // ... otros campos existentes ...
  }),
  
  cases: defineTable({
    // ... campos existentes ...
  }),
  
  // NUEVA TABLA: Límites de uso (solo para usuarios gratuitos)
  usageLimits: defineTable({
    entityId: v.string(), // userId o teamId
    entityType: v.union(v.literal("user"), v.literal("team")),
    
    // Contadores
    casesCount: v.number(),
    documentsCount: v.number(),
    aiMessagesThisMonth: v.number(),
    escritosCount: v.number(),
    libraryDocumentsCount: v.number(),
    storageUsedBytes: v.number(),
    
    // Control de reset mensual
    lastResetDate: v.number(),
    currentMonthStart: v.number(),
  })
    .index("by_entity", ["entityId"])
    .index("by_entity_type", ["entityType"]),
  
  // NUEVA TABLA: Compras de créditos IA
  aiCreditPurchases: defineTable({
    userId: v.id("users"),
    stripeInvoiceId: v.string(),
    creditsAmount: v.number(),
    priceUSD: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    purchasedAt: v.number(),
    expiresAt: v.number(), // 90 días
  })
    .index("by_user", ["userId"])
    .index("by_stripe_invoice", ["stripeInvoiceId"])
    .index("by_status", ["status"]),
  
  // NUEVA TABLA: Créditos disponibles por usuario
  aiCredits: defineTable({
    userId: v.id("users"),
    purchased: v.number(),
    used: v.number(),
    remaining: v.number(),
    expiresAt: v.optional(v.number()),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"]),
});
```

### 1.5 Inicializar la Librería

```typescript
// convex/stripe.ts

import { internalConvexStripe } from "@raideno/convex-stripe/server";

export const { stripe, store, sync, setup } = internalConvexStripe({
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY!,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
});

// IMPORTANTE: Todas estas funciones son internal actions
// No las expongas directamente a los clientes
```

### 1.6 Registrar HTTP Routes

```typescript
// convex/http.ts

import { httpRouter } from "convex/server";
import { stripe } from "./stripe";

const http = httpRouter();

// ✨ Esto registra automáticamente:
// - POST /stripe/webhook (maneja todos los eventos de Stripe)
// - GET /stripe/return/* (return URLs después de checkout)
stripe.addHttpRoutes(http);

export default http;
```

### 1.7 Auto-crear Clientes de Stripe

```typescript
// convex/functions/users.ts

import { internal } from "../_generated/api";

export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Buscar usuario existente
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    
    if (existing) return existing;
    
    // Crear usuario en Convex
    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      isActive: true,
      isOnboardingComplete: false,
    });
    
    // ✨ Crear cliente de Stripe automáticamente
    await ctx.scheduler.runAfter(0, internal.stripe.setup, {
      entityId: userId,
      email: args.email,
      metadata: {
        userName: args.name,
        clerkId: args.clerkId,
      },
    });
    
    // Inicializar límites de uso
    await ctx.db.insert("usageLimits", {
      entityId: userId,
      entityType: "user",
      casesCount: 0,
      documentsCount: 0,
      aiMessagesThisMonth: 0,
      escritosCount: 0,
      libraryDocumentsCount: 0,
      storageUsedBytes: 0,
      lastResetDate: Date.now(),
      currentMonthStart: Date.now(),
    });
    
    return userId;
  },
});
```

### 1.8 Sincronizar Data Existente

**Después de deploy, ejecutar una sola vez:**

1. Ir a Convex Dashboard → Functions
2. Ejecutar `internal.stripe.sync` (sin argumentos)
3. Esto sincroniza productos, precios y suscripciones existentes de Stripe

---

## Fase 2: Funciones de Facturación (Semana 1-2)

### 2.1 Suscripciones de Usuario

```typescript
// convex/billing/subscriptions.ts

import { v } from "convex/values";
import { action } from "../_generated/server";
import { stripe } from "../stripe";
import { internal } from "../_generated/api";

/**
 * Crear checkout para suscripción individual
 */
export const subscribeIndividual = action({
  args: {
    userId: v.id("users"),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verificar autenticación
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    // Verificar que el usuario actual es el que se va a suscribir
    const user = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    if (user._id !== args.userId) {
      throw new Error("No autorizado");
    }
    
    // ✨ Crear sesión de checkout con la librería
    const response = await stripe.subscribe(ctx, {
      entityId: args.userId,
      priceId: args.priceId,
      successUrl: `${process.env.SITE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.SITE_URL}/pricing`,
      metadata: {
        userId: args.userId,
        type: "individual_subscription",
      },
    });
    
    return { url: response.url };
  },
});

/**
 * Crear checkout para suscripción de equipo
 */
export const subscribeTeam = action({
  args: {
    teamId: v.id("teams"),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    // Verificar que usuario es creador del equipo
    const team = await ctx.runQuery(internal.functions.teams.getTeamById, {
      teamId: args.teamId,
    });
    
    const currentUser = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    if (team.createdBy !== currentUser._id) {
      throw new Error("Solo el creador del equipo puede suscribirlo");
    }
    
    // ✨ Crear sesión de checkout para equipo
    const response = await stripe.subscribe(ctx, {
      entityId: args.teamId,
      priceId: args.priceId,
      successUrl: `${process.env.SITE_URL}/teams/${args.teamId}/billing/success`,
      cancelUrl: `${process.env.SITE_URL}/teams/${args.teamId}/settings`,
      metadata: {
        teamId: args.teamId,
        type: "team_subscription",
      },
    });
    
    return { url: response.url };
  },
});

/**
 * Abrir portal de Stripe para gestionar suscripción
 */
export const openBillingPortal = action({
  args: {
    entityId: v.string(),
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    // ✨ Crear sesión del portal
    const response = await stripe.portal(ctx, {
      entityId: args.entityId,
      returnUrl: args.returnUrl || `${process.env.SITE_URL}/settings/billing`,
    });
    
    return { url: response.url };
  },
});

/**
 * Comprar créditos de IA (pago único)
 */
export const purchaseAICredits = action({
  args: {
    userId: v.id("users"),
    priceId: v.string(),
    creditsAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("No autenticado");
    
    const currentUser = await ctx.runQuery(internal.functions.users.getCurrentUser, {
      clerkId: identity.subject,
    });
    
    if (currentUser._id !== args.userId) {
      throw new Error("No autorizado");
    }
    
    // ✨ Crear sesión de pago único
    const response = await stripe.pay(ctx, {
      entityId: args.userId,
      priceId: args.priceId,
      successUrl: `${process.env.SITE_URL}/billing/credits/success`,
      cancelUrl: `${process.env.SITE_URL}/billing/credits`,
      metadata: {
        userId: args.userId,
        type: "ai_credits",
        creditsAmount: args.creditsAmount.toString(),
      },
    });
    
    return { url: response.url };
  },
});
```

### 2.2 Verificación de Planes y Features

```typescript
// convex/billing/features.ts

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Obtener el plan actual de un usuario
 */
export const getUserPlan = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<"free" | "premium_individual"> => {
    // ✨ Consultar tabla de suscripciones (sincronizada por librería)
    const subscription = await ctx.db
      .query("stripe_subscriptions")
      .withIndex("by_customer", (q) => q.eq("customer", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) return "free";
    
    // Obtener el precio
    const price = await ctx.db.get(subscription.price);
    if (!price) return "free";
    
    // Obtener el producto
    const product = await ctx.db.get(price.product);
    if (!product) return "free";
    
    // Verificar metadata del producto
    const plan = product.metadata?.plan;
    if (plan === "premium_individual") return "premium_individual";
    
    return "free";
  },
});

/**
 * Obtener el plan actual de un equipo
 */
export const getTeamPlan = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args): Promise<"free" | "premium_team"> => {
    const subscription = await ctx.db
      .query("stripe_subscriptions")
      .withIndex("by_customer", (q) => q.eq("customer", args.teamId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    
    if (!subscription) return "free";
    
    const price = await ctx.db.get(subscription.price);
    if (!price) return "free";
    
    const product = await ctx.db.get(price.product);
    if (!product) return "free";
    
    if (product.metadata?.plan === "premium_team") return "premium_team";
    
    return "free";
  },
});

/**
 * Verificar si usuario/equipo tiene acceso a una feature
 */
export const hasFeatureAccess = query({
  args: {
    entityId: v.string(),
    entityType: v.union(v.literal("user"), v.literal("team")),
    feature: v.string(),
  },
  handler: async (ctx, args): Promise<{ allowed: boolean; reason?: string }> => {
    // Obtener plan
    let plan: string;
    
    if (args.entityType === "user") {
      plan = await ctx.runQuery(internal.billing.features.getUserPlan, {
        userId: args.entityId as Id<"users">,
      });
    } else {
      plan = await ctx.runQuery(internal.billing.features.getTeamPlan, {
        teamId: args.entityId as Id<"teams">,
      });
    }
    
    // Si es premium, tiene todo
    if (plan === "premium_individual" || plan === "premium_team") {
      return { allowed: true };
    }
    
    // Usuario/equipo gratuito - verificar límites
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();
    
    if (!limits) {
      // Inicializar límites si no existen
      return { allowed: true };
    }
    
    // Verificar límites específicos
    switch (args.feature) {
      case "create_case":
        if (limits.casesCount >= 2) {
          return {
            allowed: false,
            reason: "Plan gratuito limitado a 2 casos. Actualiza a Premium.",
          };
        }
        break;
      
      case "upload_document":
        if (limits.documentsCount >= 10) {
          return {
            allowed: false,
            reason: "Plan gratuito limitado a 10 documentos por caso.",
          };
        }
        break;
      
      case "ai_message":
        // Verificar mensajes + créditos comprados
        const credits = await ctx.db
          .query("aiCredits")
          .withIndex("by_user", (q) => q.eq("userId", args.entityId as Id<"users">))
          .first();
        
        const totalAvailable = 
          (50 - limits.aiMessagesThisMonth) + 
          (credits?.remaining || 0);
        
        if (totalAvailable <= 0) {
          return {
            allowed: false,
            reason: "Límite de mensajes alcanzado. Compra créditos o actualiza a Premium.",
          };
        }
        break;
      
      case "create_escrito":
        if (limits.escritosCount >= 3) {
          return {
            allowed: false,
            reason: "Plan gratuito limitado a 3 escritos por caso.",
          };
        }
        break;
      
      case "create_team":
        return {
          allowed: false,
          reason: "Solo usuarios Premium pueden crear equipos.",
        };
      
      case "gpt5_access":
        return {
          allowed: false,
          reason: "GPT-5 solo disponible en plan Premium.",
        };
    }
    
    return { allowed: true };
  },
});

/**
 * Incrementar contador de uso
 */
export const incrementUsage = mutation({
  args: {
    entityId: v.string(),
    counter: v.union(
      v.literal("casesCount"),
      v.literal("documentsCount"),
      v.literal("aiMessagesThisMonth"),
      v.literal("escritosCount"),
      v.literal("libraryDocumentsCount")
    ),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();
    
    if (!limits) {
      throw new Error("Límites no encontrados");
    }
    
    const increment = args.amount || 1;
    
    await ctx.db.patch(limits._id, {
      [args.counter]: limits[args.counter] + increment,
    });
  },
});

/**
 * Reset mensual de contadores
 */
export const resetMonthlyCounters = mutation({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    const limits = await ctx.db
      .query("usageLimits")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .first();
    
    if (!limits) return;
    
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Solo resetear si pasó un mes
    if (limits.currentMonthStart < oneMonthAgo) {
      await ctx.db.patch(limits._id, {
        aiMessagesThisMonth: 0,
        currentMonthStart: now,
        lastResetDate: now,
      });
    }
  },
});
```

---

## Fase 3: Protección de Features (Semana 2)

### 3.1 Actualizar Mutaciones Existentes

```typescript
// convex/functions/cases.ts

import { internal } from "../_generated/api";

export const createCase = mutation({
  args: {
    title: v.string(),
    // ... otros args ...
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // ✅ VERIFICAR ACCESO
    const access = await ctx.runQuery(internal.billing.features.hasFeatureAccess, {
      entityId: currentUser._id,
      entityType: "user",
      feature: "create_case",
    });
    
    if (!access.allowed) {
      throw new Error(access.reason || "No tienes acceso a esta funcionalidad");
    }
    
    // Crear caso
    const caseId = await ctx.db.insert("cases", {
      title: args.title,
      // ... resto de campos ...
      createdBy: currentUser._id,
    });
    
    // ✅ INCREMENTAR CONTADOR (solo para usuarios gratuitos)
    const plan = await ctx.runQuery(internal.billing.features.getUserPlan, {
      userId: currentUser._id,
    });
    
    if (plan === "free") {
      await ctx.runMutation(internal.billing.features.incrementUsage, {
        entityId: currentUser._id,
        counter: "casesCount",
      });
    }
    
    return caseId;
  },
});
```

### 3.2 Selector Dinámico de Modelo de IA

```typescript
// convex/agents/utils/getModelForUser.ts

import { openai } from "@ai-sdk/openai";
import { internal } from "../_generated/api";

export async function getAIModelForUser(
  ctx: ActionCtx,
  userId: Id<"users">
) {
  const plan = await ctx.runQuery(internal.billing.features.getUserPlan, {
    userId,
  });
  
  // Premium users get GPT-5
  if (plan === "premium_individual") {
    return openai.responses('gpt-5');
  }
  
  // Free users get GPT-4o-mini
  return openai.responses('gpt-4o-mini');
}

export async function getAIModelForTeam(
  ctx: ActionCtx,
  teamId: Id<"teams">
) {
  const plan = await ctx.runQuery(internal.billing.features.getTeamPlan, {
    teamId,
  });
  
  // Premium team - all members get GPT-5
  if (plan === "premium_team") {
    return openai.responses('gpt-5');
  }
  
  // Free team - GPT-4o-mini
  return openai.responses('gpt-4o-mini');
}
```

### 3.3 Webhook Handler Personalizado (Opcional)

```typescript
// convex/billing/webhookHandlers.ts

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Handler para cuando se completa un pago de créditos IA
 * Nota: Los webhooks principales los maneja la librería automáticamente
 */
export const handleAICreditsPurchase = internalMutation({
  args: {
    invoiceId: v.string(),
    userId: v.id("users"),
    creditsAmount: v.number(),
  },
  handler: async (ctx, args) => {
    // Registrar compra
    await ctx.db.insert("aiCreditPurchases", {
      userId: args.userId,
      stripeInvoiceId: args.invoiceId,
      creditsAmount: args.creditsAmount,
      priceUSD: 3,
      status: "completed",
      purchasedAt: Date.now(),
      expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000), // 90 días
    });
    
    // Actualizar créditos disponibles
    const existingCredits = await ctx.db
      .query("aiCredits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (existingCredits) {
      await ctx.db.patch(existingCredits._id, {
        purchased: existingCredits.purchased + args.creditsAmount,
        remaining: existingCredits.remaining + args.creditsAmount,
        lastUpdated: Date.now(),
      });
    } else {
      await ctx.db.insert("aiCredits", {
        userId: args.userId,
        purchased: args.creditsAmount,
        used: 0,
        remaining: args.creditsAmount,
        expiresAt: Date.now() + (90 * 24 * 60 * 60 * 1000),
        lastUpdated: Date.now(),
      });
    }
  },
});
```

---

## Fase 4: Frontend - UI (Semana 3)

### 4.1 Página de Precios

```tsx
// app/pricing/page.tsx

"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export default function PricingPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState<string | null>(null);
  
  const subscribeIndividual = useAction(api.billing.subscriptions.subscribeIndividual);
  
  const handleSubscribe = async (priceId: string, planType: string) => {
    if (!user) {
      // Redirigir a login
      window.location.href = "/sign-in?redirect=/pricing";
      return;
    }
    
    setLoading(planType);
    
    try {
      const { url } = await subscribeIndividual({
        userId: user.id as any, // Convex user ID
        priceId,
      });
      
      window.location.href = url;
    } catch (error) {
      console.error("Error:", error);
      alert("Error al procesar suscripción");
    } finally {
      setLoading(null);
    }
  };
  
  return (
    <div className="container mx-auto py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Elige el plan perfecto para ti
        </h1>
        <p className="text-xl text-muted-foreground">
          Comienza gratis, actualiza cuando lo necesites
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Plan Gratuito */}
        <Card className="p-8">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">Gratuito</h3>
            <div className="text-4xl font-bold mb-1">$0</div>
            <div className="text-muted-foreground">para siempre</div>
          </div>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>2 casos activos</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>10 documentos por caso</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>50 mensajes IA/mes</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>IA básica (GPT-4o-mini)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>500 MB almacenamiento</span>
            </li>
          </ul>
          
          <Button variant="outline" className="w-full" disabled>
            Plan Actual
          </Button>
        </Card>
        
        {/* Premium Individual */}
        <Card className="p-8 border-2 border-primary relative">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
            Más Popular
          </div>
          
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">Premium Individual</h3>
            <div className="text-4xl font-bold mb-1">$30.000</div>
            <div className="text-muted-foreground">por mes</div>
          </div>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span className="font-medium">Todo lo de Gratuito, más:</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Casos ilimitados</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Documentos ilimitados</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>IA avanzada (GPT-5)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Mensajes IA ilimitados</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>50 GB almacenamiento</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Crear equipo (3 personas)</span>
            </li>
          </ul>
          
          <Button 
            className="w-full"
            onClick={() => handleSubscribe(
              process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM_INDIVIDUAL!,
              "individual"
            )}
            disabled={loading === "individual"}
          >
            {loading === "individual" ? "Procesando..." : "Comenzar Ahora"}
          </Button>
        </Card>
        
        {/* Premium Equipo */}
        <Card className="p-8">
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">Premium Equipo</h3>
            <div className="text-4xl font-bold mb-1">$200.000</div>
            <div className="text-muted-foreground">por mes</div>
          </div>
          
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span className="font-medium">Todo lo de Individual, más:</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>GPT-5 para todos</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Hasta 6 miembros</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>200 GB compartidos</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Biblioteca de equipo</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Panel de administración</span>
            </li>
          </ul>
          
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {/* Navigate to team creation */}}
          >
            Contactar Ventas
          </Button>
        </Card>
      </div>
      
      {/* Sección de Créditos IA */}
      <div className="mt-16 max-w-2xl mx-auto">
        <Card className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">
            ¿Necesitas más mensajes IA?
          </h3>
          <p className="text-muted-foreground mb-6">
            Compra packs adicionales de 50 mensajes por solo $3 USD
          </p>
          <Button>
            Comprar Créditos
          </Button>
        </Card>
      </div>
    </div>
  );
}
```

### 4.2 Dashboard de Facturación

```tsx
// app/settings/billing/page.tsx

"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingPage() {
  const { userId } = useAuth();
  const openPortal = useAction(api.billing.subscriptions.openBillingPortal);
  
  // Obtener plan actual
  const plan = useQuery(
    api.billing.features.getUserPlan,
    userId ? { userId: userId as any } : "skip"
  );
  
  // Obtener límites de uso
  const limits = useQuery(
    api.billing.features.getUsageLimits,
    userId ? { entityId: userId } : "skip"
  );
  
  const handleManageBilling = async () => {
    const { url } = await openPortal({
      entityId: userId!,
    });
    window.location.href = url;
  };
  
  if (!userId || !plan) return <div>Cargando...</div>;
  
  return (
    <div className="container mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Facturación y Suscripción</h1>
      
      {/* Plan Actual */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Plan Actual</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">
              {plan === "free" ? "Gratuito" : "Premium Individual"}
            </p>
            {plan === "premium_individual" && (
              <p className="text-muted-foreground">
                $30.000/mes
              </p>
            )}
          </div>
          
          {plan === "premium_individual" && (
            <Button onClick={handleManageBilling}>
              Gestionar Suscripción
            </Button>
          )}
          
          {plan === "free" && (
            <Button onClick={() => window.location.href = "/pricing"}>
              Actualizar a Premium
            </Button>
          )}
        </div>
      </Card>
      
      {/* Uso Actual (solo para plan gratuito) */}
      {plan === "free" && limits && (
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Uso del Plan Gratuito</h2>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Casos</span>
                <span className="font-medium">{limits.casesCount} / 2</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(limits.casesCount / 2) * 100}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span>Documentos</span>
                <span className="font-medium">{limits.documentsCount} / 10</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(limits.documentsCount / 10) * 100}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex justify-between mb-2">
                <span>Mensajes IA este mes</span>
                <span className="font-medium">{limits.aiMessagesThisMonth} / 50</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${(limits.aiMessagesThisMonth / 50) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
```

---

## Fase 5: Testing (Semana 3-4)

### 5.1 Tests de Integración

**Casos de prueba:**

1. **Creación de usuario**
   - Usuario se registra → Cliente de Stripe creado automáticamente
   - Verificar en Stripe Dashboard

2. **Suscripción individual**
   - Usuario compra Premium → Webhook recibido → Tabla actualizada
   - Usuario puede crear casos ilimitados

3. **Límites de plan gratuito**
   - Usuario crea 2 casos → Tercer intento bloqueado
   - Usuario sube 10 docs → Undécimo bloqueado

4. **Compra de créditos IA**
   - Usuario compra pack → Créditos agregados
   - Usar créditos → Contador decrementado

5. **Suscripción de equipo**
   - Crear equipo → Suscribir → Todos los miembros tienen GPT-5

### 5.2 Testing con Stripe CLI

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks a local
stripe listen --forward-to localhost:3000/stripe/webhook

# Trigger eventos de prueba
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
```

---

## Fase 6: Deployment (Semana 4)

### 6.1 Configuración Production

```bash
# Convex Production
npx convex env set --prod STRIPE_SECRET_KEY "sk_live_..."
npx convex env set --prod STRIPE_WEBHOOK_SECRET "whsec_..."

# Deploy
npx convex deploy

# Ejecutar sync una vez
# Ir a Dashboard → Functions → internal.stripe.sync
```

### 6.2 Stripe Production

1. Cambiar a modo live en Stripe
2. Crear productos y precios en live mode
3. Actualizar webhook URL a producción
4. Actualizar variables de entorno en Vercel/hosting

---

## Estimación de Esfuerzo

| Fase | Días | Recursos |
|------|------|----------|
| Instalación y setup | 3-4 | 1 dev backend |
| Funciones de facturación | 5-7 | 1 dev backend |
| Protección de features | 3-5 | 1 dev backend |
| Frontend UI | 3-4 | 1 dev frontend |
| Testing | 5-7 | 1 QA + 1 dev |
| Deployment | 2-3 | 1 dev ops |

**Total: 3-4 semanas**  
**Equipo: 2 desarrolladores**

---

## Ventajas vs Otras Opciones

### vs Clerk Billing
- ✅ Ahorro de 0.7% en fees
- ✅ Soporta equipos nativamente
- ✅ No vendor lock-in
- ✅ Compra de créditos one-time
- ❌ 1 semana más de desarrollo

### vs Stripe Custom
- ✅ 50% menos tiempo (3-4 sem vs 6-8)
- ✅ 65% menos código (~1,200 vs ~3,500 líneas)
- ✅ Webhooks auto-manejados
- ✅ Sync automático
- ✅ Mantenimiento reducido

---

## Recursos

- **Documentación**: https://raideno.github.io/convex-stripe/
- **Demo**: https://convex-stripe-demo.vercel.app/
- **GitHub**: https://github.com/raideno/convex-stripe
- **Stripe Docs**: https://stripe.com/docs
- **Convex Docs**: https://docs.convex.dev

---

## Conclusión

Esta aproximación con `@raideno/convex-stripe` ofrece el mejor balance entre:
- Velocidad de implementación (3-4 semanas)
- Costos operacionales (solo Stripe fees)
- Flexibilidad (soporta usuarios y equipos)
- Mantenibilidad (librería mantenida activamente)

Es la **opción recomendada** para iAlex si quieres lanzar rápido sin comprometer flexibilidad ni pagar fees adicionales de Clerk Billing.

