"use node";

/**
 * File Storage Helpers - Phase 2
 * 
 * Handle file downloads from Firebase Storage and uploads to GCS.
 * Uses "use node" for Node.js built-in modules and GCS SDK.
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Storage } from "@google-cloud/storage";
import type { FileUploadResult } from "./types";
import { 
  FIREBASE_PROJECT_ID, 
  FIREBASE_PRIVATE_KEY, 
  FIREBASE_CLIENT_EMAIL,
  GCS_BUCKET,
  FILE_DOWNLOAD_TIMEOUT_MS,
} from "./constants";

/**
 * Upload a file from Firebase Storage to GCS
 */
export const uploadFileToGCS = internalAction({
  args: {
    storageUrl: v.string(), // Firebase Storage path like "documents/userId/fileName.pdf"
    fileName: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, { storageUrl, fileName, mimeType }): Promise<FileUploadResult> => {
    try {
      console.log(`Starting file upload: ${fileName}`);
      
      // Initialize Firebase Storage
      const storage = new Storage({
        projectId: FIREBASE_PROJECT_ID,
        credentials: {
          client_email: FIREBASE_CLIENT_EMAIL,
          private_key: FIREBASE_PRIVATE_KEY,
        },
      });
      
      // Download from Firebase Storage using the storage path
      const firebaseBucket = storage.bucket(FIREBASE_PROJECT_ID + ".appspot.com");
      const firebaseFile = firebaseBucket.file(storageUrl);
      
      const [fileBuffer] = await firebaseFile.download();
      console.log(`Downloaded file: ${fileName} (${fileBuffer.length} bytes)`);
      
      // Upload to GCS
      const gcsBucket = storage.bucket(GCS_BUCKET);
      const gcsFileName = `migrations/${Date.now()}-${fileName}`;
      const gcsFile = gcsBucket.file(gcsFileName);
      
      await gcsFile.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          source: "migration",
          originalFileName: fileName,
          originalStorageUrl: storageUrl,
        }
      });
      
      console.log(`Uploaded file to GCS: ${gcsFileName}`);
      
      return {
        success: true,
        gcsBucket: GCS_BUCKET,
        gcsObject: gcsFileName,
        fileSize: fileBuffer.length,
        error: null,
      };
    } catch (error: any) {
      console.error("File upload error:", error);
      return {
        success: false,
        gcsBucket: null,
        gcsObject: null,
        fileSize: 0,
        error: error.message,
      };
    }
  }
});

