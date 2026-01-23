import { v } from "convex/values";
import { query, mutation, internalQuery } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { getCurrentUserFromAuth } from "../auth_utils";

// Default settings
const DEFAULT_SETTINGS = {
  autoLinkHighConfidence: true,
  autoLinkLowConfidence: true,
  requireConfirmationForAll: false,
  highConfidenceThreshold: 0.95,
  lowConfidenceThreshold: 0.85,
  notifyOnAutoLink: false,
};

const settingsValidator = v.object({
  autoLinkHighConfidence: v.boolean(),
  autoLinkLowConfidence: v.boolean(),
  requireConfirmationForAll: v.boolean(),
  highConfidenceThreshold: v.number(),
  lowConfidenceThreshold: v.number(),
  notifyOnAutoLink: v.boolean(),
});

/**
 * Get the effective interviniente sync settings for the current user.
 * Returns user-specific settings if they exist, otherwise team settings, or defaults.
 */
export const getSettings = query({
  args: {},
  returns: settingsValidator,
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // First, check for user-specific settings
    const userSettings = await ctx.db
      .query("intervinienteSyncSettings")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .first();

    if (userSettings) {
      return {
        autoLinkHighConfidence: userSettings.autoLinkHighConfidence,
        autoLinkLowConfidence: userSettings.autoLinkLowConfidence,
        requireConfirmationForAll: userSettings.requireConfirmationForAll,
        highConfidenceThreshold: userSettings.highConfidenceThreshold,
        lowConfidenceThreshold: userSettings.lowConfidenceThreshold,
        notifyOnAutoLink: userSettings.notifyOnAutoLink,
      };
    }

    // Check for team settings
    const teamMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (teamMembership) {
      const teamSettings = await ctx.db
        .query("intervinienteSyncSettings")
        .withIndex("by_team", (q) => q.eq("teamId", teamMembership.teamId))
        .first();

      if (teamSettings) {
        return {
          autoLinkHighConfidence: teamSettings.autoLinkHighConfidence,
          autoLinkLowConfidence: teamSettings.autoLinkLowConfidence,
          requireConfirmationForAll: teamSettings.requireConfirmationForAll,
          highConfidenceThreshold: teamSettings.highConfidenceThreshold,
          lowConfidenceThreshold: teamSettings.lowConfidenceThreshold,
          notifyOnAutoLink: teamSettings.notifyOnAutoLink,
        };
      }
    }

    // Return defaults
    return DEFAULT_SETTINGS;
  },
});

/**
 * Internal query to get settings for matching engine.
 */
export const getSettingsForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    // First, check for user-specific settings
    const userSettings = await ctx.db
      .query("intervinienteSyncSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (userSettings) {
      return {
        autoLinkHighConfidence: userSettings.autoLinkHighConfidence,
        autoLinkLowConfidence: userSettings.autoLinkLowConfidence,
        requireConfirmationForAll: userSettings.requireConfirmationForAll,
        highConfidenceThreshold: userSettings.highConfidenceThreshold,
        lowConfidenceThreshold: userSettings.lowConfidenceThreshold,
        notifyOnAutoLink: userSettings.notifyOnAutoLink,
      };
    }

    // Check for team settings
    const teamMembership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (teamMembership) {
      const teamSettings = await ctx.db
        .query("intervinienteSyncSettings")
        .withIndex("by_team", (q) => q.eq("teamId", teamMembership.teamId))
        .first();

      if (teamSettings) {
        return {
          autoLinkHighConfidence: teamSettings.autoLinkHighConfidence,
          autoLinkLowConfidence: teamSettings.autoLinkLowConfidence,
          requireConfirmationForAll: teamSettings.requireConfirmationForAll,
          highConfidenceThreshold: teamSettings.highConfidenceThreshold,
          lowConfidenceThreshold: teamSettings.lowConfidenceThreshold,
          notifyOnAutoLink: teamSettings.notifyOnAutoLink,
        };
      }
    }

    // Return defaults
    return DEFAULT_SETTINGS;
  },
});

/**
 * Update interviniente sync settings for the current user.
 */
