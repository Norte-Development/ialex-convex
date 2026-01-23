import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Cron handler: Sync notifications for all active users
 */
export const syncAllUsers = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    total: number;
    scheduled: number;
  }> => {
    console.log("[PJN Cron] Starting sync for all users");

    // Get all active accounts
    const accounts: Array<{
      accountId: string;
      userId: Id<"users">;
      username: string;
      lastSyncedAt: number | undefined;
      lastEventId: string | undefined;
      needsReauth: boolean | undefined;
    }> = await ctx.runQuery(internal.pjn.accounts.listActiveAccounts);

    console.log(`[PJN Cron] Found ${accounts.length} active accounts`);

    // Enqueue a sync action for each user instead of running them all inside this action.
    // We spread them over a 15 minute window to avoid a single huge burst of scraper traffic.
    const intervalMs = 15 * 60 * 1000;

    let scheduled = 0;

    for (const account of accounts) {
      const jitterMs = Math.floor(Math.random() * intervalMs);
      try {
        await ctx.scheduler.runAfter(
          jitterMs,
          internal.pjn.sync.syncNotificationsForUser,
          {
            userId: account.userId,
          },
        );
        scheduled += 1;
      } catch (error) {
        console.error(
          `[PJN Cron] Failed to schedule sync for user ${account.userId}:`,
          error,
        );
      }
    }

    console.log(
      `[PJN Cron] Enqueued sync for ${scheduled}/${accounts.length} users over next 15 minutes`,
    );

    return {
      total: accounts.length,
      scheduled,
    };
  },
});

