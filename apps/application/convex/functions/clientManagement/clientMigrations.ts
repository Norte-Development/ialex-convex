/**
 * Client Migrations
 *
 * Migration functions for converting legacy clients to the new juridical model.
 * Extracted from clients.ts for better code organization.
 */

import { v } from "convex/values";
import { query, mutation } from "../../_generated/server";

// ========================================
// MIGRATION FUNCTIONS
// ========================================

/**
 * Migrates legacy clients (with clientType/name/address) to the new juridical model.
 * This should be run ONCE after deploying the new schema.
 *
 * Migration rules:
 * - clientType: "individual" → naturalezaJuridica: "humana"
 * - clientType: "company" → naturalezaJuridica: "juridica"
 * - name → displayName (and split into nombre/apellido for individuals, or razonSocial for companies)
 * - address → domicilioLegal
 *
 * @returns Summary of migrated clients
 */
export const migrateClientsToJuridicalModel = mutation({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only report what would be migrated
  },
  handler: async (ctx, args) => {
    // Get all clients
    const allClients = await ctx.db.query("clients").collect();

    const results = {
      total: allClients.length,
      alreadyMigrated: 0,
      needsMigration: 0,
      migrated: 0,
      errors: [] as Array<{ clientId: string; error: string }>,
    };

    for (const client of allClients) {
      // Check if client already has new model fields
      if (client.naturalezaJuridica && client.displayName) {
        results.alreadyMigrated++;
        continue;
      }

      results.needsMigration++;

      // Skip actual migration if dry run
      if (args.dryRun) {
        continue;
      }

      try {
        // Determine naturaleza jurídica from legacy clientType
        const legacyClientType = (client as any).clientType;
        const legacyName = (client as any).name || "";
        const legacyAddress = (client as any).address;

        let updateData: Record<string, any> = {
          domicilioLegal: legacyAddress || client.domicilioLegal,
        };

        if (legacyClientType === "company") {
          // Persona Jurídica
          updateData.naturalezaJuridica = "juridica";
          updateData.razonSocial = legacyName;
          updateData.displayName = legacyName || "Sin nombre";
          // Default to "otro" since we don't know the exact type
          updateData.tipoPersonaJuridica = client.tipoPersonaJuridica || "otro";
          updateData.descripcionOtro =
            client.descripcionOtro || "Migrado del sistema anterior";
        } else {
          // Persona Humana (default for "individual" or unknown)
          updateData.naturalezaJuridica = "humana";

          // Try to split name into nombre/apellido
          const nameParts = legacyName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            // Assume last part is apellido, rest is nombre
            updateData.apellido = nameParts.pop();
            updateData.nombre = nameParts.join(" ");
          } else {
            // Single word name
            updateData.nombre = legacyName || "Sin nombre";
            updateData.apellido = "-";
          }

          // Create displayName in "Apellido, Nombre" format
          updateData.displayName = `${updateData.apellido}, ${updateData.nombre}`;

          // Keep existing DNI, default activity
          updateData.actividadEconomica =
            client.actividadEconomica || "sin_actividad";
        }

        await ctx.db.patch(client._id, updateData);
        results.migrated++;
      } catch (error) {
        results.errors.push({
          clientId: client._id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log("Migration results:", results);
    return results;
  },
});

/**
 * Gets migration status - how many clients need migration
 */
export const getMigrationStatus = query({
  args: {},
  returns: v.object({
    total: v.number(),
    alreadyMigrated: v.number(),
    needsMigration: v.number(),
    sampleLegacyClients: v.array(
      v.object({
        _id: v.id("clients"),
        name: v.optional(v.string()),
        clientType: v.optional(
          v.union(v.literal("individual"), v.literal("company")),
        ),
        hasNewModel: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const allClients = await ctx.db.query("clients").collect();

    let alreadyMigrated = 0;
    let needsMigration = 0;
    const sampleLegacyClients: Array<{
      _id: any;
      name: string | undefined;
      clientType: "individual" | "company" | undefined;
      hasNewModel: boolean;
    }> = [];

    for (const client of allClients) {
      const hasNewModel = !!(client.naturalezaJuridica && client.displayName);

      if (hasNewModel) {
        alreadyMigrated++;
      } else {
        needsMigration++;
        // Keep first 5 samples
        if (sampleLegacyClients.length < 5) {
          sampleLegacyClients.push({
            _id: client._id,
            name: (client as any).name,
            clientType: (client as any).clientType,
            hasNewModel,
          });
        }
      }
    }

    return {
      total: allClients.length,
      alreadyMigrated,
      needsMigration,
      sampleLegacyClients,
    };
  },
});
