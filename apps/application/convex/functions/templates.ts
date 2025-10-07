import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { api } from "../_generated/api";

// ========================================
// MODELOS (TEMPLATES) MANAGEMENT
// ========================================

/**
 * Creates a new template (modelo) for escritos.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.name - The template name/title
 * @param {string} [args.description] - Optional description of the template
 * @param {string} args.category - The category/type of legal template (e.g., "Derecho Civil", "Derecho Mercantil")
 * @param {"json" | "html"} args.content_type - Content format (TipTap JSON or HTML)
 * @param {string} [args.content] - Template content (TipTap JSON string or HTML string)
 * @param {boolean} args.isPublic - Whether this template is public (shared) or private
 * @param {string[]} [args.tags] - Optional tags for categorizing the template
 * @returns {Promise<string>} The created template's document ID
 * @throws {Error} When not authenticated
 * 
 * @description This function creates a new template that can be used to generate
 * escritos. Templates can be either public (available to all users)
 * or private (only available to the creator). The usage count starts at 0 and
 * is incremented each time the template is used.
 * 
 * Content can be stored as:
 * - TipTap JSON: Exact editor structure for high fidelity
 * - HTML: Human-readable format, converted to TipTap JSON when applied
 * 
 * @example
 * ```javascript
 * // Create a public template with HTML content
 * const templateId = await createModelo({
 *   name: "Demanda Civil",
 *   description: "Plantilla estándar para demandas civiles",
 *   category: "Derecho Civil",
 *   content_type: "html",
 *   content: '<h1>DEMANDA</h1><p>En la ciudad de...</p>',
 *   isPublic: true,
 *   tags: ["demanda", "civil"]
 * });
 * 
 * // Create a private template with TipTap JSON
 * const jsonTemplateId = await createModelo({
 *   name: "Recurso de Apelación", 
 *   category: "Derecho Procesal",
 *   content_type: "json",
 *   content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"RECURSO"}]}]}',
 *   isPublic: false
 * });
 * ```
 */
export const createModelo = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    content: v.optional(v.string()),
    content_type: v.optional(v.string()),
    originalFileName: v.optional(v.string()),
    isPublic: v.boolean(),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id("modelos"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const modeloId = await ctx.db.insert("modelos", {
      name: args.name,
      description: args.description,
      category: args.category,
      content: args.content,
      content_type: args.content_type,
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

/**
 * Retrieves templates accessible to the current user with optional filtering and pagination.
 * 
 * @param {Object} args - The function arguments
 * @param {Object} args.paginationOpts - Pagination options (numItems, cursor)
 * @param {"json" | "html"} [args.content_type] - Filter by content format
 * @param {string} [args.category] - Filter by category
 * @param {boolean} [args.isPublic] - Filter by public/private status
 * @returns {Promise<Object>} Paginated result with page, isDone, and continueCursor
 * @throws {Error} When not authenticated
 * 
 * @description This function returns templates that the user can access, which includes:
 * - All public templates created by any user or system
 * - Private templates created by the current user
 * 
 * The results can be filtered by content type, category, or public status.
 * Only active templates are returned.
 * Results are paginated for better performance with large template collections.
 * 
 * @example
 * ```javascript
 * // Get first page of all accessible templates (20 items)
 * const result = await getModelos({ 
 *   paginationOpts: { numItems: 20, cursor: null } 
 * });
 * 
 * // Get next page using cursor
 * const nextPage = await getModelos({ 
 *   paginationOpts: { numItems: 20, cursor: result.continueCursor } 
 * });
 * 
 * // Get only HTML templates with pagination
 * const htmlTemplates = await getModelos({ 
 *   paginationOpts: { numItems: 10, cursor: null },
 *   content_type: "html" 
 * });
 * 
 * // Get only public civil law templates
 * const civilTemplates = await getModelos({ 
 *   paginationOpts: { numItems: 15, cursor: null },
 *   category: "Derecho Civil",
 *   isPublic: true 
 * });
 * ```
 */
export const getModelos = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Start with all active templates
    let modelosQuery = ctx.db
      .query("modelos")
      .withIndex("by_active_status", (q) => q.eq("isActive", true));
    
    // Get all templates first (we need to filter by access permissions)
    const allModelos = await modelosQuery.collect();
    
    // Filter to show only public templates OR private templates created by current user
    let filteredModelos = allModelos.filter(m => 
      m.isPublic || m.createdBy === currentUser._id
    );
    
    // Apply additional filters
    if (args.category) {
      filteredModelos = filteredModelos.filter(m => m.category === args.category);
    }

    if (args.content_type) {
      filteredModelos = filteredModelos.filter(m => m.content_type === args.content_type);
    }
    
    if (args.isPublic !== undefined) {
      filteredModelos = filteredModelos.filter(m => m.isPublic === args.isPublic);
    }
    
    // Sort by creation time (newest first) for consistent pagination
    filteredModelos.sort((a, b) => b._creationTime - a._creationTime);
    
    // Implement pagination manually since we need to filter after collection
    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + numItems;
    
    const page = filteredModelos.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredModelos.length;
    const continueCursor = isDone ? null : endIndex.toString();
    
    return {
      page,
      isDone,
      continueCursor,
    };
  },
});

