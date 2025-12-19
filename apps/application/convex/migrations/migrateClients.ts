// /**
//  * Client Migration - Phase 2
//  *
//  * Mutations for creating clients in Convex from Firestore data.
//  */

// import { internalMutation } from "../_generated/server";
// import { v } from "convex/values";
// import { Id } from "../_generated/dataModel";
// import type { ClientMigrationResult } from "./types";

// /**
//  * Create a client from Firestore data
//  */
// export const createClient = internalMutation({
//   args: {
//     newUserId: v.id("users"),
//     nombre: v.string(), // Spanish: name
//     email: v.union(v.string(), v.null()),
//     telefono: v.union(v.string(), v.null()), // Spanish: phone
//     dni: v.union(v.string(), v.null()),
//     lugarTrabajo: v.union(v.string(), v.null()), // Spanish: workplace
//     oldFirestoreClientId: v.string(),
//   },
//   handler: async (ctx, args): Promise<ClientMigrationResult> => {
//     const clientId: Id<"clients"> = await ctx.db.insert("clients", {
//       name: args.nombre, // Map Spanish field to English
//       email: args.email || undefined,
//       phone: args.telefono || undefined, // Map Spanish field to English
//       dni: args.dni || undefined,
//       address: args.lugarTrabajo || undefined, // Store workplace in address field
//       clientType: "individual" as const, // Default to individual
//       isActive: true,
//       createdBy: args.newUserId,
//     });

//     console.log(`Created client ${clientId} from Firestore client ${args.oldFirestoreClientId}`);

//     return {
//       clientId,
//       oldFirestoreClientId: args.oldFirestoreClientId,
//     };
//   }
// });
