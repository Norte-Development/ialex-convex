import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Get comprehensive trial metrics for business analytics
 * 
 * @returns Trial metrics including active trials, conversions, conversion rates, and active user details
 */
export const getTrialMetrics = query({
  args: {},
  returns: v.object({
    active: v.number(),
    converted: v.number(),
    expired: v.number(),
    conversionRate: v.number(),
    activeUsers: v.array(v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      daysLeft: v.number(),
    })),
  }),
  handler: async (ctx) => {
    const activeTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "active"))
      .collect();

    const convertedTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "converted"))
      .collect();

    const expiredTrials = await ctx.db
      .query("users")
      .withIndex("by_trial_status", (q) => q.eq("trialStatus", "expired"))
      .collect();

    const now = Date.now();
    const activeUsers = activeTrials.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      daysLeft: Math.ceil((user.trialEndDate! - now) / (1000 * 60 * 60 * 24)),
    }));

    const totalTrials = convertedTrials.length + expiredTrials.length;
    const conversionRate = totalTrials > 0 
      ? (convertedTrials.length / totalTrials) * 100 
      : 0;

    return {
      active: activeTrials.length,
      converted: convertedTrials.length,
      expired: expiredTrials.length,
      conversionRate: Math.round(conversionRate * 100) / 100,
      activeUsers,
    };
  },
});

/**
 * Get detailed trial conversion funnel data
 * 
 * @returns Detailed breakdown of trial conversions over time
 */
export const getTrialConversionFunnel = query({
  args: {
    days: v.optional(v.number()), // Number of days to look back, default 30
  },
  returns: v.object({
    totalTrialsStarted: v.number(),
    totalTrialsEnded: v.number(),
    totalConversions: v.number(),
    conversionRate: v.number(),
    averageTrialDuration: v.number(),
    conversionsByDay: v.array(v.object({
      date: v.string(),
      trialsStarted: v.number(),
      trialsEnded: v.number(),
      conversions: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    // Get all users who started trials in the specified period
    const allUsers = await ctx.db
      .query("users")
      .filter((q) => q.gte(q.field("trialStartDate"), startDate))
      .collect();

    const trialUsers = allUsers.filter(user => user.trialStatus && user.trialStatus !== "none");
    
    // Calculate conversions
    const convertedUsers = trialUsers.filter(user => user.trialStatus === "converted");
    const expiredUsers = trialUsers.filter(user => user.trialStatus === "expired");
    
    // Calculate average trial duration for completed trials
    const completedTrials = trialUsers.filter(user => 
      user.trialStatus === "converted" || user.trialStatus === "expired"
    );
    
    const totalDuration = completedTrials.reduce((sum, user) => {
      if (user.trialStartDate && user.trialEndDate) {
        return sum + (user.trialEndDate - user.trialStartDate);
      }
      return sum;
    }, 0);
    
    const averageTrialDuration = completedTrials.length > 0 
      ? totalDuration / completedTrials.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    // Group by day (simplified - in production you might want more sophisticated date grouping)
    const conversionsByDay = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStart = date.getTime();
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);
      
      const trialsStarted = trialUsers.filter(user => 
        user.trialStartDate && user.trialStartDate >= dayStart && user.trialStartDate < dayEnd
      ).length;
      
      const trialsEnded = completedTrials.filter(user => 
        user.trialEndDate && user.trialEndDate >= dayStart && user.trialEndDate < dayEnd
      ).length;
      
      const conversions = convertedUsers.filter(user => 
        user.trialEndDate && user.trialEndDate >= dayStart && user.trialEndDate < dayEnd
      ).length;
      
      conversionsByDay.push({
        date: dateStr,
        trialsStarted,
        trialsEnded,
        conversions,
      });
    }

    const totalTrialsStarted = trialUsers.length;
    const totalTrialsEnded = convertedUsers.length + expiredUsers.length;
    const conversionRate = totalTrialsEnded > 0 
      ? (convertedUsers.length / totalTrialsEnded) * 100 
      : 0;

    return {
      totalTrialsStarted,
      totalTrialsEnded,
      totalConversions: convertedUsers.length,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageTrialDuration: Math.round(averageTrialDuration * 100) / 100,
      conversionsByDay: conversionsByDay.reverse(), // Most recent first
    };
  },
});

/**
 * Get trial performance by plan type
 * 
 * @returns Trial metrics broken down by trial plan (premium_individual vs premium_team)
 */
export const getTrialMetricsByPlan = query({
  args: {},
  returns: v.object({
    premiumIndividual: v.object({
      active: v.number(),
      converted: v.number(),
      expired: v.number(),
      conversionRate: v.number(),
    }),
    premiumTeam: v.object({
      active: v.number(),
      converted: v.number(),
      expired: v.number(),
      conversionRate: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const allTrialUsers = await ctx.db
      .query("users")
      .filter((q) => q.neq(q.field("trialStatus"), "none"))
      .collect();

    // Filter by plan type
    const individualUsers = allTrialUsers.filter(user => user.trialPlan === "premium_individual");
    const teamUsers = allTrialUsers.filter(user => user.trialPlan === "premium_team");

    // Calculate metrics for individual plan
    const individualActive = individualUsers.filter(user => user.trialStatus === "active").length;
    const individualConverted = individualUsers.filter(user => user.trialStatus === "converted").length;
    const individualExpired = individualUsers.filter(user => user.trialStatus === "expired").length;
    const individualTotal = individualConverted + individualExpired;
    const individualConversionRate = individualTotal > 0 
      ? (individualConverted / individualTotal) * 100 
      : 0;

    // Calculate metrics for team plan
    const teamActive = teamUsers.filter(user => user.trialStatus === "active").length;
    const teamConverted = teamUsers.filter(user => user.trialStatus === "converted").length;
    const teamExpired = teamUsers.filter(user => user.trialStatus === "expired").length;
    const teamTotal = teamConverted + teamExpired;
    const teamConversionRate = teamTotal > 0 
      ? (teamConverted / teamTotal) * 100 
      : 0;

    return {
      premiumIndividual: {
        active: individualActive,
        converted: individualConverted,
        expired: individualExpired,
        conversionRate: Math.round(individualConversionRate * 100) / 100,
      },
      premiumTeam: {
        active: teamActive,
        converted: teamConverted,
        expired: teamExpired,
        conversionRate: Math.round(teamConversionRate * 100) / 100,
      },
    };
  },
});
