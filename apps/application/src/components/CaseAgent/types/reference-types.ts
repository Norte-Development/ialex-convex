/**
 * Reference Types
 *
 * This file contains type definitions for reference-related functionality used in the Agent components.
 */

/**
 * Base reference interface used across components
 */
export interface Reference {
  type: string;
  id: string;
  name: string;
  preview?: string;
}

/**
 * Extended reference interface with original text for context display
 */
export interface ReferenceWithOriginal extends Reference {
  originalText: string;
}

/**
 * Props for the ReferenceAutocomplete component
 */
export interface ReferenceAutocompleteProps {
  input: string;
  cursorPosition: number;
  onSelectReference: (reference: Reference, startPos: number, endPos: number) => void;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Parsed reference from @ mention parsing
 */
export interface ParsedAtReference {
  type: "client" | "document" | "escrito" | "case" | null;
  query: string;
  startPos: number;
  endPos: number;
  isComplete: boolean; // true if type is specified (e.g., @client:)
}

/**
 * Reference type union for type safety
 */
export type ReferenceType = "client" | "document" | "escrito" | "case";

/**
 * Reference arrays used in components
 */
export type ReferenceArray = Array<Reference>;
export type ReferenceWithOriginalArray = Array<ReferenceWithOriginal>;
