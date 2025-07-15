import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

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
    createdBy: v.id("users"),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const modeloId = await ctx.db.insert("modelos", {
      name: args.name,
      description: args.description,
      category: args.category,
      templateType: args.templateType,
      content: args.content,
      mimeType: args.mimeType,
      originalFileName: args.originalFileName,
      isPublic: args.isPublic,
      createdBy: args.createdBy,
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
    let modelosQuery = ctx.db
      .query("modelos")
      .withIndex("by_active_status", (q) => q.eq("isActive", true));
    
    const modelos = await modelosQuery.collect();
    
    let filteredModelos = modelos;
    
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
    const modelo = await ctx.db.get(args.modeloId);
    if (modelo) {
      await ctx.db.patch(args.modeloId, {
        usageCount: modelo.usageCount + 1,
      });
    }
  },
}); 