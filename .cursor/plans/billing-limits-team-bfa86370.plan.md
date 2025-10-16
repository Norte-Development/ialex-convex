<!-- bfa86370-52db-4d98-b014-f8f15c4407f1 2fae5c52-ed4b-475c-93f6-5241d65b7c98 -->
# Fix Billing Limits for Team Context

## Audit Summary

### Critical Issues Found

**1. All usage tracking is hardcoded to user only**

- Every `incrementUsage` call passes `currentUser._id` regardless of context
- Files: `cases.ts:107`, `documents.ts:274,280,645`, `libraryDocument.ts:218,224`

**2. All limit checks use user plan only**

- `createCase` (line 58-67), `createDocument` (line 200-214), `createEscrito` (line 611-626), `createLibraryDocument` (line 136-150)
- All check `_getUserPlan(ctx, currentUser._id)` and user's `usageLimits`
- Ignores team context even when `teamId` parameter exists

**3. `hasFeatureAccess` uses wrong plan for team context**

- Line 330: Uses `_getUserPlan(ctx, team.createdBy)` instead of `_getTeamPlan(ctx, args.teamId)`
- Doesn't check team usage limits, only user limits (line 377)

**4. `_incrementUsage` hardcodes entityType**

- Line 166: Always passes `"user"` to `_getOrCreateUsageLimits`
- Cannot track team usage even if we passed teamId

**5. Case `teamId` parameter is ignored**

- `createCase` accepts `teamId` but never uses it for limits or ownership
- Cases don't track which team they belong to in schema

**6. Massive code duplication**

- Every function duplicates the same limit-checking logic
- No centralized helper to determine billing entity

## Implementation Plan

### Step 1: Create Unified Billing Entity Helper

**File:** `apps/application/convex/billing/features.ts`

Add new exported helper function (after `_getModelForUser`):

```typescript
/**
 * Determines which entity (user or team) should be billed for an action
 * Based on business rules:
 * - If teamId provided, use team limits
 * - Otherwise use user's personal limits
 */
export async function _getBillingEntity(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    teamId?: Id<"teams">;
  }
): Promise<{
  entityId: string;
  entityType: "user" | "team";
  plan: PlanType;
}> {
  if (args.teamId) {
    const plan = await _getTeamPlan(ctx, args.teamId);
    return {
      entityId: args.teamId,
      entityType: "team",
      plan,
    };
  }
  
  const plan = await _getUserPlan(ctx, args.userId);
  return {
    entityId: args.userId,
    entityType: "user",
    plan,
  };
}
```

### Step 2: Create Unified Limit Check Helper

**File:** `apps/application/convex/billing/features.ts`

Add comprehensive limit checking helper:

```typescript
/**
 * Checks if an action is allowed based on billing limits
 * Throws detailed error if limit exceeded
 */
export async function _checkLimit(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    teamId?: Id<"teams">;
    limitType: "cases" | "documentsPerCase" | "escritosPerCase" | "libraryDocuments" | "storageGB";
    currentCount?: number; // For per-case limits
    additionalBytes?: number; // For storage checks
  }
): Promise<void> {
  const billing = await _getBillingEntity(ctx, { userId: args.userId, teamId: args.teamId });
  const limits = PLAN_LIMITS[billing.plan];
  const usage = await _getOrCreateUsageLimits(ctx, billing.entityId, billing.entityType);
  
  // Check specific limit type
  switch (args.limitType) {
    case "cases":
      if (usage.casesCount >= limits.cases) {
        throw new Error(
          `Límite de ${limits.cases} casos alcanzado. Actualiza a Premium para casos ilimitados.`
        );
      }
      break;
    
    case "documentsPerCase":
      if (args.currentCount !== undefined && args.currentCount >= limits.documentsPerCase) {
        throw new Error(
          `Límite de ${limits.documentsPerCase} documentos por caso alcanzado.`
        );
      }
      break;
    
    case "escritosPerCase":
      if (args.currentCount !== undefined && args.currentCount >= limits.escritosPerCase) {
        throw new Error(
          `Límite de ${limits.escritosPerCase} escritos por caso alcanzado.`
        );
      }
      break;
    
    case "libraryDocuments":
      // Count library docs for this entity
      const libDocs = await ctx.db
        .query("libraryDocuments")
        .filter((q) => 
          billing.entityType === "team"
            ? q.eq(q.field("teamId"), billing.entityId as Id<"teams">)
            : q.eq(q.field("createdBy"), billing.entityId as Id<"users">)
        )
        .collect();
      
      if (libDocs.length >= limits.libraryDocuments) {
        throw new Error(
          `Límite de ${limits.libraryDocuments} documentos de biblioteca alcanzado.`
        );
      }
      break;
    
    case "storageGB":
      const storageLimitBytes = limits.storageGB * 1024 * 1024 * 1024;
      const newTotal = usage.storageUsedBytes + (args.additionalBytes || 0);
      
      if (newTotal > storageLimitBytes) {
        const availableGB = (storageLimitBytes - usage.storageUsedBytes) / (1024 * 1024 * 1024);
        throw new Error(
          `Espacio insuficiente. Disponible: ${availableGB.toFixed(2)}GB.`
        );
      }
      break;
  }
}
```

