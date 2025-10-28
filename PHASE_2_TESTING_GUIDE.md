# Phase 2 Migration Testing Guide

## Overview

This guide walks you through testing the Phase 2 data migration implementation before running it in production.

## Prerequisites

Before testing, ensure you have:

- ✅ Phase 2 code implemented (all files created)
- ✅ Dependencies installed (`node-fetch`, `@google-cloud/storage`)
- ✅ Convex development environment running (`npx convex dev`)
- ✅ All environment variables configured (Phase 1 + Phase 2)
- ✅ Firebase/Firestore with test data
- ✅ GCS bucket accessible
- ✅ Document processor service running (optional for initial test)

## Step 1: Environment Setup

### 1.1 Verify Environment Variables

Check your `.env.local` file has all required variables:

```bash
# Phase 1 Variables
CLERK_SECRET_KEY=sk_test_xxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
KINDE_DOMAIN=yourbusiness.kinde.com
KINDE_M2M_CLIENT_ID=your_m2m_client_id
KINDE_M2M_CLIENT_SECRET=your_m2m_client_secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GCS_BUCKET=your-bucket-name

# Phase 2 Variables
DOCUMENT_PROCESSOR_URL=http://localhost:3001
```

### 1.2 Start Convex Dev

```bash
cd apps/application
npx convex dev
```

### 1.3 Verify Firebase Connection

From Convex dashboard, test Firebase connection:

```typescript
const result = await ctx.runAction(
  internal.migrations.firebaseHelpers.getAllFirestoreUsers,
  {}
);
console.log("Firestore users:", result.length);
```

## Step 2: Prepare Test Data

### 2.1 Identify a Test User

Find a user with migration metadata:

```typescript
const users = await ctx.runQuery(
  internal.migrations.getAllUsers,
  {}
);

// Find a user with migration metadata
const testUser = users.find(u => {
  // Look for a user you know has data in Firestore
  return u.email === "test@example.com";
});

console.log("Test user:", testUser);
```

### 2.2 Check Test User's Migration Status

```typescript
const status = await ctx.runQuery(
  internal.migrations.getMigrationStatus,
  { userId: testUser._id }
);

console.log("Migration status:", status);
// Should show: { status: "pending", oldKindeId: "kinde_user_id", consentGiven: false }
```

### 2.3 Verify Test User Has Firestore Data

```typescript
// Check cases
const cases = await ctx.runAction(
  internal.migrations.firestoreDataHelpers.getUserCases,
  { kindeUserId: status.oldKindeId }
);
console.log("Cases found:", cases.length);

// Check clients
const clients = await ctx.runAction(
  internal.migrations.firestoreDataHelpers.getUserClients,
  { kindeUserId: status.oldKindeId }
);
console.log("Clients found:", clients.length);

// Check documents
const documents = await ctx.runAction(
  internal.migrations.firestoreDataHelpers.getUserDocuments,
  { kindeUserId: status.oldKindeId }
);
console.log("Documents found:", documents.length);
```

## Step 3: Test Individual Components

### 3.1 Test File Upload (Optional)

If you have a test document with a valid download URL:

```typescript
const testDoc = documents[0]; // Use a document from step 2.3

const uploadResult = await ctx.runAction(
  internal.migrations.fileStorageHelpers.uploadFileToGCS,
  {
    firebaseUrl: testDoc.downloadUrl,
    fileName: "test-file.pdf",
    mimeType: "application/pdf",
  }
);

console.log("Upload result:", uploadResult);
// Should show: { success: true, gcsBucket: "...", gcsObject: "...", error: null }
```

### 3.2 Verify GCS Upload

Check your GCS bucket for the uploaded file:
- Go to Google Cloud Console → Storage → Browser
- Look in `migrations/` folder
- File should be named with timestamp prefix

### 3.3 Test Case Migration

```typescript
const testCase = cases[0]; // Use a case from step 2.3

const caseResult = await ctx.runMutation(
  internal.migrations.createCase,
  {
    newUserId: testUser._id,
    title: testCase.title,
    description: testCase.description,
    status: testCase.status,
    expedientNumber: testCase.expedientNumber,
    category: testCase.category,
    priority: testCase.priority,
    startDate: testCase.startDate,
    endDate: testCase.endDate,
    oldFirestoreCaseId: testCase.id,
  }
);

console.log("Case created:", caseResult);
// Should show: { caseId: "...", oldFirestoreCaseId: "..." }
```

### 3.4 Test Library Document Migration

Test migrating a standalone document (not linked to any case):

