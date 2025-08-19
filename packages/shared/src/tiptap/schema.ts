import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {TextStyle} from "@tiptap/extension-text-style";
import { InlineChange, BlockChange, LineBreakChange } from "./changeNodes";
import { getSchema } from "@tiptap/core";

export function buildServerSchema() {
  const extensions = [
    StarterKit,
    TextStyle,
    InlineChange,
    BlockChange,
    LineBreakChange,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Underline,
  ];
  return getSchema(extensions);
}