/**
 * Get a specific template by ID.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.modeloId - The ID of the template to retrieve
 * @returns {Promise<Object>} The template document with full content
 * @throws {Error} When not authenticated, template not found, or unauthorized access
 * 
 * @description This function retrieves a specific template by ID. Users can only
 * access public templates or their own private templates.
 * 
 * @example
 * ```javascript
 * const template = await getModelo({ modeloId: "template_123" });
 * console.log(template.content); // HTML or JSON content
 * ```
 */
export const getModelo = query({
  args: {
    modeloId: v.id("modelos"),
  },
  returns: v.union(
    v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const modelo = await ctx.db.get(args.modeloId);
    if (!modelo) {
      return null;
    }
    
    // Check if user can access this template (public OR own private template OR system template)
    if (!modelo.isPublic && modelo.createdBy !== currentUser._id && modelo.createdBy !== "system") {
      throw new Error("Unauthorized: Cannot access private template");
    }

    
    return modelo;
  },
});

/**
 * Search templates using full-text search with optional filtering.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.searchTerm - The search term to look for in template names
 * @param {Object} args.paginationOpts - Pagination options (numItems, cursor)
 * @param {string} [args.category] - Filter by category
 * @param {boolean} [args.isPublic] - Filter by public/private status
 * @param {string} [args.content_type] - Filter by content format
 * @returns {Promise<Object>} Paginated result with page, isDone, and continueCursor
 * @throws {Error} When not authenticated
 * 
 * @description This function performs full-text search on template names using Convex's
 * search index. It returns templates that the user can access (public templates or
 * their own private templates) and matches the search criteria.
 * 
 * The search is performed on the template name field and can be combined with
 * additional filters for category, public status, and content type.
 * 
 * @example
 * ```javascript
 * // Search for templates containing "demanda"
 * const result = await searchModelos({ 
 *   searchTerm: "demanda",
 *   paginationOpts: { numItems: 20, cursor: null } 
 * });
 * 
 * // Search with additional filters
 * const civilTemplates = await searchModelos({ 
 *   searchTerm: "civil",
 *   paginationOpts: { numItems: 10, cursor: null },
 *   category: "Derecho Civil",
 *   isPublic: true 
 * });
 * ```
 */
export const searchModelos = query({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    // Build the search query with filters
    let searchQuery = ctx.db
      .query("modelos")
      .withSearchIndex("search_templates", (q) => {
        let query = q.search("name", args.searchTerm);
        
        // Apply filters
        if (args.category) {
          query = query.eq("category", args.category);
        }
        if (args.isPublic !== undefined) {
          query = query.eq("isPublic", args.isPublic);
        }
        query = query.eq("isActive", true); // Only active templates
        
        return query;
      });
    
    // Get all matching templates first (we need to filter by access permissions)
    const allModelos = await searchQuery.collect();
    
    // Filter to show only public templates OR private templates created by current user
    let filteredModelos = allModelos.filter(m => 
      m.isPublic || m.createdBy === currentUser._id
    );
    
    // Apply additional filters that aren't supported by the search index
    if (args.content_type) {
      filteredModelos = filteredModelos.filter(m => m.content_type === args.content_type);
    }
    
    // Sort by creation time (newest first) for consistent pagination
    filteredModelos.sort((a, b) => b._creationTime - a._creationTime);
    
    // Implement pagination manually since we need to filter after collection
    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + numItems;
    
    const page = filteredModelos.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredModelos.length;
    const continueCursor = isDone ? null : endIndex.toString();
    
    return {
      page,
      isDone,
      continueCursor,
    };
  },
});

/**
 * Increments the usage count for a template when it's used.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.modeloId - The ID of the template that was used
 * @throws {Error} When not authenticated, template not found, or unauthorized access to private template
 * 
 * @description This function tracks template usage by incrementing a counter each time
 * a template is used to create an escrito. Users can only increment usage
 * for public templates or their own private templates. This provides analytics on
 * template popularity and usage patterns.
 * 
 * @example
 * ```javascript
 * // After using a template to create an escrito
 * await incrementModeloUsage({ modeloId: "template_123" });
 * ```
 */
