import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Migration script to convert blocked tasks to pending
 * and ensure all tasks have proper order field
 *
 * Run this after updating the schema to remove "blocked" status
 */
export const migrateTaskStatus = mutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    totalProcessed: v.number(),
  }),
  handler: async (ctx) => {
    // Get all todo items
    const allTasks = await ctx.db.query("todoItems").collect();

    let migratedCount = 0;

    for (const task of allTasks) {
      // Convert "blocked" status to "pending"
      if ((task.status as any) === "blocked") {
        await ctx.db.patch(task._id, {
          status: "pending",
        });
        migratedCount++;
      }

      // Ensure order field exists (it should already exist in the schema)
      if (task.order === undefined) {
        // Get all tasks in this list to calculate order
        const listTasks = await ctx.db
          .query("todoItems")
          .withIndex("by_list", (q) => q.eq("listId", task.listId))
          .collect();

        // Sort by existing order or _id
        const sorted = listTasks.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return a._id.localeCompare(b._id);
        });

        // Update order for all tasks in this list
        for (let i = 0; i < sorted.length; i++) {
          if (sorted[i]._id === task._id || sorted[i].order === undefined) {
            await ctx.db.patch(sorted[i]._id, { order: i });
          }
        }
      }
    }

    return {
      migrated: migratedCount,
      totalProcessed: allTasks.length,
    };
  },
});
