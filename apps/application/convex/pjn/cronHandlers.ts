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
    successful: number;
    failed: number;
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

    // Sync each user (in parallel with limit)
    const syncPromises = accounts.map((account: {
      accountId: string;
      userId: Id<"users">;
      username: string;
      lastSyncedAt: number | undefined;
      lastEventId: string | undefined;
      needsReauth: boolean | undefined;
    }) =>
      ctx.runAction(internal.pjn.sync.syncNotificationsForUser, {
        userId: account.userId,
      }).catch((error) => {
        console.error(`[PJN Cron] Sync failed for user ${account.userId}:`, error);
        return { error: error instanceof Error ? error.message : String(error) };
      })
    );

    const results = await Promise.allSettled(syncPromises);

    const successful = results.filter((r) => r.status === "fulfilled" && !("error" in r.value)).length;
    const failed = results.length - successful;

    console.log(`[PJN Cron] Sync completed: ${successful} successful, ${failed} failed`);

    return {
      total: accounts.length,
      successful,
      failed,
    };
  },
});

