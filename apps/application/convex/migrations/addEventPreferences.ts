import { internalMutation } from "../_generated/server";

/**
 * Migración: Agregar preferencias de eventos a todos los usuarios
 * Ejecutar una sola vez desde el dashboard
 */
export const addEventPreferencesToAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    
    let updated = 0;
    
    for (const user of users) {
      if (user.preferences) {
        // Solo actualizar si no existen las preferencias
        if (user.preferences.eventReminders === undefined || 
            user.preferences.eventUpdates === undefined) {
          
          await ctx.db.patch(user._id, {
            preferences: {
              ...user.preferences,
              eventReminders: true,  // Activado por defecto
              eventUpdates: true,    // Activado por defecto
            },
          });
          
          updated++;
        }
      }
    }
    
    console.log(`✅ Actualizado ${updated} usuarios con preferencias de eventos`);
    return { updated, total: users.length };
  },
});
