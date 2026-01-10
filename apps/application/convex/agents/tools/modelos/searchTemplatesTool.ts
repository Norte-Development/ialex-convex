import { createTool, ToolCtx } from "@convex-dev/agent";
import { api, internal } from "../../../_generated/api";
import { z } from "zod";
import { createErrorResponse, getUserAndCaseIds } from "../shared/utils";
import { Id } from "../../../_generated/dataModel";
import { 
  createSpecificTemplateTemplate,
  createSearchNoResultsTemplate,
  createSearchResultsTemplate,
  createFilterNoResultsTemplate,
  createFilterResultsTemplate,
  createAllTemplatesNoResultsTemplate,
  createAllTemplatesResultsTemplate,
  createTemplateNotFoundTemplate
} from "./templates";

/**
 * Tool for searching and retrieving template information.
 * Supports searching by name, category, content type, or getting specific templates.
 *
 * @description Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns template summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding templates before applying them to escritos.
 * @param {Object} args - Search parameters
 * @param {string} [args.searchTerm] - Search term to filter templates by name or description
 * @param {string} [args.category] - Filter by category (e.g., "Derecho Civil", "Derecho Mercantil")
 * @param {string} [args.contentType] - Filter by content type: "html" or "json"
 * @param {string} [args.templateId] - Get specific template by ID
 * @param {number} [args.limit=20] - Maximum number of results to return (default: 20, max: 100)
 * @returns {Promise<Object>} Search results with template details and content preview
 * @throws {Error} When user is not authenticated or search fails
 *
 * @example
 * // Search templates by name
 * await searchTemplatesTool.handler(ctx, {
 *   searchTerm: "demanda",
 *   limit: 10
 * });
 *
 * // Get templates by category
 * await searchTemplatesTool.handler(ctx, {
 *   category: "Derecho Civil",
 *   contentType: "html"
 * });
 *
 * // Get specific template
 * await searchTemplatesTool.handler(ctx, {
 *   templateId: "template_123"
 * });
 */
/**
 * Schema for searchTemplatesTool arguments.
 * All fields have defaults to satisfy OpenAI's JSON schema requirements.
 */
const searchTemplatesToolArgs = z.object({
  searchTerm: z.string().default("").describe("Search term to filter templates by name or description. Empty string to omit."),
  category: z.string().default("").describe("Filter by category (e.g., 'Derecho Civil', 'Derecho Mercantil'). Empty string to omit."),
  contentType: z.string().default("").describe("Filter by content type: 'html' or 'json'. Empty string to omit."),
  templateId: z.string().default("").describe("Get specific template by ID. Empty string to omit."),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of results to return (default: 20, max: 100)")
});

type SearchTemplatesToolArgs = z.infer<typeof searchTemplatesToolArgs>;

export const searchTemplatesTool = createTool({
  description: "Tool for searching and retrieving template information. Supports searching by name, category, content type, or getting specific templates. Returns template summaries and brief descriptions without raw content or IDs. Perfect for finding and understanding templates before applying them to escritos.",
  args: searchTemplatesToolArgs,
  handler: async (ctx: ToolCtx, args: SearchTemplatesToolArgs) => {
    try {
      const {caseId, userId} = getUserAndCaseIds(ctx.userId as string);

      // Convert empty strings to undefined for optional parameters
      const searchTerm = args.searchTerm.trim() !== "" ? args.searchTerm.trim() : undefined;
      const category = args.category.trim() !== "" ? args.category.trim() : undefined;
      const contentType = args.contentType.trim() !== "" ? args.contentType.trim() : undefined;
      const templateId = args.templateId.trim() !== "" ? args.templateId.trim() : undefined;
      const limit = args.limit;
      
      if (templateId) {
        // Get specific template by ID
        const template = await ctx.runQuery(internal.functions.templates.internalGetModelo, {
          modeloId: templateId as Id<"modelos">,
          userId: userId as Id<"users">
        });
        
        if (!template) {
          return createErrorResponse(createTemplateNotFoundTemplate(templateId));
        }
        
        return createSpecificTemplateTemplate(templateId, template);
      } else if (searchTerm) {
        // Search templates by search term
        const searchResult = await ctx.runQuery(internal.functions.templates.internalSearchModelos, {
          searchTerm,
          paginationOpts: { numItems: limit, cursor: null },
          category: category || undefined,
          content_type: contentType || undefined,
          userId: userId as Id<"users">
        });
        
        const templates = searchResult.page;
        
        if (templates.length === 0) {
          return createSearchNoResultsTemplate(searchTerm, limit, category, contentType);
        }
        
        return createSearchResultsTemplate(searchTerm, templates, limit, searchResult.isDone, category, contentType);
      } else if (category || contentType) {
        // Filter templates by category and/or content type
        const filterResult = await ctx.runQuery(internal.functions.templates.internalGetModelos, {
          paginationOpts: { numItems: limit, cursor: null },
          category: category || undefined,
          content_type: contentType || undefined,
          userId: userId as Id<"users">
        });
        
        const templates = filterResult.page;
        
        if (templates.length === 0) {
          return createFilterNoResultsTemplate(limit, category, contentType);
        }
        
        return createFilterResultsTemplate(templates, limit, filterResult.isDone, category, contentType);
      } else {
        // Get all templates
        const allTemplatesResult = await ctx.runQuery(internal.functions.templates.internalGetModelos, {
          paginationOpts: { numItems: limit, cursor: null },
          userId: userId as Id<"users">
        });
        
        const templates = allTemplatesResult.page;
        
        if (templates.length === 0) {
          return createAllTemplatesNoResultsTemplate(limit);
        }
        
        return createAllTemplatesResultsTemplate(templates, limit, allTemplatesResult.isDone);
      }
    } catch (error) {
      return createErrorResponse(`Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  },
} as any);
