"use node";

/**
 * Document Processing Helpers - Phase 2
 * 
 * Trigger document processor service for uploaded files.
 * Uses "use node" for node-fetch.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import fetch from "node-fetch";
import type { ProcessingTriggerResult } from "./types";
import { DOCUMENT_PROCESSOR_URL } from "./constants";

/**
 * Trigger document processing for a migrated case document
 */
export const triggerDocumentProcessing = internalAction({
  args: {
    documentId: v.id("documents"),
    gcsBucket: v.string(),
    gcsObject: v.string(),
  },
  handler: async (ctx, { documentId, gcsBucket, gcsObject }): Promise<ProcessingTriggerResult> => {
    try {
      console.log(`Triggering document processing for ${documentId}`);
      
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/process`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentId,
            gcsBucket,
            gcsObject,
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Processing request failed: ${response.statusText} - ${errorText}`);
      }
      
      console.log(`Document processing triggered successfully for ${documentId}`);
      return { success: true, error: null };
    } catch (error: any) {
      console.error("Document processing trigger error:", error);
      return { success: false, error: error.message };
    }
  }
});

/**
 * Trigger library document processing for a migrated library document
 */
export const triggerLibraryDocumentProcessing = internalAction({
  args: {
    libraryDocumentId: v.id("libraryDocuments"),
    gcsBucket: v.string(),
    gcsObject: v.string(),
  },
  handler: async (ctx, { libraryDocumentId, gcsBucket, gcsObject }): Promise<ProcessingTriggerResult> => {
    try {
      console.log(`Triggering library document processing for ${libraryDocumentId}`);
      
      const response = await fetch(
        `${DOCUMENT_PROCESSOR_URL}/process-library`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            libraryDocumentId,
            gcsBucket,
            gcsObject,
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Library processing request failed: ${response.statusText} - ${errorText}`);
      }
      
      console.log(`Library document processing triggered successfully for ${libraryDocumentId}`);
      return { success: true, error: null };
    } catch (error: any) {
      console.error("Library document processing trigger error:", error);
      return { success: false, error: error.message };
    }
  }
});

