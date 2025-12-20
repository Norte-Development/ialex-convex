import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Internal helper for agent tools to get escritos by case without permission checks.
 * Agent tools have full read access by design.
 */
export const getEscritosForAgent = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();
  },
});

