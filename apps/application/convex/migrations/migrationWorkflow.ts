// /**
//  * Migration Workflow - Phase 2
//  *
//  * Converts the single migration action into a workflow to avoid timeouts.
//  * Breaks down the migration into smaller, resumable steps.
//  */

// import { WorkflowManager } from "@convex-dev/workflow";
// import { components, internal } from "../_generated/api";
// import { v } from "convex/values";
// import { internalAction, internalMutation } from "../_generated/server";
// import type {
//   UserMigrationResult,
//   FirestoreCaseData,
//   FirestoreClientData,
//   FirestoreDocumentData
// } from "./types";
// import { detectMimeTypeFromFileType, getSafeMimeType } from "./mimeTypeUtils";

// const workflow = new WorkflowManager(components.workflow);

// // Workflow state interface
// interface MigrationWorkflowState {
//   userId: string;
//   oldKindeId: string;
//   cases: FirestoreCaseData[];
//   clients: FirestoreClientData[];
//   allDocuments: FirestoreDocumentData[];
//   caseDocuments: FirestoreDocumentData[];
//   libraryDocuments: FirestoreDocumentData[];
//   caseIdMap: Record<string, string>;
//   errors: string[];
//   casesCount: number;
//   clientsCount: number;
//   caseDocumentsCount: number;
//   libraryDocumentsCount: number;
// }

// export const userDataMigrationWorkflow = workflow.define({
//   args: {
//     userId: v.id("users"),
//   },
//   handler: async (step, args): Promise<UserMigrationResult> => {
//     console.log(`Starting workflow-based migration for user ${args.userId}`);

//     // Initialize workflow state
//     const state: MigrationWorkflowState = {
//       userId: args.userId,
//       oldKindeId: "",
//       cases: [],
//       clients: [],
//       allDocuments: [],
//       caseDocuments: [],
//       libraryDocuments: [],
//       caseIdMap: {},
//       errors: [],
//       casesCount: 0,
//       clientsCount: 0,
//       caseDocumentsCount: 0,
//       libraryDocumentsCount: 0,
//     };

//     try {
//       // Step 1: Get migration metadata and update status
//       const migrationData = await step.runAction(
//         internal.migrations.migrationWorkflow.getMigrationMetadata,
//         { userId: args.userId }
//       );
//       state.oldKindeId = migrationData.oldKindeId;

//       // Step 2: Fetch all Firestore data
//       const firestoreData = await step.runAction(
//         internal.migrations.migrationWorkflow.fetchFirestoreData,
//         { kindeUserId: state.oldKindeId }
//       );
//       state.cases = firestoreData.cases;
//       state.clients = firestoreData.clients;
//       state.allDocuments = firestoreData.allDocuments;

//       // Step 3: Process and categorize documents
//       const documentData = await step.runAction(
//         internal.migrations.migrationWorkflow.processDocuments,
//         {
//           cases: state.cases,
//           allDocuments: state.allDocuments
//         }
//       );
//       state.caseDocuments = documentData.caseDocuments;
//       state.libraryDocuments = documentData.libraryDocuments;

//       // Step 4: Migrate cases with their documents
//       const caseResults = await step.runAction(
//         internal.migrations.migrationWorkflow.migrateCases,
//         {
//           userId: args.userId,
//           cases: state.cases,
//           caseDocuments: state.caseDocuments,
//         }
//       );
//       state.caseIdMap = caseResults.caseIdMap;
//       state.casesCount = caseResults.casesCount;
//       state.caseDocumentsCount = caseResults.caseDocumentsCount;
//       state.errors.push(...caseResults.errors);

//       // Step 5: Migrate library documents
//       const libraryResults = await step.runAction(
//         internal.migrations.migrationWorkflow.migrateLibraryDocuments,
//         {
//           userId: args.userId,
//           libraryDocuments: state.libraryDocuments,
//         }
//       );
//       state.libraryDocumentsCount = libraryResults.libraryDocumentsCount;
//       state.errors.push(...libraryResults.errors);

