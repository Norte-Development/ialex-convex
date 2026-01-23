import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import {
  normalizeName,
  jaroWinklerSimilarity,
} from "../utils/identifierParser";
import {
  mapPjnRole,
  isPartyRole,
  isJudicialRole,
} from "../utils/intervinienteRoleMapping";

// Confidence thresholds
const HIGH_CONFIDENCE_THRESHOLD = 0.95;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.85;

// Match result types
interface MatchCandidate {
  clientId: Id<"clients">;
  confidence: number;
  matchReason: string;
  matchType: "DNI" | "CUIT" | "CUIL" | "NAME_EXACT" | "NAME_FUZZY";
}

interface MatchResult {
  status: "HIGH_CONFIDENCE" | "LOW_CONFIDENCE" | "NO_MATCH" | "ALREADY_LINKED";
  candidate?: MatchCandidate;
  candidates?: MatchCandidate[];
}

const COMPANY_KEYWORDS = [
  "S.A",
  "SA",
  "S.R.L",
  "SRL",
  "SAS",
  "S.A.S",
  "SOCIEDAD",
  "COOPERATIVA",
  "ASOCIACION",
  "FUNDACION",
  "COMPANIA",
  "COMPAÑIA",
  "LTDA",
];

function inferNaturalezaJuridica(name: string): "humana" | "juridica" {
  const upperName = name.toUpperCase();
  const looksLikeCompany = COMPANY_KEYWORDS.some((keyword) =>
    upperName.includes(keyword)
  );
  return looksLikeCompany ? "juridica" : "humana";
}

function splitHumanName(name: string): {
  nombre?: string;
  apellido?: string;
  displayName: string;
} {
  const trimmed = name.trim();
  if (!trimmed) {
    return { displayName: name };
  }

  if (trimmed.includes(",")) {
    const [apellidoRaw, nombreRaw] = trimmed.split(",", 2);
    const apellido = apellidoRaw?.trim();
    const nombre = nombreRaw?.trim();
    if (apellido && nombre) {
      return { apellido, nombre, displayName: `${apellido}, ${nombre}` };
    }
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2) {
    const apellido = tokens.slice(0, -1).join(" ").trim();
    const nombre = tokens.slice(-1).join(" ").trim();
    if (apellido && nombre) {
      return { apellido, nombre, displayName: `${apellido}, ${nombre}` };
    }
  }

  return { nombre: trimmed, displayName: trimmed };
}

function mapDocumentToClientFields(
  documentType: string | undefined,
  documentNumber: string | undefined
): { dni?: string; cuit?: string } {
  if (!documentType || !documentNumber) return {};
  if (documentType === "DNI") {
    return { dni: documentNumber };
  }
  if (documentType === "CUIT" || documentType === "CUIL") {
    return { cuit: documentNumber };
  }
  return {};
}

function shouldAutoCreateClient(
  roleMapping: ReturnType<typeof mapPjnRole>,
  _hasIdentifier: boolean
): boolean {
  if (isJudicialRole(roleMapping.localRole)) {
    return false;
  }
  return true;
}

/**
 * Internal query to find candidate clients for matching.
 * Searches by document number (DNI/CUIT/CUIL) and name similarity.
 */
