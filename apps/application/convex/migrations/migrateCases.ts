/**
 * Case Migration - Phase 2
 * 
 * Mutations for creating cases in Convex from Firestore data.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import type { CaseMigrationResult } from "./types";

/**
 * Create a case from Firestore expediente data
 */
export const createCase = internalMutation({
  args: {
    newUserId: v.id("users"),
    caseName: v.string(),
    description: v.union(v.string(), v.null()),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    oldFirestoreCaseId: v.string(),
  },
  handler: async (ctx, args): Promise<CaseMigrationResult> => {
    // Map Firestore status to Convex status
    const statusMap: Record<string, any> = {
      "active": "en progreso",
      "completed": "completado",
      "archived": "archivado",
      "cancelled": "cancelado",
    };
    
    const convexStatus = statusMap[args.status] || "en progreso";
    
    const caseId: Id<"cases"> = await ctx.db.insert("cases", {
      title: args.caseName,
      description: args.description || undefined,
      status: convexStatus,
      priority: "medium" as const, // Default priority
      startDate: args.createdAt,
      createdBy: args.newUserId,
      assignedLawyer: args.newUserId,
      isArchived: args.status === "archived",
      lastActivityAt: args.updatedAt,
    });
    
    console.log(`Created case ${caseId} from Firestore expediente ${args.oldFirestoreCaseId}`);
    
    return {
      caseId,
      oldFirestoreCaseId: args.oldFirestoreCaseId,
    };
  }
});

