import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Internal helper for agent tools to get document without permission checks.
 * Agent tools have full read access by design.
 */
export const getDocumentForAgent = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    return document;
  },
});

/**
 * Internal helper for agent tools to get documents by case without permission checks.
 * Agent tools have full read access by design.
 */
export const getDocumentsForAgent = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();

    return documents;
  },
});

