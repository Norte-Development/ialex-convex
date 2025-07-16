import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "./auth_utils";

// ========================================
// MODELOS (TEMPLATES) MANAGEMENT
// ========================================

export const createModelo = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    templateType: v.union(v.literal("escrito"), v.literal("document")),
    content: v.optional(v.string()), // For escrito templates
    mimeType: v.optional(v.string()),
    originalFileName: v.optional(v.string()),
    isPublic: v.boolean(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const modeloId = await ctx.db.insert("modelos", {
      name: args.name,
      description: args.description,
      category: args.category,
      templateType: args.templateType,
      content: args.content,
      mimeType: args.mimeType,
      originalFileName: args.originalFileName,
      isPublic: args.isPublic,
      createdBy: currentUser._id,
      tags: args.tags,
      usageCount: 0,
      isActive: true,
    });
    
    console.log("Created modelo with id:", modeloId);
    return modeloId;
  },
});

export const getModelos = query({
  args: {
    templateType: v.optional(v.union(v.literal("escrito"), v.literal("document"))),
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    let modelosQuery = ctx.db
      .query("modelos")
      .withIndex("by_active_status", (q) => q.eq("isActive", true));
    
    const modelos = await modelosQuery.collect();
    
    // Filter to show only public templates OR private templates created by current user
    let filteredModelos = modelos.filter(m => 
      m.isPublic || m.createdBy === currentUser._id
    );
    
    if (args.templateType) {
      filteredModelos = filteredModelos.filter(m => m.templateType === args.templateType);
    }
    
    if (args.category) {
      filteredModelos = filteredModelos.filter(m => m.category === args.category);
    }
    
    if (args.isPublic !== undefined) {
      filteredModelos = filteredModelos.filter(m => m.isPublic === args.isPublic);
    }
    
    return filteredModelos;
  },
});

export const incrementModeloUsage = mutation({
  args: {
    modeloId: v.id("modelos"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const modelo = await ctx.db.get(args.modeloId);
    if (!modelo) {
      throw new Error("Template not found");
    }
    
    // Check if user can access this template (public OR own private template)
    if (!modelo.isPublic && modelo.createdBy !== currentUser._id) {
      throw new Error("Unauthorized: Cannot access private template");
    }
    
    await ctx.db.patch(args.modeloId, {
      usageCount: modelo.usageCount + 1,
    });
  },
}); 