export const incrementModeloUsage = mutation({
  args: {
    modeloId: v.id("modelos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const modelo = await ctx.db.get(args.modeloId);
    if (!modelo) {
      throw new Error("Template not found");
    }
    
    // Check if user can access this template (public OR own private template OR system template)
    if (!modelo.isPublic && modelo.createdBy !== currentUser._id && modelo.createdBy !== "system") {
      throw new Error("Unauthorized: Cannot access private template");
    }
    
    await ctx.db.patch(args.modeloId, {
      usageCount: modelo.usageCount + 1,
    });
    
    return null;
  },
});

// ========================================
// INTERNAL FUNCTIONS FOR AGENT TOOLS
// ========================================

/**
 * Internal query to get a specific template by ID for agent tools.
 * Bypasses authentication but still checks access permissions.
 */
export const internalGetModelo = internalQuery({
  args: {
    modeloId: v.id("modelos"),
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      templateType: v.optional(v.union(v.literal("escrito"), v.literal("document"))),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      prosemirrorId: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const modelo = await ctx.db.get(args.modeloId);
    if (!modelo) {
      return null;
    }
    
    // Check if user can access this template (public OR own private template OR system template)
    if (!modelo.isPublic && modelo.createdBy !== args.userId && modelo.createdBy !== "system") {
      return null;
    }
    
    // Only return active templates
    if (!modelo.isActive) {
      return null;
    }
    
    return modelo;
  },
});

/**
 * Internal query to search templates for agent tools.
 */
export const internalSearchModelos = internalQuery({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
    userId: v.id("users"),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      templateType: v.optional(v.union(v.literal("escrito"), v.literal("document"))),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      prosemirrorId: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Build the search query with filters
    let searchQuery = ctx.db
      .query("modelos")
      .withSearchIndex("search_templates", (q) => {
        let query = q.search("name", args.searchTerm);
        
        // Apply filters
        if (args.category) {
          query = query.eq("category", args.category);
        }
        if (args.isPublic !== undefined) {
          query = query.eq("isPublic", args.isPublic);
        }
        query = query.eq("isActive", true); // Only active templates
        
        return query;
      });
    
    // Get all matching templates first (we need to filter by access permissions)
    const allModelos = await searchQuery.collect();
    
    // Filter to show only public templates OR private templates created by current user
    let filteredModelos = allModelos.filter(m => 
      m.isPublic || m.createdBy === args.userId
    );
    
    // Apply additional filters that aren't supported by the search index
    if (args.content_type) {
      filteredModelos = filteredModelos.filter(m => m.content_type === args.content_type);
    }
    
    // Sort by creation time (newest first) for consistent pagination
    filteredModelos.sort((a, b) => b._creationTime - a._creationTime);
    
    // Implement pagination manually since we need to filter after collection
    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + numItems;
    
    const page = filteredModelos.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredModelos.length;
    const continueCursor = isDone ? null : endIndex.toString();
    
    return {
      page,
      isDone,
      continueCursor,
    };
  },
});

/**
 * Internal query to get templates with filtering for agent tools.
 */
export const internalGetModelos = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
    userId: v.id("users"),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      templateType: v.optional(v.union(v.literal("escrito"), v.literal("document"))),
      content: v.optional(v.string()),
      content_type: v.optional(v.string()),
      prosemirrorId: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // Start with all active templates
    let modelosQuery = ctx.db
      .query("modelos")
      .withIndex("by_active_status", (q) => q.eq("isActive", true));
    
    // Get all templates first (we need to filter by access permissions)
    const allModelos = await modelosQuery.collect();
    
    // Filter to show only public templates OR private templates created by current user
    let filteredModelos = allModelos.filter(m => 
      m.isPublic || m.createdBy === args.userId
    );
    
    // Apply additional filters
    if (args.category) {
      filteredModelos = filteredModelos.filter(m => m.category === args.category);
    }

    if (args.content_type) {
      filteredModelos = filteredModelos.filter(m => m.content_type === args.content_type);
    }
    
    if (args.isPublic !== undefined) {
      filteredModelos = filteredModelos.filter(m => m.isPublic === args.isPublic);
    }
    
    // Sort by creation time (newest first) for consistent pagination
    filteredModelos.sort((a, b) => b._creationTime - a._creationTime);
    
    // Implement pagination manually since we need to filter after collection
    const { numItems, cursor } = args.paginationOpts;
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const endIndex = startIndex + numItems;
    
    const page = filteredModelos.slice(startIndex, endIndex);
    const isDone = endIndex >= filteredModelos.length;
    const continueCursor = isDone ? null : endIndex.toString();
    
    return {
      page,
      isDone,
      continueCursor,
    };
  },
}); 