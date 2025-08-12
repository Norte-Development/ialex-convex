import { components } from "./_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

const syncApi = prosemirrorSync.syncApi({
  checkRead(ctx, id) {
    // Validate that the user can read this document
    // You can implement your authorization logic here
  },

  checkWrite(ctx, id) {
    // Validate that the user can write to this document
    // You can implement your authorization logic here
  },

  async onSnapshot(ctx, id, snapshot, version) {
    // Handle document snapshots - you can store copies, generate search indexes, etc.
    // This is optional but useful for additional processing
  },
});

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = syncApi;

export default syncApi;
