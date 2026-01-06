import { v } from "convex/values"
import { query } from "../_generated/server"

export const getPjnActivityLog = query({
  args: { caseId: v.id("cases") },
  returns: v.array(
    v.object({
      _id: v.id("pjnActivityLog"),
      _creationTime: v.number(),
      action: v.string(),
      pjnMovementId: v.optional(v.union(v.string(), v.null())),
      metadata: v.optional(v.any()),
      timestamp: v.number(),
    })
  ),
  handler: async (ctx, args) => {
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
  returns: v.array(
    v.object({
      _id: v.id("caseParticipants"),
      role: v.string(),
      name: v.string(),
      details: v.optional(v.string()),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
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
  returns: v.array(
    v.object({
      _id: v.id("caseAppeals"),
      appealType: v.string(),
      filedDate: v.optional(v.string()),
      status: v.optional(v.string()),
      court: v.optional(v.string()),
      description: v.optional(v.string()),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
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
  returns: v.array(
    v.object({
      _id: v.id("relatedCases"),
      relatedFre: v.string(),
      relationshipType: v.string(),
      relatedCaratula: v.optional(v.string()),
      relatedCourt: v.optional(v.string()),
      relatedCaseId: v.optional(v.id("cases")),
      syncedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
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
