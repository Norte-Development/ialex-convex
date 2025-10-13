import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const sendNotificationIfEnabled = internalMutation({
  args: {
    userId: v.id("users"),
    notificationType: v.union(
      v.literal("caseUpdate"),
      v.literal("documentProcessing"),
      v.literal("teamInvitation"),
      v.literal("agentResponse")
    ),
    subject: v.string(),
    htmlBody: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      console.log(`User not found: ${args.userId}`);
      return null;
    }

    const prefs = user.preferences;
    
    // Check if email notifications are enabled globally
    if (!prefs?.emailNotifications) {
      console.log(`Email notifications disabled for user: ${user.email}`);
      return null;
    }

    // Check specific notification type preference
    const typeMap = {
      caseUpdate: prefs.caseUpdates,
      documentProcessing: prefs.documentProcessing,
      teamInvitation: prefs.teamInvitations,
      agentResponse: prefs.agentResponses,
    };

    if (typeMap[args.notificationType] === false) {
      console.log(`${args.notificationType} notifications disabled for user: ${user.email}`);
      return null;
    }

    // Send the email
    try {
      await ctx.runMutation(internal.utils.resend.sendEmail, {
        from: "iAlex <notificaciones@ialex.com.ar>",
        to: user.email,
        subject: args.subject,
        body: args.htmlBody,
      });
      console.log(`Notification sent to ${user.email}: ${args.subject}`);
    } catch (error) {
      console.error(`Error sending notification to ${user.email}:`, error);
    }

    return null;
  },
});

