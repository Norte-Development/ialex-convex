import { components } from "../_generated/api";
import { v } from "convex/values";
import {
  action,
  ActionCtx,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from "../_generated/server";
import { getThreadMetadata, vMessage } from "@convex-dev/agent";
import { getCurrentUserFromAuth } from "../auth_utils";
import { agent } from "./case/agent";
import { paginationOptsValidator } from "convex/server";
import { checkNewCaseAccess } from "../auth_utils";
import { Id } from "../_generated/dataModel";

/**
 * Authorizes access to a thread based on user identity and thread ownership.
 *
 * @param ctx - The Convex context (QueryCtx, MutationCtx, or ActionCtx)
 * @param threadId - The ID of the thread to authorize access to
 * @param requireUser - Optional flag to require a valid user identity
 * @throws {Error} When user is required but not authenticated
 * @throws {Error} When user does not have access to the thread (commented out)
 */
export async function authorizeThreadAccess(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  threadId: string,
  requireUser?: boolean,
) {
  const user = await ctx.auth.getUserIdentity();
  const userId = user?.subject;

  if (requireUser && !userId) {
    throw new Error("Unauthorized: user is required");
  }
}

/**
 * Lists threads for a user, optionally filtered by case.
 *
 * TODO: Have this load all threads from all users in the case with metadata
 *
 * @param paginationOpts - Pagination options for the query
 * @param caseId - Optional case ID to filter threads by case
 * @returns Promise resolving to a list of threads with pagination
 * @throws {Error} When user doesn't have access to the specified case
 */
export const listThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
    caseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserFromAuth(ctx);
    if (args.caseId) {
      const access = await checkNewCaseAccess(
        ctx,
        userId._id,
        args.caseId as Id<"cases">,
        "basic",
      );
      if (!access.hasAccess) {
        throw new Error("Unauthorized: No access to this case");
      }
    }

    let threadUserId: string;
    if (args.caseId) {
      threadUserId = `case:${args.caseId}_${userId._id}`;
    } else {
      threadUserId = `user:${userId._id}`;
    }

    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: threadUserId, paginationOpts: args.paginationOpts },
    );
    return threads;
  },
});

/**
 * Searches threads by title and message content for a user, optionally filtered by case.
 *
 * @param searchTerm - The search term to filter threads by title and message content
 * @param caseId - Optional case ID to filter threads by case
 * @returns Promise resolving to a list of threads with snippets matching the search term
 * @throws {Error} When user doesn't have access to the specified case
 */
export const searchThreads = query({
  args: {
    searchTerm: v.string(),
    caseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserFromAuth(ctx);
    if (args.caseId) {
      const access = await checkNewCaseAccess(
        ctx,
        userId._id,
        args.caseId as Id<"cases">,
        "basic",
      );
      if (!access.hasAccess) {
        throw new Error("Unauthorized: No access to this case");
      }
    }

    let threadUserId: string;
    if (args.caseId) {
      threadUserId = `case:${args.caseId}_${userId._id}`;
    } else {
      threadUserId = `user:${userId._id}`;
    }

    // Get all threads for the user
    const allThreads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId: threadUserId,
        paginationOpts: { numItems: 100, cursor: null as any },
      },
    );

    const searchTermLower = args.searchTerm.toLowerCase().trim();
    if (!searchTermLower) {
      return allThreads;
    }

    // Search through threads and their messages
    const matchingThreads = [];

    for (const thread of allThreads.page) {
      let matchFound = false;
      let snippet = "";
      let matchType: "title" | "content" = "title";

      const titleMatch = (thread.title || "Untitled Thread")
        .toLowerCase()
        .includes(searchTermLower);
      if (titleMatch) {
        matchFound = true;
        snippet = thread.title || "Untitled Thread";
        matchType = "title";
      }

      if (!matchFound) {
        try {
          const messages = await agent.listMessages(ctx, {
            threadId: thread._id,
            paginationOpts: { numItems: 50, cursor: null as any },
          });

          for (const message of messages.page) {
            if (
              message.text &&
              message.text.toLowerCase().includes(searchTermLower)
            ) {
              matchFound = true;
              matchType = "content";

              // Create snippet with context around the match
              const text = message.text;
              const matchIndex = text.toLowerCase().indexOf(searchTermLower);
              const start = Math.max(0, matchIndex - 50);
              const end = Math.min(
                text.length,
                matchIndex + searchTermLower.length + 50,
              );

              snippet =
                (start > 0 ? "..." : "") +
                text.substring(start, end) +
                (end < text.length ? "..." : "");
              break;
            }
          }
        } catch (error) {
          // Skip threads where we can't access messages
          continue;
        }
      }

      if (matchFound) {
        matchingThreads.push({
          ...thread,
          searchSnippet: snippet,
          matchType: matchType,
        });
      }
    }

    return {
      ...allThreads,
      page: matchingThreads,
    };
  },
});

