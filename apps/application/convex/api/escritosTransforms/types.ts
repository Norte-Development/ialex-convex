import { v } from "convex/values";

/**
 * Validators for text-based edit operations
 */

export const markTypeValidator = v.union(
  v.literal("bold"),
  v.literal("italic"),
  v.literal("code"),
  v.literal("strike"),
  v.literal("underline"),
);

export const paragraphTypeValidator = v.union(
  v.literal("paragraph"),
  v.literal("heading"),
  v.literal("blockquote"),
  v.literal("bulletList"),
  v.literal("orderedList"),
  v.literal("codeBlock"),
);

export const replaceEditValidator = v.object({
  type: v.literal("replace"),
  findText: v.string(),
  replaceText: v.string(),
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
  replaceAll: v.optional(v.boolean()),
  occurrenceIndex: v.optional(v.number()),
  maxOccurrences: v.optional(v.number()),
});

export const insertEditValidator = v.object({
  type: v.literal("insert"),
  insertText: v.string(),
  afterText: v.optional(v.string()),
  beforeText: v.optional(v.string()),
});

export const addMarkEditValidator = v.object({
  type: v.literal("add_mark"),
  text: v.string(),
  markType: markTypeValidator,
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
  occurrenceIndex: v.optional(v.number()),
  maxOccurrences: v.optional(v.number()),
});

export const removeMarkEditValidator = v.object({
  type: v.literal("remove_mark"),
  text: v.string(),
  markType: markTypeValidator,
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
  occurrenceIndex: v.optional(v.number()),
  maxOccurrences: v.optional(v.number()),
});

export const replaceMarkEditValidator = v.object({
  type: v.literal("replace_mark"),
  text: v.string(),
  oldMarkType: markTypeValidator,
  newMarkType: markTypeValidator,
  contextBefore: v.optional(v.string()),
  contextAfter: v.optional(v.string()),
  occurrenceIndex: v.optional(v.number()),
  maxOccurrences: v.optional(v.number()),
});

export const addParagraphEditValidator = v.object({
  type: v.literal("add_paragraph"),
  content: v.string(),
  paragraphType: paragraphTypeValidator,
  headingLevel: v.optional(v.number()),
  afterText: v.optional(v.string()),
  beforeText: v.optional(v.string()),
  occurrenceIndex: v.optional(v.number()),
});

export const textBasedEditValidator = v.union(
  replaceEditValidator,
  insertEditValidator,
  addMarkEditValidator,
  removeMarkEditValidator,
  replaceMarkEditValidator,
  addParagraphEditValidator,
);
