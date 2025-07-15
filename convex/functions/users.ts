import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

// ========================================
// USER MANAGEMENT
// ========================================

export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("lawyer"), v.literal("assistant")),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      isActive: true,
    });
    
    console.log("Created user with id:", userId);
    return userId;
  },
});

export const getUsers = query({
  args: {
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isActive !== undefined) {
      const users = await ctx.db
        .query("users")
        .withIndex("by_active_status", (q) => q.eq("isActive", args.isActive!))
        .collect();
      return users;
    } else {
      const users = await ctx.db.query("users").collect();
      return users;
    }
  },
}); 