//       // Step 6: Migrate clients
//       const clientResults = await step.runAction(
//         internal.migrations.migrationWorkflow.migrateClients,
//         {
//           userId: args.userId,
//           clients: state.clients,
//         }
//       );
//       state.clientsCount = clientResults.clientsCount;
//       state.errors.push(...clientResults.errors);

//       // Step 7: Complete migration
//       await step.runMutation(
//         internal.migrations.migrationWorkflow.completeMigration,
//         {
//           userId: args.userId,
//           status: "completed" as const
//         }
//       );

//       console.log(`Migration workflow completed for user ${args.userId} with ${state.errors.length} errors`);

//       return {
//         success: true,
//         userId: args.userId,
//         casesCount: state.casesCount,
//         clientsCount: state.clientsCount,
//         documentsCount: state.caseDocumentsCount,
//         libraryDocumentsCount: state.libraryDocumentsCount,
//         errorCount: state.errors.length,
//         errors: state.errors,
//       };

//     } catch (error: any) {
//       console.error(`Migration workflow failed for user ${args.userId}:`, error);

//       // Update status to failed
//       await step.runMutation(
//         internal.migrations.migrationWorkflow.completeMigration,
//         {
//           userId: args.userId,
//           status: "failed" as const
//         }
//       );

//       throw error;
//     }
//   },
// });

// // Step 1: Get migration metadata
// export const getMigrationMetadata = internalAction({
//   args: { userId: v.id("users") },
//   returns: v.object({
//     oldKindeId: v.string(),
//   }),
//   handler: async (ctx, { userId }): Promise<{ oldKindeId: string }> => {
//     const migrationStatus = await ctx.runQuery(
//       internal.migrations.helpers.getMigrationStatus,
//       { userId }
//     );

//     if (!migrationStatus) {
//       throw new Error("No migration metadata found for user");
//     }

//     // Update status to in_progress
//     await ctx.runMutation(
//       internal.migrations.helpers.updateMigrationStatus,
//       { userId, status: "in_progress" as const }
//     );

//     return { oldKindeId: migrationStatus.oldKindeId };
//   },
// });

// // Step 2: Fetch Firestore data
// export const fetchFirestoreData = internalAction({
//   args: { kindeUserId: v.string() },
//   returns: v.object({
//     cases: v.array(v.any()),
//     clients: v.array(v.any()),
//     allDocuments: v.array(v.any()),
//   }),
//   handler: async (ctx, { kindeUserId }): Promise<{ cases: FirestoreCaseData[]; clients: FirestoreClientData[]; allDocuments: FirestoreDocumentData[] }> => {
//     console.log(`Fetching Firestore data for Kinde user ${kindeUserId}`);

//     const [cases, clients, allDocuments] = await Promise.all([
//       ctx.runAction(internal.migrations.firestoreDataHelpers.getUserCases,
//         { kindeUserId }),
//       ctx.runAction(internal.migrations.firestoreDataHelpers.getUserClients,
//         { kindeUserId }),
//       ctx.runAction(internal.migrations.firestoreDataHelpers.getUserDocuments,
//         { kindeUserId }),
//     ]);

//     console.log(`Found ${cases.length} cases, ${clients.length} clients, ${allDocuments.length} documents`);

//     return { cases, clients, allDocuments };
//   },
// });

// // Step 3: Process and categorize documents
// export const processDocuments = internalAction({
//   args: {
//     cases: v.array(v.any()),
//     allDocuments: v.array(v.any()),
//   },
//   returns: v.object({
//     caseDocuments: v.array(v.any()),
//     libraryDocuments: v.array(v.any()),
//   }),
//   handler: async (ctx, { cases, allDocuments }) => {
//     // Build set of case-linked document IDs
//     const caseLinkedDocIds = new Set<string>();
//     for (const firestoreCase of cases) {
//       if (firestoreCase.documents) {
//         firestoreCase.documents.forEach((docId: string) => caseLinkedDocIds.add(docId));
//       }
//     }

//     // Separate documents into case-linked and library (standalone)
//     const caseDocuments = allDocuments.filter((doc: any) => caseLinkedDocIds.has(doc.id));
//     const libraryDocuments = allDocuments.filter((doc: any) => !caseLinkedDocIds.has(doc.id));

