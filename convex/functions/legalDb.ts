'use node'
import { v } from "convex/values";
import { action } from "../_generated/server";
import { getFirestore } from "../firebaseAdmin";
import { NationalNormativeDocument, ProvinceNormativeDocument } from "../../types/legal_database";

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
            date: convertFirestoreTimestampToDate(data.date).getTime(), // Changed from .toISOString() to .getTime()
            id_norma: data.id_norma,
        };
    });

    return documents as NationalNormativeDocument[];
}


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
            date: convertFirestoreTimestampToDate(data.date).getTime(), // Changed from .toISOString() to .getTime()
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


function convertFirestoreTimestampToDate(timestamp: any) {
    if (!timestamp || typeof timestamp !== 'object') {
        return new Date();
    }
    
    // Handle Firestore Timestamp objects
    if (timestamp._seconds !== undefined) {
        return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    }
    
    // Handle regular Date objects or timestamps
    if (timestamp instanceof Date) {
        return timestamp;
    }
    
    // Handle numeric timestamps
    if (typeof timestamp === 'number') {
        return new Date(timestamp);
    }
    
    // Fallback to current date
    return new Date();
}