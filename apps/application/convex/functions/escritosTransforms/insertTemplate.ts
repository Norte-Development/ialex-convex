import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { api, components, internal } from "../../_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { buildServerSchema } from "../../../../../packages/shared/src/tiptap/schema";
import { prosemirrorSync } from "../../prosemirror";
import { EditorState } from "@tiptap/pm/state";


export const insertTemplate = mutation({
    args: {
        escritoId: v.id("escritos"),
        templateId: v.id("modelos"),
    },
    handler: async (ctx, args) => {
        const { escritoId, templateId } = args;

        const escrito = await ctx.runQuery(internal.functions.documents.internalGetEscrito, { escritoId });
        if (!escrito) throw new Error("Escrito not found");
        const template = await ctx.runQuery(internal.functions.templates.internalGetModelo, { modeloId: templateId, userId: escrito.createdBy });
        if (!template) throw new Error("Template not found");

        const {version, doc} = await prosemirrorSync.getDoc(ctx, escrito.prosemirrorId, buildServerSchema());
        if (!doc) throw new Error("Document content not found");

        // Get the template content from prosemirror
        const templateDoc = await prosemirrorSync.getDoc(ctx, template.prosemirrorId!, buildServerSchema());
        if (!templateDoc.doc) throw new Error("Template content not found");
        
        const templateDocNode = templateDoc.doc;
        await prosemirrorSync.transform(ctx, escrito.prosemirrorId, buildServerSchema(), (doc) => {
            const state = EditorState.create({ doc });
            let tr = state.tr.replaceWith(0, doc.content.size, templateDocNode.content);
            return tr;
        });

        return { ok: true, message: "Template inserted" };
    },
});