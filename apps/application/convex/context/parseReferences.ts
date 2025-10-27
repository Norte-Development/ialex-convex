import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { Id } from "../_generated/dataModel";
import { checkNewCaseAccess } from "../auth_utils";
import { createExpect } from "vitest";
import { api } from "../_generated/api";

// Types for @-references
interface ParsedReference {
  type: "client" | "document" | "escrito" | "case";
  id: string;
  name: string;
  originalText: string;
}

interface ParseResult {
  cleanMessage: string;
  references: ParsedReference[];
}

/**
 * Processes resolved references from frontend and replaces @-references in message.
 * The frontend has already resolved the references, so we just need to replace them in the text.
 */
export const parseAtReferences = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
    resolvedReferences: v.array(v.object({
      type: v.union(
        v.literal("client"),
        v.literal("document"), 
        v.literal("escrito"),
        v.literal("case")
      ),
      id: v.string(),
      name: v.string(),
      originalText: v.string(),
    })),
    caseId: v.optional(v.id("cases")),
  },
  handler: async (ctx, args): Promise<ParseResult> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Validate user can only parse their own references
    if (args.userId !== currentUser._id) {
      throw new Error("Unauthorized: Can only parse your own references");
    }

    const references: ParsedReference[] = [];
    let cleanMessage = args.message;

    // Process each resolved reference from frontend
    for (const resolvedRef of args.resolvedReferences) {
      // Convert frontend reference to backend format
      const parsedRef: ParsedReference = {
        type: resolvedRef.type,
        id: resolvedRef.id,
        name: resolvedRef.name,
        originalText: resolvedRef.originalText,
      };

      references.push(parsedRef);
      
      // Replace the @-reference with the resolved name
      cleanMessage = cleanMessage.replace(resolvedRef.originalText, resolvedRef.name);
    }

    return {
      cleanMessage,
      references,
    };
  },
});


/**
 * Gets available reference suggestions for autocomplete based on current case context
 */
export const getReferencesSuggestions = query({
  args: {
    caseId: v.optional(v.id("cases")),
    query: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("client"),
        v.literal("document"),
        v.literal("escrito"),
        v.literal("case"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx); // Get current user for permission checks
    const suggestions: Array<{
      type: string;
      id: string;
      name: string;
      preview?: string;
    }> = [];

    const searchTerm = args.query?.toLowerCase() || "";

    // Get clients (scoped to case if provided)
    if (!args.type || args.type === "client") {
      if (args.caseId) {
        const clientCases = await ctx.db
          .query("clientCases")
          .withIndex("by_case", (q: any) => q.eq("caseId", args.caseId))
          .filter((q: any) => q.eq(q.field("isActive"), true))
          .take(10);

        for (const clientCase of clientCases) {
          const client = await ctx.db.get(clientCase.clientId);
          if (
            client &&
            (!searchTerm ||
              client.name.toLowerCase().includes(searchTerm.toLowerCase()))
          ) {
            suggestions.push({
              type: "client",
              id: client._id,
              name: client.name,
              preview: `${client.clientType} - ${clientCase.role || "Sin rol"}`,
            });
          }
        }
      }
    }

    // Get documents (scoped to case if provided)
    if (!args.type || args.type === "document") {
      const documents = await ctx.runQuery(api.functions.documents.getDocuments, {
        caseId: args.caseId as Id<"cases">,
      });

      const filteredDocs = documents
        .filter(
          (doc) =>
            !searchTerm ||
            doc.title.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .slice(0, 10);

      for (const doc of filteredDocs) {
        suggestions.push({
          type: "document",
          id: doc._id,
          name: doc.title,
          preview: `${doc.documentType || "Documento"} - ${new Date(doc._creationTime).toLocaleDateString()}`,
        });
      }
    }

    // Get escritos (scoped to case if provided)
    if (!args.type || args.type === "escrito") {
      const query = args.caseId
        ? ctx.db
            .query("escritos")
            .withIndex("by_case", (q: any) => q.eq("caseId", args.caseId))
        : ctx.db.query("escritos");

      const escritos = await query
        .filter((q: any) => q.eq(q.field("isArchived"), false))
        .take(20); // Get more to filter locally

      const filteredEscritos = escritos
        .filter(
          (escrito) =>
            !searchTerm ||
            escrito.title.toLowerCase().includes(searchTerm.toLowerCase()),
        )
        .slice(0, 10);

      for (const escrito of filteredEscritos) {
        suggestions.push({
          type: "escrito",
          id: escrito._id,
          name: escrito.title,
          preview: `${escrito.status} - ${escrito.wordCount || 0} palabras`,
        });
      }
    }

    // Get cases (only accessible ones)
    if (!args.type || args.type === "case") {
      const cases = await ctx.db
        .query("cases")
        .filter((q: any) => q.eq(q.field("isArchived"), false))
        .take(50); // Get more candidates to filter by permissions

      // Filter cases by permissions and search term
      const accessibleCases: Array<{
        id: string;
        name: string;
        preview: string;
      }> = [];

      for (const caseData of cases) {
        try {
          // Check if user has access to this case
          const access = await checkNewCaseAccess(
            ctx,
            currentUser._id,
            caseData._id,
            "basic",
          );
          if (access.hasAccess) {
            // Apply search filter
            if (
              !searchTerm ||
              caseData.title.toLowerCase().includes(searchTerm.toLowerCase())
            ) {
              accessibleCases.push({
                id: caseData._id,
                name: caseData.title,
                preview: `${caseData.status} - prioridad ${caseData.priority}`,
              });
            }
          }
        } catch (error) {
          // If access check fails, skip this case
          console.warn(`Access check failed for case ${caseData._id}:`, error);
        }
      }

      // Add accessible cases to suggestions (limit to 10)
      for (const caseData of accessibleCases.slice(0, 10)) {
        suggestions.push({
          type: "case",
          id: caseData.id,
          name: caseData.name,
          preview: caseData.preview,
        });
      }
    }

    return suggestions.slice(0, 20); // Limit total suggestions
  },
});