### Step 3: Fix `hasFeatureAccess`

**File:** `apps/application/convex/billing/features.ts` (lines 320-438)

Replace the entire function:

```typescript
handler: async (ctx, args): Promise<{ allowed: boolean; reason?: string }> => {
  const billing = await _getBillingEntity(ctx, { userId: args.userId, teamId: args.teamId });
  const limits = PLAN_LIMITS[billing.plan];

  // Premium users have full access
  if (billing.plan === "premium_individual" || billing.plan === "premium_team") {
    return { allowed: true };
  }

  // Free users: check feature flags
  switch (args.feature) {
    case "create_team":
      if (!limits.features.createTeam) {
        return { allowed: false, reason: "Solo usuarios Premium pueden crear equipos." };
      }
      break;

    case "gpt5_access":
      if (!limits.features.gpt5) {
        return { allowed: false, reason: "GPT-5 solo disponible en plan Premium." };
      }
      break;

    case "team_library":
      if (!limits.features.teamLibrary) {
        return { allowed: false, reason: "Biblioteca de equipo solo en plan Premium." };
      }
      break;
  }

  // Check usage limits using correct entity
  const usage = await _getOrCreateUsageLimits(ctx, billing.entityId, billing.entityType);

  switch (args.feature) {
    case "create_case":
      if (usage.casesCount >= limits.cases) {
        return {
          allowed: false,
          reason: `Plan gratuito limitado a ${limits.cases} casos. Actualiza a Premium.`,
        };
      }
      break;

    case "upload_document":
      if (usage.documentsCount >= limits.documentsPerCase) {
        return {
          allowed: false,
          reason: `Plan gratuito limitado a ${limits.documentsPerCase} documentos por caso.`,
        };
      }
      break;

    case "ai_message": {
      const credits = await ctx.db
        .query("aiCredits")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      const availableMessages = limits.aiMessagesPerMonth - usage.aiMessagesThisMonth;
      const availableCredits = credits?.remaining || 0;
      const totalAvailable = availableMessages + availableCredits;

      if (totalAvailable <= 0) {
        return {
          allowed: false,
          reason: "Límite de mensajes alcanzado. Compra créditos o actualiza a Premium.",
        };
      }
      break;
    }

    case "create_escrito":
      if (usage.escritosCount >= limits.escritosPerCase) {
        return {
          allowed: false,
          reason: `Plan gratuito limitado a ${limits.escritosPerCase} escritos por caso.`,
        };
      }
      break;
  }

  return { allowed: true };
},
```

### Step 4: Fix `_incrementUsage` Signature

**File:** `apps/application/convex/billing/features.ts` (lines 157-173)

Update to accept entityType:

```typescript
export async function _incrementUsage(
  ctx: MutationCtx,
  args: {
    entityId: string;
    entityType: "user" | "team"; // Add this parameter
    counter: "casesCount" | "documentsCount" | "aiMessagesThisMonth" | "escritosCount" | "libraryDocumentsCount" | "storageUsedBytes";
    amount?: number;
  }
): Promise<void> {
  const limits = await _getOrCreateUsageLimits(ctx, args.entityId, args.entityType);
  const increment = args.amount || 1;

  await ctx.db.patch(limits._id, {
    [args.counter]: limits[args.counter] + increment,
  });
}
```

Update public `incrementUsage` mutation (line 456):

```typescript
args: {
  entityId: v.string(),
  entityType: v.union(v.literal("user"), v.literal("team")), // Add this
  counter: v.union(
    v.literal("casesCount"),
    v.literal("documentsCount"),
    v.literal("aiMessagesThisMonth"),
    v.literal("escritosCount"),
    v.literal("libraryDocumentsCount"),
    v.literal("storageUsedBytes")
  ),
  amount: v.optional(v.number()),
},
```

