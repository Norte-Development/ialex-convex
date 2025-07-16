import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentUserFromAuth } from "./auth_utils";

// ========================================
// CLIENT MANAGEMENT
// ========================================

export const createClient = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dni: v.optional(v.string()),
    cuit: v.optional(v.string()),
    address: v.optional(v.string()),
    clientType: v.union(v.literal("individual"), v.literal("company")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    
    const clientId = await ctx.db.insert("clients", {
      name: args.name,
      email: args.email,
      phone: args.phone,
      dni: args.dni,
      cuit: args.cuit,
      address: args.address,
      clientType: args.clientType,
      notes: args.notes,
      isActive: true,
      createdBy: currentUser._id,
    });
    
    console.log("Created client with id:", clientId);
    return clientId;
  },
});

export const getClients = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authentication to view clients
    await getCurrentUserFromAuth(ctx);
    
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_active_status", (q) => q.eq("isActive", true))
      .collect();
    
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      return clients.filter(client => 
        client.name.toLowerCase().includes(searchLower) ||
        (client.dni && client.dni.includes(args.search!)) ||
        (client.cuit && client.cuit.includes(args.search!))
      );
    }
    
    return clients;
  },
}); 