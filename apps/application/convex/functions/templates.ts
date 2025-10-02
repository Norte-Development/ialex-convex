import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";

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
    mimeType: v.optional(v.string()),
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
 * @param {"json" | "html"} [args.content_type] - Filter by content format
 * @param {string} [args.category] - Filter by category
 * @param {boolean} [args.isPublic] - Filter by public/private status
 * @returns {Promise<Object[]>} Array of template documents accessible to the user
 * @throws {Error} When not authenticated
 * 
 * @description This function returns templates that the user can access, which includes:
 * - All public templates created by any user or system
 * - Private templates created by the current user
 * 
 * The results can be filtered by content type, category, or public status.
 * Only active templates are returned.
 * 
 * @example
 * ```javascript
 * // Get all accessible templates
 * const allTemplates = await getModelos({});
 * 
 * // Get only HTML templates
 * const htmlTemplates = await getModelos({ content_type: "html" });
 * 
 * // Get only public civil law templates
 * const civilTemplates = await getModelos({ 
 *   category: "Derecho Civil",
 *   isPublic: true 
 * });
 * 
 * // Get only my private templates
 * const myPrivateTemplates = await getModelos({ isPublic: false });
 * ```
 */
export const getModelos = query({
  args: {
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("modelos"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.string(),
      content: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      originalFileName: v.optional(v.string()),
      isPublic: v.boolean(),
      createdBy: v.union(v.id("users"), v.literal("system")),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
      isActive: v.boolean(),
    })
  ),
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
    
    
    if (args.category) {
      filteredModelos = filteredModelos.filter(m => m.category === args.category);
    }
    
    if (args.isPublic !== undefined) {
      filteredModelos = filteredModelos.filter(m => m.isPublic === args.isPublic);
    }
    
    return filteredModelos;
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