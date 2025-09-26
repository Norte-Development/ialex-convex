import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../_generated/api';
import schema from '../../schema';
import { modules } from '../../test.setup';

describe('Basic Convex Test Setup', () => {
  it('can create and query data', async () => {
    const t = convexTest(schema, modules);

    // Create a user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        name: "Test User",
        email: "test@example.com",
        isActive: true,
        isOnboardingComplete: true,
      });
    });

    // Create a case
    const caseId = await t.run(async (ctx) => {
      return await ctx.db.insert("cases", {
        title: "Test Case",
        status: "pendiente",
        priority: "medium",
        startDate: Date.now(),
        assignedLawyer: userId,
        createdBy: userId,
        isArchived: false,
      });
    });

    // Verify the case was created
    const caseData = await t.run(async (ctx) => {
      return await ctx.db.get(caseId);
    });

    expect(caseData).toBeTruthy();
    expect(caseData!.title).toBe("Test Case");
    expect(caseData!.status).toBe("pendiente");
  });

  it('can test with identity', async () => {
    const t = convexTest(schema, modules);
    const asTestUser = t.withIdentity({ name: "Test User" });

    // This test demonstrates the withIdentity functionality
    // In a real scenario, you would test functions that depend on authentication
    expect(asTestUser).toBeDefined();
  });
});
