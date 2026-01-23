import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Create a notification for a user (internal use)
 */
export const createForUser = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(
      v.literal("pjn_notification"),
      v.literal("document_processed"),
      v.literal("team_invitation"),
      v.literal("case_update"),
      v.literal("system"),
    ),
    title: v.string(),
    bodyPreview: v.string(),
    source: v.union(
      v.literal("PJN-Portal"),
      v.literal("system"),
      v.literal("internal"),
    ),
    caseId: v.optional(v.id("cases")),
    documentId: v.optional(v.id("documents")),
    pjnEventId: v.optional(v.string()),
    linkTarget: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"notifications"> | null> => {
    // Check if notification already exists (for idempotency, especially for PJN events)
    if (args.pjnEventId) {
      const existing = await ctx.db
        .query("notifications")
        .withIndex("by_pjnEventId", (q) => q.eq("pjnEventId", args.pjnEventId!))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .first();

      if (existing) {
        // Notification already exists, skip creation
        return null;
      }
    }

    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      bodyPreview: args.bodyPreview,
      source: args.source,
      readAt: undefined,
      caseId: args.caseId,
      documentId: args.documentId,
      pjnEventId: args.pjnEventId,
      linkTarget: args.linkTarget,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

/**
 * Bulk create notifications for multiple users (for future broadcast-style notifications)
 */
export const bulkCreateForUsers = internalMutation({
  args: {
    userIds: v.array(v.id("users")),
    kind: v.union(
      v.literal("pjn_notification"),
      v.literal("document_processed"),
      v.literal("team_invitation"),
      v.literal("case_update"),
      v.literal("system"),
    ),
    title: v.string(),
    bodyPreview: v.string(),
    source: v.union(
      v.literal("PJN-Portal"),
      v.literal("system"),
      v.literal("internal"),
    ),
    caseId: v.optional(v.id("cases")),
    documentId: v.optional(v.id("documents")),
    pjnEventId: v.optional(v.string()),
    linkTarget: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    let created = 0;

    for (const userId of args.userIds) {
      // Check idempotency for PJN events
      if (args.pjnEventId) {
        const existing = await ctx.db
          .query("notifications")
          .withIndex("by_pjnEventId", (q) => q.eq("pjnEventId", args.pjnEventId!))
          .filter((q) => q.eq(q.field("userId"), userId))
          .first();

        if (existing) {
          continue;
        }
      }

      await ctx.db.insert("notifications", {
        userId,
        kind: args.kind,
        title: args.title,
        bodyPreview: args.bodyPreview,
        source: args.source,
        readAt: undefined,
        caseId: args.caseId,
        documentId: args.documentId,
        pjnEventId: args.pjnEventId,
        linkTarget: args.linkTarget,
        createdAt: now,
      });
      created++;
    }

    return created;
  },
});

/**
 * List notifications for the current user
 */
export const listForCurrentUser = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    kind: v.optional(
      v.union(
        v.literal("pjn_notification"),
        v.literal("document_processed"),
        v.literal("team_invitation"),
        v.literal("case_update"),
        v.literal("system"),
      ),
    ),
    caseId: v.optional(v.id("cases")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    let query = ctx.db
      .query("notifications")
      .withIndex("by_user_and_createdAt", (q) => q.eq("userId", user._id));

    // Apply filters
    const notifications = await query.collect();

    let filtered = notifications;

    if (args.unreadOnly) {
      filtered = filtered.filter((n) => !n.readAt);
    }

    if (args.kind) {
      filtered = filtered.filter((n) => n.kind === args.kind);
    }

    if (args.caseId) {
      filtered = filtered.filter((n) => n.caseId === args.caseId);
    }

    // Sort by createdAt descending (most recent first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    if (args.limit) {
      filtered = filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

/**
 * Get unread count for current user
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return notifications.filter((n) => !n.readAt).length;
  },
});

/**
 * Mark a notification as read
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    // Verify ownership
    if (notification.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // Only mark as read if not already read
    if (!notification.readAt) {
      await ctx.db.patch(args.notificationId, {
        readAt: Date.now(),
      });
    }
  },
});

/**
 * Mark all notifications as read for current user
 */
export const markAllAsReadForCurrentUser = mutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const now = Date.now();
    let marked = 0;

    for (const notification of notifications) {
      if (!notification.readAt) {
        await ctx.db.patch(notification._id, {
          readAt: now,
        });
        marked++;
      }
    }

    return marked;
  },
});