### Step 5: Add Team Context Helper for Cases

**File:** `apps/application/convex/functions/cases.ts`

Add helper function at top of file (after imports):

```typescript
/**
 * Determines team context for a case based on team access
 */
async function getCaseTeamContext(
  ctx: QueryCtx | MutationCtx,
  caseId: Id<"cases">
): Promise<Id<"teams"> | undefined> {
  // Check if any team has access to this case
  const teamAccess = await ctx.db
    .query("caseAccess")
    .withIndex("by_case", (q) => q.eq("caseId", caseId))
    .filter((q) => q.neq(q.field("teamId"), undefined))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();
  
  return teamAccess?.teamId;
}
```

### Step 6: Update `createCase` Function

**File:** `apps/application/convex/functions/cases.ts` (lines 44-116)

Replace limit checking logic (lines 57-67):

```typescript
handler: async (ctx, args) => {
  const currentUser = await getCurrentUserFromAuth(ctx);

  // Check billing limits with team context
  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: args.teamId,
    limitType: "cases",
  });

  // ... rest of function unchanged until line 106

  // Increment usage counter for correct entity
  const billing = await _getBillingEntity(ctx, {
    userId: currentUser._id,
    teamId: args.teamId,
  });
  
  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "casesCount",
    amount: 1,
  });

  // If team context, grant team access to case
  if (args.teamId) {
    await ctx.db.insert("caseAccess", {
      caseId,
      teamId: args.teamId,
      accessLevel: "advanced",
      grantedBy: currentUser._id,
      grantedAt: Date.now(),
      isActive: true,
    });
  }

  console.log("Created case with id:", caseId);
  return caseId;
},
```

### Step 7: Update `createDocument` Function

**File:** `apps/application/convex/functions/documents.ts` (lines 169-298)

Replace limit checking (lines 199-220) and usage tracking (lines 274-284):

```typescript
// Import at top
import { _checkLimit, _getBillingEntity } from "../billing/features";

handler: async (ctx, args) => {
  const currentUser = await getCurrentUserFromAuth(ctx);
  await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

  // Get team context from case
  const teamContext = await getCaseTeamContext(ctx, args.caseId);

  // Check document limit
  const existingDocuments = await ctx.db
    .query("documents")
    .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
    .collect();

  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: teamContext,
    limitType: "documentsPerCase",
    currentCount: existingDocuments.length,
  });

  // Check storage limit
  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: teamContext,
    limitType: "storageGB",
    additionalBytes: args.fileSize,
  });

  // ... create document (lines 234-271)

  // Increment usage with correct entity
  const billing = await _getBillingEntity(ctx, {
    userId: currentUser._id,
    teamId: teamContext,
  });

  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "documentsCount",
    amount: 1,
  });

  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "storageUsedBytes",
    amount: args.fileSize,
  });

  // ... rest unchanged
},
```

### Step 8: Update `createEscrito` Function

**File:** `apps/application/convex/functions/documents.ts` (lines 578-654)

Replace limit checking (lines 610-626) and usage tracking (lines 645-649):

```typescript
handler: async (ctx, args) => {
  const currentUser = await getCurrentUserFromAuth(ctx);
  await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

  // Idempotency check (lines 593-608)...

  // Get team context
  const teamContext = await getCaseTeamContext(ctx, args.caseId);

  // Check escritos limit
  const existingEscritos = await ctx.db
    .query("escritos")
    .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
    .filter((q) => q.eq(q.field("isArchived"), false))
    .collect();

  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: teamContext,
    limitType: "escritosPerCase",
    currentCount: existingEscritos.length,
  });

  // ... create escrito (lines 628-642)

  // Increment with correct entity
  const billing = await _getBillingEntity(ctx, {
    userId: currentUser._id,
    teamId: teamContext,
  });

  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "escritosCount",
    amount: 1,
  });

  // ... rest unchanged
},
```

### Step 9: Update `createLibraryDocument` Function

**File:** `apps/application/convex/functions/libraryDocument.ts` (lines 120-240)

Replace limit checking (lines 135-161) and usage tracking (lines 218-228):

