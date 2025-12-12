import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getCurrentUserFromAuth, requireAdminsOrg } from "../auth_utils";

const popupTemplateValidator = v.union(v.literal("simple"));
const popupAudienceValidator = v.union(
  v.literal("all"),
  v.literal("free"),
  v.literal("trial"),
  v.literal("free_or_trial"),
);

function normalizeKey(key: string): string {
  return key.trim();
}

function validateSchedule(args: { startAt?: number; endAt?: number }) {
  if (
    args.startAt !== undefined &&
    args.endAt !== undefined &&
    args.startAt > args.endAt
  ) {
    throw new ConvexError({
      code: "INVALID_SCHEDULE",
      message: "startAt must be <= endAt",
    });
  }
}

/**
 * Admin: list all popups (enabled and disabled).
 */
export const listPopupsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminsOrg(ctx);
    await getCurrentUserFromAuth(ctx);

    const popups = await ctx.db.query("popups").collect();

    popups.sort((a, b) => {
      const prioA = a.priority ?? 0;
      const prioB = b.priority ?? 0;
      if (prioA !== prioB) return prioB - prioA;
      return b.updatedAt - a.updatedAt;
    });

    return popups;
  },
});

/**
 * Admin: fetch popup by id.
 */
export const getPopupAdmin = query({
  args: { popupId: v.id("popups") },
  handler: async (ctx, args) => {
    await requireAdminsOrg(ctx);
    await getCurrentUserFromAuth(ctx);

    return await ctx.db.get(args.popupId);
  },
});

/**
 * Admin: create popup.
 */
export const createPopupAdmin = mutation({
  args: {
    key: v.string(),
    title: v.string(),
    body: v.string(),
    enabled: v.optional(v.boolean()),
    template: v.optional(popupTemplateValidator),
    audience: popupAudienceValidator,

    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),

    showAfterDays: v.optional(v.number()),
    frequencyDays: v.optional(v.number()),
    maxImpressions: v.optional(v.number()),

    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminsOrg(ctx);
    const currentUser = await getCurrentUserFromAuth(ctx);

    const key = normalizeKey(args.key);
    if (!key) {
      throw new ConvexError({
        code: "INVALID_KEY",
        message: "key is required",
      });
    }

    validateSchedule({ startAt: args.startAt, endAt: args.endAt });

    const existing = await ctx.db
      .query("popups")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      throw new ConvexError({
        code: "POPUP_KEY_EXISTS",
        message: `Popup with key '${key}' already exists`,
      });
    }

    const now = Date.now();

    const popupId = await ctx.db.insert("popups", {
      key,
      title: args.title,
      body: args.body,
      enabled: args.enabled ?? true,
      template: args.template ?? "simple",
      audience: args.audience,
      startAt: args.startAt,
      endAt: args.endAt,
      showAfterDays: args.showAfterDays,
      frequencyDays: args.frequencyDays,
      maxImpressions: args.maxImpressions,
      priority: args.priority,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
      createdAt: now,
      updatedAt: now,
    });

    return popupId;
  },
});

/**
 * Admin: update popup.
 */
export const updatePopupAdmin = mutation({
  args: {
    popupId: v.id("popups"),
    key: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    template: v.optional(popupTemplateValidator),
    audience: v.optional(popupAudienceValidator),

    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),

    showAfterDays: v.optional(v.number()),
    frequencyDays: v.optional(v.number()),
    maxImpressions: v.optional(v.number()),

    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminsOrg(ctx);
    const currentUser = await getCurrentUserFromAuth(ctx);

    const existing = await ctx.db.get(args.popupId);
    if (!existing) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    const nextKey =
      args.key !== undefined ? normalizeKey(args.key) : existing.key;
    if (!nextKey) {
      throw new ConvexError({
        code: "INVALID_KEY",
        message: "key is required",
      });
    }

    // If key changes, enforce uniqueness
    if (nextKey !== existing.key) {
      const keyCollision = await ctx.db
        .query("popups")
        .withIndex("by_key", (q) => q.eq("key", nextKey))
        .first();

      if (keyCollision) {
        throw new ConvexError({
          code: "POPUP_KEY_EXISTS",
          message: `Popup with key '${nextKey}' already exists`,
        });
      }
    }

    const nextStartAt =
      args.startAt !== undefined ? args.startAt : existing.startAt;
    const nextEndAt = args.endAt !== undefined ? args.endAt : existing.endAt;
    validateSchedule({ startAt: nextStartAt, endAt: nextEndAt });

    const patch: Record<string, any> = {
      updatedAt: Date.now(),
      updatedBy: currentUser._id,
    };

    if (args.key !== undefined) patch.key = nextKey;
    if (args.title !== undefined) patch.title = args.title;
    if (args.body !== undefined) patch.body = args.body;
    if (args.enabled !== undefined) patch.enabled = args.enabled;
    if (args.template !== undefined) patch.template = args.template;
    if (args.audience !== undefined) patch.audience = args.audience;

    if (args.startAt !== undefined) patch.startAt = args.startAt;
    if (args.endAt !== undefined) patch.endAt = args.endAt;

    if (args.showAfterDays !== undefined)
      patch.showAfterDays = args.showAfterDays;
    if (args.frequencyDays !== undefined)
      patch.frequencyDays = args.frequencyDays;
    if (args.maxImpressions !== undefined)
      patch.maxImpressions = args.maxImpressions;

    if (args.priority !== undefined) patch.priority = args.priority;

    await ctx.db.patch(args.popupId, patch);
  },
});

/**
 * Admin: enable/disable popup.
 */
export const setPopupEnabledAdmin = mutation({
  args: {
    popupId: v.id("popups"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminsOrg(ctx);
    const currentUser = await getCurrentUserFromAuth(ctx);

    const popup = await ctx.db.get(args.popupId);
    if (!popup) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    await ctx.db.patch(args.popupId, {
      enabled: args.enabled,
      updatedAt: Date.now(),
      updatedBy: currentUser._id,
    });
  },
});

/**
 * Admin: hard delete popup.
 * Note: does not cascade delete from popupViews.
 */
export const deletePopupAdmin = mutation({
  args: { popupId: v.id("popups") },
  handler: async (ctx, args) => {
    await requireAdminsOrg(ctx);
    await getCurrentUserFromAuth(ctx);

    const popup = await ctx.db.get(args.popupId);
    if (!popup) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    await ctx.db.delete(args.popupId);
  },
});
