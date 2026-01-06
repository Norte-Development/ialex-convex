import { v } from "convex/values";
import {
  mutation,
  action,
  internalQuery,
  internalMutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../auth_utils";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Type definition for case context to avoid circular inference
interface CaseContext {
  userId: Id<"users">;
  title: string;
  description?: string;
  status: string;
  category?: string;
  expedientNumber?: string;
  documents: Array<{ title: string; type?: string | null }>;
  escritos: Array<{ title: string; status: string; lastEditedAt: number }>;
  events: Array<{ title: string; start: number }>;
  clients: Array<{ displayName?: string; naturalezaJuridica?: string }>;
}

/**
 * Internal mutation: Save summary to case (called from action)
 */
export const saveSummaryToCase = internalMutation({
  args: {
    caseId: v.id("cases"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.caseId, {
      caseSummary: args.summary,
      caseSummaryUpdatedAt: Date.now(),
      caseSummaryManuallyEdited: false, // Reset manual edit flag on regeneration
    });
  },
});

/**
 * Internal query: Get case creator
 */
export const getCaseCreator = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) return null;
    return {
      createdBy: caseData.createdBy,
    };
  },
});

/**
 * Internal query: Gather comprehensive case context
 * Limits results to prevent token overflow
 */
export const getCaseContext = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<CaseContext | null> => {
    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) return null;

    // Gather related data (limit to recent items to avoid token overflow)
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .take(20); // Limit to 20 most recent

    const escritos = await ctx.db
      .query("escritos")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .order("desc")
      .take(15); // Limit to 15 most recent

    const events = await ctx.db
      .query("events")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .take(10);

    const clientCases = await ctx.db
      .query("clientCases")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .collect();

    const clients = await Promise.all(
      clientCases.map(async (cc) => {
        const client = await ctx.db.get(cc.clientId);
        return client
          ? {
              displayName: client.displayName,
              naturalezaJuridica: client.naturalezaJuridica,
            }
          : null;
      }),
    );

    return {
      userId: caseData.createdBy,
      title: caseData.title,
      description: caseData.description,
      status: caseData.status,
      category: caseData.category,
      expedientNumber: caseData.expedientNumber,
      documents: documents.map((d) => ({
        title: d.title,
        type: d.documentType,
      })),
      escritos: escritos.map((e) => ({
        title: e.title,
        status: e.status,
        lastEditedAt: e._creationTime,
      })),
      events: events.map((e) => ({
        title: e.title,
        start: e.startDate,
      })),
      clients: clients.filter((c): c is NonNullable<typeof c> => c !== null),
    };
  },
});

/**
 * Helper function: Build structured prompt for AI summary generation
 */
function buildSummaryPrompt(context: CaseContext): string {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return `# Generar Resumen de Caso Legal

Eres un asistente legal especializado en sintetizar información de casos legales para abogados argentinos.

## Información del Caso
- **Título**: ${context.title}
- **Descripción**: ${context.description || "Sin descripción"}
- **Estado**: ${context.status}
- **Categoría**: ${context.category || "No especificada"}
- **Expediente**: ${context.expedientNumber || "No especificado"}

## Partes Involucradas
${
  context.clients.length > 0
    ? context.clients
        .map(
          (c) =>
            `- ${c.displayName || "Sin nombre"} (${c.naturalezaJuridica || "Tipo no especificado"})`,
        )
        .join("\n")
    : "- No hay clientes registrados"
}

## Documentos del Caso (${context.documents.length})
${
  context.documents.length > 0
    ? context.documents
        .slice(0, 10)
        .map((d) => `- **${d.title}** (${d.type || "Documento"})`)
        .join("\n")
    : "- No hay documentos"
}

## Escritos Recientes (${context.escritos.length})
${
  context.escritos.length > 0
    ? context.escritos
        .slice(0, 8)
        .map(
          (e) =>
            `- **${e.title}** (${e.status}) - ${formatDate(e.lastEditedAt)}`,
        )
        .join("\n")
    : "- No hay escritos"
}

## Eventos (${context.events.length})
${
  context.events.length > 0
    ? context.events
        .map((e) => `- **${e.title}** - ${formatDate(e.start)}`)
        .join("\n")
    : "- No hay eventos"
}

## Instrucciones
Genera un resumen ESTRUCTURADO y CONCISO del caso en español con las siguientes secciones:

1. **Hechos Clave**: Los 3-5 hechos más importantes del caso
2. **Acciones Relevantes**: Acciones legales tomadas o en curso
3. **Estado Actual**: Situación actual del caso de forma clara
4. **Próximos Pasos**: Sugerencias concretas para avanzar el caso (máximo 5)

## Formato de Salida
Responde EN ESTE FORMATO EXACTO (sin markdown fuera de las etiquetas):

<summary>
## Hechos Clave
• [Hecho 1]
• [Hecho 2]
• [Hecho 3]

## Acciones Relevantes
• [Acción 1]
• [Acción 2]

## Estado Actual
[Descripción clara del estado actual en 2-3 oraciones]

## Próximos Pasos
1. [Paso 1]
2. [Paso 2]
3. [Paso 3]
</summary>

IMPORTANTE:
- Sé conciso y directo
- Usa viñetas (•) para listas
- Máximo 3 oraciones por sección
- Enfócate en información práctica y accionable
- Si hay poca información, indícalo honestamente
- NO inventes hechos que no estén en la información proporcionada
`;
}