export const updateSettings = mutation({
  args: {
    autoLinkHighConfidence: v.optional(v.boolean()),
    autoLinkLowConfidence: v.optional(v.boolean()),
    requireConfirmationForAll: v.optional(v.boolean()),
    highConfidenceThreshold: v.optional(v.number()),
    lowConfidenceThreshold: v.optional(v.number()),
    notifyOnAutoLink: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const now = Date.now();

    // Check for existing user settings
    const existing = await ctx.db
      .query("intervinienteSyncSettings")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .first();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        ...(args.autoLinkHighConfidence !== undefined && {
          autoLinkHighConfidence: args.autoLinkHighConfidence,
        }),
        ...(args.autoLinkLowConfidence !== undefined && {
          autoLinkLowConfidence: args.autoLinkLowConfidence,
        }),
        ...(args.requireConfirmationForAll !== undefined && {
          requireConfirmationForAll: args.requireConfirmationForAll,
        }),
        ...(args.highConfidenceThreshold !== undefined && {
          highConfidenceThreshold: args.highConfidenceThreshold,
        }),
        ...(args.lowConfidenceThreshold !== undefined && {
          lowConfidenceThreshold: args.lowConfidenceThreshold,
        }),
        ...(args.notifyOnAutoLink !== undefined && {
          notifyOnAutoLink: args.notifyOnAutoLink,
        }),
        updatedAt: now,
      });
    } else {
      // Create new settings with defaults for unspecified fields
      await ctx.db.insert("intervinienteSyncSettings", {
        userId: currentUser._id,
        autoLinkHighConfidence:
          args.autoLinkHighConfidence ?? DEFAULT_SETTINGS.autoLinkHighConfidence,
        autoLinkLowConfidence:
          args.autoLinkLowConfidence ?? DEFAULT_SETTINGS.autoLinkLowConfidence,
        requireConfirmationForAll:
          args.requireConfirmationForAll ?? DEFAULT_SETTINGS.requireConfirmationForAll,
        highConfidenceThreshold:
          args.highConfidenceThreshold ?? DEFAULT_SETTINGS.highConfidenceThreshold,
        lowConfidenceThreshold:
          args.lowConfidenceThreshold ?? DEFAULT_SETTINGS.lowConfidenceThreshold,
        notifyOnAutoLink: args.notifyOnAutoLink ?? DEFAULT_SETTINGS.notifyOnAutoLink,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Get link audit history for a participant.
 */
export const getLinkAuditHistory = query({
  args: {
    participantId: v.id("caseParticipants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("intervinienteLinkAudit"),
      action: v.string(),
      previousLinkType: v.optional(v.string()),
      newLinkType: v.optional(v.string()),
      matchReason: v.optional(v.string()),
      confidence: v.optional(v.number()),
      performedBy: v.optional(v.id("users")),
      performerName: v.optional(v.string()),
      performedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Get the participant to verify access
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Get audit entries
    const auditEntries = await ctx.db
      .query("intervinienteLinkAudit")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .order("desc")
      .take(50);

    // Fetch user names for performers
    const performerIds = [
      ...new Set(auditEntries.filter((e) => e.performedBy).map((e) => e.performedBy!)),
    ];
    const performers = await Promise.all(performerIds.map((id) => ctx.db.get(id)));
    const performerMap = new Map<string, string>();
    for (let i = 0; i < performerIds.length; i++) {
      if (performers[i]) {
        performerMap.set(performerIds[i], performers[i]!.name);
      }
    }

    return auditEntries.map((entry) => ({
      _id: entry._id,
      action: entry.action,
      previousLinkType: entry.previousLinkType,
      newLinkType: entry.newLinkType,
      matchReason: entry.matchReason,
      confidence: entry.confidence,
      performedBy: entry.performedBy,
      performerName: entry.performedBy ? performerMap.get(entry.performedBy) : undefined,
      performedAt: entry.performedAt,
    }));
  },
});

/**
 * Get link audit history for a case (admin view).
 */
export const getCaseAuditHistory = query({
  args: {
    caseId: v.id("cases"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("intervinienteLinkAudit"),
      participantId: v.id("caseParticipants"),
      participantName: v.optional(v.string()),
      clientId: v.optional(v.id("clients")),
      clientName: v.optional(v.string()),
      action: v.string(),
      matchReason: v.optional(v.string()),
      confidence: v.optional(v.number()),
      performedBy: v.optional(v.id("users")),
      performerName: v.optional(v.string()),
      performedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const limit = args.limit ?? 100;

    // Get audit entries for this case
    const auditEntries = await ctx.db
      .query("intervinienteLinkAudit")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .take(limit);

    // Fetch participant names
    const participantIds = [...new Set(auditEntries.map((e) => e.participantId))];
    const participants = await Promise.all(participantIds.map((id) => ctx.db.get(id)));
    const participantMap = new Map<string, string>();
    for (let i = 0; i < participantIds.length; i++) {
      if (participants[i]) {
        participantMap.set(participantIds[i], participants[i]!.name);
      }
    }

    // Fetch client names
    const clientIds = [
      ...new Set(auditEntries.filter((e) => e.clientId).map((e) => e.clientId!)),
    ];
    const clients = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientMap = new Map<string, string>();
    for (let i = 0; i < clientIds.length; i++) {
      if (clients[i]) {
        clientMap.set(
          clientIds[i],
          clients[i]!.displayName ||
            clients[i]!.razonSocial ||
            `${clients[i]!.apellido}, ${clients[i]!.nombre}` ||
            "Cliente",
        );
      }
    }

    // Fetch performer names
    const performerIds = [
      ...new Set(auditEntries.filter((e) => e.performedBy).map((e) => e.performedBy!)),
    ];
    const performers = await Promise.all(performerIds.map((id) => ctx.db.get(id)));
    const performerMap = new Map<string, string>();
    for (let i = 0; i < performerIds.length; i++) {
      if (performers[i]) {
        performerMap.set(performerIds[i], performers[i]!.name);
      }
    }

    return auditEntries.map((entry) => ({
      _id: entry._id,
      participantId: entry.participantId,
      participantName: participantMap.get(entry.participantId),
      clientId: entry.clientId,
      clientName: entry.clientId ? clientMap.get(entry.clientId) : undefined,
      action: entry.action,
      matchReason: entry.matchReason,
      confidence: entry.confidence,
      performedBy: entry.performedBy,
      performerName: entry.performedBy ? performerMap.get(entry.performedBy) : undefined,
      performedAt: entry.performedAt,
    }));
  },
});
