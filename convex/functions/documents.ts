import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireCaseAccess } from "./auth_utils";

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

export const createDocument = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.id("cases"),
    documentType: v.optional(v.union(
      v.literal("contract"),
      v.literal("evidence"),
      v.literal("correspondence"),
      v.literal("legal_brief"),
      v.literal("court_filing"),
      v.literal("other")
    )),
    fileId: v.id("_storage"),
    originalFileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    const documentId = await ctx.db.insert("documents", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
      documentType: args.documentType,
      fileId: args.fileId,
      originalFileName: args.originalFileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: currentUser._id,
      tags: args.tags,
    });
    
    console.log("Created document with id:", documentId);
    return documentId;
  },
});

export const getDocuments = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect();
    
    return documents;
  },
});

// ========================================
// ESCRITO MANAGEMENT (Simplified)
// ========================================

export const createEscrito = mutation({
  args: {
    title: v.string(),
    content: v.string(), // Tiptap JSON
    caseId: v.id("cases"),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, args.caseId, "full");
    
    const wordCount = args.content.length; // Simple word count estimation
    
    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      content: args.content,
      caseId: args.caseId,
      status: "borrador",
      presentationDate: args.presentationDate,
      courtName: args.courtName,
      expedientNumber: args.expedientNumber,
      wordCount: wordCount,
      lastEditedAt: Date.now(),
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      isArchived: false,
    });
    
    console.log("Created escrito with id:", escritoId);
    return escritoId;
  },
});

export const updateEscrito = mutation({
  args: {
    escritoId: v.id("escritos"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("borrador"), v.literal("terminado"))),
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the escrito to check case access
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }
    
    // Verify user has full access to the case
    const { currentUser } = await requireCaseAccess(ctx, escrito.caseId, "full");
    
    const updates: any = {
      lastModifiedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };
    
    if (args.title) updates.title = args.title;
    if (args.content) {
      updates.content = args.content;
      updates.wordCount = args.content.length; // Update word count
    }
    if (args.status) updates.status = args.status;
    if (args.presentationDate !== undefined) updates.presentationDate = args.presentationDate;
    if (args.courtName !== undefined) updates.courtName = args.courtName;
    if (args.expedientNumber !== undefined) updates.expedientNumber = args.expedientNumber;
    
    await ctx.db.patch(args.escritoId, updates);
    console.log("Updated escrito:", args.escritoId);
  },
});

export const getEscritos = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to the case
    await requireCaseAccess(ctx, args.caseId, "read");
    
    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();
    
    return escritos;
  },
}); 