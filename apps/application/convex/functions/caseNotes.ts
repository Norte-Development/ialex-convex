import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";

// ========================================
// TYPES
// ========================================

export type CaseNoteType =
  | "decisión"
  | "recordatorio"
  | "acuerdo"
  | "información"
  | "otro";

// ========================================
// QUERIES
// ========================================

/**
 * List all active notes for a case, ordered by most recently edited
 * Requires basic access level
 */
export const listNotesByCase = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify user has basic access to case
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Fetch all active notes for this case
    const notes = await ctx.db
      .query("caseNotes")
      .withIndex("by_case_and_active", (q) =>
        q.eq("caseId", args.caseId).eq("isActive", true)
      )
      .collect();

    // Sort by lastEditedAt descending (most recent first)
    // If no lastEditedAt, use creation time
    const sortedNotes = notes.sort((a, b) => {
      const timeA = a.lastEditedAt || a._creationTime;
      const timeB = b.lastEditedAt || b._creationTime;
      return timeB - timeA;
    });

    // Enrich with creator names
    const enrichedNotes = await Promise.all(
      sortedNotes.map(async (note) => {
        const creator = await ctx.db.get(note.createdBy);
        const updater = note.updatedBy ? await ctx.db.get(note.updatedBy) : null;

        return {
          ...note,
          creatorName: creator?.name || "Usuario",
          updaterName: updater?.name || null,
        };
      })
    );

    return enrichedNotes;
  },
});

/**
 * Get a single note by ID
 * Requires basic access level
 */
export const getNoteById = query({
  args: {
    noteId: v.id("caseNotes"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const note = await ctx.db.get(args.noteId);
    if (!note || !note.isActive) {
      throw new Error("Nota no encontrada");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(ctx, currentUser._id, note.caseId, "basic");

    // Enrich with creator info
    const creator = await ctx.db.get(note.createdBy);
    const updater = note.updatedBy ? await ctx.db.get(note.updatedBy) : null;

    return {
      ...note,
      creatorName: creator?.name || "Usuario",
      updaterName: updater?.name || null,
    };
  },
});

// ========================================
// MUTATIONS
// ========================================

/**
 * Create a new case note
 * Requires basic access level
 */
export const createCaseNote = mutation({
  args: {
    caseId: v.id("cases"),
    content: v.string(),
    title: v.optional(v.string()),
    type: v.union(
      v.literal("decisión"),
      v.literal("recordatorio"),
      v.literal("acuerdo"),
      v.literal("información"),
      v.literal("otro")
    ),
    isImportant: v.boolean(),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify user has basic access to case
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Validate content is not empty
    if (!args.content.trim()) {
      throw new Error("El contenido de la nota es requerido");
    }

    const noteId = await ctx.db.insert("caseNotes", {
      caseId: args.caseId,
      content: args.content.trim(),
      title: args.title?.trim() || undefined,
      type: args.type,
      isImportant: args.isImportant,
      createdBy: currentUser._id,
      isActive: true,
    });

    console.log("Created case note:", noteId);
    return noteId;
  },
});

/**
 * Update an existing case note
 * Requires basic access level (anyone with access can edit)
 */
export const updateCaseNote = mutation({
  args: {
    noteId: v.id("caseNotes"),
    content: v.optional(v.string()),
    title: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("decisión"),
        v.literal("recordatorio"),
        v.literal("acuerdo"),
        v.literal("información"),
        v.literal("otro")
      )
    ),
    isImportant: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const existingNote = await ctx.db.get(args.noteId);
    if (!existingNote || !existingNote.isActive) {
      throw new Error("Nota no encontrada");
    }

    // Verify user has basic access to case
    await requireNewCaseAccess(ctx, currentUser._id, existingNote.caseId, "basic");

    // Build updates object (only include provided fields)
    const updates: any = {};
    if (args.content !== undefined) {
      if (!args.content.trim()) {
        throw new Error("El contenido de la nota es requerido");
      }
      updates.content = args.content.trim();
    }
    if (args.title !== undefined) {
      updates.title = args.title.trim() || undefined;
    }
    if (args.type !== undefined) updates.type = args.type;
    if (args.isImportant !== undefined) updates.isImportant = args.isImportant;

    // Always update these fields
    updates.updatedBy = currentUser._id;
    updates.lastEditedAt = Date.now();

    await ctx.db.patch(args.noteId, updates);

    console.log("Updated case note:", args.noteId);
    return null;
  },
});

/**
 * Soft delete a case note (sets isActive to false)
 * Requires basic access level
 */
export const deleteCaseNote = mutation({
  args: {
    noteId: v.id("caseNotes"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const existingNote = await ctx.db.get(args.noteId);
    if (!existingNote || !existingNote.isActive) {
      throw new Error("Nota no encontrada");
    }

    // Verify user has basic access to case
    await requireNewCaseAccess(ctx, currentUser._id, existingNote.caseId, "basic");

    await ctx.db.patch(args.noteId, {
      isActive: false,
      updatedBy: currentUser._id,
      lastEditedAt: Date.now(),
    });

    console.log("Deleted case note:", args.noteId);
    return null;
  },
});
