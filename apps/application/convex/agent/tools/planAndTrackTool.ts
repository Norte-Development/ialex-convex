import { createTool, ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../../_generated/api";
import { getUserAndCaseIds } from "./utils";
import { Id } from "../../_generated/dataModel";

export const planAndTrackTool = createTool({
  description: "Analyze a complex legal request, create a basic todo list with actionable tasks, and track progress. Phase 1: simple decomposition only.",
  args: z
    .object({
      task: z.string().describe("High-level user request to analyze and plan"),
      context: z
        .object({
          urgency: z.enum(["low", "medium", "high"]).optional(),
          deadline: z.string().optional(),
          userExperience: z
            .enum(["beginner", "intermediate", "advanced"]).optional(),
        })
        .optional(),
      planningMode: z
        .enum(["detailed", "quick", "template"]) 
        .default("quick"),
      existingTodos: z.any().optional(),
      threadId: z.string().optional().describe("Agent thread id for association"),
    })
    .required({ task: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    const {userId, caseId} = getUserAndCaseIds(ctx.userId as string);

    // Simple heuristic decomposition (Phase 1)
    const baseTasks: Array<{ title: string }>
      = [
        { title: "Clarify objectives and constraints" },
        { title: "Gather relevant case facts and documents" },
        { title: "Outline key steps and deliverables" },
        { title: "Execute initial step and report progress" },
      ];

    const listTitle = `Plan: ${args.task.slice(0, 60)}`;

    // Ensure a todo list exists for this thread (if provided)
    const listId = await ctx.runMutation(
      api.functions.todos.getOrCreateThreadTodoList,
      {
        title: listTitle,
        threadId: (args.threadId || ctx.threadId || "") as any,
        createdBy: userId as Id<"users">,
        caseId: caseId as Id<"cases">,
      },
    );

    // Add initial tasks if list is new or empty
    // We don't have a direct signal if newly created, so just list items first
    const existingItems = await ctx.runQuery(
      api.functions.todos.listTodoItemsByList,
      { listId: listId as any },
    );

    if (existingItems.length === 0) {
      let order = 1;
      for (const t of baseTasks) {
        await ctx.runMutation(api.functions.todos.addTodoItem, {
          listId: listId as any,
          title: t.title,
          createdBy: userId as Id<"users">,
          order,
        });
        order += 1;
      }
    }

    return {
      ok: true,
      message: "Planning initialized with a basic todo list",
      listId,
      itemsAdded: existingItems.length === 0 ? baseTasks.length : 0,
    };
  },
} as any);