//     console.log(`Documents breakdown: ${caseDocuments.length} case-linked, ${libraryDocuments.length} library`);

//     return { caseDocuments, libraryDocuments };
//   },
// });

// // Step 4: Migrate cases with their documents
// export const migrateCases = internalAction({
//   args: {
//     userId: v.id("users"),
//     cases: v.array(v.any()),
//     caseDocuments: v.array(v.any()),
//   },
//   returns: v.object({
//     caseIdMap: v.record(v.string(), v.string()),
//     casesCount: v.number(),
//     caseDocumentsCount: v.number(),
//     errors: v.array(v.string()),
//   }),
//   handler: async (ctx, { userId, cases, caseDocuments }) => {
//     console.log("Migrating cases...");
//     const caseIdMap: Record<string, string> = {};
//     const errors: string[] = [];
//     let caseDocumentsCount = 0;

//     for (const firestoreCase of cases) {
//       try {
//         const result = await ctx.runMutation(
//           internal.migrations.migrateCases.createCase,
//           {
//             newUserId: userId,
//             caseName: firestoreCase.caseName,
//             description: firestoreCase.description,
//             status: firestoreCase.status,
//             createdAt: firestoreCase.createdAt,
//             updatedAt: firestoreCase.updatedAt,
//             oldFirestoreCaseId: firestoreCase.id,
//           }
//         );
//         caseIdMap[firestoreCase.id] = result.caseId;

//         // Migrate documents for this case
//         if (firestoreCase.documents && firestoreCase.documents.length > 0) {
//           console.log(`Migrating ${firestoreCase.documents.length} documents for case ${firestoreCase.caseName}`);

//           const caseDocsForThisCase = caseDocuments.filter((doc: any) =>
//             firestoreCase.documents.includes(doc.id)
//           );

//           for (const doc of caseDocsForThisCase) {
//             try {
//               // Detect proper MIME type from file type
//               const mimeType = getSafeMimeType(detectMimeTypeFromFileType(doc.fileType));

//               // Upload file to GCS
//               const uploadResult = await ctx.runAction(
//                 internal.migrations.fileStorageHelpers.uploadFileToGCS,
//                 {
//                   storageUrl: doc.storageUrl,
//                   fileName: doc.fileName,
//                   mimeType: mimeType,
//                 }
//               );

//               if (!uploadResult.success) {
//                 errors.push(`Case Document ${doc.id}: Upload failed - ${uploadResult.error}`);
//                 continue;
//               }

//               // Create case document in Convex using internal function
//               await ctx.runMutation(
//                 internal.functions.documents.internalCreateDocument,
//                 {
//                   title: doc.fileName,
//                   caseId: result.caseId as any,
//                   gcsBucket: uploadResult.gcsBucket!,
//                   gcsObject: uploadResult.gcsObject!,
//                   originalFileName: doc.fileName,
//                   mimeType: mimeType,
//                   fileSize: uploadResult.fileSize,
//                   createdBy: userId,
//                 }
//               );

//               caseDocumentsCount++;
//             } catch (error: any) {
//               errors.push(`Case Document ${doc.id}: ${error.message}`);
//               console.error(`Failed to migrate case document ${doc.id}:`, error);
//             }
//           }
//         }
//       } catch (error: any) {
//         errors.push(`Case ${firestoreCase.id}: ${error.message}`);
//         console.error(`Failed to migrate case ${firestoreCase.id}:`, error);
//       }
//     }

//     console.log(`Migrated ${Object.keys(caseIdMap).length} cases with ${caseDocumentsCount} documents`);

//     return {
//       caseIdMap,
//       casesCount: cases.length,
//       caseDocumentsCount,
//       errors,
//     };
//   },
// });

// // Step 5: Migrate library documents
// export const migrateLibraryDocuments = internalAction({
//   args: {
//     userId: v.id("users"),
//     libraryDocuments: v.array(v.any()),
//   },
//   returns: v.object({
//     libraryDocumentsCount: v.number(),
//     errors: v.array(v.string()),
//   }),
//   handler: async (ctx, { userId, libraryDocuments }) => {
//     console.log(`Migrating ${libraryDocuments.length} library documents...`);
//     const errors: string[] = [];
//     let libraryDocumentsCount = 0;

