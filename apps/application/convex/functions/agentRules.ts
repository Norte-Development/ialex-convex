import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";

export const createRule = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    scope: v.union(v.literal("user"), v.literal("case")),
    userId: v.optional(v.id("users")),
    caseId: v.optional(v.id("cases")),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    if (args.scope === "user") {
      const targetUserId = args.userId ?? currentUser._id;
      if (targetUserId !== currentUser._id) {
        throw new Error("Unauthorized: Cannot create rules for other users");
      }
      const id = await ctx.db.insert("agentRules", {
        name: args.name,
        content: args.content,
        scope: "user",
        userId: targetUserId,
        isActive: args.isActive ?? true,
        createdBy: currentUser._id,
        order: args.order,
      });
      return id;
    } else {
      if (!args.caseId) throw new Error("caseId is required for case-scoped rules");
      await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "admin");
      const id = await ctx.db.insert("agentRules", {
        name: args.name,
        content: args.content,
        scope: "case",
        caseId: args.caseId,
        isActive: args.isActive ?? true,
        createdBy: currentUser._id,
        order: args.order,
      });
      return id;
    }
  },
});

export const updateRule = mutation({
  args: {
    ruleId: v.id("agentRules"),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Rule not found");

    // Authorization: user can edit own user rules; admin on case can edit case rules
    if (rule.scope === "user") {
      if (rule.userId !== currentUser._id && rule.createdBy !== currentUser._id) {
        throw new Error("Unauthorized: Cannot edit this rule");
      }
    } else if (rule.scope === "case") {
      if (!rule.caseId) throw new Error("Invalid case rule");
      await requireNewCaseAccess(ctx, currentUser._id, rule.caseId, "admin");
    }

    const update: any = {};
    if (args.name !== undefined) update.name = args.name;
    if (args.content !== undefined) update.content = args.content;
    if (args.isActive !== undefined) update.isActive = args.isActive;
    if (args.order !== undefined) update.order = args.order;

    await ctx.db.patch(args.ruleId, update);
    return args.ruleId;
  },
});

export const deleteRule = mutation({
  args: { ruleId: v.id("agentRules") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Rule not found");

    if (rule.scope === "user") {
      if (rule.userId !== currentUser._id && rule.createdBy !== currentUser._id) {
        throw new Error("Unauthorized: Cannot delete this rule");
      }
    } else if (rule.scope === "case") {
      if (!rule.caseId) throw new Error("Invalid case rule");
      await requireNewCaseAccess(ctx, currentUser._id, rule.caseId, "admin");
    }

    await ctx.db.delete(args.ruleId);
    return null;
  },
});

export const toggleRuleActive = mutation({
  args: { ruleId: v.id("agentRules"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const rule = await ctx.db.get(args.ruleId);
    if (!rule) throw new Error("Rule not found");

    if (rule.scope === "user") {
      if (rule.userId !== currentUser._id && rule.createdBy !== currentUser._id) {
        throw new Error("Unauthorized: Cannot toggle this rule");
      }
    } else if (rule.scope === "case") {
      if (!rule.caseId) throw new Error("Invalid case rule");
      await requireNewCaseAccess(ctx, currentUser._id, rule.caseId, "admin");
    }

    await ctx.db.patch(args.ruleId, { isActive: args.isActive });
    return args.ruleId;
  },
});

export const getUserRules = query({
  args: { userId: v.optional(v.id("users")), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const targetUserId = args.userId ?? currentUser._id;
    if (targetUserId !== currentUser._id) {
      throw new Error("Unauthorized: Cannot view other users' rules");
    }

    let q = ctx.db
      .query("agentRules")
      .withIndex("by_user_and_active", (q) => q.eq("userId", targetUserId));

    if (args.activeOnly) {
      q = q.filter((q) => q.eq(q.field("isActive"), true));
    }

    const rules = await q.collect();
    return rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});

export const getCaseRules = query({
  args: { caseId: v.id("cases"), activeOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    // Require at least basic access to view rules
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    let q = ctx.db
      .query("agentRules")
      .withIndex("by_case_and_active", (q) => q.eq("caseId", args.caseId));

    if (args.activeOnly) {
      q = q.filter((q) => q.eq(q.field("isActive"), true));
    }

    const rules = await q.collect();
    return rules.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
});
