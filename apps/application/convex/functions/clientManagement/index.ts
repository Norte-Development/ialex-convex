/**
 * Client Management Module Index
 *
 * Re-exports all client management related functions and validators.
 */

// Helper functions
export {
  normalizeText,
  fuzzyMatch,
  getAccessibleCaseIds,
  batchFetchClientCases,
  computeDisplayName,
  normalizeClient,
} from "./clientHelpers";

// Validators
export { clientValidator, clientCaseValidator } from "./clientValidators";
