import { v } from "convex/values";
import { action } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";



/**
 * Exporta un escrito a Google Docs.
 *
 * Esta acción permite al usuario exportar un escrito almacenado internamente a un nuevo documento de Google Docs
 * usando la API de Google Drive. El contenido puede ser HTML opcional para inicializar el documento.
 * 
 * Requiere que el usuario esté autenticado y que tenga acceso al escrito especificado. Utiliza el ID del usuario actual
 * para asociar el documento de Google Drive.
 *
 * @param {Object} args - Parámetros de la acción.
 * @param {Id<"escritos">} args.escritoId - ID del escrito a exportar.
 * @param {Id<"cases">} args.caseId - ID del expediente/caso al que pertenece el escrito.
 * @param {string} [args.html] - HTML opcional para inicializar el contenido del documento.
 * @returns {Promise<{ docId: string, docUrl: string }>} Un objeto con el ID y URL del documento de Google creado.
 * 
 * @throws {Error} Si el usuario no está autenticado o el escrito no existe.
 */
export const exportEscritoToGoogleDocs = action({
    args: {
        escritoId: v.id("escritos"),
        caseId: v.id("cases"),
        html: v.string(),
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