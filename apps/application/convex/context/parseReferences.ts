import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentUserFromAuth } from "../auth_utils";
import { Id } from "../_generated/dataModel";
import { checkNewCaseAccess } from "../auth_utils";

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
 * Parses @-references in a user message and resolves them to actual entities.
 * Supports: @client:name, @document:title, @escrito:title, @case:title
 */
export const parseAtReferences = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
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

    // Regex patterns for @-references
    const patterns = {
      client: /@client:([^@\s]+)/gi,
      document: /@document:([^@\s]+)/gi,
      escrito: /@escrito:([^@\s]+)/gi,
      case: /@case:([^@\s]+)/gi,
    };

    // Process each type of reference
    for (const [type, pattern] of Object.entries(patterns)) {
      let match;
      while ((match = pattern.exec(args.message)) !== null) {
        const searchTerm = match[1].replace(/[_\-]/g, " ").toLowerCase();
        const originalText = match[0];

        try {
          let resolvedRef: ParsedReference | null = null;

          switch (type) {
            case "client":
              resolvedRef = await resolveClientReference(
                ctx,
                searchTerm,
                args.caseId,
                originalText,
              );
              break;
            case "document":
              resolvedRef = await resolveDocumentReference(
                ctx,
                searchTerm,
                args.caseId,
                originalText,
              );
              break;
            case "escrito":
              resolvedRef = await resolveEscritoReference(
                ctx,
                searchTerm,
                args.caseId,
                originalText,
              );
              break;
            case "case":
              resolvedRef = await resolveCaseReference(
                ctx,
                searchTerm,
                originalText,
              );
              break;
          }

          if (resolvedRef) {
            references.push(resolvedRef);
            // Replace the @-reference with the resolved name
            cleanMessage = cleanMessage.replace(originalText, resolvedRef.name);
          }
        } catch (error) {
          console.warn(
            `Failed to resolve ${type} reference "${searchTerm}":`,
            error,
          );
          // Keep the original @-reference if resolution fails
        }
      }
    }

    return {
      cleanMessage,
      references,
    };
  },
});

// Helper functions to resolve different types of references

async function resolveClientReference(
  ctx: any,
  searchTerm: string,
  caseId: Id<"cases"> | undefined,
  originalText: string,
): Promise<ParsedReference | null> {
  if (!caseId) {
    // Search across all accessible clients if no case context
    // Use Convex's built-in string comparison methods
    const clients = await ctx.db
      .query("clients")
      .filter((q: any) =>
        q.or(
          q.eq(q.field("name"), searchTerm),
          q.like(q.field("name"), `%${searchTerm}%`),
        ),
      )
      .take(10); // Get more to filter locally

    // Filter by case-insensitive comparison in JavaScript
    const matchingClient = clients.find((client: any) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (matchingClient) {
      return {
        type: "client",
        id: matchingClient._id,
        name: matchingClient.name,
        originalText,
      };
    }
  } else {
    // Search within case clients
    const clientCases = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect();

    for (const clientCase of clientCases) {
      const client = await ctx.db.get(clientCase.clientId);
      if (client && client.name.toLowerCase().includes(searchTerm)) {
        return {
          type: "client",
          id: client._id,
          name: client.name,
          originalText,
        };
      }
    }
  }

  return null;
}

async function resolveDocumentReference(
  ctx: any,
  searchTerm: string,
  caseId: Id<"cases"> | undefined,
  originalText: string,
): Promise<ParsedReference | null> {
  const query = caseId
    ? ctx.db
        .query("documents")
        .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
    : ctx.db.query("documents");

  const documents = await query
    .filter((q: any) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.or(
          q.eq(q.field("title"), searchTerm),
          q.like(q.field("title"), `%${searchTerm}%`),
        ),
      ),
    )
    .take(10); // Get more to filter locally

  // Filter by case-insensitive comparison in JavaScript
  const matchingDoc = documents.find((doc: any) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (matchingDoc) {
    return {
      type: "document",
      id: matchingDoc._id,
      name: matchingDoc.title,
      originalText,
    };
  }

  return null;
}

async function resolveEscritoReference(
  ctx: any,
  searchTerm: string,
  caseId: Id<"cases"> | undefined,
  originalText: string,
): Promise<ParsedReference | null> {
  const query = caseId
    ? ctx.db
        .query("escritos")
        .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
    : ctx.db.query("escritos");

  const escritos = await query
    .filter((q: any) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.or(
          q.eq(q.field("title"), searchTerm),
          q.like(q.field("title"), `%${searchTerm}%`),
        ),
      ),
    )
    .take(10); // Get more to filter locally

  // Filter by case-insensitive comparison in JavaScript
  const matchingEscrito = escritos.find((escrito: any) =>
    escrito.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (matchingEscrito) {
    return {
      type: "escrito",
      id: matchingEscrito._id,
      name: matchingEscrito.title,
      originalText,
    };
  }

  return null;
}

async function resolveCaseReference(
  ctx: any,
  searchTerm: string,
  originalText: string,
): Promise<ParsedReference | null> {
  // Get current user to check permissions
  const currentUser = await getCurrentUserFromAuth(ctx);

  const cases = await ctx.db
    .query("cases")
    .filter((q: any) =>
      q.and(
        q.eq(q.field("isArchived"), false),
        q.or(
          q.eq(q.field("title"), searchTerm),
          q.like(q.field("title"), `%${searchTerm}%`),
        ),
      ),
    )
    .take(20); // Get more candidates to filter by permissions

  // Filter cases by user access permissions and case-insensitive search
  for (const caseData of cases) {
    // Apply case-insensitive search filter
    if (!caseData.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      continue;
    }
    try {
      const access = await checkNewCaseAccess(
        ctx,
        currentUser._id,
        caseData._id,
        "basic",
      );
      if (access.hasAccess) {
        return {
          type: "case",
          id: caseData._id,
          name: caseData.title,
          originalText,
        };
      }
    } catch (error) {
      // If access check fails, skip this case
      console.warn(`Access check failed for case ${caseData._id}:`, error);
    }
  }

  return null;
}

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
      const query = args.caseId
        ? ctx.db
            .query("documents")
            .withIndex("by_case", (q: any) => q.eq("caseId", args.caseId))
        : ctx.db.query("documents");

      const documents = await query
        .filter((q: any) => q.eq(q.field("isArchived"), false))
        .take(20); // Get more to filter locally

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
