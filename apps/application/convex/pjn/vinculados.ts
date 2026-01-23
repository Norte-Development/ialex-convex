import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
} from "../_generated/server";
import { api, internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  getCurrentUserFromAuth,
  requireNewCaseAccess,
} from "../auth_utils";

type PjnVinculado = Doc<"pjnVinculados">;

type LinkedCaseSummary = {
  caseId: Id<"cases">;
  title: string;
  status: Doc<"cases">["status"];
  fre?: string;
};

type EnrichedVinculado = {
  _id: Id<"pjnVinculados">;
  caseId: Id<"cases">;
  vinculadoKey: string;
  vinculadoMeta: PjnVinculado["vinculadoMeta"];
  status: PjnVinculado["status"];
  source: PjnVinculado["source"];
  linkedCaseId?: Id<"cases">;
  linkedCase: LinkedCaseSummary | null;
};

/**
 * Internal helper: process all PJN vinculados for a case and
 * auto-link them to existing workspace cases using the FRE key.
 *
 * - Only touches entries that are still pending and without linkedCaseId.
 * - If exactly one case with matching FRE exists, marks the vinculado as linked.
 * - Also propagates the link to the legacy relatedCases table.
 */
export const processForCase = internalMutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<null> => {
    const vinculados = await ctx.db
      .query("pjnVinculados")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    // For large Vinculados sets (multi-page scrapes), avoid repeated lookups
    // and duplicated work by de-duplicating keys and caching FRE->case matches.
    const seenKeys = new Set<string>();
    const freToUniqueCaseId = new Map<string, Id<"cases"> | null>();

    for (const vinculado of vinculados) {
      if (vinculado.status !== "pending" || vinculado.linkedCaseId) {
        continue;
      }

      if (seenKeys.has(vinculado.vinculadoKey)) {
        continue;
      }
      seenKeys.add(vinculado.vinculadoKey);

      let uniqueCaseId: Id<"cases"> | null;
      if (freToUniqueCaseId.has(vinculado.vinculadoKey)) {
        uniqueCaseId = freToUniqueCaseId.get(vinculado.vinculadoKey) ?? null;
      } else {
        const matches = await ctx.db
          .query("cases")
          .withIndex("by_fre", (q) => q.eq("fre", vinculado.vinculadoKey))
          .take(2);
        uniqueCaseId = matches.length === 1 ? matches[0]._id : null;
        freToUniqueCaseId.set(vinculado.vinculadoKey, uniqueCaseId);
      }

      if (!uniqueCaseId) {
        continue;
      }

      await ctx.db.patch(vinculado._id, {
        linkedCaseId: uniqueCaseId,
        status: "linked",
      });

      // Keep legacy relatedCases table in sync for the same FRE
      const relatedRows = await ctx.db
        .query("relatedCases")
        .withIndex("by_case_and_related_fre", (q) =>
          q.eq("caseId", args.caseId).eq("relatedFre", vinculado.vinculadoKey),
        )
        .collect();

      for (const row of relatedRows) {
        if (!row.relatedCaseId) {
          await ctx.db.patch(row._id, {
            relatedCaseId: uniqueCaseId,
          });
        }
      }
    }

    return null;
  },
});

/**
 * Public mutation: create a new workspace case from a pending PJN vinculado.
 *
 * - Requires the user to have at least advanced access to the base case.
 * - Prefills FRE and basic metadata from vinculadoMeta.
 * - Links the vinculado (and relatedCases rows) to the newly created case.
 */