export const findCandidateClients = internalQuery({
  args: {
    caseId: v.id("cases"),
    documentNumber: v.optional(v.string()),
    documentType: v.optional(v.string()),
    participantName: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("clients"),
      displayName: v.optional(v.string()),
      dni: v.optional(v.string()),
      cuit: v.optional(v.string()),
      nombre: v.optional(v.string()),
      apellido: v.optional(v.string()),
      razonSocial: v.optional(v.string()),
      naturalezaJuridica: v.optional(
        v.union(v.literal("humana"), v.literal("juridica")),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const candidates: Doc<"clients">[] = [];
    const addedIds = new Set<string>();

    // 1. Search by document number if provided
    if (args.documentNumber) {
      // Search by DNI
      const byDni = await ctx.db
        .query("clients")
        .withIndex("by_dni", (q) => q.eq("dni", args.documentNumber!))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const client of byDni) {
        if (!addedIds.has(client._id)) {
          candidates.push(client);
          addedIds.add(client._id);
        }
      }

      // Search by CUIT (document number might be DNI extracted from CUIT)
      const byCuit = await ctx.db
        .query("clients")
        .withIndex("by_cuit", (q) => q.eq("cuit", args.documentNumber!))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      for (const client of byCuit) {
        if (!addedIds.has(client._id)) {
          candidates.push(client);
          addedIds.add(client._id);
        }
      }

      // If document type is CUIT/CUIL (11 digits), also try matching the middle 8 digits to DNI
      if (
        args.documentNumber.length === 11 &&
        (args.documentType === "CUIT" || args.documentType === "CUIL")
      ) {
        const dniFromCuit = args.documentNumber.slice(2, 10);
        const byDniFromCuit = await ctx.db
          .query("clients")
          .withIndex("by_dni", (q) => q.eq("dni", dniFromCuit))
          .filter((q) => q.eq(q.field("isActive"), true))
          .collect();

        for (const client of byDniFromCuit) {
          if (!addedIds.has(client._id)) {
            candidates.push(client);
            addedIds.add(client._id);
          }
        }
      }
    }

    // 2. Get clients already on the case (they might be unlinked intervinientes)
    const caseClients = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const cc of caseClients) {
      if (!addedIds.has(cc.clientId)) {
        const client = await ctx.db.get(cc.clientId);
        if (client && client.isActive) {
          candidates.push(client);
          addedIds.add(client._id);
        }
      }
    }

    // 3. Search by name if we don't have enough candidates
    if (candidates.length < 10 && args.participantName) {
      const normalizedSearch = normalizeName(args.participantName);

      // Use search index for name matching
      const byName = await ctx.db
        .query("clients")
        .withSearchIndex("search_clients", (q) =>
          q.search("displayName", args.participantName).eq("isActive", true),
        )
        .take(20);

      for (const client of byName) {
        if (!addedIds.has(client._id)) {
          candidates.push(client);
          addedIds.add(client._id);
        }
      }
    }

    // Return simplified client data for matching
    return candidates.map((c) => ({
      _id: c._id,
      displayName: c.displayName,
      dni: c.dni,
      cuit: c.cuit,
      nombre: c.nombre,
      apellido: c.apellido,
      razonSocial: c.razonSocial,
      naturalezaJuridica: c.naturalezaJuridica,
    }));
  },
});

/**
 * Check if a participant is already linked to a client.
 */
