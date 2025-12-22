/**
 * Client Helper Functions
 *
 * Shared helper functions for client management operations.
 * Extracted from clients.ts for better code organization.
 */

import type { QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";

// ========================================
// TEXT NORMALIZATION AND SEARCH
// ========================================

/**
 * Normalizes text for flexible searching by:
 * - Removing accents/diacritics
 * - Converting to lowercase
 * - Trimming and normalizing whitespace
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Checks if a normalized search term matches within a normalized target string.
 * Performs a fuzzy search that allows partial matches.
 */
export function fuzzyMatch(
  target: string | undefined | null,
  search: string,
): boolean {
  if (!search) return true;
  if (!target) return false;

  const normalizedTarget = normalizeText(target);
  const normalizedSearch = normalizeText(search);

  // Simple partial match - contains the search term
  return normalizedTarget.includes(normalizedSearch);
}

// ========================================
// CASE ACCESS HELPERS
// ========================================

/**
 * Helper function to get all case IDs that a user has access to.
 * Includes cases the user created, is assigned to, has team access to, or has explicit user permissions for.
 */
export async function getAccessibleCaseIds(
  ctx: QueryCtx,
  userId: string,
): Promise<Set<string>> {
  const caseIds = new Set<string>();

  // 1. Cases the user created or is assigned to
  const ownedCases = await ctx.db
    .query("cases")
    .filter((q) =>
      q.or(
        q.eq(q.field("createdBy"), userId),
        q.eq(q.field("assignedLawyer"), userId),
      ),
    )
    .collect();
  ownedCases.forEach((c) => caseIds.add(c._id));

  // 2. Cases accessible through team membership
  const teamMemberships = await ctx.db
    .query("teamMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  const teamCaseAccess = await Promise.all(
    teamMemberships.map((membership) =>
      ctx.db
        .query("teamCaseAccess")
        .withIndex("by_team", (q) => q.eq("teamId", membership.teamId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect(),
    ),
  );
  teamCaseAccess.flat().forEach((access) => caseIds.add(access.caseId));

  // 3. Cases with explicit user permissions
  const userCaseAccess = await ctx.db
    .query("userCaseAccess")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();
  userCaseAccess.forEach((access) => caseIds.add(access.caseId));

  return caseIds;
}

// ========================================
// CLIENT DATA HELPERS
// ========================================

/**
 * Helper function to batch fetch client cases to avoid N+1 queries.
 * Fetches all client-case relationships and case data in batches.
 */
export async function batchFetchClientCases(
  ctx: QueryCtx,
  clients: Array<Doc<"clients">>,
) {
  if (clients.length === 0) return [];

  // Batch fetch all client-case relationships for all clients
  const allRelations = await Promise.all(
    clients.map(async (client) => {
      const relations = await ctx.db
        .query("clientCases")
        .withIndex("by_client", (q) => q.eq("clientId", client._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
      return { clientId: client._id, relations };
    }),
  );

  // Collect all unique case IDs
  const caseIdsSet = new Set<string>();
  for (const { relations } of allRelations) {
    for (const relation of relations) {
      caseIdsSet.add(relation.caseId);
    }
  }

  // Batch fetch all case data
  const casesMap = new Map<string, Doc<"cases"> | null>();
  await Promise.all(
    Array.from(caseIdsSet).map(async (caseId) => {
      const caseData = (await ctx.db.get(caseId as any)) as Doc<"cases"> | null;
      casesMap.set(caseId, caseData);
    }),
  );

  // Assemble the result
  return clients.map((client) => {
    const clientRelations = allRelations.find((r) => r.clientId === client._id);
    const cases = (clientRelations?.relations || [])
      .map((relation) => ({
        case: casesMap.get(relation.caseId) || null,
        role: relation.role,
        relationId: relation._id,
      }))
      .filter(({ case: caseData }) => caseData !== null);

    return {
      ...client,
      cases,
    };
  });
}

// ========================================
// DISPLAY NAME HELPERS
// ========================================

/**
 * Helper function to compute displayName for legacy clients.
 * Used to ensure all returned clients have a displayName even if not in DB.
 */
export function computeDisplayName(client: Doc<"clients">): string {
  // If displayName exists, use it
  if (client.displayName) return client.displayName;

  // For new model clients without displayName (shouldn't happen but just in case)
  if (
    client.naturalezaJuridica === "humana" &&
    client.apellido &&
    client.nombre
  ) {
    return `${client.apellido}, ${client.nombre}`;
  }
  if (client.naturalezaJuridica === "juridica" && client.razonSocial) {
    return client.razonSocial;
  }

  // For legacy clients, use the old name field
  if ((client as any).name) {
    return (client as any).name;
  }

  // Last resort fallback
  return "Sin nombre";
}

/**
 * Normalizes a client document to ensure it has all required fields for the API.
 * Computes displayName and naturalezaJuridica for legacy clients.
 */
export function normalizeClient<T extends Doc<"clients">>(
  client: T,
): T & { displayName: string; naturalezaJuridica: "humana" | "juridica" } {
  return {
    ...client,
    displayName: computeDisplayName(client),
    naturalezaJuridica:
      client.naturalezaJuridica ||
      ((client as any).clientType === "company" ? "juridica" : "humana"),
  };
}
