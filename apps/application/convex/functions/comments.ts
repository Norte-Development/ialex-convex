import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getCurrentUserFromAuth } from "../auth_utils";

/**
 * Extract user IDs from mentions in content
 * Mentions are formatted as @[userId] in the text
 */
function extractMentions(content: string): Id<"users">[] {
  const mentionRegex = /@\[([^\]]+)\]/g;
  const mentions: Id<"users">[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1] as Id<"users">);
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Create a new comment on a task
 */
export const createComment = mutation({
  args: {
    taskId: v.id("todoItems"),
    content: v.string(),
  },
  returns: v.id("taskComments"),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verify task exists
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Extract mentions from content
    const mentions = extractMentions(args.content);

    const commentId = await ctx.db.insert("taskComments", {
      taskId: args.taskId,
      authorId: currentUser._id,
      content: args.content,
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: Date.now(),
      isEdited: false,
    });

    return commentId;
  },
});

/**
 * List all comments for a task with author details
 */
export const listCommentsByTask = query({
  args: {
    taskId: v.id("todoItems"),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .order("asc")
      .collect();

    // Enrich with author data
    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          author: author
            ? {
                _id: author._id,
                name: author.name,
                email: author.email,
                profileImage: author.profileImage,
              }
            : null,
        };
      }),
    );

    return commentsWithAuthors;
  },
});

/**
 * Update a comment (only author can edit)
 */
export const updateComment = mutation({
  args: {
    commentId: v.id("taskComments"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Only author can edit
    if (comment.authorId !== currentUser._id) {
      throw new Error("You can only edit your own comments");
    }

    // Extract new mentions
    const mentions = extractMentions(args.content);

    await ctx.db.patch(args.commentId, {
      content: args.content,
      mentions: mentions.length > 0 ? mentions : undefined,
      updatedAt: Date.now(),
      isEdited: true,
    });

    return null;
  },
});

/**
 * Delete a comment (only author can delete)
 */
export const deleteComment = mutation({
  args: {
    commentId: v.id("taskComments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Only author can delete
    if (comment.authorId !== currentUser._id) {
      throw new Error("You can only delete your own comments");
    }

    await ctx.db.delete(args.commentId);

    return null;
  },
});

/**
 * Get comment count for a task
 */
export const getCommentCount = query({
  args: {
    taskId: v.id("todoItems"),
  },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("taskComments")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    return comments.length;
  },
});

/**
 * Get comment counts for multiple tasks (batch query for Kanban)
 */
export const getCommentCountsForTasks = query({
  args: {
    taskIds: v.array(v.id("todoItems")),
  },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};

    for (const taskId of args.taskIds) {
      const comments = await ctx.db
        .query("taskComments")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect();
      counts[taskId] = comments.length;
    }

    return counts;
  },
});