export const getExistingLink = internalQuery({
  args: {
    participantId: v.id("caseParticipants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("intervinienteClientLinks"),
      clientId: v.id("clients"),
      linkType: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("intervinienteClientLinks")
      .withIndex("by_participant", (q) =>
        q.eq("participantId", args.participantId),
      )
      .first();

    if (!link) return null;

    return {
      _id: link._id,
      clientId: link.clientId,
      linkType: link.linkType,
    };
  },
});

/**
 * Main matching mutation - attempts to match a participant to a client.
 * Creates an IntervinienteClientLink record based on match confidence.
 */
export const matchParticipantToClient = internalMutation({
  args: {
    participantId: v.id("caseParticipants"),
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<{
    status: string;
    linkId?: Id<"intervinienteClientLinks">;
    clientId?: Id<"clients">;
    confidence?: number;
    matchReason?: string;
  }> => {
    // Get the participant
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      return { status: "PARTICIPANT_NOT_FOUND" };
    }

    // Check if already linked
    const existingLink = await ctx.runQuery(
      internal.intervinientes.matching.getExistingLink,
      { participantId: args.participantId },
    );

    if (existingLink && existingLink.linkType !== "AUTO_LOW_CONFIDENCE") {
      // Already has a confirmed or high-confidence link
      if (existingLink.linkType !== "IGNORED") {
        const roleMapping = mapPjnRole(participant.role);
        await ctx.runMutation(
          internal.intervinientes.matching.ensureClientCaseRelation,
          {
            clientId: existingLink.clientId,
            caseId: args.caseId,
            participantId: args.participantId,
            role: roleMapping.localRole,
          }
        );
      }

      return {
        status: "ALREADY_LINKED",
        linkId: existingLink._id,
        clientId: existingLink.clientId,
      };
    }

    const roleMapping = mapPjnRole(participant.role);
    const canAutoCreate = shouldAutoCreateClient(
      roleMapping,
      Boolean(participant.documentNumber)
    );

    // Find candidate clients
    const candidates = await ctx.runQuery(
      internal.intervinientes.matching.findCandidateClients,
      {
        caseId: args.caseId,
        documentNumber: participant.documentNumber,
        documentType: participant.documentType,
        participantName: participant.name,
      },
    );

    if (candidates.length === 0) {
      if (!canAutoCreate) {
        if (existingLink && existingLink.linkType !== "IGNORED") {
          await ctx.runMutation(
            internal.intervinientes.matching.ensureClientCaseRelation,
            {
              clientId: existingLink.clientId,
              caseId: args.caseId,
              participantId: args.participantId,
              role: roleMapping.localRole,
            }
          );
        }
        return { status: "NO_CANDIDATES" };
      }

      const caseDoc = await ctx.db.get(participant.caseId);
      if (!caseDoc) {
        return { status: "CASE_NOT_FOUND" };
      }

      const naturalezaJuridica = inferNaturalezaJuridica(participant.name);
      const humanName = splitHumanName(participant.name);
      const docFields = mapDocumentToClientFields(
        participant.documentType,
        participant.documentNumber
      );
      const displayName =
        naturalezaJuridica === "humana"
          ? humanName.displayName
          : participant.name.trim();

      const clientId = await ctx.db.insert("clients", {
        naturalezaJuridica,
        nombre: naturalezaJuridica === "humana" ? humanName.nombre : undefined,
        apellido: naturalezaJuridica === "humana" ? humanName.apellido : undefined,
        razonSocial:
          naturalezaJuridica === "juridica" ? participant.name.trim() : undefined,
        dni: docFields.dni,
        cuit: docFields.cuit,
        displayName,
        isActive: true,
        createdBy: caseDoc.assignedLawyer,
      });

      const now = Date.now();
      const linkType = "AUTO_HIGH_CONFIDENCE" as const;
      const matchReason =
        "Cliente creado automaticamente para interviniente sin coincidencias";

      if (existingLink) {
        await ctx.db.patch(existingLink._id, {
          clientId,
          linkType,
          confidence: 1,
          matchReason,
          localRole: roleMapping.localRole,
          updatedAt: now,
        });

        await ctx.db.insert("intervinienteLinkAudit", {
          participantId: args.participantId,
          clientId,
          caseId: args.caseId,
          action: "AUTO_LINKED",
          previousLinkType: existingLink.linkType,
          newLinkType: linkType,
          matchReason,
          confidence: 1,
          performedAt: now,
        });

        await ctx.runMutation(
          internal.intervinientes.matching.ensureClientCaseRelation,
          {
            clientId,
            caseId: args.caseId,
            participantId: args.participantId,
            role: roleMapping.localRole,
          }
        );

        return {
          status: linkType,
          linkId: existingLink._id,
          clientId,
          confidence: 1,
          matchReason,
        };
      }

      const linkId = await ctx.db.insert("intervinienteClientLinks", {
        participantId: args.participantId,
        clientId,
        caseId: args.caseId,
        localRole: roleMapping.localRole,
        linkType,
        confidence: 1,
        matchReason,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId,
        caseId: args.caseId,
        action: "AUTO_LINKED",
        newLinkType: linkType,
        matchReason,
        confidence: 1,
        performedAt: now,
      });

      await ctx.runMutation(
        internal.intervinientes.matching.ensureClientCaseRelation,
        {
          clientId,
          caseId: args.caseId,
          participantId: args.participantId,
          role: roleMapping.localRole,
        }
      );

      return {
        status: linkType,
        linkId,
        clientId,
        confidence: 1,
        matchReason,
      };
    }

    // Score and rank candidates
    const scoredCandidates: MatchCandidate[] = [];

    for (const client of candidates) {
      let bestScore = 0;
      let bestReason = "";
      let bestType: MatchCandidate["matchType"] = "NAME_FUZZY";

      // 1. Check document number match (highest priority)
      if (participant.documentNumber) {
        // Check DNI match
        if (client.dni) {
          const normalizedClientDni = client.dni.replace(/[-.\s]/g, "");
          const normalizedParticipantDoc = participant.documentNumber.replace(
            /[-.\s]/g,
            "",
          );

          if (normalizedClientDni === normalizedParticipantDoc) {
            bestScore = 1.0;
            bestReason = `DNI exacto: ${client.dni}`;
            bestType = "DNI";
          } else if (
            participant.documentType === "CUIT" ||
            participant.documentType === "CUIL"
          ) {
            // Check if DNI is contained in CUIT
            const dniFromCuit = normalizedParticipantDoc.slice(2, 10);
            if (normalizedClientDni === dniFromCuit) {
              bestScore = 0.98;
              bestReason = `DNI extraído de ${participant.documentType}: ${normalizedParticipantDoc}`;
              bestType = "DNI";
            }
          }
        }

        // Check CUIT match
        if (client.cuit && bestScore < 1.0) {
          const normalizedClientCuit = client.cuit.replace(/[-.\s]/g, "");
          const normalizedParticipantDoc = participant.documentNumber.replace(
            /[-.\s]/g,
            "",
          );

          if (normalizedClientCuit === normalizedParticipantDoc) {
            bestScore = 1.0;
            bestReason = `CUIT exacto: ${client.cuit}`;
            bestType = "CUIT";
          }
        }
      }

      // 2. If no document match, check name similarity
      if (bestScore < HIGH_CONFIDENCE_THRESHOLD) {
        const normalizedParticipantName = normalizeName(participant.name);

        // Build client name for comparison
        let clientName = "";
        if (client.displayName) {
          clientName = client.displayName;
        } else if (client.apellido && client.nombre) {
          clientName = `${client.apellido}, ${client.nombre}`;
        } else if (client.razonSocial) {
          clientName = client.razonSocial;
        }

        const normalizedClientName = normalizeName(clientName);

        if (normalizedParticipantName && normalizedClientName) {
          // Check exact match first
          if (normalizedParticipantName === normalizedClientName) {
            const score = bestScore > 0 ? Math.max(bestScore, 0.95) : 0.95;
            if (score > bestScore) {
              bestScore = score;
              bestReason = `Nombre exacto: ${clientName}`;
              bestType = "NAME_EXACT";
            }
          } else {
            // Fuzzy match
            const similarity = jaroWinklerSimilarity(
              normalizedParticipantName,
              normalizedClientName,
            );

            if (similarity > bestScore && similarity >= MEDIUM_CONFIDENCE_THRESHOLD) {
              bestScore = similarity;
              bestReason = `Similitud de nombre: ${(similarity * 100).toFixed(0)}%`;
              bestType = "NAME_FUZZY";
            }
          }
        }
      }

      if (bestScore >= MEDIUM_CONFIDENCE_THRESHOLD) {
        scoredCandidates.push({
          clientId: client._id,
          confidence: bestScore,
          matchReason: bestReason,
          matchType: bestType,
        });
      }
    }

    // Sort by confidence descending
    scoredCandidates.sort((a, b) => b.confidence - a.confidence);

    if (scoredCandidates.length === 0) {
      if (!canAutoCreate) {
        if (existingLink && existingLink.linkType !== "IGNORED") {
          await ctx.runMutation(
            internal.intervinientes.matching.ensureClientCaseRelation,
            {
              clientId: existingLink.clientId,
              caseId: args.caseId,
              participantId: args.participantId,
              role: roleMapping.localRole,
            }
          );
        }
        return { status: "NO_MATCH" };
      }

      const caseDoc = await ctx.db.get(participant.caseId);
      if (!caseDoc) {
        return { status: "CASE_NOT_FOUND" };
      }

      const naturalezaJuridica = inferNaturalezaJuridica(participant.name);
      const humanName = splitHumanName(participant.name);
      const docFields = mapDocumentToClientFields(
        participant.documentType,
        participant.documentNumber
      );
      const displayName =
        naturalezaJuridica === "humana"
          ? humanName.displayName
          : participant.name.trim();

      const clientId = await ctx.db.insert("clients", {
        naturalezaJuridica,
        nombre: naturalezaJuridica === "humana" ? humanName.nombre : undefined,
        apellido: naturalezaJuridica === "humana" ? humanName.apellido : undefined,
        razonSocial:
          naturalezaJuridica === "juridica" ? participant.name.trim() : undefined,
        dni: docFields.dni,
        cuit: docFields.cuit,
        displayName,
        isActive: true,
        createdBy: caseDoc.assignedLawyer,
      });

      const now = Date.now();
      const linkType = "AUTO_HIGH_CONFIDENCE" as const;
      const matchReason =
        "Cliente creado automaticamente para interviniente sin coincidencias";

      if (existingLink) {
        await ctx.db.patch(existingLink._id, {
          clientId,
          linkType,
          confidence: 1,
          matchReason,
          localRole: roleMapping.localRole,
          updatedAt: now,
        });

        await ctx.db.insert("intervinienteLinkAudit", {
          participantId: args.participantId,
          clientId,
          caseId: args.caseId,
          action: "AUTO_LINKED",
          previousLinkType: existingLink.linkType,
          newLinkType: linkType,
          matchReason,
          confidence: 1,
          performedAt: now,
        });

        await ctx.runMutation(
          internal.intervinientes.matching.ensureClientCaseRelation,
          {
            clientId,
            caseId: args.caseId,
            participantId: args.participantId,
            role: roleMapping.localRole,
          }
        );

        return {
          status: linkType,
          linkId: existingLink._id,
          clientId,
          confidence: 1,
          matchReason,
        };
      }

      const linkId = await ctx.db.insert("intervinienteClientLinks", {
        participantId: args.participantId,
        clientId,
        caseId: args.caseId,
        localRole: roleMapping.localRole,
        linkType,
        confidence: 1,
        matchReason,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId,
        caseId: args.caseId,
        action: "AUTO_LINKED",
        newLinkType: linkType,
        matchReason,
        confidence: 1,
        performedAt: now,
      });

      await ctx.runMutation(
        internal.intervinientes.matching.ensureClientCaseRelation,
        {
          clientId,
          caseId: args.caseId,
          participantId: args.participantId,
          role: roleMapping.localRole,
        }
      );

      return {
        status: linkType,
        linkId,
        clientId,
        confidence: 1,
        matchReason,
      };
    }

    const bestCandidate = scoredCandidates[0];

    // Determine link type based on confidence
    const linkType =
      bestCandidate.confidence >= HIGH_CONFIDENCE_THRESHOLD
        ? ("AUTO_HIGH_CONFIDENCE" as const)
        : ("AUTO_LOW_CONFIDENCE" as const);

    // Create or update the link
    const now = Date.now();

    if (existingLink) {
      // Update existing low-confidence link if we found a better match
      await ctx.db.patch(existingLink._id, {
        clientId: bestCandidate.clientId,
        linkType,
        confidence: bestCandidate.confidence,
        matchReason: bestCandidate.matchReason,
        localRole: roleMapping.localRole,
        updatedAt: now,
      });

      // Log the update
      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId: bestCandidate.clientId,
        caseId: args.caseId,
        action: "AUTO_LINKED",
        previousLinkType: existingLink.linkType,
        newLinkType: linkType,
        matchReason: bestCandidate.matchReason,
        confidence: bestCandidate.confidence,
        performedAt: now,
      });

      return {
        status: linkType,
        linkId: existingLink._id,
        clientId: bestCandidate.clientId,
        confidence: bestCandidate.confidence,
        matchReason: bestCandidate.matchReason,
      };
    }

    // Create new link
    const linkId = await ctx.db.insert("intervinienteClientLinks", {
      participantId: args.participantId,
      clientId: bestCandidate.clientId,
      caseId: args.caseId,
      localRole: roleMapping.localRole,
      linkType,
      confidence: bestCandidate.confidence,
      matchReason: bestCandidate.matchReason,
      createdAt: now,
      updatedAt: now,
    });

    // Log the creation
    await ctx.db.insert("intervinienteLinkAudit", {
      participantId: args.participantId,
      clientId: bestCandidate.clientId,
      caseId: args.caseId,
      action: "AUTO_LINKED",
      newLinkType: linkType,
      matchReason: bestCandidate.matchReason,
      confidence: bestCandidate.confidence,
      performedAt: now,
    });

    await ctx.runMutation(
      internal.intervinientes.matching.ensureClientCaseRelation,
      {
        clientId: bestCandidate.clientId,
        caseId: args.caseId,
        participantId: args.participantId,
        role: roleMapping.localRole,
      },
    );

    return {
      status: linkType,
      linkId,
      clientId: bestCandidate.clientId,
      confidence: bestCandidate.confidence,
      matchReason: bestCandidate.matchReason,
    };
  },
});

