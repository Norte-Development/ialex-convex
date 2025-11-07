import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentUserFromAuth, checkNewCaseAccess } from "../auth_utils";

/**
 * Get the total count of cases accessible by the current user
 */
export const getCasesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get all non-archived cases
    const allCases = await ctx.db
      .query("cases")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Filter cases based on user access
    let accessibleCount = 0;
    for (const caseData of allCases) {
      const access = await checkNewCaseAccess(
        ctx,
        currentUser._id,
        caseData._id,
        "basic",
      );
      if (access.hasAccess) {
        accessibleCount++;
      }
    }

    return accessibleCount;
  },
});

/**
 * Get the total count of clients accessible by the current user
 */
export const getClientsCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Count all active clients created by the current user
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_created_by", (q) => q.eq("createdBy", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return clients.length;
  },
});

/**
 * Get the total count of escritos accessible by the current user
 */
export const getEscritosCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get all cases the user has access to
    const allCases = await ctx.db
      .query("cases")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Filter cases based on user access
    const accessibleCaseIds: string[] = [];
    for (const caseData of allCases) {
      const access = await checkNewCaseAccess(
        ctx,
        currentUser._id,
        caseData._id,
        "basic",
      );
      if (access.hasAccess) {
        accessibleCaseIds.push(caseData._id);
      }
    }

    // Count all non-archived escritos in accessible cases
    let totalEscritos = 0;
    for (const caseId of accessibleCaseIds) {
      const escritos = await ctx.db
        .query("escritos")
        .withIndex("by_case", (q) => q.eq("caseId", caseId as any))
        .filter((q) => q.eq(q.field("isArchived"), false))
        .collect();
      totalEscritos += escritos.length;
    }

    return totalEscritos;
  },
});

