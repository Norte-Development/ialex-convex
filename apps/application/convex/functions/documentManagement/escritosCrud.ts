import { v } from "convex/values";
import { mutation, internalMutation } from "../../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../../auth_utils";
import { internal, components } from "../../_generated/api";
import { _checkLimit, _getBillingEntity } from "../../billing/features";
import { Id } from "../../_generated/dataModel";

/**
 * Creates a new escrito (legal writing/brief) for a case.
 *
 * This mutation is idempotent: if an escrito with the given prosemirrorId already exists,
 * it returns the existing escrito instead of creating a duplicate. This prevents accidental
 * duplicate creation from multiple calls with the same prosemirrorId.
 *
 * The ProseMirror document will be created client-side when the editor loads,
 * following the empty document pattern for collaborative editing.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The escrito title
 * @param {string} args.caseId - The ID of the case this escrito belongs to
 * @param {string} args.prosemirrorId - The UUID for the ProseMirror document (must be unique)
 * @param {number} [args.presentationDate] - Optional timestamp for when this will be presented
 * @param {string} [args.courtName] - Name of the court where this will be filed
 * @param {string} [args.expedientNumber] - Court expedient/case number
 * @returns {Promise<{escritoId: string, prosemirrorId: string, alreadyExists: boolean}>} IDs for the created (or existing) escrito, its ProseMirror document, and a flag indicating if it already existed
 * @throws {Error} When not authenticated or lacking full case access
 *
 * @example
 * ```javascript
 * const prosemirrorId = crypto.randomUUID();
 * const { escritoId } = await createEscrito({
 *   title: "Motion to Dismiss",
 *   caseId: "case_123",
 *   prosemirrorId: prosemirrorId,
 *   courtName: "Supreme Court",
 *   expedientNumber: "SC-2024-001"
 * });
 * ```
 */
export const createEscrito = mutation({
  args: {
    title: v.string(),
    caseId: v.id("cases"),
    prosemirrorId: v.string(), // Accept the prosemirror ID from client
    presentationDate: v.optional(v.number()),
    courtName: v.optional(v.string()),
    expedientNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has escrito write permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // IDEMPOTENCY CHECK: Check if an escrito with this prosemirrorId already exists
    const existingEscrito = await ctx.db
      .query("escritos")
      .withIndex("by_prosemirror_id", (q) =>
        q.eq("prosemirrorId", args.prosemirrorId),
      )
      .first();

    if (existingEscrito) {
      console.log(
        "Escrito with prosemirrorId already exists:",
        existingEscrito._id,
      );
      // Return the existing escrito instead of creating a duplicate
      return {
        escritoId: existingEscrito._id,
        prosemirrorId: existingEscrito.prosemirrorId,
        alreadyExists: true,
      };
    }

    // Get team context
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: args.caseId,
      },
    );

    // Check escritos limit
    const existingEscritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    await _checkLimit(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
      limitType: "escritosPerCase",
      currentCount: existingEscritos.length,
    });

    // Just store the escrito record with the provided prosemirrorId
    // The ProseMirror document will be created client-side when the editor loads
    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      caseId: args.caseId,
      status: "borrador",
      presentationDate: args.presentationDate,
      courtName: args.courtName,
      expedientNumber: args.expedientNumber,
      prosemirrorId: args.prosemirrorId,
      lastEditedAt: Date.now(),
      createdBy: currentUser._id,
      lastModifiedBy: currentUser._id,
      isArchived: false,
    });

    // Increment with correct entity
    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "escritosCount",
      amount: 1,
    });

    console.log("Created escrito with id:", escritoId);
    return {
      escritoId,
      prosemirrorId: args.prosemirrorId,
      alreadyExists: false,
    };
  },
});

/**
 * Internal mutation to create a new escrito with initial content.
 *
 * This mutation creates a ProseMirror document with initial content and creates
 * the corresponding escrito record.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.title - The escrito title
 * @param {string} args.caseId - The ID of the case this escrito belongs to
 * @param {string} args.userId - User ID for the escrito creator
 * @param {string} args.initialContent - Initial text content for the escrito
 * @returns {Promise<{escritoId: string}>} The created escrito's ID
 */
