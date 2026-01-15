import { applyJsonDelta as applyJsonDeltaWithHandler } from "./portals/deltaApplier";
import { handleArrayDelta } from "./portals/arrayChanges";

export { processJsonDiffDelta } from "./portals/deltaProcessor";
export { handleValueDelta } from "./portals/deltaValueHandlers";
export { handleArrayDelta } from "./portals/arrayChanges";

export function applyJsonDelta(
  newNode: any,
  oldNode: any,
  delta: any,
  changeId: string,
  path: string[] = []
): void {
  applyJsonDeltaWithHandler(newNode, oldNode, delta, changeId, path, handleArrayDelta);
}


