import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export const createTodoList = mutation({
  args: {
    title: v.string(),
    createdBy: v.id("users"),
    caseId: v.optional(v.id("cases")),
    threadId: v.optional(v.string()),
  },
  returns: v.id("todoLists"),
  handler: async (ctx: MutationCtx, args: {
    title: string;
    createdBy: Id<"users">;
    caseId?: Id<"cases">;
    threadId?: string;
  }) => {
    const listId = await ctx.db.insert("todoLists", {
      title: args.title,
      createdBy: args.createdBy,
      caseId: args.caseId,
      threadId: args.threadId,
      status: "active",
      isActive: true,
      progressPercent: 0,
    });
    return listId;
  },
});

export const addTodoItem = mutation({
  args: {
    listId: v.id("todoLists"),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    order: v.optional(v.number()),
    createdBy: v.id("users"),
  },
  returns: v.id("todoItems"),
  handler: async (ctx: MutationCtx, args: {
    listId: Id<"todoLists">;
    title: string;
    description?: string;
    assignedTo?: Id<"users">;
    dueDate?: number;
    order?: number;
    createdBy: Id<"users">;
  }) => {
    // Compute next order if not provided
    const order = args.order ??
      ((await ctx.db
        .query("todoItems")
        .withIndex("by_list", (q: any) => q.eq("listId", args.listId))
        .collect()).length + 1);

    const id = await ctx.db.insert("todoItems", {
      listId: args.listId,
      title: args.title,
      description: args.description,
      status: "pending",
      order,
      assignedTo: args.assignedTo,
      dueDate: args.dueDate,
      createdBy: args.createdBy,
    });

    return id;
  },
});

export const updateTodoItem = mutation({
  args: {
    itemId: v.id("todoItems"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed"))),
    order: v.optional(v.number()),
    assignedTo: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args: {
    itemId: Id<"todoItems">;
    title?: string;
    description?: string;
    status?: "pending" | "in_progress" | "completed";
    order?: number;
    assignedTo?: Id<"users">;
    dueDate?: number;
  }) => {
    const existing = await ctx.db.get(args.itemId);
    if (!existing) return null;

    await ctx.db.patch(args.itemId, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.order !== undefined ? { order: args.order } : {}),
      ...(args.assignedTo !== undefined ? { assignedTo: args.assignedTo } : {}),
      ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
    });

    // Update list progressPercent (simple derived metric)
    await updateListProgress(ctx, existing.listId as Id<"todoLists">);

    return null;
  },
});

// Helper function to update list progress
async function updateListProgress(ctx: MutationCtx, listId: Id<"todoLists">) {
  const items = await ctx.db
    .query("todoItems")
    .withIndex("by_list", (q: any) => q.eq("listId", listId))
    .collect();
  const total = items.length;
  const completed = items.filter((i: any) => i.status === "completed").length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  await ctx.db.patch(listId, { progressPercent: progress });
}

// Update todo item status and move it to the end of the target column
export const updateTodoItemStatus = mutation({
  args: {
    todoItemId: v.id("todoItems"),
    newStatus: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed")),
  },
  returns: v.id("todoItems"),
  handler: async (ctx: MutationCtx, args: {
    todoItemId: Id<"todoItems">;
    newStatus: "pending" | "in_progress" | "completed";
  }) => {
    const { todoItemId, newStatus } = args;

    // Validate that the task exists
    const task = await ctx.db.get(todoItemId);
    if (!task) {
      throw new Error("Tarea no encontrada");
    }

    // Calculate new order (at the end of the destination column)
    const tasksInColumn = await ctx.db
      .query("todoItems")
      .withIndex("by_list_status_order", (q: any) =>
        q.eq("listId", task.listId).eq("status", newStatus)
      )
      .collect();

    const maxOrder = tasksInColumn.length > 0
      ? Math.max(...tasksInColumn.map((t) => t.order ?? 0))
      : -1;
    const newOrder = maxOrder + 1;

    // Update task
    await ctx.db.patch(todoItemId, {
      status: newStatus,
      order: newOrder,
    });

    // Recalculate list progress
    await updateListProgress(ctx, task.listId as Id<"todoLists">);

    return todoItemId;
  },
});

// Reorder tasks within a column
export const reorderTodoItems = mutation({
  args: {
    listId: v.id("todoLists"),
    status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("completed")),
    taskIds: v.array(v.id("todoItems")),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args: {
    listId: Id<"todoLists">;
    status: "pending" | "in_progress" | "completed";
    taskIds: Id<"todoItems">[];
  }) => {
    const { listId, status, taskIds } = args;

    // Update order of each task
    for (let i = 0; i < taskIds.length; i++) {
      await ctx.db.patch(taskIds[i], { order: i });
    }

    return null;
  },
});

