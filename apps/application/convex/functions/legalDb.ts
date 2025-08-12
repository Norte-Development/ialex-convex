'use node'
import { v } from "convex/values";
import { action } from "../_generated/server";
import { getFirestore } from "../firebaseAdmin";
import { NationalNormativeDocument, ProvinceNormativeDocument } from "../../types/legal_database";

/**
 * Action to fetch legal documents from Firestore based on jurisdiction and category.
 * @param ctx - The Convex context object.
 * @param args - The arguments object containing optional filters.
 * @param args.jurisdiction - The jurisdiction to filter documents (e.g., 'nacional' or province name).
 * @param args.category - The category of documents to fetch (defaults to 'ley').
 * @param args.limit - The maximum number of documents to return (defaults to 10).
 * @param args.offset - The number of documents to skip for pagination (defaults to 0).
 * @returns A promise resolving to an array of national or province normative documents.
 * @throws Error if the user is not authenticated.
 */
export const fetchLegalDb = action({
    args: {
        jurisdiction: v.optional(v.string()),
        category: v.optional(v.string()),
        limit: v.optional(v.number()),
        offset: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { jurisdiction, category = 'ley', limit = 10, offset = 0 } = args;
        const currentUser = await ctx.auth.getUserIdentity();

        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        if (jurisdiction === 'nacional' || !jurisdiction) {
            return await fetchNationalNormativeDocuments(category, limit, offset);
        } else {
            return await fetchProvinceNormativeDocuments(jurisdiction, category, limit, offset);
        }
    }
})

/**
 * Fetches national normative documents from Firestore.
 * @param category - The category of documents to fetch.
 * @param limit - The maximum number of documents to return.
 * @param offset - The number of documents to skip for pagination.
 * @returns A promise resolving to an array of NationalNormativeDocument objects.
 */
async function fetchNationalNormativeDocuments(category: string, limit: number, offset: number) {
    const firestore = getFirestore();
    const collectionRef = firestore.collection('legalDocuments');

    let query = collectionRef.where('category', '==', category);
    query = query.limit(limit);
    query = query.offset(offset);

    const querySnapshot = await query.get();

    const documents = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title,
            category: data.category,
            number: data.number,
            date: convertFirestoreTimestampToDate(data.date).getTime(),
            id_norma: data.id_norma,
        };
    });

    return documents as NationalNormativeDocument[];
}

/**
 * Fetches province-specific normative documents from Firestore.
 * @param province - The province to filter documents.
 * @param category - The category of documents to fetch.
 * @param limit - The maximum number of documents to return.
 * @param offset - The number of documents to skip for pagination.
 * @returns A promise resolving to an array of ProvinceNormativeDocument objects.
 */
async function fetchProvinceNormativeDocuments(province: string, category: string, limit: number, offset: number) {
    const firestore = getFirestore();
    const collectionRef = firestore.collection(`legislacion_${province}`);

    let query = collectionRef.where('type', '==', category);
    query = query.limit(limit);
    query = query.offset(offset);

    const querySnapshot = await query.get();

    const documents = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            content: data.content,
            date: convertFirestoreTimestampToDate(data.date).getTime(),
            documentId: data.documentId,
            number: data.number,
            object: data.object,
            title: data.title,
            type: data.type,
            url: data.url,
            province: data.province,
        };
    });

    return documents as ProvinceNormativeDocument[];
}

/**
 * Converts a Firestore timestamp to a JavaScript Date object.
 * @param timestamp - The Firestore timestamp or Date object to convert.
 * @returns A JavaScript Date object, or the current date if the input is invalid.
 */
function convertFirestoreTimestampToDate(timestamp: any) {
    if (!timestamp || typeof timestamp !== 'object') {
        return new Date();
    }
    
    if (timestamp._seconds !== undefined) {
        return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    }
    
    if (timestamp instanceof Date) {
        return timestamp;
    }
    
    if (typeof timestamp === 'number') {
        return new Date(timestamp);
    }
    
    return new Date();
}