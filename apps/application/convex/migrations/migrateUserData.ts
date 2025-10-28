"use node";

/**
 * User Data Migration Orchestrator - Phase 2
 * 
 * Main function that orchestrates the complete data migration for a user.
 * Migrates cases, clients, and documents from Firestore to Convex.
 * Uses "use node" because it calls actions with "use node".
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { UserMigrationResult } from "./types";

/**
 * Migrate all data for a single user
 * 
 * This is the main entry point for Phase 2 data migration.
 * Called when a user logs in and gives consent to migrate their data.
 */
export const migrateUserData = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<UserMigrationResult> => {
    console.log(`Starting data migration for user ${userId}`);
    
    // Get migration metadata
    const migrationStatus = await ctx.runQuery(
      internal.migrations.helpers.getMigrationStatus,
      { userId }
    );
    
    if (!migrationStatus) {
      throw new Error("No migration metadata found for user");
    }
    
    const { oldKindeId } = migrationStatus;
    const errors: Array<string> = [];
    
    // Update status to in_progress
    await ctx.runMutation(
      internal.migrations.helpers.updateMigrationStatus,
      { userId, status: "in_progress" as const }
    );
    
    try {
      // 1. Fetch Firestore data
      console.log(`Fetching Firestore data for Kinde user ${oldKindeId}`);
      const [cases, clients, allDocuments] = await Promise.all([
        ctx.runAction(internal.migrations.firestoreDataHelpers.getUserCases, 
          { kindeUserId: oldKindeId }),
        ctx.runAction(internal.migrations.firestoreDataHelpers.getUserClients, 
          { kindeUserId: oldKindeId }),
        ctx.runAction(internal.migrations.firestoreDataHelpers.getUserDocuments,
          { kindeUserId: oldKindeId }),
      ]);
      
      console.log(`Found ${cases.length} cases, ${clients.length} clients, ${allDocuments.length} documents`);
      
      // 2. Build set of case-linked document IDs
      const caseLinkedDocIds = new Set<string>();
      for (const firestoreCase of cases) {
        if (firestoreCase.documents) {
          firestoreCase.documents.forEach(docId => caseLinkedDocIds.add(docId));
        }
      }
      
      // Separate documents into case-linked and library (standalone)
      const caseDocuments = allDocuments.filter(doc => caseLinkedDocIds.has(doc.id));
      const libraryDocuments = allDocuments.filter(doc => !caseLinkedDocIds.has(doc.id));
      
      console.log(`Documents breakdown: ${caseDocuments.length} case-linked, ${libraryDocuments.length} library`);
      
      // 3. Migrate cases with their documents
      const caseIdMap: Record<string, string> = {};
      console.log("Migrating cases...");
      let caseDocumentsCount = 0;
      
      for (const firestoreCase of cases) {
        try {
          const result = await ctx.runMutation(
            internal.migrations.migrateCases.createCase,
            {
              newUserId: userId,
              caseName: firestoreCase.caseName,
              description: firestoreCase.description,
              status: firestoreCase.status,
              createdAt: firestoreCase.createdAt,
              updatedAt: firestoreCase.updatedAt,
              oldFirestoreCaseId: firestoreCase.id,
            }
          );
          caseIdMap[firestoreCase.id] = result.caseId;
          
          // Migrate documents for this case
          if (firestoreCase.documents && firestoreCase.documents.length > 0) {
            console.log(`Migrating ${firestoreCase.documents.length} documents for case ${firestoreCase.caseName}`);
            
            const caseDocsForThisCase = caseDocuments.filter(doc => 
              firestoreCase.documents.includes(doc.id)
            );
            
            for (const doc of caseDocsForThisCase) {
              try {
                // Upload file to GCS
                const uploadResult = await ctx.runAction(
                  internal.migrations.fileStorageHelpers.uploadFileToGCS,
                  {
                    storageUrl: doc.storageUrl,
                    fileName: doc.fileName,
                    mimeType: `application/${doc.fileType}`,
                  }
                );
                
                if (!uploadResult.success) {
                  errors.push(`Case Document ${doc.id}: Upload failed - ${uploadResult.error}`);
                  continue;
                }
                
                // Create case document in Convex
                const newDoc = await ctx.runMutation(
                  internal.migrations.migrateDocuments.createDocument,
                  {
                    newUserId: userId,
                    newCaseId: result.caseId as any,
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    date: doc.date,
                    gcsBucket: uploadResult.gcsBucket!,
                    gcsObject: uploadResult.gcsObject!,
                    mimeType: `application/${doc.fileType}`,
                    fileSize: 0, // We don't have size from Firestore
                    oldFirestoreDocId: doc.id,
                  }
                );
                
                // Trigger document processing
                const processingResult = await ctx.runAction(
                  internal.migrations.processingHelpers.triggerDocumentProcessing,
                  {
                    documentId: newDoc.documentId,
                    gcsBucket: uploadResult.gcsBucket!,
                    gcsObject: uploadResult.gcsObject!,
                  }
                );
                
                if (!processingResult.success) {
                  errors.push(`Case Document ${doc.id}: Processing trigger failed - ${processingResult.error}`);
                }
                
                caseDocumentsCount++;
              } catch (error: any) {
                errors.push(`Case Document ${doc.id}: ${error.message}`);
                console.error(`Failed to migrate case document ${doc.id}:`, error);
              }
            }
          }
        } catch (error: any) {
          errors.push(`Case ${firestoreCase.id}: ${error.message}`);
          console.error(`Failed to migrate case ${firestoreCase.id}:`, error);
        }
      }
      
      console.log(`Migrated ${Object.keys(caseIdMap).length} cases with ${caseDocumentsCount} documents`);
      
      // 4. Migrate library documents (standalone documents not linked to cases)
      console.log(`Migrating ${libraryDocuments.length} library documents...`);
      let libraryDocumentsCount = 0;
      
      for (const doc of libraryDocuments) {
        try {
          // Upload file to GCS
          const uploadResult = await ctx.runAction(
            internal.migrations.fileStorageHelpers.uploadFileToGCS,
            {
              storageUrl: doc.storageUrl,
              fileName: doc.fileName,
              mimeType: `application/${doc.fileType}`,
            }
          );
          
          if (!uploadResult.success) {
            errors.push(`Library Document ${doc.id}: Upload failed - ${uploadResult.error}`);
            continue;
          }
          
          // Create library document in Convex
          const newLibDoc = await ctx.runMutation(
            internal.migrations.migrateLibraryDocuments.createLibraryDocument,
            {
              newUserId: userId,
              fileName: doc.fileName,
              fileType: doc.fileType,
              date: doc.date,
              gcsBucket: uploadResult.gcsBucket!,
              gcsObject: uploadResult.gcsObject!,
              mimeType: `application/${doc.fileType}`,
              fileSize: 0, // We don't have size from Firestore
              oldFirestoreDocId: doc.id,
            }
          );
          
          // Trigger library document processing
          const processingResult = await ctx.runAction(
            internal.migrations.processingHelpers.triggerLibraryDocumentProcessing,
            {
              libraryDocumentId: newLibDoc.libraryDocumentId,
              gcsBucket: uploadResult.gcsBucket!,
              gcsObject: uploadResult.gcsObject!,
            }
          );
          
          if (!processingResult.success) {
            errors.push(`Library Document ${doc.id}: Processing trigger failed - ${processingResult.error}`);
          }
          
          libraryDocumentsCount++;
        } catch (error: any) {
          errors.push(`Library Document ${doc.id}: ${error.message}`);
          console.error(`Failed to migrate library document ${doc.id}:`, error);
        }
      }
      
      console.log(`Migrated ${libraryDocumentsCount} library documents`);
      
      // 5. Migrate clients
      console.log("Migrating clients...");
      let clientsCount = 0;
      
      for (const client of clients) {
        try {
          await ctx.runMutation(
            internal.migrations.migrateClients.createClient,
            {
              newUserId: userId,
              nombre: client.nombre,
              email: client.email,
              telefono: client.telefono,
              dni: client.dni,
              lugarTrabajo: client.lugarTrabajo,
              oldFirestoreClientId: client.id,
            }
          );
          clientsCount++;
        } catch (error: any) {
          errors.push(`Client ${client.id}: ${error.message}`);
          console.error(`Failed to migrate client ${client.id}:`, error);
        }
      }
      
      console.log(`Migrated ${clientsCount} clients`);
      
      // Update status to completed
      await ctx.runMutation(
        internal.migrations.helpers.updateMigrationStatus,
        { userId, status: "completed" as const }
      );
      
      console.log(`Migration completed for user ${userId} with ${errors.length} errors`);
      
      return {
        success: true,
        userId: userId,
        casesCount: cases.length,
        clientsCount: clients.length,
        documentsCount: caseDocumentsCount,
        libraryDocumentsCount,
        errorCount: errors.length,
        errors,
      };
      
    } catch (error: any) {
      console.error(`Migration failed for user ${userId}:`, error);
      
      // Update status to failed
      await ctx.runMutation(
        internal.migrations.helpers.updateMigrationStatus,
        { userId, status: "failed" as const }
      );
      
      throw error;
    }
  }
});

