"use node";

/**
 * Clerk Helper Actions
 * 
 * This file contains all Clerk SDK operations as internalActions.
 * It has "use node" because it imports @clerk/backend.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { createClerkClient } from "@clerk/backend";

function getClerkClient() {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  
  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY environment variable is not set");
  }

  return createClerkClient({ secretKey: clerkSecretKey });
}

export const createClerkUser = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    oldKindeId: v.string(),
  },
  returns: v.object({
    id: v.string(),
  }),
  handler: async (ctx, { email, firstName, lastName, oldKindeId }) => {
    const clerk = getClerkClient();
    
    const user = await clerk.users.createUser({
      emailAddress: [email],
      firstName,
      lastName,
      skipPasswordRequirement: true,
      publicMetadata: {
        migrationStatus: "pending",
        oldKindeId,
      },
    });
    
    return { id: user.id };
  },
});

