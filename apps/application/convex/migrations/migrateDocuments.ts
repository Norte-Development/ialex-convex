/**
 * Document Migration - Phase 2
 * 
 * Mutations for creating documents in Convex from Firestore data.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import type { DocumentMigrationResult } from "./types";

/**
 * Create a document from Firestore data with GCS storage
 */
export const createDocument = internalMutation({
  args: {
    newUserId: v.id("users"),
    newCaseId: v.id("cases"),
    fileName: v.string(),
    fileType: v.string(),
    date: v.number(),
    gcsBucket: v.string(),
    gcsObject: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    oldFirestoreDocId: v.string(),
  },
  handler: async (ctx, args): Promise<DocumentMigrationResult> => {
    const documentId: Id<"documents"> = await ctx.db.insert("documents", {
      title: args.fileName,
      caseId: args.newCaseId,
      storageBackend: "gcs" as const,
      gcsBucket: args.gcsBucket,
      gcsObject: args.gcsObject,
      originalFileName: args.fileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: args.newUserId,
      processingStatus: "pending" as const,
    });
    
    console.log(`Created document ${documentId} from Firestore document ${args.oldFirestoreDocId}`);
    
    return {
      documentId,
      oldFirestoreDocId: args.oldFirestoreDocId,
    };
  }
});

