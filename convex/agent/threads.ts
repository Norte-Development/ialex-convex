import { components } from "../_generated/api";
import { v } from "convex/values";
import { action, ActionCtx, mutation, MutationCtx, query, QueryCtx } from "../_generated/server";
import { createThread, getThreadMetadata, saveMessage, vMessage } from "@convex-dev/agent";
import { getCurrentUserFromAuth } from "../auth_utils";
import { agent } from "./agent";
import z from "zod";
import { paginationOptsValidator } from "convex/server";
import { threadId } from "worker_threads";


export async function authorizeThreadAccess(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    threadId: string,
    requireUser?: boolean,
) {
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject;

    if (requireUser && !userId){
        throw new Error("Unauthorized: user is required");

    }
    const {userId: threadUserId } = await getThreadMetadata(ctx, components.agent, {threadId});
    if (requireUser && threadUserId !== userId) {
        throw new Error("Unauthorized: user does not match user thread")
    }
}

export const listThreads = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserFromAuth(ctx);
    const threads = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      { userId: userId.clerkId, paginationOpts: args.paginationOpts },
    );
    return threads;
  },
});


export const createNewThread = mutation({
    args: {
        title: v.optional(v.string()),
        initialMessage: v.optional(vMessage),
    },
    handler: async (ctx, args) => {
        const userId = await getCurrentUserFromAuth(ctx);
        const threadId = await createThread(ctx, components.agent, {
            userId: userId.clerkId,
            title: args.title,
        });
       if (args.initialMessage) {
        await saveMessage(ctx, components.agent, {
            threadId,
            message: args.initialMessage,
        });
       }
       return threadId;
    },
});


export const getThreadDetails = query({
    args: {threadId: v.string()},
    handler: async (ctx , {threadId}) => {
        await authorizeThreadAccess(ctx, threadId);
        const {title, summary} = await getThreadMetadata(ctx, components.agent, {threadId});
        return {title, summary};
    }
})

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

