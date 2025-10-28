/**
 * Migration Constants
 * 
 * This file contains all the constants needed for the Kinde to Clerk migration.
 * Update these values according to your environment configuration.
 * 
 * Note: This file doesn't need "use node" - it's just constants that will be
 * imported by action files that have "use node".
 */

// ================================
// CLERK CONFIGURATION
// ================================

/**
 * Clerk Secret Key
 * Get this from: https://dashboard.clerk.com/
 * Navigate to: API Keys → Secret Keys
 */
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || "";

/**
 * Clerk Publishable Key
 * Get this from: https://dashboard.clerk.com/
 * Navigate to: API Keys → Publishable Keys
 */
export const CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

// ================================
// KINDE CONFIGURATION
// ================================

/**
 * Kinde Domain
 * Get this from: Kinde Settings → Details
 * Format: yourbusiness.kinde.com (without https://)
 */
export const KINDE_DOMAIN = process.env.KINDE_DOMAIN || "";

/**
 * Kinde M2M Client ID
 * Get this from: Kinde Settings → Applications → Create M2M Application
 * Navigate to: APIs → Select your API → Applications
 */
export const KINDE_M2M_CLIENT_ID = process.env.KINDE_M2M_CLIENT_ID || "";

/**
 * Kinde M2M Client Secret
 * Get this from: Kinde Settings → Applications → Your M2M App → Credentials
 */
export const KINDE_M2M_CLIENT_SECRET = process.env.KINDE_M2M_CLIENT_SECRET || "";

// ================================
// FIREBASE CONFIGURATION
// ================================

/**
 * Firebase Project ID
 * Get this from: Firebase Console → Project Settings → General
 */
export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";

/**
 * Firebase Service Account Email
 * Get this from: Firebase Console → Project Settings → Service Accounts
 * Generate a new private key if you don't have one
 */
export const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";

/**
 * Firebase Private Key
 * Get this from: Firebase Console → Project Settings → Service Accounts
 * Generate a new private key if you don't have one
 * Note: This should be the full private key including BEGIN/END markers
 */
export const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || "";

// ================================
// GOOGLE CLOUD STORAGE CONFIGURATION
// ================================

/**
 * Google Cloud Storage Bucket Name
 * Get this from: Google Cloud Console → Cloud Storage → Browser
 * Format: your-bucket-name (without gs:// prefix)
 */
export const GCS_BUCKET = process.env.GCS_BUCKET || "";

/**
 * GCS Service Account Email
 * Usually the same as Firebase, but can be different
 */
export const GCS_SERVICE_ACCOUNT_EMAIL = process.env.GCS_SERVICE_ACCOUNT_EMAIL || FIREBASE_CLIENT_EMAIL;

/**
 * GCS Private Key
 * Usually the same as Firebase, but can be different
 */
export const GCS_PRIVATE_KEY = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n') || FIREBASE_PRIVATE_KEY;

// ================================
// MIGRATION CONFIGURATION
// ================================

/**
 * Frontend URL
 * The base URL of your frontend application
 * Used for generating migration consent URLs in emails
 */
export const FRONTEND_URL = process.env.VITE_APP_URL || process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Migration Batch Size
 * Number of users to process in each batch during bulk migration
 * Lower values reduce memory usage but increase execution time
 */
export const MIGRATION_BATCH_SIZE = 50;

/**
 * Migration Test Limit
 * Number of users to use for test migrations
 * Keep this small (5-10) for initial testing
 */
export const MIGRATION_TEST_LIMIT = 5;

/**
 * Migration Retry Attempts
 * Number of times to retry a failed migration before marking it as failed
 */
export const MIGRATION_RETRY_ATTEMPTS = 3;

/**
 * Migration Retry Delay (ms)
 * Delay between retry attempts in milliseconds
 */
export const MIGRATION_RETRY_DELAY = 2000;

// ================================
// PHASE 2: DATA MIGRATION CONFIGURATION
// ================================

/**
 * Document Processor URL
 * URL of the document processing service
 */