/**
 * Creates a new thread for a user, optionally associated with a case.
 *
 * @param title - Optional title for the new thread
 * @param initialMessage - Optional initial message to add to the thread
 * @param caseId - Optional case ID to associate the thread with
 * @returns Promise resolving to the created thread ID
 * @throws {Error} When user doesn't have access to the specified case
 */
export const createNewThread = mutation({
  args: {
    title: v.optional(v.string()),
    initialMessage: v.optional(vMessage),
    caseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserFromAuth(ctx);

    if (args.caseId) {
      const access = await checkNewCaseAccess(
        ctx,
        userId._id,
        args.caseId as Id<"cases">,
        "basic",
      );
      if (!access.hasAccess) {
        throw new Error("Unauthorized: No access to this case");
      }
    }

    let threadUserId: string;
    if (args.caseId) {
      threadUserId = `case:${args.caseId}_${userId._id}`;
    } else {
      threadUserId = `user:${userId._id}`;
    }

    const { threadId } = await agent.createThread(ctx, {
      userId: threadUserId,
      title: args.title,
    });

    if (args.initialMessage) {
      await agent.saveMessage(ctx, {
        threadId,
        message: args.initialMessage,
      });
    }
    return threadId;
  },
});

/**
 * Retrieves the title and summary metadata for a specific thread.
 *
 * @param threadId - The ID of the thread to get details for
 * @returns Promise resolving to an object containing title and summary
 * @throws {Error} When user doesn't have access to the thread
 */
export const getThreadDetails = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    await authorizeThreadAccess(ctx, threadId);
    const { title, summary } = await getThreadMetadata(ctx, components.agent, {
      threadId,
    });
    return { title, summary };
  },
});

/**
 * Lists messages for a specific thread.
 *
 * @param threadId - The ID of the thread to get messages from
 * @param paginationOpts - Pagination options for the query
 * @returns Promise resolving to paginated messages
 * @throws {Error} When user doesn't have access to the thread
 */
export const getThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { threadId, paginationOpts }) => {
    await authorizeThreadAccess(ctx, threadId);
    const messages = await agent.listMessages(ctx, {
      threadId,
      paginationOpts,
    });
    return messages;
  },
});

/**
 * Updates the title and summary of a thread using AI generation.
 *
 * NOTE: This function is currently commented out and not in use.
 *
 * @param threadId - The ID of the thread to update
 * @throws {Error} When user doesn't have access to the thread
 */
// export const updateThreadTitle = action({
//     args: { threadId: v.string() },
//     handler: async (ctx, { threadId }) => {
//       await authorizeThreadAccess(ctx, threadId);
//       const { thread } = await agent.continueThread(ctx, { threadId });
//       const {
//         object: { title, summary },
//       } = await thread.generateObject(
//         {
//           schemaDescription:
//             "Generate a title and summary for the thread. The title should be a single sentence that captures the main topic of the thread. The summary should be a short description of the thread that could be used to describe it to someone who hasn't read it.",
//           schema: z.object({
//             title: z.string().describe("The new title for the thread"),
//             summary: z.string().describe("The new summary for the thread"),
//           }),
//           prompt: "Generate a title and summary for this thread.",
//         },
//         { storageOptions: { saveMessages: "none" } },
//       );
//       await thread.updateMetadata({ title, summary });
//     },
//   });
