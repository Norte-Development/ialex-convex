import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";
import { mapPjnRole, isPartyRole } from "../utils/intervinienteRoleMapping";

// Validator for participant with link info
const participantWithLinkValidator = v.object({
  _id: v.id("caseParticipants"),
  role: v.string(),
  name: v.string(),
  details: v.optional(v.string()),
  iejp: v.optional(v.string()),
  documentType: v.optional(v.string()),
  documentNumber: v.optional(v.string()),
  syncedAt: v.number(),
  // Link information
  link: v.optional(
    v.object({
      _id: v.id("intervinienteClientLinks"),
      clientId: v.id("clients"),
      clientName: v.optional(v.string()),
      localRole: v.optional(v.string()),
      linkType: v.string(),
      confidence: v.optional(v.number()),
      matchReason: v.optional(v.string()),
      confirmedBy: v.optional(v.id("users")),
      confirmedAt: v.optional(v.number()),
    }),
  ),
  // Mapped role info
  mappedRole: v.object({
    localRole: v.string(),
    side: v.string(),
    displayNameEs: v.string(),
    rawRole: v.string(),
  }),
});

/**
 * Get all intervinientes (PJN participants) for a case with their link status.
 * This is the main query for the Intervinientes panel on the case page.
 */
export const getIntervinientesForCase = query({
  args: {
    caseId: v.id("cases"),
  },
  returns: v.object({
    participants: v.array(participantWithLinkValidator),
    summary: v.object({
      total: v.number(),
      linked: v.number(),
      suggested: v.number(),
      unlinked: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Ensure user has at least basic access to the case
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Get all participants for this case
    const participants = await ctx.db
      .query("caseParticipants")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.neq(q.field("isActive"), false))
      .collect();

    // Get all links for this case
    const links = await ctx.db
      .query("intervinienteClientLinks")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    // Create a map for quick lookup
    const linkMap = new Map<string, Doc<"intervinienteClientLinks">>();
    for (const link of links) {
      linkMap.set(link.participantId, link);
    }

    // Fetch client names for all linked clients
    const clientIds = [...new Set(links.map((l) => l.clientId))];
    const clients = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientMap = new Map<string, Doc<"clients"> | null>();
    for (let i = 0; i < clientIds.length; i++) {
      clientMap.set(clientIds[i], clients[i]);
    }

    // Build the result with link information
    const result = participants.map((p) => {
      const link = linkMap.get(p._id);
      const client = link ? clientMap.get(link.clientId) : null;
      const mappedRole = mapPjnRole(p.role);

      return {
        _id: p._id,
        role: p.role,
        name: p.name,
        details: p.details,
        iejp: p.iejp,
        documentType: p.documentType,
        documentNumber: p.documentNumber,
        syncedAt: p.syncedAt,
        link: link
          ? {
              _id: link._id,
              clientId: link.clientId,
              clientName: client?.displayName || client?.razonSocial || 
                (client?.apellido && client?.nombre 
                  ? `${client.apellido}, ${client.nombre}` 
                  : undefined),
              localRole: link.localRole,
              linkType: link.linkType,
              confidence: link.confidence,
              matchReason: link.matchReason,
              confirmedBy: link.confirmedBy,
              confirmedAt: link.confirmedAt,
            }
          : undefined,
        mappedRole: {
          localRole: mappedRole.localRole,
          side: mappedRole.side,
          displayNameEs: mappedRole.displayNameEs,
          rawRole: mappedRole.rawRole,
        },
      };
    });

    // Calculate summary
    let linked = 0;
    let suggested = 0;
    let unlinked = 0;

    for (const p of result) {
      if (p.link) {
        if (
          p.link.linkType === "AUTO_HIGH_CONFIDENCE" ||
          p.link.linkType === "CONFIRMED" ||
          p.link.linkType === "MANUAL"
        ) {
          linked++;
        } else if (p.link.linkType === "AUTO_LOW_CONFIDENCE") {
          suggested++;
        } else if (p.link.linkType === "IGNORED") {
          unlinked++;
        }
      } else {
        unlinked++;
      }
    }

    return {
      participants: result,
      summary: {
        total: result.length,
        linked,
        suggested,
        unlinked,
      },
    };
  },
});

/**
 * Confirm an auto-linked interviniente-client relationship.
 * Upgrades an AUTO_LOW_CONFIDENCE or AUTO_HIGH_CONFIDENCE link to CONFIRMED.
 */
export const confirmIntervinienteLink = mutation({
  args: {
    linkId: v.id("intervinienteClientLinks"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Link not found");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(ctx, currentUser._id, link.caseId, "advanced");

    const now = Date.now();
    const previousLinkType = link.linkType;

    // Update the link
    await ctx.db.patch(args.linkId, {
      linkType: "CONFIRMED",
      confirmedBy: currentUser._id,
      confirmedAt: now,
      updatedAt: now,
    });

    // Log the confirmation
    await ctx.db.insert("intervinienteLinkAudit", {
      participantId: link.participantId,
      clientId: link.clientId,
      caseId: link.caseId,
      action: "CONFIRMED",
      previousLinkType,
      newLinkType: "CONFIRMED",
      performedBy: currentUser._id,
      performedAt: now,
    });

    // Get participant for role mapping
    const participant = await ctx.db.get(link.participantId);
    if (participant) {
      const roleMapping = mapPjnRole(participant.role);

      // Create clientCase relation if it's a party role
      if (isPartyRole(roleMapping.localRole)) {
        await ctx.runMutation(
          internal.intervinientes.matching.ensureClientCaseRelation,
          {
            clientId: link.clientId,
            caseId: link.caseId,
            participantId: link.participantId,
            role: link.localRole || roleMapping.localRole,
          },
        );
      }
    }

    return { success: true };
  },
});

/**
 * Manually link an interviniente to a client.
 */
export const linkIntervinienteToClient = mutation({
  args: {
    participantId: v.id("caseParticipants"),
    clientId: v.id("clients"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; linkId: Id<"intervinienteClientLinks"> }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get participant
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      participant.caseId,
      "advanced",
    );

    // Verify client exists
    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw new Error("Client not found");
    }

    const now = Date.now();

    // Check for existing link
    const existingLink = await ctx.db
      .query("intervinienteClientLinks")
      .withIndex("by_participant", (q) =>
        q.eq("participantId", args.participantId),
      )
      .first();

    // Map role if not provided
    const roleMapping = mapPjnRole(participant.role);
    const localRole = args.role || roleMapping.localRole;

    let linkId: Id<"intervinienteClientLinks">;

    if (existingLink) {
      // Update existing link
      await ctx.db.patch(existingLink._id, {
        clientId: args.clientId,
        localRole,
        linkType: "MANUAL",
        confidence: 1.0,
        matchReason: "Vinculación manual",
        confirmedBy: currentUser._id,
        confirmedAt: now,
        updatedAt: now,
      });

      linkId = existingLink._id;

      // Log the change
      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId: args.clientId,
        caseId: participant.caseId,
        action: "MANUAL_LINKED",
        previousLinkType: existingLink.linkType,
        newLinkType: "MANUAL",
        performedBy: currentUser._id,
        performedAt: now,
      });
    } else {
      // Create new link
      linkId = await ctx.db.insert("intervinienteClientLinks", {
        participantId: args.participantId,
        clientId: args.clientId,
        caseId: participant.caseId,
        localRole,
        linkType: "MANUAL",
        confidence: 1.0,
        matchReason: "Vinculación manual",
        confirmedBy: currentUser._id,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Log the creation
      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId: args.clientId,
        caseId: participant.caseId,
        action: "MANUAL_LINKED",
        newLinkType: "MANUAL",
        performedBy: currentUser._id,
        performedAt: now,
      });
    }

    // Create clientCase relation if it's a party role
    if (isPartyRole(roleMapping.localRole)) {
      await ctx.runMutation(
        internal.intervinientes.matching.ensureClientCaseRelation,
        {
          clientId: args.clientId,
          caseId: participant.caseId,
          participantId: args.participantId,
          role: localRole,
        },
      );
    }

    return { success: true, linkId };
  },
});