export const createCaseFromVinculado = mutation({
  args: {
    vinculadoId: v.id("pjnVinculados"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ caseId: Id<"cases"> }> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const vinculado = await ctx.db.get(args.vinculadoId);
    if (!vinculado) {
      throw new Error("Vinculado no encontrado");
    }

    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      vinculado.caseId,
      "advanced",
    );

    if (vinculado.status === "ignored") {
      throw new Error(
        "Este vinculado fue marcado como ignorado y no se puede usar para crear un caso.",
      );
    }

    if (vinculado.linkedCaseId) {
      return { caseId: vinculado.linkedCaseId };
    }

    const parentCase = await ctx.db.get(vinculado.caseId);
    if (!parentCase) {
      throw new Error("Caso original no encontrado");
    }

    const meta = vinculado.vinculadoMeta;

    const title =
      meta.caratula && meta.caratula.trim().length > 0
        ? meta.caratula
        : `Caso vinculado ${meta.expedienteKey}`;

    const descriptionParts: string[] = [];
    if (meta.relationshipType) descriptionParts.push(meta.relationshipType);
    if (meta.court) descriptionParts.push(meta.court);
    const description =
      descriptionParts.length > 0 ? descriptionParts.join(" · ") : undefined;

    const teamId = await ctx.runQuery(
      internal.functions.cases.getCaseTeamContext,
      { caseId: vinculado.caseId },
    );

    const newCaseId = await ctx.runMutation(
      api.functions.cases.createCase,
      {
        title,
        description,
        expedientNumber: meta.rawNumber,
        assignedLawyer: parentCase.assignedLawyer,
        priority: parentCase.priority,
        category: parentCase.category,
        estimatedHours: undefined,
        fre: meta.expedienteKey,
        teamId: teamId ?? undefined,
      },
    );

    await ctx.db.patch(args.vinculadoId, {
      linkedCaseId: newCaseId,
      status: "linked",
    });

    // Also propagate the link to relatedCases rows for this FRE
    const relatedRows = await ctx.db
      .query("relatedCases")
      .withIndex("by_case_and_related_fre", (q) =>
        q.eq("caseId", vinculado.caseId).eq("relatedFre", vinculado.vinculadoKey),
      )
      .collect();

    for (const row of relatedRows) {
      if (!row.relatedCaseId) {
        await ctx.db.patch(row._id, {
          relatedCaseId: newCaseId,
        });
      }
    }

    return { caseId: newCaseId };
  },
});

/**
 * Public mutation: mark a vinculado as ignored so it does not appear
 * in the pending list for the case.
 */
export const ignoreVinculado = mutation({
  args: {
    vinculadoId: v.id("pjnVinculados"),
  },
  handler: async (ctx, args): Promise<null> => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    const vinculado = await ctx.db.get(args.vinculadoId);
    if (!vinculado) {
      throw new Error("Vinculado no encontrado");
    }

    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      vinculado.caseId,
      "advanced",
    );

    await ctx.db.patch(args.vinculadoId, {
      status: "ignored",
    });

    return null;
  },
});

/**
 * Public query: list enriched vinculados for a case, grouped with
 * basic information about any linked workspace cases.
 */
export const listForCase = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<EnrichedVinculado[]> => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(
      ctx,
      currentUser._id,
      args.caseId,
      "basic",
    );

    const rows = await ctx.db
      .query("pjnVinculados")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    const visible = rows.filter((row) => row.status !== "ignored");

    const linkedCaseIds = new Set<Id<"cases">>();
    for (const row of visible) {
      if (row.linkedCaseId) {
        linkedCaseIds.add(row.linkedCaseId);
      }
    }

    const linkedCaseMap = new Map<Id<"cases">, LinkedCaseSummary>();
    for (const caseId of linkedCaseIds) {
      const caseDoc = await ctx.db.get(caseId);
      if (caseDoc) {
        linkedCaseMap.set(caseId, {
          caseId: caseDoc._id,
          title: caseDoc.title,
          status: caseDoc.status,
          fre: caseDoc.fre ?? undefined,
        });
      }
    }

    const enriched: EnrichedVinculado[] = visible.map((row) => ({
      _id: row._id,
      caseId: row.caseId,
      vinculadoKey: row.vinculadoKey,
      vinculadoMeta: row.vinculadoMeta,
      status: row.status,
      source: row.source,
      linkedCaseId: row.linkedCaseId,
      linkedCase: row.linkedCaseId
        ? linkedCaseMap.get(row.linkedCaseId) ?? null
        : null,
    }));

    return enriched;
  },
});

