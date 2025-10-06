import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getCurrentUserFromAuth } from "../auth_utils";

// ========================================
// MODELOS (TEMPLATES) MANAGEMENT
// ========================================

/**
 * Creates a new template (modelo) for escritos or documents.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.name - The template name/title
 * @param {string} [args.description] - Optional description of the template
 * @param {string} args.category - The category/type of legal template (e.g., "Contract Law", "Family Law")
 * @param {"escrito" | "document"} args.templateType - Whether this is for escritos or documents
 * @param {string} [args.content] - Template content (required for escrito templates, Tiptap JSON format)
 * @param {string} [args.mimeType] - MIME type for document templates
 * @param {string} [args.originalFileName] - Original filename for document templates
 * @param {boolean} args.isPublic - Whether this template is public (shared) or private
 * @param {string[]} [args.tags] - Optional tags for categorizing the template
 * @returns {Promise<string>} The created template's document ID
 * @throws {Error} When not authenticated
 * 
 * @description This function creates a new template that can be used to generate
 * escritos or documents. Templates can be either public (available to all users)
 * or private (only available to the creator). The usage count starts at 0 and
 * is incremented each time the template is used.
 * 
 * @example
 * ```javascript
 * // Create a public escrito template
 * const templateId = await createModelo({
 *   name: "Motion to Dismiss Template",
 *   description: "Standard template for filing motions to dismiss",
 *   category: "Civil Procedure",
 *   templateType: "escrito",
 *   content: '{"type":"doc","content":[...]}',
 *   isPublic: true,
 *   tags: ["motion", "civil"]
 * });
 * 
 * // Create a private document template
 * const docTemplateId = await createModelo({
 *   name: "NDA Template", 
 *   category: "Contract Law",
 *   templateType: "document",
 *   mimeType: "application/pdf",
 *   originalFileName: "nda_template.pdf",
 *   isPublic: false
 * });
 * ```
 */
export const createModelo = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    templateType: v.union(v.literal("escrito"), v.literal("document")),
    prosemirrorId: v.optional(v.string()), // For escrito templates
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
      prosemirrorId: args.prosemirrorId,
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

/**
 * Retrieves templates accessible to the current user with optional filtering.
 * 
 * @param {Object} args - The function arguments
 * @param {"escrito" | "document"} [args.templateType] - Filter by template type
 * @param {string} [args.category] - Filter by category
 * @param {boolean} [args.isPublic] - Filter by public/private status
 * @returns {Promise<Object[]>} Array of template documents accessible to the user
 * @throws {Error} When not authenticated
 * 
 * @description This function returns templates that the user can access, which includes:
 * - All public templates created by any user
 * - Private templates created by the current user
 * 
 * The results can be filtered by template type, category, or public status.
 * Only active templates are returned.
 * 
 * @example
 * ```javascript
 * // Get all accessible templates
 * const allTemplates = await getModelos({});
 * 
 * // Get only escrito templates
 * const escritoTemplates = await getModelos({ templateType: "escrito" });
 * 
 * // Get only public contract templates
 * const contractTemplates = await getModelos({ 
 *   category: "Contract Law",
 *   isPublic: true 
 * });
 * 
 * // Get only my private templates
 * const myPrivateTemplates = await getModelos({ isPublic: false });
 * ```
 */
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


export const internalSearchModelos = internalQuery({
  args: {
    searchTerm: v.string(),
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
    userId: v.id("users"), // Add missing userId parameter
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
 * Increments the usage count for a template when it's used.
 * 
 * @param {Object} args - The function arguments
 * @param {string} args.modeloId - The ID of the template that was used
 * @throws {Error} When not authenticated, template not found, or unauthorized access to private template
 * 
 * @description This function tracks template usage by incrementing a counter each time
 * a template is used to create an escrito or document. Users can only increment usage
 * for public templates or their own private templates. This provides analytics on
 * template popularity and usage patterns.
 * 
 * @example
 * ```javascript
 * // After using a template to create an escrito/document
 * await incrementModeloUsage({ modeloId: "template_123" });
 * ```
 */
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

/**
 * Internal helper for agent tools to get a specific template by ID without permission checks.
 * Agent tools have full read access by design.
 */
export const internalGetModelo = internalQuery({
  args: {
    modeloId: v.id("modelos"),
    userId: v.id("users"), // Required to filter accessible templates
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
    const modelo = await ctx.db.get(args.modeloId);
    if (!modelo) {
      return null;
    }
    
    // Check if user can access this template (public OR own private template OR system template)
    if (!modelo.isPublic && modelo.createdBy !== args.userId && modelo.createdBy !== "system") {
      return null; // Return null instead of throwing for agent tools
    }
    
    return modelo;
  },
});

/**
 * Internal helper for agent tools to get templates with filtering and pagination without permission checks.
 * Agent tools have full read access by design.
 */
export const internalGetModelos = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    content_type: v.optional(v.string()),
    userId: v.id("users"), // Required to filter accessible templates
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