/**
 * Ensure a clientCase relation exists for a linked participant.
 * Creates or updates the relation with PJN source tracking.
 */
export const ensureClientCaseRelation = internalMutation({
  args: {
    clientId: v.id("clients"),
    caseId: v.id("cases"),
    participantId: v.id("caseParticipants"),
    role: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    // Check for existing relation
    const existing = await ctx.db
      .query("clientCases")
      .withIndex("by_client_and_case", (q) =>
        q.eq("clientId", args.clientId).eq("caseId", args.caseId),
      )
      .first();

    if (existing) {
      const shouldReactivate = existing.isActive === false;
      const shouldUpdateSource = !existing.sourceParticipantId;
      if (shouldReactivate || shouldUpdateSource) {
        await ctx.db.patch(existing._id, {
          ...(shouldReactivate && { isActive: true }),
          ...(shouldUpdateSource && {
            source: "PJN",
            sourceParticipantId: args.participantId,
          }),
          role: existing.role || args.role,
        });
      }
      return null;
    }

    // Get case to find assignedLawyer for addedBy
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc) return null;

    // Create new clientCase relation
    await ctx.db.insert("clientCases", {
      clientId: args.clientId,
      caseId: args.caseId,
      role: args.role,
      addedBy: caseDoc.assignedLawyer,
      isActive: true,
      source: "PJN",
      sourceParticipantId: args.participantId,
    });

    return null;
  },
});

