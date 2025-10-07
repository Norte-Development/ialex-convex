"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { generateJSON } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "../../../../packages/shared/src/tiptap/changeNodes";

/**
 * Parse HTML into TipTap JSON using Node-only @tiptap/html/server.
 * Returns the JSON as a string to satisfy Convex validators.
 */
export const parseHtmlToTiptapJson = internalAction({
  args: { html: v.string() },
  returns: v.string(),
  handler: async (ctx, { html }) => {
    const extensions = [
      StarterKit.configure({ horizontalRule: false }),
      TextStyle,
      InlineChange,
      BlockChange,
      LineBreakChange,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      // Table extensions
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ];

    const json = generateJSON(html, extensions);
    return JSON.stringify(json);
  },
});