/**
 * Unlink an interviniente from a client.
 */
export const unlinkInterviniente = mutation({
  args: {
    linkId: v.id("intervinienteClientLinks"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const link = await ctx.db.get(args.linkId);
    if (!link) {
      throw new Error("Link not found");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(ctx, currentUser._id, link.caseId, "advanced");

    const now = Date.now();

    // Log the unlink
    await ctx.db.insert("intervinienteLinkAudit", {
      participantId: link.participantId,
      clientId: link.clientId,
      caseId: link.caseId,
      action: "UNLINKED",
      previousLinkType: link.linkType,
      performedBy: currentUser._id,
      performedAt: now,
    });

    // Delete the link
    await ctx.db.delete(args.linkId);

    // Note: We don't remove the clientCase relation as the user may have
    // other reasons to keep the client on the case

    return { success: true };
  },
});

/**
 * Mark an interviniente as ignored (user explicitly chose not to link).
 */
export const ignoreInterviniente = mutation({
  args: {
    participantId: v.id("caseParticipants"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      participant.caseId,
      "advanced",
    );

    const now = Date.now();

    // Check for existing link
    const existingLink = await ctx.db
      .query("intervinienteClientLinks")
      .withIndex("by_participant", (q) =>
        q.eq("participantId", args.participantId),
      )
      .first();

    if (existingLink) {
      // Update to IGNORED
      await ctx.db.patch(existingLink._id, {
        linkType: "IGNORED",
        confirmedBy: currentUser._id,
        confirmedAt: now,
        updatedAt: now,
      });

      // Log the change
      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        clientId: existingLink.clientId,
        caseId: participant.caseId,
        action: "IGNORED",
        previousLinkType: existingLink.linkType,
        newLinkType: "IGNORED",
        performedBy: currentUser._id,
        performedAt: now,
      });
    } else {
      // Create an IGNORED link (without clientId)
      // This requires a slight schema adjustment or we can just not create a link
      // For now, log the ignore action without creating a link
      await ctx.db.insert("intervinienteLinkAudit", {
        participantId: args.participantId,
        caseId: participant.caseId,
        action: "IGNORED",
        performedBy: currentUser._id,
        performedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Create a new client from an interviniente and link them.
 */
export const createClientFromInterviniente = mutation({
  args: {
    participantId: v.id("caseParticipants"),
    // Client creation fields
    naturalezaJuridica: v.union(v.literal("humana"), v.literal("juridica")),
    // Persona humana fields
    nombre: v.optional(v.string()),
    apellido: v.optional(v.string()),
    dni: v.optional(v.string()),
    actividadEconomica: v.optional(
      v.union(
        v.literal("sin_actividad"),
        v.literal("profesional"),
        v.literal("comerciante"),
      ),
    ),
    // Persona juridica fields
    razonSocial: v.optional(v.string()),
    tipoPersonaJuridica: v.optional(v.string()),
    tipoSociedad: v.optional(v.string()),
    // Common fields
    cuit: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    domicilioLegal: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    clientId: v.id("clients"),
    linkId: v.id("intervinienteClientLinks"),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Verify user has access to the case
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      participant.caseId,
      "advanced",
    );

    // Build displayName
    let displayName: string;
    if (args.naturalezaJuridica === "humana") {
      if (!args.nombre || !args.apellido) {
        throw new Error("Nombre y apellido son requeridos");
      }
      displayName = `${args.apellido.trim()}, ${args.nombre.trim()}`;
    } else {
      if (!args.razonSocial) {
        throw new Error("Razón social es requerida");
      }
      displayName = args.razonSocial.trim();
    }

    // Create the client
    const clientId = await ctx.db.insert("clients", {
      naturalezaJuridica: args.naturalezaJuridica,
      nombre: args.nombre,
      apellido: args.apellido,
      dni: args.dni,
      actividadEconomica: args.actividadEconomica,
      razonSocial: args.razonSocial,
      tipoPersonaJuridica: args.tipoPersonaJuridica as any,
      tipoSociedad: args.tipoSociedad as any,
      cuit: args.cuit,
      email: args.email,
      phone: args.phone,
      domicilioLegal: args.domicilioLegal,
      displayName,
      isActive: true,
      createdBy: currentUser._id,
    });

    // Map role
    const roleMapping = mapPjnRole(participant.role);

    const now = Date.now();

    // Create the link
    const linkId = await ctx.db.insert("intervinienteClientLinks", {
      participantId: args.participantId,
      clientId,
      caseId: participant.caseId,
      localRole: roleMapping.localRole,
      linkType: "MANUAL",
      confidence: 1.0,
      matchReason: "Cliente creado desde interviniente",
      confirmedBy: currentUser._id,
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Log the creation
    await ctx.db.insert("intervinienteLinkAudit", {
      participantId: args.participantId,
      clientId,
      caseId: participant.caseId,
      action: "MANUAL_LINKED",
      newLinkType: "MANUAL",
      matchReason: "Cliente creado desde interviniente",
      performedBy: currentUser._id,
      performedAt: now,
    });

    // Create clientCase relation if it's a party role
    if (isPartyRole(roleMapping.localRole)) {
      await ctx.runMutation(
        internal.intervinientes.matching.ensureClientCaseRelation,
        {
          clientId,
          caseId: participant.caseId,
          participantId: args.participantId,
          role: roleMapping.localRole,
        },
      );
    }

    return { success: true, clientId, linkId };
  },
});

/**
 * Re-run matching for all participants in a case.
 * Useful after adding new clients to the workspace.
 */
export const rematchParticipantsForCase = mutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; processed: number; linked: number; suggested: number }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify user has access to the case
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    // Run the batch matching
    const result = await ctx.runMutation(
      internal.intervinientes.matching.matchAllParticipantsForCase,
      { caseId: args.caseId },
    );

    return {
      success: true,
      ...result,
    };
  },
});