```typescript
// Find a document that's NOT linked to any case
const allDocs = await ctx.runAction(
  internal.migrations.firestoreDataHelpers.getUserDocuments,
  { kindeUserId: status.oldKindeId }
);

// Get all case-linked document IDs
const caseLinkedDocIds = new Set();
for (const c of cases) {
  if (c.documents) {
    c.documents.forEach(id => caseLinkedDocIds.add(id));
  }
}

// Find standalone documents
const standaloneDoc = allDocs.find(doc => !caseLinkedDocIds.has(doc.id));

if (standaloneDoc) {
  console.log("Testing library document migration...");
  
  // Upload to GCS
  const uploadResult = await ctx.runAction(
    internal.migrations.fileStorageHelpers.uploadFileToGCS,
    {
      storageUrl: standaloneDoc.storageUrl,
      fileName: standaloneDoc.fileName,
      mimeType: `application/${standaloneDoc.fileType}`,
    }
  );
  
  if (uploadResult.success) {
    // Create library document
    const libDocResult = await ctx.runMutation(
      internal.migrations.createLibraryDocument,
      {
        newUserId: testUser._id,
        fileName: standaloneDoc.fileName,
        fileType: standaloneDoc.fileType,
        date: standaloneDoc.date,
        gcsBucket: uploadResult.gcsBucket,
        gcsObject: uploadResult.gcsObject,
        mimeType: `application/${standaloneDoc.fileType}`,
        fileSize: 0,
        oldFirestoreDocId: standaloneDoc.id,
      }
    );
    
    console.log("Library document created:", libDocResult);
    // Should show: { libraryDocumentId: "...", oldFirestoreDocId: "..." }
  }
} else {
  console.log("No standalone documents found - all documents are linked to cases");
}
```

**Expected Results:**
- Library document should be created in `libraryDocuments` table
- Document should have `userId` set but no `caseId`
- Document should have GCS storage references

## Step 4: Run Full Migration Test

### 4.1 Run Migration for Test User

```typescript
console.log("Starting full migration for test user...");

const migrationResult = await ctx.runAction(
  internal.migrations.migrateUserData,
  { userId: testUser._id }
);

console.log("Migration completed!");
console.log("Results:", {
  success: migrationResult.success,
  casesCount: migrationResult.casesCount,
  clientsCount: migrationResult.clientsCount,
  documentsCount: migrationResult.documentsCount,
  libraryDocumentsCount: migrationResult.libraryDocumentsCount,
  errorCount: migrationResult.errorCount,
});

if (migrationResult.errorCount > 0) {
  console.log("Errors:", migrationResult.errors);
}
```

### 4.2 Verify Migration Results

#### Check Cases
```typescript
const migratedCases = await ctx.db
  .query("cases")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

console.log("Migrated cases:", migratedCases.length);
console.log("Sample case:", migratedCases[0]);
```

#### Check Clients
```typescript
const migratedClients = await ctx.db
  .query("clients")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

console.log("Migrated clients:", migratedClients.length);
console.log("Sample client:", migratedClients[0]);
```

#### Check Case Documents
```typescript
const migratedDocuments = await ctx.db
  .query("documents")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

console.log("Migrated case documents:", migratedDocuments.length);
console.log("Sample case document:", migratedDocuments[0]);

// Check document properties
if (migratedDocuments.length > 0) {
  const doc = migratedDocuments[0];
  console.log("Storage backend:", doc.storageBackend); // Should be "gcs"
  console.log("GCS bucket:", doc.gcsBucket);
  console.log("GCS object:", doc.gcsObject);
  console.log("Case ID:", doc.caseId); // Should reference a case
  console.log("Processing status:", doc.processingStatus); // Should be "pending"
}
```

#### Check Library Documents
```typescript
const migratedLibraryDocs = await ctx.db
  .query("libraryDocuments")
  .withIndex("by_user", (q) => q.eq("userId", testUser._id))
  .collect();

console.log("Migrated library documents:", migratedLibraryDocs.length);
console.log("Sample library document:", migratedLibraryDocs[0]);

// Check library document properties
if (migratedLibraryDocs.length > 0) {
  const libDoc = migratedLibraryDocs[0];
  console.log("GCS bucket:", libDoc.gcsBucket);
  console.log("GCS object:", libDoc.gcsObject);
  console.log("User ID:", libDoc.userId); // Should be the migrated user
  console.log("Processing status:", libDoc.processingStatus); // Should be "pending"
  
  // Verify it's NOT linked to a case (library docs are standalone)
  console.log("Has teamId:", libDoc.teamId); // Should be undefined for personal library
}
```

**Expected Results:**
- Case documents have a `caseId` and are linked to migrated cases
- Library documents have a `userId` but NO case reference
- All documents should have GCS storage references
- Documents not linked to any case should be in `libraryDocuments` table

### 4.3 Check Migration Status

