import "dotenv/config";

/**
 * Configuration for PJN scraper microservice
 */
export const config = {
  // Server
  port: parseInt(process.env.PORT || "4002", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Local development / testing
  // When true, PJN session state will be stored on the local filesystem
  // instead of Google Cloud Storage. This is useful for running the
  // scraper locally without GCP credentials.
  useLocalSessionStore:
    process.env.USE_LOCAL_SESSION_STORE === "true" ||
    process.env.NODE_ENV === "test",

  // PJN API & Portal
  pjnApiBaseUrl: process.env.PJN_API_BASE_URL || "https://api.pjn.gov.ar",
  pjnEventsEndpoint: "/eventos",
  pjnPdfEndpoint: "/eventos/{eventId}/pdf",
  // Base URLs for the PJN SSO realm and portal UI
  pjnSsoBaseUrl:
    process.env.PJN_SSO_BASE_URL || "https://sso.pjn.gov.ar/auth/realms/pjn",
  pjnPortalBaseUrl:
    process.env.PJN_PORTAL_BASE_URL || "https://portalpjn.pjn.gov.ar",
  // Full SSO auth URL used to initiate the login flow
  pjnSsoAuthUrl:
    process.env.PJN_SSO_AUTH_URL ||
    "https://sso.pjn.gov.ar/auth/realms/pjn/protocol/openid-connect/auth?client_id=pjn-portal&redirect_uri=https%3A%2F%2Fportalpjn.pjn.gov.ar%2F&response_mode=fragment&response_type=code&scope=openid",

  // GCS Configuration
  gcsSessionsBucket: process.env.GCS_PJN_SESSIONS_BUCKET || "ialex-pjn-sessions",
  gcsDocumentsBucket: process.env.GCS_PJN_DOCUMENTS_BUCKET || process.env.GCS_BUCKET || "ialex-pjn-documents",
  gcsSignerClientEmail: process.env.GCS_SIGNER_CLIENT_EMAIL || "",
  gcsSignerPrivateKey: process.env.GCS_SIGNER_PRIVATE_KEY || "",

  // Document Processor
  documentProcessorUrl:
    process.env.DOCUMENT_PROCESSOR_URL || "http://localhost:4001",
  documentProcessorEndpoint: "/process-document",

  // Service-to-service auth
  serviceAuthSecret: process.env.EXPEDIENTES_SCRAPER_SECRET || "",

  // Scraping settings
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || "1000", 10),
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10),
  eventsPageSize: parseInt(process.env.EVENTS_PAGE_SIZE || "20", 10),
  maxPagesPerSync: parseInt(process.env.MAX_PAGES_PER_SYNC || "100", 10),

  // Session settings
  sessionFileName: "session_state.json",
} as const;

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required = [
    { key: "GCS_PJN_SESSIONS_BUCKET", value: config.gcsSessionsBucket },
    { key: "GCS_PJN_DOCUMENTS_BUCKET or GCS_BUCKET", value: config.gcsDocumentsBucket },
  ];

  // Only require GCS credentials when not using local session store
  if (!config.useLocalSessionStore) {
    required.push(
      { key: "GCS_SIGNER_CLIENT_EMAIL", value: config.gcsSignerClientEmail },
      { key: "GCS_SIGNER_PRIVATE_KEY", value: config.gcsSignerPrivateKey }
    );
  }

  // Require service auth secret in all non-test environments
  if (config.nodeEnv !== "test") {
    required.push({
      key: "EXPEDIENTES_SCRAPER_SECRET",
      value: config.serviceAuthSecret,
    });
  }

  const missing = required.filter(({ value }) => !value);
  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.map((m) => m.key).join(", ")}`
    );
  }
}

