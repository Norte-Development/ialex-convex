# Billing Team Context Tests

This directory contains comprehensive tests for the team-based billing system implementation.

## Test Files

### 1. `teamBillingLimits.test.ts` - Unit Tests
Tests for individual billing helper functions with mocked plans.

**Coverage:**
- ✅ `_getBillingEntity` - Entity determination logic
- ✅ `_checkLimit` - Limit checking for all limit types
- ✅ `hasFeatureAccess` - Feature access with team context
- ✅ Usage tracking to correct entity
- ✅ `decrementCredits` with team context

**Test Scenarios:**
- Free user without team context → uses user's free plan limits
- Free user with premium team context → uses team's premium limits
- Premium user → uses premium individual limits
- Different limit types: cases, documents per case, escritos per case, library documents, storage
- Usage increment/decrement to correct entity

### 2. `teamBillingIntegration.test.ts` - Integration Tests
End-to-end tests for actual case/document creation with team context.

**Coverage:**
- ✅ Case creation with team limits
- ✅ Document creation in team vs personal cases
- ✅ Escrito creation with team context
- ✅ Library document creation with team ownership
- ✅ AI credits usage tracking

**Test Scenarios:**
- Free user creating personal cases (limited to 3)
- Free user creating team cases (unlimited via premium team)
- Document limits in personal vs team cases
- Library document limits for personal vs team
- Usage tracking verification

## Running the Tests

```bash
# Run all billing tests
pnpm test __tests__/billing

# Run specific test file
pnpm test __tests__/billing/teamBillingLimits.test.ts
pnpm test __tests__/billing/teamBillingIntegration.test.ts

# Watch mode
pnpm test __tests__/billing --watch
```

## Test Data Setup

Each test creates the following mock data:

### Users
- **Free User**: No subscription, limited to free plan
- **Premium User**: Has `premium_individual` subscription
- **Team Owner**: Creates the premium team

### Teams
- **Premium Team**: Has `premium_team` subscription with unlimited limits
- **Free Team**: No subscription, limited to free plan

### Subscriptions
Tests mock the complete Stripe subscription flow:
1. `stripeCustomers` - Links entity (user/team) to Stripe customer
2. `stripeProducts` - Product definition with plan metadata
3. `stripePrices` - Pricing information
4. `stripeSubscriptions` - Active subscription with status

## Plan Limits Tested

### Free Plan
- Cases: 3
- Documents per case: 10
- Escritos per case: 5
- Library documents: 10
- Storage: 2GB
- AI messages/month: 10

### Premium Individual
- Cases: Unlimited
- Documents per case: Unlimited
- Escritos per case: Unlimited
- Library documents: 50
- Storage: 20GB
- AI messages/month: Unlimited

### Premium Team
- Cases: Unlimited
- Documents per case: Unlimited
- Escritos per case: Unlimited
- Library documents: 200
- Storage: 50GB
- AI messages/month: Unlimited
- Team members: 6

## Key Test Assertions

### Billing Entity Selection
```typescript
// Free user without team → uses user entity
expect(result.entityType).toBe("user");
expect(result.plan).toBe("free");

// Free user with team → uses team entity
expect(result.entityType).toBe("team");
expect(result.plan).toBe("premium_team");
```

### Limit Enforcement
```typescript
// Free user at case limit
await expect(createCase()).rejects.toThrow("Límite de 3 casos alcanzado");

// Premium team has unlimited cases
await expect(createCase({ teamId })).resolves.toBeDefined();
```

### Usage Tracking
```typescript
// Usage tracked to team entity
const usage = await getUsage(premiumTeamId);
expect(usage.entityType).toBe("team");
expect(usage.casesCount).toBe(expectedCount);
```

## Edge Cases Covered

1. **Free user in premium team**: Gets team's unlimited limits
2. **Team access grants**: Team access properly created when teamId provided
3. **Personal vs team resources**: Separate usage tracking
4. **Storage limits**: Byte-level calculation and enforcement
5. **AI credits**: Monthly limits vs purchased credits
6. **Usage decrements**: Proper decrement when deleting resources

## Mocking Strategy

### Stripe Entities
Tests create realistic Stripe mock data following the actual schema:
- Products have metadata with `plan: "premium_team"`
- Subscriptions have `status: "active"`
- Prices link to products via `productId`
- Complete subscription object structure

### Authentication
Uses `convex-test` identity mocking:
```typescript
t.withIdentity({ subject: "user-firebase-uid" });
```

### Async Operations
Tests account for scheduled functions:
```typescript
// Wait for async increment to complete
await new Promise(resolve => setTimeout(resolve, 100));
```

## Continuous Improvement

When adding new billing features:
1. Add unit tests to `teamBillingLimits.test.ts`
2. Add integration tests to `teamBillingIntegration.test.ts`
3. Update this README with new scenarios
4. Verify all edge cases are covered

## Related Files

- Implementation: `apps/application/convex/billing/features.ts`
- Case functions: `apps/application/convex/functions/cases.ts`
- Document functions: `apps/application/convex/functions/documents.ts`
- Library docs: `apps/application/convex/functions/libraryDocument.ts`
- Plan limits: `apps/application/convex/billing/planLimits.ts`