export const createEscritoWithContent = internalMutation({
  args: {
    title: v.string(),
    caseId: v.id("cases"),
    userId: v.id("users"),
    initialContent: v.any(),
  },
  returns: v.object({
    escritoId: v.id("escritos"),
  }),
  handler: async (ctx, args) => {
    const userId = args.userId;

    const prosemirrorId = crypto.randomUUID();
    await ctx.runMutation(components.prosemirrorSync.lib.submitSnapshot, {
      id: prosemirrorId,
      content: JSON.stringify(args.initialContent),
      version: 0,
    });

    const now = Date.now();

    const escritoId = await ctx.db.insert("escritos", {
      title: args.title,
      caseId: args.caseId,
      prosemirrorId: prosemirrorId,
      status: "borrador",
      createdBy: userId,
      lastModifiedBy: userId,
      isArchived: false,
      lastEditedAt: now,
      // Reasonable defaults for optional metadata fields
      expedientNumber: undefined,
      presentationDate: undefined,
      courtName: undefined,
      wordCount: undefined,
    });

    console.log("Created escrito with content, id:", escritoId);
    return { escritoId };
  },
});

/**
 * Updates an existing escrito with new content or metadata.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to update
 * @param {string} [args.title] - New title for the escrito
 * @param {string} [args.content] - New content in Tiptap JSON format
 * @param {"borrador" | "terminado"} [args.status] - New status (draft or finished)
 * @param {number} [args.presentationDate] - New presentation date timestamp
 * @param {string} [args.courtName] - New court name
 * @param {string} [args.expedientNumber] - New expedient number
 * @throws {Error} When not authenticated, escrito not found, or lacking full case access
 *
 * @description This function updates an escrito with new data. Only provided fields
 * are updated, allowing for partial updates. The function automatically updates
 * the modification timestamp and word count when content changes.
 *
 * @example
 * ```javascript
 * // Update content and mark as finished
 * await updateEscrito({
 *   escritoId: "escrito_123",
 *   content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Final version..."}]}]}',
 *   status: "terminado"
 * });
 *
 * // Update only court information
 * await updateEscrito({
 *   escritoId: "escrito_123",
 *   courtName: "Appeals Court",
 *   expedientNumber: "AC-2024-002"
 * });
 * ```
 */
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

    // Verify user has escrito write permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      escrito.caseId,
      "advanced",
    );

    const updates: {
      lastModifiedBy: Id<"users">;
      lastEditedAt: number;
      title?: string;
      content?: string;
      wordCount?: number;
      status?: "borrador" | "terminado";
      presentationDate?: number;
      courtName?: string;
      expedientNumber?: string;
    } = {
      lastModifiedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };

    if (args.title) updates.title = args.title;
    if (args.content) {
      updates.content = args.content;
      updates.wordCount = args.content.length; // Update word count
    }
    if (args.status) updates.status = args.status;
    if (args.presentationDate !== undefined)
      updates.presentationDate = args.presentationDate;
    if (args.courtName !== undefined) updates.courtName = args.courtName;
    if (args.expedientNumber !== undefined)
      updates.expedientNumber = args.expedientNumber;

    await ctx.db.patch(args.escritoId, updates);
    console.log("Updated escrito:", args.escritoId);
  },
});

/**
 * Archives or unarchives an escrito.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to archive/unarchive
 * @param {boolean} args.isArchived - Whether to archive (true) or unarchive (false) the escrito
 * @throws {Error} When not authenticated, escrito not found, or lacking full case access
 *
 * @description This function toggles the archived status of an escrito. When archived,
 * the escrito will no longer appear in the main escritos list but can be restored later.
 * The user must have full access to the case to archive/unarchive escritos.
 *
 * @example
 * ```javascript
 * // Archive an escrito
 * await archiveEscrito({
 *   escritoId: "escrito_123",
 *   isArchived: true
 * });
 *
 * // Unarchive an escrito
 * await archiveEscrito({
 *   escritoId: "escrito_123",
 *   isArchived: false
 * });
 * ```
 */
export const archiveEscrito = mutation({
  args: {
    escritoId: v.id("escritos"),
    isArchived: v.boolean(),
  },
  handler: async (ctx, args) => {
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Verify user has escrito delete permission for archiving using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, escrito.caseId, "admin");

    // Update the archived status
    await ctx.db.patch(args.escritoId, { isArchived: args.isArchived });

    // Get team context from case to update usage counter from correct entity
    const teamContext = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      {
        caseId: escrito.caseId,
      },
    );

    const billing = await _getBillingEntity(ctx, {
      userId: currentUser._id,
      teamId: teamContext ?? undefined,
    });

    // Update usage counter based on archiving action
    // Archiving: decrement counter (removing from active count)
    // Unarchiving: increment counter (adding back to active count)
    const counterChange = args.isArchived ? -1 : 1;
    await ctx.scheduler.runAfter(0, internal.billing.features.incrementUsage, {
      entityId: billing.entityId,
      entityType: billing.entityType,
      counter: "escritosCount",
      amount: counterChange,
    });

    return { success: true };
  },
});

