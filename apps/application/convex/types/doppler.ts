/**
 * Type definitions for Doppler Marketing Lists API integration
 */

/**
 * Doppler list ID (numeric string or number)
 */
export type DopplerListId = string | number;

/**
 * Doppler subscriber field value
 * Represents a custom field attached to a subscriber
 */
export interface DopplerFieldValue {
  /** Field name (0-50 chars, alphanumeric, underscores, hyphens, and ñ/Ñ) */
  name: string;
  /** Field value (0-400 chars) */
  value: string;
  /** Whether this is a predefined field */
  predefined?: boolean;
}

/**
 * Subscriber data for adding to a Doppler list
 */
export interface DopplerSubscriber {
  /** Email address (required, 0-100 chars) */
  email: string;
  /** Custom fields attached to the subscriber */
  fields?: DopplerFieldValue[];
}

/**
 * Success response from Doppler API
 */
export interface DopplerSuccessResponse {
  /** Response status */
  status: string;
  /** Optional message */
  message?: string;
}

/**
 * Error response from Doppler API
 */
export interface DopplerErrorResponse {
  /** Error code or type */
  error?: string;
  /** Error message */
  message: string;
}

/**
 * Result of adding a subscriber to a list
 */
export interface AddSubscriberResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Response data if successful */
  data?: DopplerSuccessResponse;
}

/**
 * Doppler list information
 */
export interface DopplerList {
  /** List ID */
  id: number;
  /** List name */
  name: string;
  /** List state (active/inactive) */
  state?: string;
  /** Number of subscribers */
  subscribersCount?: number;
}

/**
 * Collection page response from Doppler API
 */
export interface DopplerCollectionPage<T> {
  /** Array of items */
  items: T[];
  /** Current page number */
  page: number;
  /** Items per page */
  perPage: number;
  /** Total number of items */
  total: number;
}

/**
 * Result of fetching available lists
 */
export interface GetListsResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** List of available lists */
  lists?: DopplerList[];
}

