/**
 * Plan Limits and Feature Flags (Frontend Copy)
 * 
 * Defines the limits and features available for each subscription tier.
 * This is a frontend copy of the backend plan limits for UI display purposes.
 * 
 * HYBRID MODEL (Option 3):
 * - Free: No teams allowed
 * - Premium Individual ($30k): Can create unlimited teams, each limited to 3 members
 * - Premium Team ($200k): Per-team subscription for 6 members + GPT-5 for all
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
    libraryDocuments: 100,
    storageGB: 50,
    teamsAllowed: Infinity, // Can create unlimited teams
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
    libraryDocuments: 200,
    storageGB: 200,
    teamsAllowed: Infinity, // Can create unlimited teams
    teamMembers: 6, // Each subscribed team gets 6 members
    features: {
      createTeam: true,
      gpt5: true, // ALL team members get GPT-5
      teamLibrary: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

