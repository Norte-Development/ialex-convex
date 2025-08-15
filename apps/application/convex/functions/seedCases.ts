import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const seedCases = mutation({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const existingCases = await ctx.db.query("cases").collect();
    if (existingCases.length > 0) {
      return "Ya existen casos en la base de datos";
    }

    const currentUser = await ctx.auth.getUserIdentity();
    if (!currentUser && !args.userId) {
      throw new Error("No user authenticated and no userId provided");
    }

    let userId = args.userId;
    if (!userId) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", currentUser!.subject))
        .first();
      if (!user) {
        throw new Error("User not found in database");
      }
      userId = user._id;
    }
    // Test cases
    const testCases = [
      {
        title: "Divorcio Consensuado - García vs García",
        description:
          "Proceso de divorcio por mutuo acuerdo con división de bienes",
        status: "en progreso" as const,
        priority: "medium" as const,
        category: "Derecho de Familia",
        estimatedHours: 40,
        startDate: Date.now(),
        isArchived: false,
        assignedLawyer: userId,
        createdBy: userId,
      },
      {
        title: "Accidente de Tránsito - Reclamo de Seguros",
        description:
          "Reclamo por daños materiales y lesiones leves en accidente vehicular",
        status: "pendiente" as const,
        priority: "high" as const,
        category: "Derecho Civil",
        estimatedHours: 25,
        startDate: Date.now(),
        isArchived: false,
        assignedLawyer: userId,
        createdBy: userId,
      },
      {
        title: "Constitución de Sociedad Anónima",
        description: "Trámites para la constitución de una nueva empresa",
        status: "completado" as const,
        priority: "low" as const,
        category: "Derecho Comercial",
        estimatedHours: 60,
        startDate: Date.now() - 86400000, // Ayer
        endDate: Date.now(),
        isArchived: false,
        assignedLawyer: userId,
        createdBy: userId,
      },
      {
        title: "Despido Injustificado - Consulta Laboral",
        description: "Asesoramiento sobre despido sin causa y liquidación",
        status: "en progreso" as const,
        priority: "high" as const,
        category: "Derecho Laboral",
        estimatedHours: 30,
        startDate: Date.now() - 172800000, // Hace 2 días
        isArchived: false,
        assignedLawyer: userId,
        createdBy: userId,
      },
      {
        title: "Contrato de Alquiler - Revisión Legal",
        description:
          "Revisión y modificación de contrato de alquiler comercial",
        status: "pendiente" as const,
        priority: "medium" as const,
        category: "Derecho Inmobiliario",
        estimatedHours: 15,
        startDate: Date.now(),
        isArchived: false,
        assignedLawyer: userId,
        createdBy: userId,
      },
    ];

    // Insertar cada caso
    const insertedCases = [];
    for (const caseData of testCases) {
      const caseId = await ctx.db.insert("cases", caseData);
      insertedCases.push(caseId);
    }

    return `Se insertaron ${insertedCases.length} casos de prueba exitosamente`;
  },
});
