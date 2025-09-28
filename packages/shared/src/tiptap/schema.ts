import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {TextStyle} from "@tiptap/extension-text-style";
import { InlineChange, BlockChange, LineBreakChange } from "./changeNodes";
import { getSchema } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";

// Export the extensions array so it can be reused
export const getServerExtensions = () => [
  StarterKit.configure({
    horizontalRule: false,
  }),
  TextStyle,
  InlineChange,
  BlockChange,
  LineBreakChange,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  // Note: TrackingExtension is client-side only and doesn't affect schema
];

export function buildServerSchema(): Schema {
  const extensions = getServerExtensions();
  return getSchema(extensions);
}


