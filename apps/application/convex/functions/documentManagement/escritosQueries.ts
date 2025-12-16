import { v } from "convex/values";
import { query, internalQuery } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../../auth_utils";
import { Id } from "../../_generated/dataModel";
import { components } from "../../_generated/api";

/**
 * Retrieves all active escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get escritos for
 * @returns {Promise<Object[]>} Array of escrito records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns all non-archived escritos belonging to a case,
 * ordered by creation date with the most recent first. The user must have read
 * access to the case to view its escritos.
 *
 * @example
 * ```javascript
 * const escritos = await getEscritos({ caseId: "case_123" });
 * // Returns: [{ title: "Motion", status: "borrador", wordCount: 1500 }, ...]
 * ```
 */
export const getEscritos = query({
  args: {
    caseId: v.id("cases"),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.union(v.literal("borrador"), v.literal("terminado"))),
    sortBy: v.optional(v.string()),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    totalCount: v.number(),
  }),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all escritos for the case
    let escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Apply search filter
    if (args.search && args.search.trim()) {
      const searchTerm = args.search.toLowerCase().trim();
      escritos = escritos.filter((escrito) =>
        escrito.title.toLowerCase().includes(searchTerm),
      );
    }

    // Apply status filter
    if (args.status) {
      escritos = escritos.filter((escrito) => escrito.status === args.status);
    }

    // Apply sorting
    if (args.sortBy && args.sortOrder) {
      escritos.sort((a, b) => {
        let aValue, bValue;

        switch (args.sortBy) {
          case "title":
            aValue = a.title.toLowerCase();
            bValue = b.title.toLowerCase();
            break;
          case "status":
            aValue = a.status;
            bValue = b.status;
            break;
          case "createdAt":
          default:
            aValue = a._creationTime;
            bValue = b._creationTime;
            break;
        }

        if (aValue < bValue) return args.sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return args.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by creation time (newest first)
      escritos.sort((a, b) => b._creationTime - a._creationTime);
    }

    // Apply pagination
    const offset = args.paginationOpts.cursor
      ? parseInt(args.paginationOpts.cursor)
      : 0;
    const startIndex = offset;
    const endIndex = offset + args.paginationOpts.numItems;

    const paginatedEscritos = escritos.slice(startIndex, endIndex);
    const isDone = endIndex >= escritos.length;
    const continueCursor = isDone ? null : endIndex.toString();

    return {
      page: paginatedEscritos,
      isDone,
      continueCursor,
      totalCount: escritos.length,
    };
  },
});

/**
 * Retrieves a specific escrito by ID.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.escritoId - The ID of the escrito to retrieve
 * @returns {Promise<Object>} The escrito record
 * @throws {Error} When not authenticated, the escrito is not found, or access is denied
 *
 * @description Fetches an escrito and validates the requester has read access to the
 * corresponding case.
 *
 * @example
 * ```javascript
 * const escrito = await getEscrito({ escritoId: "escrito_123" });
 * // Returns: { title: "Motion", status: "borrador", ... }
 * ```
 */
export const getEscrito = query({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    // First get the escrito to access its caseId
    const escrito = await ctx.db.get(args.escritoId);
    if (!escrito) {
      throw new Error("Escrito not found");
    }

    // Verify user has escrito read permission using the case ID
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, escrito.caseId, "basic");

    return escrito;
  },
});

export const internalGetEscrito = internalQuery({
  args: {
    escritoId: v.id("escritos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.escritoId);
  },
});

/**
 * Retrieves all archived escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case to get archived escritos for
 * @returns {Promise<Object[]>} Array of archived escrito records ordered by creation date (newest first)
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description This function returns all archived escritos belonging to a case,
 * ordered by creation date with the most recent first. The user must have read
 * access to the case to view its archived escritos.
 *
 * @example
 * ```javascript
 * const archivedEscritos = await getArchivedEscritos({ caseId: "case_123" });
 * // Returns: [{ title: "Old Motion", status: "terminado", isArchived: true }, ...]
 * ```
 */
export const getArchivedEscritos = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    // Verify user has escrito read permission using NEW system
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const archivedEscritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), true))
      .order("desc")
      .collect();

    return archivedEscritos;
  },
});

/**
 * Searches escritos by title for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @param {string} args.query - The search query string
 * @param {number} [args.limit] - Maximum number of results (default: 20)
 * @returns {Promise<Object[]>} Array of matching escrito documents
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description Performs a case-insensitive search on escrito titles.
 * Only returns non-archived escritos.
 *
 * @example
 * ```javascript
 * const results = await searchEscritos({
 *   caseId: "case_123",
 *   query: "motion",
 *   limit: 10
 * });
 * ```
 */
