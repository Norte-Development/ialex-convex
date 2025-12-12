import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getCurrentUserFromAuth } from "../auth_utils";
import { _getUserPlan } from "../billing/features";

const popupTemplateValidator = v.union(v.literal("simple"), v.literal("promo"));
const popupAudienceValidator = v.union(
  v.literal("all"),
  v.literal("free"),
  v.literal("trial"),
  v.literal("free_or_trial"),
);

const popupActionValidator = v.object({
  type: v.union(v.literal("link"), v.literal("billing")),
  label: v.string(),
  url: v.optional(v.string()),
  newTab: v.optional(v.boolean()),
  billingMode: v.optional(
    v.union(
      v.literal("plans"),
      v.literal("checkout_individual"),
      v.literal("checkout_team"),
    ),
  ),
});

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function audienceMatches(args: {
  audience: "all" | "free" | "trial" | "free_or_trial";
  isFree: boolean;
  isTrial: boolean;
}) {
  if (args.audience === "all") return true;
  if (args.audience === "free") return args.isFree;
  if (args.audience === "trial") return args.isTrial;
  if (args.audience === "free_or_trial") return args.isFree || args.isTrial;
  return false;
}

function withinSchedule(now: number, startAt?: number, endAt?: number) {
  if (startAt !== undefined && now < startAt) return false;
  if (endAt !== undefined && now > endAt) return false;
  return true;
}

/**
 * Admin: list all popups (enabled and disabled).
 */
export const listPopupsAdmin = query({
  args: {},
  handler: async (ctx) => {
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
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
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
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

    badgeText: v.optional(v.string()),
    actions: v.optional(v.array(popupActionValidator)),

    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),

    showAfterDays: v.optional(v.number()),
    frequencyDays: v.optional(v.number()),
    maxImpressions: v.optional(v.number()),

    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
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
      badgeText: args.badgeText,
      actions: args.actions,
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

    badgeText: v.optional(v.string()),
    actions: v.optional(v.array(popupActionValidator)),

    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),

    showAfterDays: v.optional(v.number()),
    frequencyDays: v.optional(v.number()),
    maxImpressions: v.optional(v.number()),

    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
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

    if (args.badgeText !== undefined) patch.badgeText = args.badgeText;
    if (args.actions !== undefined) patch.actions = args.actions;

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
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
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
    // TEMP: server-side admin guard disabled; relying on frontend RequireAdminsOrg.
    await getCurrentUserFromAuth(ctx);

    const popup = await ctx.db.get(args.popupId);
    if (!popup) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    await ctx.db.delete(args.popupId);
  },
});

/**
 * User: returns the best popup to show right now, or null.
 *
 * Selection rules:
 * - enabled
 * - audience match (free/trial)
 * - within schedule window (startAt/endAt)
 * - showAfterDays based on user account age
 * - skip if dismissed
 * - enforce maxImpressions
 * - enforce frequencyDays based on lastShownAt
 *
 * Priority: highest `priority` first, then `updatedAt`.
 */
export const getActivePopupForUser = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const now = Date.now();

    const plan = await _getUserPlan(ctx, currentUser._id);
    const isTrial =
      currentUser.trialStatus === "active" &&
      currentUser.trialEndDate !== undefined &&
      currentUser.trialEndDate > now;
    const isFree = !isTrial && plan === "free";

    const popups = await ctx.db
      .query("popups")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();

    if (popups.length === 0) return null;

    const views = await ctx.db
      .query("popupViews")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();

    const viewsByPopupId = new Map<string, (typeof views)[number]>();
    for (const view of views) {
      viewsByPopupId.set(view.popupId as unknown as string, view);
    }

    const eligible = popups.filter((popup) => {
      if (!withinSchedule(now, popup.startAt, popup.endAt)) return false;
      if (!audienceMatches({ audience: popup.audience, isFree, isTrial })) {
        return false;
      }

      if (popup.showAfterDays !== undefined) {
        const minAgeMs = popup.showAfterDays * MS_PER_DAY;
        const userAgeMs = now - currentUser._creationTime;
        if (userAgeMs < minAgeMs) return false;
      }

      const view = viewsByPopupId.get(popup._id as unknown as string);
      if (!view) return true;
      if (view.dismissedAt !== undefined) return false;

      if (
        popup.maxImpressions !== undefined &&
        view.impressions >= popup.maxImpressions
      ) {
        return false;
      }

      if (popup.frequencyDays !== undefined) {
        const minGapMs = popup.frequencyDays * MS_PER_DAY;
        if (now - view.lastShownAt < minGapMs) return false;
      }

      return true;
    });

    if (eligible.length === 0) return null;

    eligible.sort((a, b) => {
      const prioA = a.priority ?? 0;
      const prioB = b.priority ?? 0;
      if (prioA !== prioB) return prioB - prioA;
      return b.updatedAt - a.updatedAt;
    });

    const popup = eligible[0];
    const view = viewsByPopupId.get(popup._id as unknown as string) ?? null;

    return {
      popup,
      view: view
        ? {
            impressions: view.impressions,
            firstShownAt: view.firstShownAt,
            lastShownAt: view.lastShownAt,
            dismissedAt: view.dismissedAt,
          }
        : null,
    };
  },
});

/**
 * User: record that the popup was shown (impression + lastShownAt).
 */
export const recordPopupImpression = mutation({
  args: {
    popupId: v.id("popups"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const now = Date.now();

    const popup = await ctx.db.get(args.popupId);
    if (!popup) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    const existingView = await ctx.db
      .query("popupViews")
      .withIndex("by_popup_and_user", (q) =>
        q.eq("popupId", args.popupId).eq("userId", currentUser._id),
      )
      .first();

    if (!existingView) {
      await ctx.db.insert("popupViews", {
        popupId: args.popupId,
        userId: currentUser._id,
        impressions: 1,
        firstShownAt: now,
        lastShownAt: now,
        dismissedAt: undefined,
      });
      return { impressions: 1 };
    }

    const nextImpressions = existingView.impressions + 1;
    await ctx.db.patch(existingView._id, {
      impressions: nextImpressions,
      lastShownAt: now,
    });

    return { impressions: nextImpressions };
  },
});

/**
 * User: dismiss a popup (do not show again).
 */
export const dismissPopup = mutation({
  args: {
    popupId: v.id("popups"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const now = Date.now();

    const popup = await ctx.db.get(args.popupId);
    if (!popup) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Popup not found" });
    }

    const existingView = await ctx.db
      .query("popupViews")
      .withIndex("by_popup_and_user", (q) =>
        q.eq("popupId", args.popupId).eq("userId", currentUser._id),
      )
      .first();

    if (!existingView) {
      await ctx.db.insert("popupViews", {
        popupId: args.popupId,
        userId: currentUser._id,
        impressions: 0,
        firstShownAt: now,
        lastShownAt: now,
        dismissedAt: now,
      });
      return { dismissedAt: now };
    }

    await ctx.db.patch(existingView._id, {
      dismissedAt: now,
      lastShownAt: now,
    });

    return { dismissedAt: now };
  },
});
