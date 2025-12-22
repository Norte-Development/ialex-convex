/**
 * Media attachment types shared by HomeAgent components.
 */

export type HomeAgentMediaKind = "image" | "pdf";

export interface HomeAgentMediaRef {
  url: string;
  gcsBucket: string;
  gcsObject: string;
  contentType: string;
  filename: string;
  size: number;
  kind: HomeAgentMediaKind;
}

/**
 * Frontend limit (must match backend MAX_HOME_MEDIA_SIZE_BYTES value).
 */
export const HOME_AGENT_MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB
