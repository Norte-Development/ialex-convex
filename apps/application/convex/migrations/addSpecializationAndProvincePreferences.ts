import { internalMutation } from "../_generated/server";

/**
 * Migración: Agregar preferencias de especialización y provincia a todos los usuarios
 * Ejecutar una sola vez desde el dashboard de Convex
 *
 * Esta migración agrega:
 * - specialization: Especialización legal del abogado
 * - provinceJurisdiction: Provincia para jurisprudencia específica
 */
export const addSpecializationAndProvincePreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    let updated = 0;
    let skipped = 0;

    console.log(`🔍 Iniciando migración para ${users.length} usuarios...`);

    for (const user of users) {
      if (user.preferences) {
        // Solo actualizar si no existen las preferencias
        if (
          user.preferences.specialization === undefined ||
          user.preferences.provinceJurisdiction === undefined
        ) {
          await ctx.db.patch(user._id, {
            preferences: {
              ...user.preferences,
              specialization: user.preferences.specialization || "general",
              provinceJurisdiction:
                user.preferences.provinceJurisdiction || "nacional",
            },
          });

          updated++;
          console.log(`✅ Usuario ${user.email} actualizado`);
        } else {
          skipped++;
          console.log(`⏭️ Usuario ${user.email} ya tiene las preferencias`);
        }
      } else {
        // Si el usuario no tiene preferencias, crear el objeto completo
        await ctx.db.patch(user._id, {
          preferences: {
            language: "es-AR",
            timezone: "America/Argentina/Buenos_Aires",
            emailNotifications: true,
            caseUpdates: true,
            documentProcessing: true,
            teamInvitations: true,
            agentResponses: true,
            eventReminders: true,
            eventUpdates: true,
            agentResponseStyle: "formal",
            defaultJurisdiction: "argentina",
            provinceJurisdiction: "nacional",
            specialization: "general",
            autoIncludeContext: true,
            citationFormat: "apa",
            sessionTimeout: 60,
            activityLogVisible: true,
          },
        });

        updated++;
        console.log(
          `✅ Usuario ${user.email} creado con preferencias por defecto`,
        );
      }
    }

    console.log(`\n📊 Migración completada:`);
    console.log(`   - Total usuarios: ${users.length}`);
    console.log(`   - Actualizados: ${updated}`);
    console.log(`   - Omitidos: ${skipped}`);

    return {
      total: users.length,
      updated,
      skipped,
      success: true,
    };
  },
});
