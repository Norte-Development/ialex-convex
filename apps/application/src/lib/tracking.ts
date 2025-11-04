import { clarity } from "../clarity";
import posthog from "posthog-js";

/**
 * Centralized tracking helper for Phase 1 events
 * Tracks: Auth, Onboarding, CRUD, Billing, AI Chat, Errors
 * Dual tracking: Clarity + PostHog
 */
export const tracking = {
  // ========================================
  // AUTHENTICATION & ONBOARDING
  // ========================================
  
  /** User signup - track when new user signs up */
  signup: (data: { trial?: boolean }) => {
    clarity.event("user_signup", { trial: data.trial || false });
    posthog.capture("user_signup", { trial: data.trial || false });
  },

  /** User login */
  login: () => {
    clarity.event("user_login");
    posthog.capture("user_login");
  },

  /** Onboarding started */
  onboardingStarted: () => {
    clarity.event("onboarding_started");
    posthog.capture("onboarding_started");
  },

  /** Onboarding step completed */
  onboardingStepCompleted: (step: number) => {
    clarity.event("onboarding_step_completed", { step });
    posthog.capture("onboarding_step_completed", { step });
  },

  /** Onboarding completed */
  onboardingCompleted: () => {
    clarity.event("onboarding_completed");
    posthog.capture("onboarding_completed");
  },

  // ========================================
  // CORE CRUD OPERATIONS
  // ========================================

  /** Case created */
  caseCreated: (data: {
    caseId: string;
    category?: string;
    priority: string;
    status: string;
  }) => {
    clarity.event("case_created", {
      caseId: data.caseId,
      category: data.category || null,
      priority: data.priority,
      status: data.status,
    });
    posthog.capture("case_created", {
      caseId: data.caseId,
      category: data.category || null,
      priority: data.priority,
      status: data.status,
    });
  },

  /** Client created */
  clientCreated: (data: {
    clientId: string;
    clientType: "individual" | "company";
  }) => {
    clarity.event("client_created", {
      clientId: data.clientId,
      clientType: data.clientType,
    });
    posthog.capture("client_created", {
      clientId: data.clientId,
      clientType: data.clientType,
    });
  },

  /** Document uploaded */
  documentUploaded: (data: {
    documentId: string;
    type?: string;
    fileSize: number;
    mimeType: string;
    caseId: string;
  }) => {
    clarity.event("document_uploaded", {
      documentId: data.documentId,
      type: data.type || null,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      caseId: data.caseId,
    });
    posthog.capture("document_uploaded", {
      documentId: data.documentId,
      type: data.type || null,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      caseId: data.caseId,
    });
  },

  /** Document upload failed */
  documentUploadFailed: (data: {
    errorType: string;
    fileSize: number;
  }) => {
    clarity.event("document_upload_failed", {
      errorType: data.errorType,
      fileSize: data.fileSize,
    });
    posthog.capture("document_upload_failed", {
      errorType: data.errorType,
      fileSize: data.fileSize,
    });
  },

  /** Escrito created (NOT autosave) */
  escritoCreated: (data: {
    escritoId: string;
    caseId: string;
  }) => {
    clarity.event("escrito_created", {
      escritoId: data.escritoId,
      caseId: data.caseId,
    });
    posthog.capture("escrito_created", {
      escritoId: data.escritoId,
      caseId: data.caseId,
    });
  },

  // ========================================
  // BILLING & SUBSCRIPTIONS
  // ========================================

  /** Trial started */
  trialStarted: (plan: string) => {
    clarity.event("trial_started", { plan });
    posthog.capture("trial_started", { plan });
  },

  /** Subscription created */
  subscriptionCreated: (data: {
    plan: string;
    billingCycle: string;
  }) => {
    clarity.event("subscription_created", {
      plan: data.plan,
      billingCycle: data.billingCycle,
    });
    posthog.capture("subscription_created", {
      plan: data.plan,
      billingCycle: data.billingCycle,
    });
  },

  /** Billing limit reached */
  billingLimitReached: (data: {
    limitType: string;
  }) => {
    clarity.event("billing_limit_reached", {
      limitType: data.limitType,
    });
    posthog.capture("billing_limit_reached", {
      limitType: data.limitType,
    });
  },

  // ========================================
  // AI CHAT INTERACTIONS
  // ========================================

  /** AI chat started */
  aiChatStarted: (data: {
    threadId: string;
    context: "home" | "case";
    caseId?: string;
  }) => {
    clarity.event("ai_chat_started", {
      threadId: data.threadId,
      context: data.context,
      caseId: data.caseId || null,
    });
    posthog.capture("ai_chat_started", {
      threadId: data.threadId,
      context: data.context,
      caseId: data.caseId || null,
    });
  },

  /** AI message sent */
  aiMessageSent: (data: {
    threadId: string;
    messageLength: number;
    hasReferences: boolean;
  }) => {
    clarity.event("ai_message_sent", {
      threadId: data.threadId,
      messageLength: data.messageLength,
      hasReferences: data.hasReferences,
    });
    posthog.capture("ai_message_sent", {
      threadId: data.threadId,
      messageLength: data.messageLength,
      hasReferences: data.hasReferences,
    });
  },

  /** AI chat aborted */
  aiChatAborted: (data: { threadId: string }) => {
    clarity.event("ai_chat_aborted", {
      threadId: data.threadId,
    });
    posthog.capture("ai_chat_aborted", {
      threadId: data.threadId,
    });
  },

  /** AI error */
  aiError: (data: { errorType: string; threadId?: string }) => {
    clarity.event("ai_error", {
      errorType: data.errorType,
      threadId: data.threadId || null,
    });
    posthog.capture("ai_error", {
      errorType: data.errorType,
      threadId: data.threadId || null,
    });
  },

  // ========================================
  // ERROR TRACKING
  // ========================================

  /** Error boundary triggered */
  errorBoundary: (errorType: string) => {
    clarity.event("error_boundary_triggered", { errorType });
    posthog.capture("error_boundary_triggered", { errorType });
  },

  /** Chunk load error */
  chunkLoadError: () => {
    clarity.event("chunk_load_error");
    posthog.capture("chunk_load_error");
  },

  /** API error */
  apiError: (data: {
    endpoint: string;
    statusCode?: number;
  }) => {
    clarity.event("api_error", {
      endpoint: data.endpoint,
      statusCode: data.statusCode || null,
    });
    posthog.capture("api_error", {
      endpoint: data.endpoint,
      statusCode: data.statusCode || null,
    });
  },
};