```typescript
handler: async (ctx, args) => {
  const currentUser = await getCurrentUserFromAuth(ctx);

  // Check library documents limit with team context
  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: args.teamId,
    limitType: "libraryDocuments",
  });

  // Check storage limit
  await _checkLimit(ctx, {
    userId: currentUser._id,
    teamId: args.teamId,
    limitType: "storageGB",
    additionalBytes: args.fileSize,
  });

  // ... validation and creation (lines 163-215)

  // Increment with correct entity
  const billing = await _getBillingEntity(ctx, {
    userId: currentUser._id,
    teamId: args.teamId,
  });

  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "libraryDocumentsCount",
    amount: 1,
  });

  await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
    entityId: billing.entityId,
    entityType: billing.entityType,
    counter: "storageUsedBytes",
    amount: args.fileSize,
  });

  // ... rest unchanged
},
```

### Step 10: Update AI Message Credits (Agent Workflows)

**File:** `apps/application/convex/agents/case/workflow.ts` (line 432)

**File:** `apps/application/convex/agents/case/streaming.ts` (line 100)

**File:** `apps/application/convex/agents/home/workflow.ts` (line 239)

For each file, update the `decrementCredits` call to include team context.

First, get the team context from the case (for case agents):

```typescript
// After getting the case, add:
const teamContext = await ctx.runQuery(internal.functions.cases.getCaseTeamContext, {
  caseId: args.caseId
});

// Then update decrementCredits call:
await ctx.scheduler.runAfter(0, internal.billing.features.decrementCredits, {
  userId,
  teamId: teamContext,
  amount: 1,
});
```

**Note:** This requires updating `decrementCredits` function signature to accept `teamId`.

### Step 11: Update `decrementCredits` Function

**File:** `apps/application/convex/billing/features.ts` (lines 480-529)

Update args and logic:

```typescript
export const decrementCredits = internalMutation({
  args: {
    userId: v.id("users"),
    teamId: v.optional(v.id("teams")), // Add this
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const amount = args.amount || 1;
    
    // Get billing entity
    const billing = await _getBillingEntity(ctx, {
      userId: args.userId,
      teamId: args.teamId,
    });
    
    const limits = PLAN_LIMITS[billing.plan];
    const usage = await _getOrCreateUsageLimits(ctx, billing.entityId, billing.entityType);

    // If within monthly limit, increment counter
    if (usage.aiMessagesThisMonth < limits.aiMessagesPerMonth) {
      await ctx.db.patch(usage._id, {
        aiMessagesThisMonth: usage.aiMessagesThisMonth + amount,
      });
      return null;
    }

    // Otherwise use purchased credits (user-level only)
    const credits = await ctx.db
      .query("aiCredits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!credits || credits.remaining < amount) {
      throw new Error("Créditos insuficientes");
    }

    await ctx.db.patch(credits._id, {
      used: credits.used + amount,
      remaining: credits.remaining - amount,
      lastUpdated: Date.now(),
    });

    return null;
  },
});
```

### Step 12: Export Helper Functions & Add getCaseTeamContext

**File:** `apps/application/convex/billing/features.ts`

Export new helpers at appropriate places:

- `_getBillingEntity` (around line 213)
- `_checkLimit` (after _getBillingEntity)

**File:** `apps/application/convex/functions/cases.ts`

Export the `getCaseTeamContext` helper as an internal query:

```typescript
export const getCaseTeamContext = internalQuery({
  args: { caseId: v.id("cases") },
  returns: v.union(v.id("teams"), v.null()),
  handler: async (ctx, args) => {
    const teamAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.neq(q.field("teamId"), undefined))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    
    return teamAccess?.teamId ?? null;
  },
});
```

## Summary

This plan fixes the billing system to properly respect team context:

- **Free user in premium_team**: Gets team's unlimited limits when working in team context
- **Team library documents**: Charged to team, not individual users
- **Case resources**: Charged to team if case has team access, otherwise to user
- **AI messages**: Charged to team if in team case context

All limit checks and usage tracking now use a unified helper system that eliminates code duplication and ensures consistency.

### To-dos

- [ ] Create _getBillingEntity and _checkLimit helper functions in billing/features.ts
- [ ] Fix hasFeatureAccess to use _getBillingEntity instead of hardcoded user plan
- [ ] Update _incrementUsage signature to accept entityType parameter
- [ ] Add getCaseTeamContext helper in cases.ts and export as internal query
- [ ] Update createCase to use new helpers and grant team access when teamId provided
- [ ] Update createDocument to check team context and use correct billing entity
- [ ] Update createEscrito to check team context and use correct billing entity
- [ ] Update createLibraryDocument to use teamId for billing entity
- [ ] Update decrementCredits to accept teamId and use billing entity
- [ ] Update all agent workflow files to pass team context when decrementing credits
- [ ] Test: free user in premium team, team library docs, case resources with team access
- [ ] Run linter on all modified files and fix any errors