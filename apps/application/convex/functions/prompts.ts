import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// PROMPTS LIBRARY MANAGEMENT
// ========================================

/**
 * Creates a new prompt for the library.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.titulo - The prompt title
 * @param {string} args.category - The category/type of legal prompt (e.g., "Civil", "Penal", "Laboral")
 * @param {string} args.descripcion - Description of what the prompt does
 * @param {string} args.prompt - The actual prompt text with [placeholders]
 * @param {boolean} args.isPublic - Whether this prompt is public (shared) or private
 * @param {string[]} [args.tags] - Optional tags for categorizing the prompt
 * @returns {Promise<string>} The created prompt's document ID
 * @throws {Error} When not authenticated
 *
 * @example
 * ```javascript
 * const promptId = await createPrompt({
 *   titulo: "Redacta una demanda por daños y perjuicios",
 *   category: "Civil",
 *   descripcion: "En minutos, tendrás un texto claro y bien fundamentado.",
 *   prompt: "Redacta una demanda por daños y perjuicios por un accidente de tránsito en [ciudad], con fundamentos del Código Civil y Comercial.",
 *   isPublic: true,
 *   tags: ["demanda", "civil", "daños"]
 * });
 * ```
 */
export const createPrompt = mutation({
  args: {
    titulo: v.string(),
    category: v.string(),
    descripcion: v.string(),
    prompt: v.string(),
    isPublic: v.boolean(),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id("prompts"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const now = Date.now();
    const promptId = await ctx.db.insert("prompts", {
      titulo: args.titulo,
      category: args.category,
      descripcion: args.descripcion,
      prompt: args.prompt,
      isPublic: args.isPublic,
      createdBy: currentUser._id,
      tags: args.tags,
      usageCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    console.log("Created prompt with id:", promptId);
    return promptId;
  },
});

/**
 * Retrieves prompts accessible to the current user with optional filtering and pagination.
 *
 * @param {Object} args - The function arguments
 * @param {Object} args.paginationOpts - Pagination options (numItems, cursor)
 * @param {string} [args.category] - Filter by category
 * @param {boolean} [args.isPublic] - Filter by public/private status
 * @returns {Promise<Object>} Paginated result with page, isDone, and continueCursor
 * @throws {Error} When not authenticated
 */
export const getPrompts = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    let query = ctx.db
      .query("prompts")
      .filter((q) => q.eq(q.field("isActive"), true));

    // Apply filters
    if (args.category) {
      query = query.filter((q) => q.eq(q.field("category"), args.category));
    }

    if (args.isPublic !== undefined) {
      query = query.filter((q) => q.eq(q.field("isPublic"), args.isPublic));
    } else {
      // If no specific isPublic filter, show public prompts OR user's own prompts
      query = query.filter((q) =>
        q.or(
          q.eq(q.field("isPublic"), true),
          q.eq(q.field("createdBy"), currentUser._id),
        ),
      );
    }

    const result = await query.order("desc").paginate(args.paginationOpts);

    return result;
  },
});

/**
 * Searches prompts by title with optional filtering.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.searchTerm - The search term to match against prompt titles
 * @param {Object} args.paginationOpts - Pagination options
 * @param {string} [args.category] - Filter by category
 * @returns {Promise<Object>} Paginated search results
 */
export const searchPrompts = query({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    let searchQuery = ctx.db
      .query("prompts")
      .withSearchIndex("search_prompts", (q) =>
        q.search("titulo", args.searchTerm).eq("isActive", true),
      );

    // Apply category filter if provided
    if (args.category) {
      searchQuery = searchQuery.filter((q) =>
        q.eq(q.field("category"), args.category),
      );
    }

    // Filter to show public prompts OR user's own prompts
    searchQuery = searchQuery.filter((q) =>
      q.or(
        q.eq(q.field("isPublic"), true),
        q.eq(q.field("createdBy"), currentUser._id),
      ),
    );

    const result = await searchQuery.paginate(args.paginationOpts);

    return result;
  },
});

/**
 * Gets a single prompt by ID.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.promptId - The ID of the prompt to retrieve
 * @returns {Promise<Object>} The prompt document
 * @throws {Error} When prompt not found or user doesn't have access
 */
export const getPrompt = query({
  args: {
    promptId: v.id("prompts"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const prompt = await ctx.db.get(args.promptId);

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Check if user has access (public or owner)
    if (!prompt.isPublic && prompt.createdBy !== currentUser._id) {
      throw new Error("You don't have access to this prompt");
    }

    return prompt;
  },
});

/**
 * Updates an existing prompt.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.promptId - The ID of the prompt to update
 * @param {string} [args.titulo] - Updated title
 * @param {string} [args.category] - Updated category
 * @param {string} [args.descripcion] - Updated description
 * @param {string} [args.prompt] - Updated prompt text
 * @param {boolean} [args.isPublic] - Updated public status
 * @param {string[]} [args.tags] - Updated tags
 * @returns {Promise<void>}
 * @throws {Error} When user is not the creator
 */
export const updatePrompt = mutation({
  args: {
    promptId: v.id("prompts"),
    titulo: v.optional(v.string()),
    category: v.optional(v.string()),
    descripcion: v.optional(v.string()),
    prompt: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const existingPrompt = await ctx.db.get(args.promptId);

    if (!existingPrompt) {
      throw new Error("Prompt not found");
    }

    // Only creator can update
    if (
      existingPrompt.createdBy !== currentUser._id &&
      existingPrompt.createdBy !== "system"
    ) {
      throw new Error("Only the creator can update this prompt");
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.titulo !== undefined) updateData.titulo = args.titulo;
    if (args.category !== undefined) updateData.category = args.category;
    if (args.descripcion !== undefined)
      updateData.descripcion = args.descripcion;
    if (args.prompt !== undefined) updateData.prompt = args.prompt;
    if (args.isPublic !== undefined) updateData.isPublic = args.isPublic;
    if (args.tags !== undefined) updateData.tags = args.tags;

    await ctx.db.patch(args.promptId, updateData);
  },
});

/**
 * Increments the usage count for a prompt.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.promptId - The ID of the prompt to increment
 * @returns {Promise<void>}
 */
export const incrementPromptUsage = mutation({
  args: {
    promptId: v.id("prompts"),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db.get(args.promptId);

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    await ctx.db.patch(args.promptId, {
      usageCount: prompt.usageCount + 1,
    });
  },
});

/**
 * Deletes (soft delete) a prompt.
 *
 * @param {Object} args - The function arguments
 * @param {string} args.promptId - The ID of the prompt to delete
 * @returns {Promise<void>}
 * @throws {Error} When user is not the creator
 */
export const deletePrompt = mutation({
  args: {
    promptId: v.id("prompts"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const prompt = await ctx.db.get(args.promptId);

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    // Only creator can delete
    if (prompt.createdBy !== currentUser._id && prompt.createdBy !== "system") {
      throw new Error("Only the creator can delete this prompt");
    }

    // Soft delete
    await ctx.db.patch(args.promptId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Gets all unique categories from active prompts.
 *
 * @returns {Promise<string[]>} Array of unique category names
 */
export const getPromptCategories = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const prompts = await ctx.db
      .query("prompts")
      .filter((q) =>
        q.and(
          q.eq(q.field("isActive"), true),
          q.or(
            q.eq(q.field("isPublic"), true),
            q.eq(q.field("createdBy"), currentUser._id),
          ),
        ),
      )
      .collect();

    const categories = new Set(prompts.map((p) => p.category));
    return Array.from(categories).sort();
  },
});
