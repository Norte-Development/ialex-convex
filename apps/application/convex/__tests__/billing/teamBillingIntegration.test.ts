import { convexTest } from "convex-test";
import { expect, test, describe, beforeEach, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import { Id } from "../../_generated/dataModel";

describe("Team Billing Integration Tests", () => {
  let t: ReturnType<typeof convexTest>;
  let freeUserId: Id<"users">;
  let premiumTeamId: Id<"teams">;
  let teamOwnerId: Id<"users">;

  beforeEach(async () => {
    t = convexTest(schema);

    // Create team owner
    teamOwnerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Team Owner",
        email: "owner@test.com",
        role: "lawyer",
        firebaseUid: "owner-uid",
      });
    });

    // Create free user
    freeUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        name: "Free User",
        email: "free@test.com",
        role: "lawyer",
        firebaseUid: "free-uid",
      });
    });

    // Create premium team with subscription
    premiumTeamId = await t.run(async (ctx) => {
      const teamId = await ctx.db.insert("teams", {
        name: "Premium Team",
        description: "Team with premium subscription",
        createdBy: teamOwnerId,
      });

      // Create Stripe entities for premium team
      const customerId = `cus_team_${Date.now()}`;
      await ctx.db.insert("stripeCustomers", {
        customerId,
        entityId: teamId,
        entityType: "team",
      });

      const productId = `prod_premium_team_${Date.now()}`;
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

      const priceId = `price_premium_team_${Date.now()}`;
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

      const subscriptionId = `sub_team_${Date.now()}`;
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

      // Add free user as team member
      await ctx.db.insert("teamMemberships", {
        teamId,
        userId: freeUserId,
        role: "abogado",
        isActive: true,
        addedBy: teamOwnerId,
        addedAt: Date.now(),
      });

      return teamId;
    });
  });

  describe("Case Creation with Team Context", () => {
    test("free user should be limited to 3 cases without team context", async () => {
      // Mock auth to return free user
      t.withIdentity({ subject: "free-uid" });

      // Create usage limits for free user at limit
      await t.run(async (ctx) => {
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

      // Should throw when trying to create 4th case
      await expect(
        t.mutation(api.functions.cases.createCase, {
          title: "Case 4",
          priority: "medium",
        })
      ).rejects.toThrow("Límite de 3 casos alcanzado");
    });

    test("free user should have unlimited cases with team context", async () => {
      // Mock auth
      t.withIdentity({ subject: "free-uid" });

      // Create team usage limits (already at 10 cases)
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

      // Should NOT throw because premium team has unlimited cases
      const caseId = await t.mutation(api.functions.cases.createCase, {
        title: "Team Case",
        priority: "high",
        teamId: premiumTeamId,
      });

      expect(caseId).toBeDefined();

      // Verify team access was granted
      const teamAccess = await t.run(async (ctx) => {
        return await ctx.db
          .query("caseAccess")
          .filter((q) => q.eq(q.field("caseId"), caseId))
          .filter((q) => q.eq(q.field("teamId"), premiumTeamId))
          .first();
      });

      expect(teamAccess).toBeDefined();
      expect(teamAccess?.accessLevel).toBe("advanced");
    });

    test("should track usage to team entity when teamId provided", async () => {
      t.withIdentity({ subject: "free-uid" });

      // Get initial team usage
      const initialUsage = await t.run(async (ctx) => {
        return await ctx.db
        .query("usageLimits")
        .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      const initialCount = initialUsage?.casesCount || 0;

      // Create case with team context
      await t.mutation(api.functions.cases.createCase, {
        title: "Team Case",
        priority: "medium",
        teamId: premiumTeamId,
      });

      // Wait for async increment to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify usage was tracked to team
      const finalUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(finalUsage?.casesCount).toBe(initialCount + 1);
      expect(finalUsage?.entityType).toBe("team");
    });
  });

  describe("Document Creation with Team Context", () => {
    let caseId: Id<"cases">;
    let teamCaseId: Id<"cases">;

    beforeEach(async () => {
      t.withIdentity({ subject: "free-uid" });

      // Create personal case
      caseId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("cases", {
          title: "Personal Case",
          createdBy: freeUserId,
          assignedLawyer: freeUserId,
          status: "pendiente",
          priority: "medium",
          startDate: Date.now(),
          isArchived: false,
        });

        await ctx.db.insert("caseAccess", {
          caseId: id,
          userId: freeUserId,
          accessLevel: "admin",
          grantedBy: freeUserId,
          grantedAt: Date.now(),
          isActive: true,
        });

        return id;
      });

      // Create team case
      teamCaseId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("cases", {
          title: "Team Case",
          createdBy: freeUserId,
          assignedLawyer: freeUserId,
          status: "pendiente",
          priority: "medium",
          startDate: Date.now(),
          isArchived: false,
        });

        await ctx.db.insert("caseAccess", {
          caseId: id,
          userId: freeUserId,
          accessLevel: "admin",
          grantedBy: freeUserId,
          grantedAt: Date.now(),
          isActive: true,
        });

        await ctx.db.insert("caseAccess", {
          caseId: id,
          teamId: premiumTeamId,
          accessLevel: "advanced",
          grantedBy: freeUserId,
          grantedAt: Date.now(),
          isActive: true,
        });

        return id;
      });
    });

    test("free user should be limited to 10 documents per personal case", async () => {
      // Create 10 documents
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("documents", {
            title: `Doc ${i}`,
            caseId,
            createdBy: freeUserId,
            originalFileName: `doc${i}.pdf`,
            mimeType: "application/pdf",
            fileSize: 1024,
            storageBackend: "gcs",
            gcsObject: `test/doc${i}.pdf`,
            processingStatus: "pending",
          });
        }
      });

      // 11th document should fail
      await expect(
        t.mutation(api.functions.documents.createDocument, {
          title: "Doc 11",
          caseId,
          originalFileName: "doc11.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
          gcsObject: "test/doc11.pdf",
        })
      ).rejects.toThrow("Límite de 10 documentos por caso alcanzado");
    });

    test("free user should have unlimited documents in team case", async () => {
      // Create 15 documents in team case
      for (let i = 0; i < 15; i++) {
        await t.mutation(api.functions.documents.createDocument, {
          title: `Team Doc ${i}`,
          caseId: teamCaseId,
          originalFileName: `teamdoc${i}.pdf`,
          mimeType: "application/pdf",
          fileSize: 1024,
          gcsObject: `test/teamdoc${i}.pdf`,
        });
      }

      // Verify all documents were created
      const docs = await t.run(async (ctx) => {
        return await ctx.db
          .query("documents")
          .filter((q) => q.eq(q.field("caseId"), teamCaseId))
          .collect();
      });

      expect(docs.length).toBe(15);
    });

    test("should track document usage to team for team case", async () => {
      // Get initial team usage
      const initialUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      const initialDocCount = initialUsage?.documentsCount || 0;
      const initialStorage = initialUsage?.storageUsedBytes || 0;

      // Create document in team case
      await t.mutation(api.functions.documents.createDocument, {
        title: "Team Document",
        caseId: teamCaseId,
        originalFileName: "team.pdf",
        mimeType: "application/pdf",
        fileSize: 5000,
        gcsObject: "test/team.pdf",
      });

      // Wait for async updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify usage tracked to team
      const finalUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(finalUsage?.documentsCount).toBe(initialDocCount + 1);
      expect(finalUsage?.storageUsedBytes).toBe(initialStorage + 5000);
    });
  });

  describe("Library Document Creation with Team Context", () => {
    test("should track library docs to team when teamId provided", async () => {
      t.withIdentity({ subject: "free-uid" });

      // Get initial team usage
      const initialUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      const initialLibDocs = initialUsage?.libraryDocumentsCount || 0;

      // Create library document for team
      await t.mutation(api.functions.libraryDocument.createLibraryDocument, {
        title: "Team Library Doc",
        teamId: premiumTeamId,
        gcsObject: "library/team-doc.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
      });

      // Wait for async updates
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify usage tracked to team
      const finalUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(finalUsage?.libraryDocumentsCount).toBe(initialLibDocs + 1);
      expect(finalUsage?.entityType).toBe("team");
    });

    test("free user personal library should have 10 doc limit", async () => {
      t.withIdentity({ subject: "free-uid" });

      // Create usage at limit
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

        // Create 10 library documents
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("libraryDocuments", {
            title: `Lib Doc ${i}`,
            createdBy: freeUserId,
            userId: freeUserId,
            gcsObject: `lib/doc${i}.pdf`,
            mimeType: "application/pdf",
            fileSize: 1024,
            processingStatus: "pending",
          });
        }
      });

      // 11th should fail
      await expect(
        t.mutation(api.functions.libraryDocument.createLibraryDocument, {
          title: "Lib Doc 11",
          gcsObject: "lib/doc11.pdf",
          mimeType: "application/pdf",
          fileSize: 1024,
        })
      ).rejects.toThrow("Límite de 10 documentos de biblioteca alcanzado");
    });
  });

  describe("AI Credits with Team Context", () => {
    test("should use team credits for team case", async () => {
      t.withIdentity({ subject: "free-uid" });

      // Set up team usage limits
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

      // Decrement with team context
      await t.mutation(internal.billing.features.decrementCredits, {
        userId: freeUserId,
        teamId: premiumTeamId,
        amount: 5,
      });

      // Verify team usage increased
      const teamUsage = await t.run(async (ctx) => {
        return await ctx.db
          .query("usageLimits")
          .filter((q) => q.eq(q.field("entityId"), premiumTeamId))
          .first();
      });

      expect(teamUsage?.aiMessagesThisMonth).toBe(5);

      // Verify user usage unchanged
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

