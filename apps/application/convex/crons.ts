import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Sync PJN notifications every 15 minutes
 */
crons.interval(
  "sync-pjn-notifications",
  {
    minutes: 15,
  },
  internal.pjn.cronHandlers.syncAllUsers
);

export default crons;