/**
 * Batch match all unlinked participants for a case.
 * Called after a full PJN sync to process all participants at once.
 */
export const matchAllParticipantsForCase = internalMutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<{
    processed: number;
    linked: number;
    suggested: number;
  }> => {
    // Get all participants for this case
    const participants = await ctx.db
      .query("caseParticipants")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.neq(q.field("isActive"), false))
      .collect();

    let processed = 0;
    let linked = 0;
    let suggested = 0;

    for (const participant of participants) {
      // Check if already linked
      const existingLink = await ctx.db
        .query("intervinienteClientLinks")
        .withIndex("by_participant", (q) =>
          q.eq("participantId", participant._id),
        )
        .first();

      if (existingLink && existingLink.linkType !== "AUTO_LOW_CONFIDENCE") {
        if (existingLink.linkType !== "IGNORED") {
          const roleMapping = mapPjnRole(participant.role);
          await ctx.runMutation(
            internal.intervinientes.matching.ensureClientCaseRelation,
            {
              clientId: existingLink.clientId,
              caseId: args.caseId,
              participantId: participant._id,
              role: roleMapping.localRole,
            },
          );
        }
        // Skip already confirmed links
        continue;
      }

      // Run matching
      const result = await ctx.runMutation(
        internal.intervinientes.matching.matchParticipantToClient,
        {
          participantId: participant._id,
          caseId: args.caseId,
        },
      );

      processed++;

      if (result.status === "AUTO_HIGH_CONFIDENCE") {
        linked++;
      } else if (result.status === "AUTO_LOW_CONFIDENCE") {
        suggested++;
      }
    }

    return { processed, linked, suggested };
  },
});
