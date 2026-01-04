"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from "ai";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Schema para la respuesta del LLM
const checklistSchema = z.object({
  title: z.string().describe("Titulo descriptivo del plan de trabajo"),
  tasks: z.array(z.object({
    title: z.string().describe("Titulo corto de la tarea (max 80 chars)"),
    description: z.string().optional().describe("Descripcion detallada opcional"),
  })).min(3).max(15).describe("Lista de tareas ordenadas cronologicamente"),
});

interface GenerateCaseChecklistArgs {
  caseId: Id<"cases">;
  userId: Id<"users">;
  sourceType: "case_description" | "thread_conversation";
  threadId?: string;
}

export const generateCaseChecklist = action({
  args: {
    caseId: v.id("cases"),
    userId: v.id("users"),
    sourceType: v.union(
      v.literal("case_description"),
      v.literal("thread_conversation"),
    ),
    threadId: v.optional(v.string()),
  },
  handler: async (_ctx: ActionCtx, args: GenerateCaseChecklistArgs) => {
    const ctx = _ctx as any;

    // 1. Cargar datos del caso
    const caseData: any = await ctx.runQuery(api.functions.cases.getCaseById, {
      caseId: args.caseId,
    });

    if (!caseData) {
      throw new Error("Caso no encontrado");
    }

    // 2. Cargar clientes del caso
    const clients: any[] | null = await ctx.runQuery(api.functions.cases.getClientsForCase, {
      caseId: args.caseId,
    });

    // 3. Construir contexto base
    let contextPrompt: string = `
# Caso Legal
- Titulo: ${caseData.title}
- Categoria: ${caseData.category || "No especificada"}
- Estado: ${caseData.status}
- Prioridad: ${caseData.priority}
- Descripcion: ${caseData.description || "Sin descripcion"}
- Expediente: ${caseData.expedientNumber || "No asignado"}

# Clientes
${clients?.map((c: any) => `- ${c.name || c.displayName} (${c.role || "cliente"})`).join("\n") || "Sin clientes asignados"}
`;

    // 4. Si viene de conversacion, cargar mensajes del thread
    if (args.sourceType === "thread_conversation" && args.threadId) {
      const messages = await ctx.runQuery(api.agents.threads.getThreadMessages, {
        threadId: args.threadId as any,
        paginationOpts: { numItems: 30, cursor: null as any },
      });

      const conversationContext = messages.page
        .filter((m: any) => m.text)
        .slice(-20)
        .map((m: any) => `[${m.role}]: ${m.text?.substring(0, 500)}`)
        .join("\n");

      contextPrompt += `

# Conversacion con el Agente
${conversationContext}
`;
    }

    // 5. Generar checklist con IA
    const systemPrompt: string = `Eres un abogado senior argentino experto en planificacion de casos legales.
Tu tarea es generar un plan de trabajo (checklist) para un caso legal.

Reglas:
- Genera entre 5 y 12 tareas concretas y accionables
- Ordena las tareas cronologicamente (de primero a ultimo)
- Cada tarea debe ser especifica y medible
- Usa terminologia legal argentina
- Incluye tareas como: revision documental, redaccion de escritos, plazos procesales, audiencias, etc.
- El titulo del plan debe reflejar el tipo de caso`;

    const { object: checklist } = await generateObject({
      model: openrouter('anthropic/claude-haiku-4.5'),
      schema: checklistSchema,
      system: systemPrompt,
      prompt: `Genera un plan de trabajo detallado para el siguiente caso:

${contextPrompt}

Responde con un JSON que contenga "title" (titulo del plan) y "tasks" (array de tareas con "title" y "description" opcional).`,
    });

    // 6. Crear o actualizar la lista en la base de datos
    const listId: Id<"todoLists"> = await ctx.runMutation(api.functions.todos.getOrCreateCaseTodoList, {
      title: checklist.title,
      caseId: args.caseId,
      createdBy: args.userId,
    });

    // 7. Limpiar y agregar nuevas tareas
    await ctx.runMutation(api.functions.todos.clearAndReplaceTodoItems, {
      listId,
      items: checklist.tasks,
      createdBy: args.userId,
    });

    return {
      success: true,
      listId,
      taskCount: checklist.tasks.length,
      title: checklist.title,
    };
  },
});