//     for (const doc of libraryDocuments) {
//       try {
//         // Detect proper MIME type from file type
//         const mimeType = getSafeMimeType(detectMimeTypeFromFileType(doc.fileType));

//         // Upload file to GCS
//         const uploadResult = await ctx.runAction(
//           internal.migrations.fileStorageHelpers.uploadFileToGCS,
//           {
//             storageUrl: doc.storageUrl,
//             fileName: doc.fileName,
//             mimeType: mimeType,
//           }
//         );

//         if (!uploadResult.success) {
//           errors.push(`Library Document ${doc.id}: Upload failed - ${uploadResult.error}`);
//           continue;
//         }

//         // Create library document in Convex using internal function
//         await ctx.runMutation(
//           internal.functions.libraryDocument.internalCreateLibraryDocument,
//           {
//             title: doc.fileName,
//             gcsBucket: uploadResult.gcsBucket!,
//             gcsObject: uploadResult.gcsObject!,
//             mimeType: mimeType,
//             fileSize: uploadResult.fileSize,
//             createdBy: userId,
//           }
//         );

//         libraryDocumentsCount++;
//       } catch (error: any) {
//         errors.push(`Library Document ${doc.id}: ${error.message}`);
//         console.error(`Failed to migrate library document ${doc.id}:`, error);
//       }
//     }

//     console.log(`Migrated ${libraryDocumentsCount} library documents`);

//     return {
//       libraryDocumentsCount,
//       errors,
//     };
//   },
// });

// // Step 6: Migrate clients
// export const migrateClients = internalAction({
//   args: {
//     userId: v.id("users"),
//     clients: v.array(v.any()),
//   },
//   returns: v.object({
//     clientsCount: v.number(),
//     errors: v.array(v.string()),
//   }),
//   handler: async (ctx, { userId, clients }) => {
//     console.log("Migrating clients...");
//     const errors: string[] = [];
//     let clientsCount = 0;

//     for (const client of clients) {
//       try {
//         await ctx.runMutation(
//           internal.migrations.migrateClients.createClient,
//           {
//             newUserId: userId,
//             nombre: client.nombre,
//             email: client.email,
//             telefono: client.telefono,
//             dni: client.dni,
//             lugarTrabajo: client.lugarTrabajo,
//             oldFirestoreClientId: client.id,
//           }
//         );
//         clientsCount++;
//       } catch (error: any) {
//         errors.push(`Client ${client.id}: ${error.message}`);
//         console.error(`Failed to migrate client ${client.id}:`, error);
//       }
//     }

//     console.log(`Migrated ${clientsCount} clients`);

//     return {
//       clientsCount,
//       errors,
//     };
//   },
// });

// // Step 7: Complete migration
// export const completeMigration = internalMutation({
//   args: {
//     userId: v.id("users"),
//     status: v.union(v.literal("completed"), v.literal("failed")),
//   },
//   returns: v.null(),
//   handler: async (ctx, { userId, status }) => {
//     await ctx.runMutation(
//       internal.migrations.helpers.updateMigrationStatus,
//       { userId, status }
//     );
//     return null;
//   },
// });

// // New workflow-based migration orchestrator
// export const migrateUserDataWorkflow = internalAction({
//   args: { userId: v.id("users") },
//   returns: v.any(), // UserMigrationResult
//   handler: async (ctx, { userId }): Promise<UserMigrationResult> => {
//     console.log(`Starting workflow-based data migration for user ${userId}`);

//     const workflowId = await workflow.start(
//       ctx,
//       internal.migrations.migrationWorkflow.userDataMigrationWorkflow,
//       { userId }
//     );

//     console.log(`Migration workflow started with ID: ${workflowId}`);

//     // Return a result indicating the workflow has been started
//     // The actual migration will happen asynchronously
//     return {
//       success: true,
//       userId: userId,
//       casesCount: 0,
//       clientsCount: 0,
//       documentsCount: 0,
//       libraryDocumentsCount: 0,
//       errorCount: 0,
//       errors: [],
//     };
//   },
// });