export const listTodoListsByThread = query({
  args: { threadId: v.string() },
  returns: v.array(v.object({
    _id: v.id("todoLists"),
    title: v.string(),
    progressPercent: v.optional(v.number()),
  })),
  handler: async (ctx: QueryCtx, { threadId }: { threadId: string }) => {
    const lists = await ctx.db
      .query("todoLists")
      .withIndex("by_thread", (q: any) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
    return lists.map((l: any) => ({ _id: l._id, title: l.title, progressPercent: l.progressPercent }));
  },
});

export const listTodoItemsByList = query({
  args: { listId: v.id("todoLists") },
  handler: async (ctx: QueryCtx, { listId }: { listId: Id<"todoLists"> }) => {
    const items = await ctx.db
      .query("todoItems")
      .withIndex("by_list", (q: any) => q.eq("listId", listId))
      .collect();
    return items;
  },
});

export const getOrCreateThreadTodoList = mutation({
  args: {
    title: v.string(),
    threadId: v.string(),
    createdBy: v.id("users"),
    caseId: v.optional(v.id("cases")),
  },
  returns: v.id("todoLists"),
  handler: async (ctx: MutationCtx, args: {
    title: string;
    threadId: string;
    createdBy: Id<"users">;
    caseId?: Id<"cases">;
  }) => {
    const existing = await ctx.db
      .query("todoLists")
      .withIndex("by_thread", (q: any) => q.eq("threadId", args.threadId))
      .first();
    if (existing) return existing._id;

    const id = await ctx.db.insert("todoLists", {
      title: args.title,
      createdBy: args.createdBy,
      caseId: args.caseId,
      threadId: args.threadId,
      status: "active",
      isActive: true,
      progressPercent: 0,
    });
    return id;
  },
});

// ============================================
// Case Work Plan Functions
// ============================================

export const listTodoListsByCase = query({
  args: { caseId: v.id("cases") },
  returns: v.array(v.object({
    _id: v.id("todoLists"),
    title: v.string(),
    progressPercent: v.optional(v.number()),
  })),
  handler: async (ctx: QueryCtx, { caseId }: { caseId: Id<"cases"> }) => {
    // Buscar lista del caso que NO tenga threadId (lista principal del caso)
    const list = await ctx.db
      .query("todoLists")
      .withIndex("by_case", (q: any) => q.eq("caseId", caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .filter((q: any) => q.eq(q.field("threadId"), undefined))
      .first();
    return list ? [{ _id: list._id, title: list.title, progressPercent: list.progressPercent }] : [];
  },
});

export const getOrCreateCaseTodoList = mutation({
  args: {
    title: v.string(),
    caseId: v.id("cases"),
    createdBy: v.id("users"),
  },
  returns: v.id("todoLists"),
  handler: async (ctx: MutationCtx, args: {
    title: string;
    caseId: Id<"cases">;
    createdBy: Id<"users">;
  }) => {
    // Buscar lista existente para este caso sin threadId
    const existing = await ctx.db
      .query("todoLists")
      .withIndex("by_case", (q: any) => q.eq("caseId", args.caseId))
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .filter((q: any) => q.eq(q.field("threadId"), undefined))
      .first();

    if (existing) return existing._id;

    const id = await ctx.db.insert("todoLists", {
      title: args.title,
      createdBy: args.createdBy,
      caseId: args.caseId,
      threadId: undefined,
      status: "active",
      isActive: true,
      progressPercent: 0,
    });
    return id;
  },
});

export const deleteTodoItem = mutation({
  args: { itemId: v.id("todoItems") },
  returns: v.null(),
  handler: async (ctx: MutationCtx, { itemId }: { itemId: Id<"todoItems"> }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return null;

    const listId = item.listId as Id<"todoLists">;
    await ctx.db.delete(itemId);

    // Recalcular progreso de la lista
    const items = await ctx.db
      .query("todoItems")
      .withIndex("by_list", (q: any) => q.eq("listId", listId))
      .collect();
    const total = items.length;
    const completed = items.filter((i: any) => i.status === "completed").length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    await ctx.db.patch(listId, { progressPercent: progress });

    return null;
  },
});

export const clearAndReplaceTodoItems = mutation({
  args: {
    listId: v.id("todoLists"),
    items: v.array(v.object({
      title: v.string(),
      description: v.optional(v.string()),
    })),
    createdBy: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args: {
    listId: Id<"todoLists">;
    items: Array<{ title: string; description?: string }>;
    createdBy: Id<"users">;
  }) => {
    // Eliminar items existentes
    const existing = await ctx.db
      .query("todoItems")
      .withIndex("by_list", (q: any) => q.eq("listId", args.listId))
      .collect();

    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Crear nuevos items
    let order = 1;
    for (const item of args.items) {
      await ctx.db.insert("todoItems", {
        listId: args.listId,
        title: item.title,
        description: item.description,
        status: "pending",
        order,
        createdBy: args.createdBy,
      });
      order++;
    }

    // Reset progreso a 0
    await ctx.db.patch(args.listId, { progressPercent: 0 });

    return null;
  },
});

