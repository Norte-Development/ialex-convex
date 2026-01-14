"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface ChecklistTask {
  title: string;
  description?: string;
}

interface Checklist {
  title: string;
  tasks: ChecklistTask[];
}

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
    const clients: any[] | null = await ctx.runQuery(
      api.functions.cases.getClientsForCase,
      {
        caseId: args.caseId,
      },
    );

    // 3. Construir contexto base
    let contextPrompt: string = `
CASO LEGAL:
Titulo: ${caseData.title}
Categoria: ${caseData.category || "No especificada"}
Estado: ${caseData.status}
Prioridad: ${caseData.priority}
Descripcion: ${caseData.description || "Sin descripcion"}
Expediente: ${caseData.expedientNumber || "No asignado"}

CLIENTES:
${clients?.map((c: any) => `- ${c.name || c.displayName} (${c.role || "cliente"})`).join("\n") || "Sin clientes asignados"}
`;

    // 4. Si viene de conversacion, cargar mensajes del thread
    if (args.sourceType === "thread_conversation" && args.threadId) {
      const messages = await ctx.runQuery(
        api.agents.threads.getThreadMessages,
        {
          threadId: args.threadId as any,
          paginationOpts: { numItems: 30, cursor: null as any },
        },
      );

      const conversationContext = messages.page
        .filter((m: any) => m.text)
        .slice(-20)
        .map((m: any) => `[${m.role}]: ${m.text?.substring(0, 500)}`)
        .join("\n");

      contextPrompt += `

CONVERSACION CON EL AGENTE:
${conversationContext}
`;
    }

    // 5. System prompt
    const systemPrompt: string = `Eres un abogado argentino experto. Tu tarea es generar un plan de trabajo para un caso legal.

INSTRUCCIONES:
1. Genera entre 5 y 12 tareas concretas
2. Ordena las tareas cronologicamente (de primero a ultimo)
3. Cada tarea debe ser especifica y medible
4. Usa terminologia legal argentina
5. Incluye tareas como: revision documental, redaccion de escritos, plazos procesales, audiencias, etc.

FORMATO DE RESPUESTA:
Debes responder UNICAMENTE con un JSON valido. Sin texto antes ni despues.

Estructura requerida:
{
  "title": "Titulo del plan de trabajo",
  "tasks": [
    {"title": "Primera tarea", "description": "Detalle opcional"},
    {"title": "Segunda tarea", "description": "Otro detalle"}
  ]
}

IMPORTANTE: Responde solo con el JSON. No incluyas markdown ni ningun texto adicional.`;

    try {
      // 6. Generar texto con DeepSeek
      const { text } = await generateText({
        model: openrouter("deepseek/deepseek-chat"),
        system: systemPrompt,
        prompt: `Genera un plan de trabajo para este caso:

${contextPrompt}

Responde con el JSON del plan de trabajo.`,
      });

      // 7. Parsear JSON manualmente
      let cleanedText = text.trim();

      // Eliminar markdown code blocks si existen
      cleanedText = cleanedText.replace(/^```json\s*/i, "");
      cleanedText = cleanedText.replace(/^```\s*/i, "");
      cleanedText = cleanedText.replace(/```\s*$/i, "");

      // Eliminar cualquier texto antes del primer {
      const firstBraceIndex = cleanedText.indexOf("{");
      if (firstBraceIndex > 0) {
        cleanedText = cleanedText.substring(firstBraceIndex);
      }

      // Eliminar cualquier texto despues del ultimo }
      const lastBraceIndex = cleanedText.lastIndexOf("}");
      if (lastBraceIndex >= 0 && lastBraceIndex < cleanedText.length - 1) {
        cleanedText = cleanedText.substring(0, lastBraceIndex + 1);
      }

      console.log("JSON limpiado:", cleanedText);

      // Parsear JSON
      let checklist: Checklist;
      try {
        checklist = JSON.parse(cleanedText);
      } catch (parseError: any) {
        console.error("Error parseando JSON:", parseError);
        console.error("Texto original:", text);
        throw new Error("No se pudo parsear la respuesta de la IA como JSON");
      }

      // 8. Validar estructura
      if (!checklist?.title || typeof checklist.title !== "string") {
        throw new Error("El plan debe tener un título válido");
      }

      if (!Array.isArray(checklist?.tasks) || checklist.tasks.length === 0) {
        throw new Error("El plan debe tener al menos una tarea");
      }

      if (checklist.tasks.length < 5 || checklist.tasks.length > 12) {
        throw new Error("El plan debe tener entre 5 y 12 tareas");
      }

      // Validar cada tarea
      for (const task of checklist.tasks) {
        if (!task?.title || typeof task.title !== "string") {
          throw new Error("Cada tarea debe tener un título válido");
        }
      }

      // 9. Crear o actualizar la lista en la base de datos
      const listId: Id<"todoLists"> = await ctx.runMutation(
        api.functions.todos.getOrCreateCaseTodoList,
        {
          title: checklist.title,
          caseId: args.caseId,
          createdBy: args.userId,
        },
      );

      // 10. Limpiar y agregar nuevas tareas
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
    } catch (error: any) {
      console.error("Error generando checklist:", error);
      throw new Error(
        `Error al generar el plan: ${error.message || "Error desconocido"}`,
      );
    }
  },
});
