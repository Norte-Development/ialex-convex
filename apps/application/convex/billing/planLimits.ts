/**
 * Plan Limits and Feature Flags
 * 
 * Defines the limits and features available for each subscription tier.
 * Used by the billing/features.ts module to enforce access control.
 * 
 * TEAM OWNERSHIP LIMITS:
 * - Free: No teams allowed (0 teams)
 * - Premium Individual ($30k): Can create 1 team, limited to 3 members
 * - Premium Team ($200k): Can create 1 team, with 6 members + GPT-5 for all
 * 
 * Examples:
 * - Solo lawyer: $30k/month (premium_individual, 1 team)
 * - Small firm (1 team, 3 people): $30k/month  
 * - Growing firm (1 team, 6 people): $30k + $200k = $230k/month
 */

export const PLAN_LIMITS = {
  free: {
    cases: 2,
    documentsPerCase: 10,
    aiMessagesPerMonth: 50,
    escritosPerCase: 3,
    libraryDocuments: 5,
    storageGB: 0.5,
    teamsAllowed: 0, // Cannot create teams
    teamMembers: 0,
    features: {
      createTeam: false,
      gpt5: false,
      teamLibrary: false,
    },
  },
  premium_individual: {
    cases: Infinity,
    documentsPerCase: Infinity,
    aiMessagesPerMonth: Infinity,
    escritosPerCase: Infinity,
    libraryDocuments: 500,
    storageGB: 50,
    teamsAllowed: 1, // Can create 1 team
    teamMembers: 3, // But each team limited to 3 members
    features: {
      createTeam: true, // Unlocks team creation
      gpt5: true, // Owner gets GPT-5 (members don't)
      teamLibrary: true, // Owner can use team library
    },
  },
  premium_team: {
    cases: Infinity,
    documentsPerCase: Infinity,
    aiMessagesPerMonth: Infinity,
    escritosPerCase: Infinity,
    libraryDocuments: 1000,
    storageGB: 200,
    teamsAllowed: 1, // Can create 1 team
    teamMembers: 6, // Each subscribed team gets 6 members
    features: {
      createTeam: true,
      gpt5: true, // ALL team members get GPT-5
      teamLibrary: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

export type FeatureName = 
  | "create_case"
  | "upload_document"
  | "ai_message"
  | "create_escrito"
  | "create_team"
  | "gpt5_access"
  | "team_library";

export type UsageCounter =
  | "casesCount"
  | "documentsCount"
  | "aiMessagesThisMonth"
  | "escritosCount"
  | "libraryDocumentsCount"
  | "storageUsedBytes";