export const DOCUMENT_PROCESSOR_URL = process.env.DOCUMENT_PROCESSOR_URL || "http://localhost:3001";

/**
 * Phase 2 Batch Size
 * Number of documents to process in each batch
 */
export const PHASE_2_BATCH_SIZE = 50;

/**
 * File Download Timeout (ms)
 * Timeout for downloading files from Firebase Storage
 */
export const FILE_DOWNLOAD_TIMEOUT_MS = 30000;

/**
 * Max File Size (bytes)
 * Maximum file size for migration (100MB)
 */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * GCS Upload Retry Attempts
 * Number of times to retry a failed GCS upload
 */
export const GCS_UPLOAD_RETRY_ATTEMPTS = 3;

// ================================
// FIRESTORE COLLECTIONS
// ================================

/**
 * Firestore collection names for old Kinde data
 */
export const FIRESTORE_COLLECTIONS = {
  USERS: "users",
  CASES: "cases", 
  DOCUMENTS: "documents",
  CLIENTS: "clients",
  FOLDERS: "folders",
  ESCRITOS: "escritos",
  TEAMS: "teams",
  SUBSCRIPTIONS: "subscriptions",
} as const;

// ================================
// MIGRATION STATUS
// ================================

/**
 * Migration status values
 */
export const MIGRATION_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

// ================================
// EMAIL TEMPLATES
// ================================

/**
 * Email template configuration
 */
export const EMAIL_TEMPLATES = {
  MIGRATION_ANNOUNCEMENT: "migration-announcement",
  MIGRATION_CONSENT_REMINDER: "migration-consent-reminder",
  MIGRATION_COMPLETE: "migration-complete",
  MIGRATION_FAILED: "migration-failed",
} as const;

// ================================
// CONFLICT RESOLUTION STRATEGIES
// ================================

/**
 * Strategies for handling email conflicts
 */
export const CONFLICT_RESOLUTION_STRATEGIES = {
  MERGE: "merge",
  ALTERNATIVE_EMAIL: "alternative_email",
  SKIP: "skip",
} as const;

// ================================
// VALIDATION
// ================================

/**
 * Validates that all required environment variables are set
 * Call this before running migrations
 */
export function validateMigrationEnvironment(): {
  isValid: boolean;
  missingVars: string[];
} {
  const requiredVars = [
    { name: "CLERK_SECRET_KEY", value: CLERK_SECRET_KEY },
    { name: "KINDE_DOMAIN", value: KINDE_DOMAIN },
    { name: "KINDE_M2M_CLIENT_ID", value: KINDE_M2M_CLIENT_ID },
    { name: "KINDE_M2M_CLIENT_SECRET", value: KINDE_M2M_CLIENT_SECRET },
    { name: "FIREBASE_PROJECT_ID", value: FIREBASE_PROJECT_ID },
    { name: "FIREBASE_CLIENT_EMAIL", value: FIREBASE_CLIENT_EMAIL },
    { name: "FIREBASE_PRIVATE_KEY", value: FIREBASE_PRIVATE_KEY },
    { name: "GCS_BUCKET", value: GCS_BUCKET },
  ];

  const missingVars = requiredVars
    .filter((v) => !v.value || v.value === "")
    .map((v) => v.name);

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Logs the current configuration (without sensitive data)
 */
export function logMigrationConfig() {
  console.log("Migration Configuration:");
  console.log("- Frontend URL:", FRONTEND_URL);
  console.log("- Kinde Domain:", KINDE_DOMAIN);
  console.log("- Firebase Project:", FIREBASE_PROJECT_ID);
  console.log("- GCS Bucket:", GCS_BUCKET);
  console.log("- Batch Size:", MIGRATION_BATCH_SIZE);
  console.log("- Test Limit:", MIGRATION_TEST_LIMIT);
  console.log("- Clerk Key Set:", !!CLERK_SECRET_KEY);
  console.log("- Kinde M2M Credentials Set:", !!KINDE_M2M_CLIENT_ID && !!KINDE_M2M_CLIENT_SECRET);
  console.log("- Firebase Key Set:", !!FIREBASE_PRIVATE_KEY);
}

