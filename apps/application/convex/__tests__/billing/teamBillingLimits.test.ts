import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach } from "vitest";
import { api, internal } from "../../_generated/api"
import schema from "../../schema";
import { Id } from "../../_generated/dataModel";

describe("Team Billing Limits", () => {
  let t: ReturnType<typeof convexTest>;
  let freeUserId: Id<"users">;
  let premiumUserId: Id<"users">;
  let teamOwnerId: Id<"users">;
  let premiumTeamId: Id<"teams">;
  let freeTeamId: Id<"teams">;

  beforeEach(async () => {
    t = convexTest(schema);

    // Create test users
    freeUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Free User",
        email: "free@test.com",
        role: "lawyer",
        firebaseUid: "free-uid",
      });
    });

    premiumUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Premium User",
        email: "premium@test.com",
        role: "lawyer",
        firebaseUid: "premium-uid",
      });
    });

    teamOwnerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Team Owner",
        email: "owner@test.com",
        role: "lawyer",
        firebaseUid: "owner-uid",
      });
    });

    // Create Stripe customers and subscriptions for premium user
    await t.run(async (ctx) => {
      const customerId = `cus_premium_${Date.now()}`;
      await ctx.db.insert("stripeCustomers", {
        customerId,
        entityId: premiumUserId,
        entityType: "user",
      });

      const subscriptionId = `sub_premium_${Date.now()}`;
      const priceId = `price_premium_individual_${Date.now()}`;
      const productId = `prod_premium_individual_${Date.now()}`;

      // Create product
      await ctx.db.insert("stripeProducts", {
        productId,
        stripe: {
          id: productId,
          object: "product",
          active: true,
          created: Date.now(),
          name: "Premium Individual",
          metadata: { plan: "premium_individual" },
          livemode: false,
        },
      });

      // Create price
      await ctx.db.insert("stripePrices", {
        priceId,
        stripe: {
          id: priceId,
          object: "price",
          active: true,
          created: Date.now(),
          currency: "usd",
          productId,
          type: "recurring",
          unit_amount: 2900,
          livemode: false,
        },
      });

      // Create subscription
      await ctx.db.insert("stripeSubscriptions", {
        subscriptionId,
        customerId,
        stripe: {
          id: subscriptionId,
          object: "subscription",
          created: Date.now(),
          status: "active",
          items: {
            object: "list",
            data: [
              {
                id: `si_${Date.now()}`,
                object: "subscription_item",
                price: {
                  id: priceId,
                  object: "price",
                  active: true,
                  created: Date.now(),
                  currency: "usd",
                  productId,
                  type: "recurring",
                  unit_amount: 2900,
                  livemode: false,
                },
                created: Date.now(),
                subscription: subscriptionId,
              },
            ],
          },
          livemode: false,
        },
      });
    });

    // Create teams
    premiumTeamId = await t.run(async (ctx) => {
      const teamId = await ctx.db.insert("teams", {
        name: "Premium Team",
        description: "Team with premium subscription",
        createdBy: teamOwnerId,
      });

      // Create Stripe subscription for team
      const customerId = `cus_team_${Date.now()}`;
      await ctx.db.insert("stripeCustomers", {
        customerId,
        entityId: teamId,
        entityType: "team",
      });

      const subscriptionId = `sub_team_${Date.now()}`;
      const priceId = `price_premium_team_${Date.now()}`;
      const productId = `prod_premium_team_${Date.now()}`;

      // Create product
      await ctx.db.insert("stripeProducts", {
        productId,
        stripe: {
          id: productId,
          object: "product",
          active: true,
          created: Date.now(),
          name: "Premium Team",
          metadata: { plan: "premium_team" },
          livemode: false,
        },
      });

      // Create price
      await ctx.db.insert("stripePrices", {
        priceId,
        stripe: {
          id: priceId,
          object: "price",
          active: true,
          created: Date.now(),
          currency: "usd",
          productId,
          type: "recurring",
          unit_amount: 9900,
          livemode: false,
        },
      });

      // Create subscription
      await ctx.db.insert("stripeSubscriptions", {
        subscriptionId,
        customerId,
        stripe: {
          id: subscriptionId,
          object: "subscription",
          created: Date.now(),
          status: "active",
          items: {
            object: "list",
            data: [
              {
                id: `si_${Date.now()}`,
                object: "subscription_item",
                price: {
                  id: priceId,
                  object: "price",
                  active: true,
                  created: Date.now(),
                  currency: "usd",
                  productId,
                  type: "recurring",
                  unit_amount: 9900,
                  livemode: false,
                },
                created: Date.now(),
                subscription: subscriptionId,
              },
            ],
          },
          livemode: false,
        },
      });

      return teamId;
    });

    freeTeamId = await t.run(async (ctx) => {
      return await ctx.db.insert("teams", {
        name: "Free Team",
        description: "Team without subscription",
        createdBy: freeUserId,
      });
    });

    // Add free user to premium team
    await t.run(async (ctx) => {
      await ctx.db.insert("teamMemberships", {
        teamId: premiumTeamId,
        userId: freeUserId,
        role: "abogado",
        isActive: true,
        addedBy: teamOwnerId,
        addedAt: Date.now(),
      });
    });
  });

  describe("_getBillingEntity", () => {
    test("should return user entity when no teamId provided", async () => {
      const result = await t.run(async (ctx) => {
        const { _getBillingEntity } = await import(
          "../../billing/features"
        );
        return await _getBillingEntity(ctx, {
          userId: freeUserId,
        });
      });

      expect(result.entityType).toBe("user");
      expect(result.entityId).toBe(freeUserId);
      expect(result.plan).toBe("free");
    });

    test("should return team entity when teamId provided", async () => {
      const result = await t.run(async (ctx) => {
        const { _getBillingEntity } = await import(
          "../../billing/features"
        );
        return await _getBillingEntity(ctx, {
          userId: freeUserId,
          teamId: premiumTeamId,
        });
      });

      expect(result.entityType).toBe("team");
      expect(result.entityId).toBe(premiumTeamId);
      expect(result.plan).toBe("premium_team");
    });

    test("should return premium_individual plan for premium user", async () => {
      const result = await t.run(async (ctx) => {
        const { _getBillingEntity } = await import(
          "../../billing/features"
        );
        return await _getBillingEntity(ctx, {
          userId: premiumUserId,
        });
      });

      expect(result.entityType).toBe("user");
      expect(result.plan).toBe("premium_individual");
    });
  });

  describe("_checkLimit - Cases", () => {
    test("should throw error when free user reaches case limit", async () => {
      // Create 3 cases for free user (limit is 3)
      await t.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("cases", {
            title: `Case ${i}`,
            createdBy: freeUserId,
            assignedLawyer: freeUserId,
            status: "pendiente",
            priority: "medium",
            startDate: Date.now(),
            isArchived: false,
          });
        }

        // Create usage limits
        await ctx.db.insert("usageLimits", {
          entityId: freeUserId,
          entityType: "user",
          casesCount: 3,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      await expect(
        t.run(async (ctx) => {
          const { _checkLimit } = await import(
            "../../billing/features"
          );
          await _checkLimit(ctx, {
            userId: freeUserId,
            limitType: "cases",
          });
        })
      ).rejects.toThrow("Límite de 3 casos alcanzado");
    });

    test("should allow premium user to create unlimited cases", async () => {
      // Create 10 cases for premium user
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("cases", {
            title: `Case ${i}`,
            createdBy: premiumUserId,
            assignedLawyer: premiumUserId,
            status: "pendiente",
            priority: "medium",
            startDate: Date.now(),
            isArchived: false,
          });
        }

        await ctx.db.insert("usageLimits", {
          entityId: premiumUserId,
          entityType: "user",
          casesCount: 10,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      // Should not throw
      await t.run(async (ctx) => {
        const { _checkLimit } = await import(
          "../../billing/features"
        );
        await _checkLimit(ctx, {
          userId: premiumUserId,
          limitType: "cases",
        });
      });
    });

    test("should allow free user to create unlimited cases in premium team context", async () => {
      // Create team usage limits with many cases
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: premiumTeamId,
          entityType: "team",
          casesCount: 10,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      // Should not throw because team has premium_team plan (unlimited)
      await t.run(async (ctx) => {
        const { _checkLimit } = await import(
          "../../billing/features"
        );
        await _checkLimit(ctx, {
          userId: freeUserId,
          teamId: premiumTeamId,
          limitType: "cases",
        });
      });
    });
  });

  describe("_checkLimit - Documents Per Case", () => {
    test("should throw error when free user reaches document limit per case", async () => {
      await expect(
        t.run(async (ctx) => {
          const { _checkLimit } = await import(
            "../../billing/features"
          );
          await _checkLimit(ctx, {
            userId: freeUserId,
            limitType: "documentsPerCase",
            currentCount: 10, // Free limit is 10
          });
        })
      ).rejects.toThrow("Límite de 10 documentos por caso alcanzado");
    });

    test("should allow premium team unlimited documents per case", async () => {
      // Should not throw
      await t.run(async (ctx) => {
        const { _checkLimit } = await import(
          "../../billing/features"
        );
        await _checkLimit(ctx, {
          userId: freeUserId,
          teamId: premiumTeamId,
          limitType: "documentsPerCase",
          currentCount: 50, // Way above free limit
        });
      });
    });
  });

  describe("_checkLimit - Storage", () => {
    test("should throw error when free user reaches storage limit", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: freeUserId,
          entityType: "user",
          casesCount: 0,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 2 * 1024 * 1024 * 1024, // 2GB used (limit is 2GB)
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      await expect(
        t.run(async (ctx) => {
          const { _checkLimit } = await import(
            "../../billing/features"
          );
          await _checkLimit(ctx, {
            userId: freeUserId,
            limitType: "storageGB",
            additionalBytes: 1024, // Any additional bytes should fail
          });
        })
      ).rejects.toThrow("Espacio insuficiente");
    });

    test("should allow more storage for premium team", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: premiumTeamId,
          entityType: "team",
          casesCount: 0,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 2 * 1024 * 1024 * 1024, // 2GB used
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      // Should not throw (premium team has 50GB limit)
      await t.run(async (ctx) => {
        const { _checkLimit } = await import(
          "../../billing/features"
        );
        await _checkLimit(ctx, {
          userId: freeUserId,
          teamId: premiumTeamId,
          limitType: "storageGB",
          additionalBytes: 10 * 1024 * 1024 * 1024, // 10GB more
        });
      });
    });
  });

  describe("hasFeatureAccess", () => {
    test("should deny create_team for free user", async () => {
      const result = await t.query(api.billing.features.hasFeatureAccess, {
        userId: freeUserId,
        feature: "create_team",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Premium");
    });

    test("should allow create_team for premium user", async () => {
      const result = await t.query(api.billing.features.hasFeatureAccess, {
        userId: premiumUserId,
        feature: "create_team",
      });

      expect(result.allowed).toBe(true);
    });

    test("should use team plan when teamId provided", async () => {
      // Free user in premium team context should have access to team features
      const result = await t.query(api.billing.features.hasFeatureAccess, {
        userId: freeUserId,
        teamId: premiumTeamId,
        feature: "team_library",
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe("Usage tracking with correct entity", () => {
    test("should track usage to user when no team context", async () => {
      await t.mutation(internal.billing.features.incrementUsage, {
        entityId: freeUserId,
        entityType: "user",
        counter: "casesCount",
        amount: 1,
      });

      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), freeUserId))
          .first();
      });

      expect(usage?.casesCount).toBe(1);
      expect(usage?.entityType).toBe("user");
    });

    test("should track usage to team when team context provided", async () => {
      await t.mutation(internal.billing.features.incrementUsage, {
        entityId: premiumTeamId,
        entityType: "team",
        counter: "casesCount",
        amount: 1,
      });

      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(usage?.casesCount).toBe(1);
      expect(usage?.entityType).toBe("team");
    });

    test("should decrement from correct entity", async () => {
      // Set up initial usage
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: premiumTeamId,
          entityType: "team",
          casesCount: 5,
          documentsCount: 10,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      // Decrement
      await t.mutation(internal.billing.features.incrementUsage, {
        entityId: premiumTeamId,
        entityType: "team",
        counter: "documentsCount",
        amount: -1,
      });

      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(usage?.documentsCount).toBe(9);
    });
  });

  describe("decrementCredits with team context", () => {
    test("should use user monthly limit when no team context", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: freeUserId,
          entityType: "user",
          casesCount: 0,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      await t.mutation(internal.billing.features.decrementCredits, {
        userId: freeUserId,
        amount: 1,
      });

      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), freeUserId))
          .first();
      });

      expect(usage?.aiMessagesThisMonth).toBe(1);
    });

    test("should use team monthly limit when team context provided", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("usageLimits", {
          entityId: premiumTeamId,
          entityType: "team",
          casesCount: 0,
          documentsCount: 0,
          aiMessagesThisMonth: 0,
          escritosCount: 0,
          libraryDocumentsCount: 0,
          storageUsedBytes: 0,
          currentMonthStart: Date.now(),
          lastResetDate: Date.now(),
        });
      });

      await t.mutation(internal.billing.features.decrementCredits, {
        userId: freeUserId,
        teamId: premiumTeamId,
        amount: 1,
      });

      const usage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(usage?.aiMessagesThisMonth).toBe(1);

      // User's personal usage should be unchanged
      const userUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), freeUserId))
          .first();
      });

      expect(userUsage).toBeNull();
    });
  });
});