/**
 * Internal query: Verify user has access to case
 */
export const verifyUserCaseAccess = internalQuery({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { authorized: false, userId: null, error: "No autenticado" };
    }

    // Get user from clerk ID
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return {
        authorized: false,
        userId: null,
        error: "Usuario no encontrado",
      };
    }

    // Check if user is case owner
    const caseData = await ctx.db.get(args.caseId);
    if (!caseData) {
      return {
        authorized: false,
        userId: user._id,
        error: "Caso no encontrado",
      };
    }

    // Owner always has access
    if (
      caseData.createdBy === user._id ||
      caseData.assignedLawyer === user._id
    ) {
      return { authorized: true, userId: user._id, error: null };
    }

    // Check caseAccess table for user
    const directAccess = await ctx.db
      .query("caseAccess")
      .withIndex("by_case_and_user", (q) =>
        q.eq("caseId", args.caseId).eq("userId", user._id),
      )
      .first();

    if (directAccess?.isActive && directAccess.accessLevel !== "none") {
      return { authorized: true, userId: user._id, error: null };
    }

    return { authorized: false, userId: user._id, error: "Sin acceso al caso" };
  },
});

/**
 * Public action: Generate AI-powered case summary
 * Requires: ADVANCED access level
 * Cost: 1 AI credit
 */
export const generateCaseSummary = action({
  args: {
    caseId: v.id("cases"),
  },
  returns: v.object({
    success: v.boolean(),
    summary: v.optional(v.string()),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; summary?: string; message: string }> => {
    try {
      // 0. Verify user authentication and access
      const accessCheck = await ctx.runQuery(
        internal.functions.caseSummary.verifyUserCaseAccess,
        { caseId: args.caseId },
      );

      if (!accessCheck.authorized) {
        return {
          success: false,
          message: accessCheck.error || "No tienes acceso a este caso",
        };
      }

      // 1. Gather case context
      const caseData: CaseContext | null = await ctx.runQuery(
        internal.functions.caseSummary.getCaseContext,
        {
          caseId: args.caseId,
        },
      );

      if (!caseData) {
        return {
          success: false,
          message: "Caso no encontrado",
        };
      }

      // 2. Build summary prompt
      const prompt = buildSummaryPrompt(caseData);

      // 3. Model for summary generation
      const openRouterModel = "deepseek/deepseek-chat";

      // 4. Generate summary using AI SDK
      const { text } = await generateText({
        model: openrouter(openRouterModel),
        prompt: prompt,
      });

      // 5. Save summary to case document
      await ctx.runMutation(internal.functions.caseSummary.saveSummaryToCase, {
        caseId: args.caseId,
        summary: text,
      });

      // 6. Decrement credits
      const caseInfo = await ctx.runQuery(
        internal.functions.caseSummary.getCaseCreator,
        {
          caseId: args.caseId,
        },
      );

      if (caseInfo?.createdBy) {
        await ctx.runMutation(internal.billing.features.decrementCredits, {
          userId: caseInfo.createdBy,
          amount: 1,
        });
      }

      return {
        success: true,
        summary: text,
        message: "Resumen generado exitosamente",
      };
    } catch (error) {
      console.error("Error generating case summary:", error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          return {
            success: false,
            message:
              "La generación está tomando demasiado tiempo. Inténtalo nuevamente.",
          };
        }
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          return {
            success: false,
            message:
              "Error de conexión. Verifica tu internet e inténtalo nuevamente.",
          };
        }
      }

      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  },
});

/**
 * Public mutation: Update case summary manually
 * Requires: ADVANCED access level
 */
export const updateCaseSummary = mutation({
  args: {
    caseId: v.id("cases"),
    summary: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    // 1. Authentication & Permission Check
    const currentUser = await getCurrentUserFromAuth(ctx);
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "advanced");

    try {
      // 2. Update summary with manual edit flag
      await ctx.db.patch(args.caseId, {
        caseSummary: args.summary,
        caseSummaryUpdatedAt: Date.now(),
        caseSummaryManuallyEdited: true, // Mark as manually edited
      });

      return {
        success: true,
        message: "Resumen actualizado exitosamente",
      };
    } catch (error) {
      console.error("Error updating case summary:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  },
});
