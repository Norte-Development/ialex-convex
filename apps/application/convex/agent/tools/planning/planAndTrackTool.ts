import { createTool, ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { api } from "../../../_generated/api";
import { getUserAndCaseIds } from "../utils";
import { Id } from "../../../_generated/dataModel";

export const planAndTrackTool = createTool({
  description: "Create a todo list with the provided tasks and track progress. Use this tool MANDATORY for complex tasks requiring more than 3 steps, extensive escrito editing, or multi-document analysis. This tool helps organize work, track progress, and facilitates continuation if step limits are reached. Always create the task list BEFORE starting any complex work.",
  args: z
    .object({
      plan: z.string().describe("High-level user request description"),
      tasks: z.array(z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Task description"),
      })).describe("Array of specific tasks to add to the todo list"),
      context: z
        .object({
          urgency: z.enum(["low", "medium", "high"]).optional(),
          deadline: z.string().optional(),
        })
        .optional(),
    })
    .required({ plan: true, tasks: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    const {userId, caseId} = getUserAndCaseIds(ctx.userId as string);

    // Use tasks provided by the agent
    const tasksToAdd = args.tasks;

    const listTitle = `Plan: ${args.plan.slice(0, 60)}`;

    // Ensure a todo list exists for this thread (if provided)
    const listId = await ctx.runMutation(
      api.functions.todos.getOrCreateThreadTodoList,
      {
        title: listTitle,
        threadId: ctx.threadId as any,
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
      for (const task of tasksToAdd) {
        await ctx.runMutation(api.functions.todos.addTodoItem, {
          listId: listId as any,
          title: task.title,
          description: task.description,
          createdBy: userId as Id<"users">,
          order,
        });
        order += 1;
      }
    }

    return {
      ok: true,
      message: "Todo list created with provided tasks",
      listId,
      itemsAdded: existingItems.length === 0 ? tasksToAdd.length : 0,
    };
  },
} as any);

export const markTaskCompleteTool = createTool({
  description: "Mark a specific task as completed in the current thread's todo list. Use this tool IMMEDIATELY after completing each individual task to maintain real-time progress tracking. This updates the todo list progress and helps with continuation if step limits are reached.",
  args: z
    .object({
      taskTitle: z.string().describe("The title of the task to mark as completed"),
    })
    .required({ taskTitle: true }),
  handler: async (ctx: ToolCtx, args: any) => {
    const {userId, caseId} = getUserAndCaseIds(ctx.userId as string);

    // Find the current thread's todo list
    const todoLists = await ctx.runQuery(
      api.functions.todos.listTodoListsByThread,
      { threadId: ctx.threadId as string }
    );

    if (todoLists.length === 0) {
      return {
        ok: false,
        message: "No todo list found for this thread",
      };
    }

    const listId = todoLists[0]._id;

    // Get all items in the list
    const todoItems = await ctx.runQuery(
      api.functions.todos.listTodoItemsByList,
      { listId }
    );

    // Find the task by title (case-insensitive match)
    const taskToComplete = todoItems.find(
      item => item.title.toLowerCase().trim() === args.taskTitle.toLowerCase().trim()
    );

    if (!taskToComplete) {
      return {
        ok: false,
        message: `Task "${args.taskTitle}" not found in the todo list`,
        availableTasks: todoItems.map(item => item.title),
      };
    }

    // Mark the task as completed
    await ctx.runMutation(api.functions.todos.updateTodoItem, {
      itemId: taskToComplete._id,
      status: "completed",
    });

    return {
      ok: true,
      message: `Task "${args.taskTitle}" marked as completed`,
      completedTask: taskToComplete.title,
    };
  },
} as any);

