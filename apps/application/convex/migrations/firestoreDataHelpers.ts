"use node";

/**
 * Firestore Data Helpers - Phase 2
 * 
 * Fetch user data (cases, clients, documents) from Firestore.
 * Uses "use node" because it imports firebase-admin.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getFirestore } from "../firebaseAdmin";
import type { 
  FirestoreCaseData, 
  FirestoreClientData, 
  FirestoreDocumentData 
} from "./types";

/**
 * Get all cases (expedientes) for a Kinde user from Firestore
 */
export const getUserCases = internalAction({
  args: { kindeUserId: v.string() },
  handler: async (ctx, { kindeUserId }): Promise<Array<FirestoreCaseData>> => {
    const firestore = getFirestore();
    const casesSnapshot = await firestore
      .collection("expedientes")
      .where("userId", "==", kindeUserId)
      .get();
    
    return casesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        caseName: data.caseName || "Untitled Case",
        description: data.description || null,
        status: data.status || "active",
        userId: data.userId,
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() || Date.now(),
        documents: data.documents || [],
        legalDocuments: data.legalDocuments || [],
        sentencias: data.sentencias || [],
      };
    });
  }
});

/**
 * Get all clients for a Kinde user from Firestore
 */
export const getUserClients = internalAction({
  args: { kindeUserId: v.string() },
  handler: async (ctx, { kindeUserId }): Promise<Array<FirestoreClientData>> => {
    const firestore = getFirestore();
    const clientsSnapshot = await firestore
      .collection("clients")
      .where("userId", "==", kindeUserId)
      .get();
    
    return clientsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nombre: data.nombre || "Unknown",
        email: data.email || null,
        telefono: data.telefono || null,
        dni: data.dni || null,
        lugarTrabajo: data.lugarTrabajo || null,
        userId: data.userId,
      };
    });
  }
});

/**
 * Get all documents for a Kinde user from Firestore
 * This returns ALL documents, including those not linked to cases (library documents)
 */
export const getUserDocuments = internalAction({
  args: { kindeUserId: v.string() },
  handler: async (ctx, { kindeUserId }): Promise<Array<FirestoreDocumentData>> => {
    const firestore = getFirestore();
    const documentsSnapshot = await firestore
      .collection("documents")
      .where("userId", "==", kindeUserId)
      .get();
    
    return documentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        fileName: data.fileName || "Untitled Document",
        fileType: data.fileType || "pdf",
        storageUrl: data.storageUrl || "",
        status: data.status || "processed",
        date: data.date?.toMillis?.() || Date.now(),
        userId: data.userId,
      };
    });
  }
});

/**
 * Get specific documents by IDs from Firestore
 */
export const getDocumentsByIds = internalAction({
  args: { documentIds: v.array(v.string()) },
  handler: async (ctx, { documentIds }): Promise<Array<FirestoreDocumentData>> => {
    if (documentIds.length === 0) {
      return [];
    }
    
    const firestore = getFirestore();
    const documents: Array<FirestoreDocumentData> = [];
    
    // Firestore has a limit of 10 items per 'in' query, so we batch
    const batchSize = 10;
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      const documentsSnapshot = await firestore
        .collection("documents")
        .where("__name__", "in", batch)
        .get();
      
      documentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        documents.push({
          id: doc.id,
          fileName: data.fileName || "Untitled Document",
          fileType: data.fileType || "pdf",
          storageUrl: data.storageUrl || "",
          status: data.status || "processed",
          date: data.date?.toMillis?.() || Date.now(),
          userId: data.userId,
        });
      });
    }
    
    return documents;
  }
});

