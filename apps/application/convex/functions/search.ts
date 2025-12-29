import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Global search function that searches across all major entities
 * Returns grouped results by type with proper access control
 */
export const globalSearch = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        cases: [],
        clients: [],
        documents: [],
        escritos: [],
        templates: [],
        libraryDocuments: [],
      };
    }

    const limit = args.limit ?? 5;
    const searchQuery = args.query.trim();

    if (searchQuery.length === 0) {
      return {
        cases: [],
        clients: [],
        documents: [],
        escritos: [],
        templates: [],
        libraryDocuments: [],
      };
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return {
        cases: [],
        clients: [],
        documents: [],
        escritos: [],
        templates: [],
        libraryDocuments: [],
      };
    }

    // Get user's teams
    const userTeams = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    const teamIds = userTeams.map((tm) => tm.teamId);

    // Search Cases - only non-archived cases the user has access to
    const casesSearchResults = await ctx.db
      .query("cases")
      .withSearchIndex("search_cases", (q) =>
        q.search("title", searchQuery).eq("isArchived", false),
      )
      .take(limit);

    // Filter cases by access
    const casesWithAccess = await Promise.all(
      casesSearchResults.map(async (caseItem) => {
        // Check if user created the case or is assigned
        if (
          caseItem.createdBy === user._id ||
          caseItem.assignedLawyer === user._id
        ) {
          return caseItem;
        }

        // Check user-level access
        const userAccess = await ctx.db
          .query("caseAccess")
          .withIndex("by_case_and_user", (q) =>
            q.eq("caseId", caseItem._id).eq("userId", user._id),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();

        if (userAccess && userAccess.accessLevel !== "none") {
          return caseItem;
        }

        // Check team-level access
        for (const teamId of teamIds) {
          const teamAccess = await ctx.db
            .query("caseAccess")
            .withIndex("by_case_and_team", (q) =>
              q.eq("caseId", caseItem._id).eq("teamId", teamId),
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

          if (teamAccess && teamAccess.accessLevel !== "none") {
            return caseItem;
          }
        }

        return null;
      }),
    );

    const cases = casesWithAccess
      .filter((c) => c !== null)
      .map((c) => ({
        _id: c!._id,
        title: c!.title,
        status: c!.status,
        category: c!.category,
      }));

    // Search Clients - only active clients
    const clientsSearchResults = await ctx.db
      .query("clients")
      .withSearchIndex("search_clients", (q) =>
        q.search("displayName", searchQuery).eq("isActive", true),
      )
      .take(limit);

    const clients = clientsSearchResults.map((c) => ({
      _id: c._id,
      name: c.name,
      clientType: c.clientType,
      email: c.email,
    }));

    // Search Documents - only from cases the user has access to
    const documentsSearchResults = await ctx.db
      .query("documents")
      .withSearchIndex("search_documents", (q) =>
        q.search("title", searchQuery),
      )
      .take(limit * 2); // Get more to filter

    // Filter documents by case access
    const documentsWithAccess = await Promise.all(
      documentsSearchResults.map(async (doc) => {
        const caseItem = await ctx.db.get(doc.caseId);
        if (!caseItem) return null;

        // Check if user created the case or is assigned
        if (
          caseItem.createdBy === user._id ||
          caseItem.assignedLawyer === user._id
        ) {
          return doc;
        }

        // Check user-level access
        const userAccess = await ctx.db
          .query("caseAccess")
          .withIndex("by_case_and_user", (q) =>
            q.eq("caseId", caseItem._id).eq("userId", user._id),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();

        if (userAccess && userAccess.accessLevel !== "none") {
          return doc;
        }

        // Check team-level access
        for (const teamId of teamIds) {
          const teamAccess = await ctx.db
            .query("caseAccess")
            .withIndex("by_case_and_team", (q) =>
              q.eq("caseId", caseItem._id).eq("teamId", teamId),
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

          if (teamAccess && teamAccess.accessLevel !== "none") {
            return doc;
          }
        }

        return null;
      }),
    );

    const documents = documentsWithAccess
      .filter((d) => d !== null)
      .slice(0, limit)
      .map((d) => ({
        _id: d!._id,
        title: d!.title,
        caseId: d!.caseId,
        documentType: d!.documentType,
      }));

    // Search Escritos - only non-archived escritos from cases the user has access to
    const escritosSearchResults = await ctx.db
      .query("escritos")
      .withSearchIndex("search_escritos", (q) =>
        q.search("title", searchQuery).eq("isArchived", false),
      )
      .take(limit * 2); // Get more to filter

    // Filter escritos by case access
    const escritosWithAccess = await Promise.all(
      escritosSearchResults.map(async (escrito) => {
        const caseItem = await ctx.db.get(escrito.caseId);
        if (!caseItem) return null;

        // Check if user created the case or is assigned
        if (
          caseItem.createdBy === user._id ||
          caseItem.assignedLawyer === user._id
        ) {
          return escrito;
        }

        // Check user-level access
        const userAccess = await ctx.db
          .query("caseAccess")
          .withIndex("by_case_and_user", (q) =>
            q.eq("caseId", caseItem._id).eq("userId", user._id),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();

        if (userAccess && userAccess.accessLevel !== "none") {
          return escrito;
        }

        // Check team-level access
        for (const teamId of teamIds) {
          const teamAccess = await ctx.db
            .query("caseAccess")
            .withIndex("by_case_and_team", (q) =>
              q.eq("caseId", caseItem._id).eq("teamId", teamId),
            )
            .filter((q) => q.eq(q.field("isActive"), true))
            .first();

          if (teamAccess && teamAccess.accessLevel !== "none") {
            return escrito;
          }
        }

        return null;
      }),
    );

    const escritos = escritosWithAccess
      .filter((e) => e !== null)
      .slice(0, limit)
      .map((e) => ({
        _id: e!._id,
        title: e!.title,
        caseId: e!.caseId,
        status: e!.status,
      }));

    // Search Templates (Modelos) - public or user's templates
    const templatesSearchResults = await ctx.db
      .query("modelos")
      .withSearchIndex("search_templates", (q) =>
        q.search("name", searchQuery).eq("isActive", true),
      )
      .take(limit * 2); // Get more to filter

    // Filter templates by access (public or created by user or their teams)
    const templatesWithAccess = templatesSearchResults.filter((template) => {
      if (template.isPublic) return true;
      if (template.createdBy === user._id || template.createdBy === "system")
        return true;
      // Check if created by a team member (optional - depends on requirements)
      return false;
    });

    const templates = templatesWithAccess.slice(0, limit).map((t) => ({
      _id: t._id,
      name: t.name,
      category: t.category,
      templateType: t.templateType,
    }));

    // Search Library Documents - user's personal or team library
    const libraryDocumentsSearchResults = await ctx.db
      .query("libraryDocuments")
      .withSearchIndex("search_library_documents", (q) =>
        q.search("title", searchQuery),
      )
      .take(limit * 2); // Get more to filter

    // Filter library documents by access
    const libraryDocumentsWithAccess = libraryDocumentsSearchResults.filter(
      (doc) => {
        // User's personal documents
        if (doc.userId === user._id) return true;
        // Team documents
        if (doc.teamId && teamIds.includes(doc.teamId)) return true;
        return false;
      },
    );

    const libraryDocuments = libraryDocumentsWithAccess
      .slice(0, limit)
      .map((d) => ({
        _id: d._id,
        title: d.title,
        teamId: d.teamId,
        userId: d.userId,
      }));

    return {
      cases,
      clients,
      documents,
      escritos,
      templates,
      libraryDocuments,
    };
  },
});