export const searchEscritos = query({
  args: {
    caseId: v.id("cases"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const limit = args.limit || 20;
    const searchTerm = args.query.toLowerCase().trim();

    if (!searchTerm) {
      return [];
    }

    // Get all non-archived escritos for the case
    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    // Filter by search term and limit results
    return escritos
      .filter((escrito) => escrito.title.toLowerCase().includes(searchTerm))
      .sort((a, b) => b.lastEditedAt - a.lastEditedAt)
      .slice(0, limit);
  },
});

/**
 * Gets the most recent escritos for a specific case.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @param {number} [args.limit] - Maximum number of results (default: 10)
 * @returns {Promise<Object[]>} Array of recent escrito documents
 * @throws {Error} When not authenticated or lacking case access
 *
 * @description Returns the most recently edited non-archived escritos.
 *
 * @example
 * ```javascript
 * const recent = await getRecentEscritos({
 *   caseId: "case_123",
 *   limit: 5
 * });
 * ```
 */
export const getRecentEscritos = query({
  args: {
    caseId: v.id("cases"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Verify user has escrito read permission
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    const limit = args.limit || 10;

    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .take(limit);

    return escritos;
  },
});

export const resolveEscritoId = internalQuery({
  args: {
    escritoId: v.string(),
  },
  handler: async (ctx, args) => {
    const raw = args.escritoId?.trim();
    if (!raw) {
      return null;
    }

    try {
      const direct = await ctx.db.get(raw as Id<"escritos">);
      if (direct) {
        return direct._id;
      }
    } catch {
      // ignore and fall back to prefix matching
    }

    if (raw.length < 32) {
      const matches: Array< { _id: Id<"escritos">; score: number }> = [];
      let scanned = 0;
      for await (const doc of ctx.db.query("escritos")) {
        scanned += 1;
        if ((doc._id as string).startsWith(raw)) {
          const score = doc.lastEditedAt ?? doc._creationTime ?? 0;
          matches.push({ _id: doc._id, score });
        }
        if (matches.length >= 5 || scanned >= 1000) {
          break;
        }
      }

      if (matches.length > 0) {
        matches.sort((a, b) => b.score - a.score);
        return matches[0]._id;
      }
    }

    return null;
  },
});

/**
 * Gets all escritos in a case that have pending changes (change nodes in their prosemirror documents).
 *
 * @param {Object} args - The function arguments
 * @param {string} args.caseId - The ID of the case
 * @returns {Promise<Array<{escritoId: Id<"escritos">, prosemirrorId: string, title: string, pendingChangesCount: number}>>} Array of escritos with pending changes
 * @throws {Error} When not authenticated or lacking case access
 */
export const getEscritosWithPendingChanges = query({
  args: {
    caseId: v.id("cases"),
  },
  returns: v.array(
    v.object({
      escritoId: v.id("escritos"),
      prosemirrorId: v.string(),
      title: v.string(),
      pendingChangesCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all escritos for the case
    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    const resultados: Array<{
      escritoId: Id<"escritos">;
      prosemirrorId: string;
      title: string;
      pendingChangesCount: number;
    }> = [];

    // Check each escrito for pending changes
    for (const escrito of escritos) {
      try {
        // Use getSnapshot to get the document JSON
        const snapshotResult = await ctx.runQuery(
          components.prosemirrorSync.lib.getSnapshot,
          {
            id: escrito.prosemirrorId,
          },
        );

        // Check if snapshot has content (it can be null or have content property)
        if (!snapshotResult || snapshotResult.content === null) continue;

        // Type guard: check if content exists
        if (!("content" in snapshotResult)) continue;

        // Parse the snapshot JSON to check for change nodes
        const content = (snapshotResult as { content: string }).content;
        const docJson =
          typeof content === "string" ? JSON.parse(content) : content;
        let changeCount = 0;

        // Recursively count change nodes in the JSON structure
        function countChangesInNode(node: unknown): void {
          if (!node || typeof node !== "object") return;

          const nodeObj = node as Record<string, unknown>;
          if (
            nodeObj.type === "inlineChange" ||
            nodeObj.type === "blockChange" ||
            nodeObj.type === "lineBreakChange"
          ) {
            changeCount++;
          }

          if (nodeObj.content && Array.isArray(nodeObj.content)) {
            nodeObj.content.forEach((child: unknown) =>
              countChangesInNode(child),
            );
          }
        }

        countChangesInNode(docJson);

        if (changeCount > 0) {
          resultados.push({
            escritoId: escrito._id,
            prosemirrorId: escrito.prosemirrorId,
            title: escrito.title,
            pendingChangesCount: changeCount,
          });
        }
      } catch (error) {
        // Skip escritos that can't be loaded
        console.error(`Error checking escrito ${escrito._id} for changes:`, error);
      }
    }

    return resultados;
  },
});

