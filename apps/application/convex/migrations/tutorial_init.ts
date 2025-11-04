/**
 * Tutorial Migration Script
 *
 * Este script puede ejecutarse para inicializar el tutorial
 * para usuarios existentes que no tienen registro de progreso.
 *
 * NOTA: Ejecutar esto desde Convex Dashboard o mediante un mutation especial
 */

import { internalMutation } from "../_generated/server";

/**
 * Inicializar progreso de tutorial para todos los usuarios activos
 * que no tengan un registro existente.
 *
 * USAR CON PRECAUCIÓN - Solo ejecutar una vez durante el despliegue inicial
 */
export const initializeExistingUsersTutorial = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting tutorial initialization for existing users...");

    // Obtener todos los usuarios activos
    const users = await ctx.db
      .query("users")
      .withIndex("by_active_status", (q) => q.eq("isActive", true))
      .collect();

    console.log(`Found ${users.length} active users`);

    let initialized = 0;
    let skipped = 0;

    for (const user of users) {
      // Verificar si ya tiene progreso de tutorial
      const existingProgress = await ctx.db
        .query("tutorialProgress")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      if (existingProgress) {
        skipped++;
        continue;
      }

      // Crear progreso inicial (inactivo por defecto)
      await ctx.db.insert("tutorialProgress", {
        userId: user._id,
        isActive: false, // No activar automáticamente
        isCompleted: false,
        currentPage: undefined,
        currentStepId: undefined,
        completedSteps: [],
        skippedPages: [],
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      });

      initialized++;
    }

    console.log(
      `Tutorial initialization complete: ${initialized} initialized, ${skipped} skipped`,
    );

    return {
      success: true,
      totalUsers: users.length,
      initialized,
      skipped,
    };
  },
});

/**
 * Limpiar progreso de tutorial de un usuario específico
 * (útil para testing)
 */
export const resetUserTutorialProgress = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Obtener identidad del usuario actual
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Obtener usuario
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Buscar progreso existente
    const progress = await ctx.db
      .query("tutorialProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (progress) {
      // Eliminar progreso existente
      await ctx.db.delete(progress._id);
      console.log(`Deleted tutorial progress for user ${user._id}`);
    }

    return {
      success: true,
      message: "Tutorial progress reset successfully",
    };
  },
});
