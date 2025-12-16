import { v } from "convex/values";
import { action, mutation } from "../../_generated/server";
import { getCurrentUserFromAuth, requireNewCaseAccess } from "../../auth_utils";
import { createGoogleDoc } from "../../google/driveActions";
import { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";



export const exportEscritoToGoogleDocs = action({
    args: {
        escritoId: v.id("escritos"),
        caseId: v.id("cases"),
        html: v.optional(v.string()),
    },
    handler: async (ctx, args) : Promise<{ docId: string; docUrl: string }> => {

        const user = await ctx.auth.getUserIdentity();

        if (!user) {
            throw new Error("User not authenticated");
        }

        const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, {
            escritoId: args.escritoId as Id<"escritos">,
        });

        if (!escrito) {
            throw new Error("Escrito not found");
        }
        
        const userId = await ctx.runMutation(api.functions.users.getCurrentUserIdForAction, {});



        const doc = await ctx.runAction(internal.google.driveActions.createGoogleDoc, {
            userId: userId,
            title: escrito.title,
            content: args.html,
        });

        return doc;
    },
});