```typescript
const finalStatus = await ctx.runQuery(
  internal.migrations.getMigrationStatus,
  { userId: testUser._id }
);

console.log("Final migration status:", finalStatus);
// Should show: { status: "completed", oldKindeId: "...", consentGiven: false }
```

## Step 5: Validation Checklist

After running the migration, verify:

- [ ] Migration status changed from "pending" to "completed"
- [ ] All cases migrated (count matches Firestore)
- [ ] All clients migrated (count matches Firestore)
- [ ] Documents uploaded to GCS (count may be less if some had no URL)
- [ ] Documents have correct GCS references (bucket and object)
- [ ] Documents have `processingStatus: "pending"`
- [ ] Case relationships preserved (documents reference correct cases)
- [ ] No critical errors in `migrationResult.errors`
- [ ] GCS files visible in Google Cloud Console
- [ ] File sizes reasonable (check GCS console)

## Step 6: Test Document Processing (Optional)

If you have the document processor service running:

### 6.1 Check Processing Trigger

The migration should have triggered document processing. Check logs:

```bash
# In document processor service logs
# Should see: "Processing request received for document: <documentId>"
```

### 6.2 Monitor Processing Status

```typescript
// Wait a few seconds/minutes depending on file size
const docs = await ctx.db
  .query("documents")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

docs.forEach(doc => {
  console.log(`Document ${doc._id}:`, doc.processingStatus);
  // Status should progress: pending → processing → completed
});
```

## Step 7: Error Handling Tests

### 7.1 Test Missing Download URL

Create a test with a document that has no download URL:
- Should be skipped
- Should appear in `migrationResult.errors`

### 7.2 Test Orphaned Document

Create a test with a document referencing a non-existent case:
- Should be skipped
- Should appear in `migrationResult.errors`

### 7.3 Test Invalid File URL

Create a test with an invalid Firebase URL:
- Should fail gracefully
- Should appear in `migrationResult.errors`

## Step 8: Cleanup Test Data (Optional)

After testing, you may want to clean up the test migration:

```typescript
// Delete migrated cases
const casesToDelete = await ctx.db
  .query("cases")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

for (const c of casesToDelete) {
  await ctx.db.delete(c._id);
}

// Delete migrated clients
const clientsToDelete = await ctx.db
  .query("clients")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

for (const c of clientsToDelete) {
  await ctx.db.delete(c._id);
}

// Delete migrated documents
const docsToDelete = await ctx.db
  .query("documents")
  .withIndex("by_created_by", (q) => q.eq("createdBy", testUser._id))
  .collect();

for (const d of docsToDelete) {
  await ctx.db.delete(d._id);
}

// Reset migration status
await ctx.runMutation(
  internal.migrations.updateMigrationStatus,
  { userId: testUser._id, status: "pending" }
);
```

## Common Issues & Solutions

### Issue: "No migration metadata found"
**Solution:** Ensure the user has migration metadata from Phase 1. Run Phase 1 migration first.

### Issue: "Firebase authentication error"
**Solution:** Verify FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL are correct.

### Issue: File upload fails with "Permission denied"
**Solution:** Check GCS bucket permissions. Service account needs write access.

### Issue: Document processor not receiving requests
**Solution:** 
- Verify DOCUMENT_PROCESSOR_URL is correct
- Ensure document processor service is running
- Check network connectivity

### Issue: Files not appearing in GCS
**Solution:**
- Check GCS bucket name is correct
- Verify service account has storage.objects.create permission
- Check GCS console for error logs

### Issue: High error count
**Solution:**
- Review `migrationResult.errors` array
- Check for common patterns (missing URLs, invalid data)
- Fix data in Firestore if needed
- Re-run migration

## Success Criteria

Migration test is successful when:

✅ Migration completes without throwing errors
✅ Migration status changes to "completed"
✅ Case count matches Firestore
✅ Client count matches Firestore
✅ Document count is reasonable (some may be skipped if no URL)
✅ Files uploaded to GCS successfully
✅ Document processor triggered (if service running)
✅ Error count < 5% of total items
✅ No data corruption in Convex
✅ Relationships preserved

## Next Steps

After successful testing:

1. ✅ Test passed - ready for Phase 3 implementation
2. Document any issues encountered
3. Plan Phase 3: User consent flow
4. Prepare for production rollout
5. Monitor first few production migrations closely

## Notes

- Test with multiple users of different data sizes
- Test with users who have no data (should handle gracefully)
- Test with users who have large files (check timeout handling)
- Consider implementing progress tracking for long migrations
- Plan for retry mechanism for failed migrations

---

**Testing Status**: Ready to Test

**Last Updated**: October 28, 2025

**Prerequisites**: Phase 1 complete, dependencies installed, environment configured

