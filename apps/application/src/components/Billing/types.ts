import { Id } from "@/../../convex/_generated/dataModel";

/**
 * Billing Types and Interfaces
 * Foundation types for the billing UI system
 */

export type PlanType = "free" | "premium_individual" | "premium_team";

export type LimitType = 
  | "cases" 
  | "documentsPerCase" 
  | "escritosPerCase" 
  | "libraryDocuments" 
  | "storage";

export type FeatureName = 
  | "create_case" 
  | "upload_document" 
  | "ai_message" 
  | "create_escrito" 
  | "create_team" 
  | "gpt5_access" 
  | "team_library";

export interface BillingLimitResult {
  allowed: boolean;
  reason?: string;
  isWarning: boolean;
  percentage: number;
  currentCount?: number;
  limit?: number;
}

export interface UsageLimits {
  casesCount: number;
  documentsCount: number;
  aiMessagesThisMonth: number;
  escritosCount: number;
  libraryDocumentsCount: number;
  storageUsedBytes: number;
  lastResetDate: number;
  currentMonthStart: number;
}

export interface PlanLimits {
  cases: number;
  documentsPerCase: number;
  aiMessagesPerMonth: number;
  escritosPerCase: number;
  libraryDocuments: number;
  storageGB: number;
  teamMembers: number;
  teamsAllowed: number;
  features: {
    createTeam: boolean;
    gpt5: boolean;
    teamLibrary: boolean;
  };
}

export interface BillingContextData {
  userId?: Id<"users">;
  teamId?: Id<"teams">;
}

