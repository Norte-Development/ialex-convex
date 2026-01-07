import { v } from "convex/values"
import { query } from "../_generated/server"
import { Id } from "../_generated/dataModel"

export const getCaseActuaciones = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"caseActuaciones">;
    movementDate: number;
    description: string;
    hasDocument: boolean;
    documentId?: Id<"documents">;
    gcsPath?: string;
    rawDate?: string;
  }>> => {
    const actuaciones = await ctx.db
      .query("caseActuaciones")
      .withIndex("by_case_and_date", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .collect()

    return actuaciones.map((a) => ({
      _id: a._id,
      movementDate: a.movementDate,
      description: a.description,
      hasDocument: a.hasDocument,
      documentId: a.documentId,
      gcsPath: a.gcsPath,
      rawDate: a.rawDate,
    }))
  },
})

export const getPjnActivityLog = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"pjnActivityLog">;
    _creationTime: number;
    action: string;
    pjnMovementId?: string | null;
    metadata?: any;
    timestamp: number;
  }>> => {
    const logs = await ctx.db
      .query("pjnActivityLog")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .take(100)

    return logs.map((log) => ({
      _id: log._id,
      _creationTime: log._creationTime,
      action: log.action,
      pjnMovementId: log.pjnMovementId,
      metadata: log.metadata,
      timestamp: log.timestamp,
    }))
  },
})

export const getCaseParticipants = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"caseParticipants">;
    role: string;
    name: string;
    details?: string;
    syncedAt: number;
  }>> => {
    const participants = await ctx.db
      .query("caseParticipants")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect()

    return participants.map((p) => ({
      _id: p._id,
      role: p.role,
      name: p.name,
      details: p.details,
      syncedAt: p.syncedAt,
    }))
  },
})

export const getCaseAppeals = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"caseAppeals">;
    appealType: string;
    filedDate?: string;
    status?: string;
    court?: string;
    description?: string;
    syncedAt: number;
  }>> => {
    const appeals = await ctx.db
      .query("caseAppeals")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect()

    return appeals.map((a) => ({
      _id: a._id,
      appealType: a.appealType,
      filedDate: a.filedDate,
      status: a.status,
      court: a.court,
      description: a.description,
      syncedAt: a.syncedAt,
    }))
  },
})

export const getRelatedCases = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"relatedCases">;
    relatedFre: string;
    relationshipType: string;
    relatedCaratula?: string;
    relatedCourt?: string;
    relatedCaseId?: Id<"cases">;
    syncedAt: number;
  }>> => {
    const related = await ctx.db
      .query("relatedCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect()

    return related.map((r) => ({
      _id: r._id,
      relatedFre: r.relatedFre,
      relationshipType: r.relationshipType,
      relatedCaratula: r.relatedCaratula,
      relatedCourt: r.relatedCourt,
      relatedCaseId: r.relatedCaseId,
      syncedAt: r.syncedAt,
    }))
  },
})
