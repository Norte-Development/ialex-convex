/**
 * Library Document Migration - Phase 2
 * 
 * Mutations for creating library documents in Convex from Firestore data.
 * Library documents are standalone documents not linked to specific cases.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import type { LibraryDocumentMigrationResult } from "./types";

/**
 * Create a library document from Firestore data with GCS storage
 * Used for documents that are not linked to any specific case
 */
export const createLibraryDocument = internalMutation({
  args: {
    newUserId: v.id("users"),
    fileName: v.string(),
    fileType: v.string(),
    date: v.number(),
    gcsBucket: v.string(),
    gcsObject: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    oldFirestoreDocId: v.string(),
  },
  handler: async (ctx, args): Promise<LibraryDocumentMigrationResult> => {
    const libraryDocumentId: Id<"libraryDocuments"> = await ctx.db.insert("libraryDocuments", {
      title: args.fileName,
      userId: args.newUserId, // Personal library document
      teamId: undefined, // Not a team document during migration
      description: undefined,
      folderId: undefined, // No folder during migration
      createdBy: args.newUserId,
      gcsBucket: args.gcsBucket,
      gcsObject: args.gcsObject,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      tags: undefined,
      processingStatus: "pending" as const,
    });
    
    console.log(`Created library document ${libraryDocumentId} from Firestore document ${args.oldFirestoreDocId}`);
    
    return {
      libraryDocumentId,
      oldFirestoreDocId: args.oldFirestoreDocId,
    };
  }
});

