import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import Link from "@tiptap/extension-link";
// @ts-ignore - No types available for tiptap-extension-margin
import { InlineChange, BlockChange, LineBreakChange } from "./changeNodes";
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import { getSchema } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";

export function buildServerSchema(): Schema {
  const extensions = [
    StarterKit.configure({
      horizontalRule: false,
    }),
    TextStyle,
    InlineChange,
    BlockChange,
    LineBreakChange,
    LineHeight,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      protocols: ["http", "https"],
    }),
    Color,
    FontFamily.configure({
      types: ["textStyle"],
    }),
    FontSize.configure({
      types: ["textStyle"],
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Underline,

    // Image extension
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: "editor-image",
      },
    }),
    // Table extensions
    Table.configure({
      resizable: true,
      allowTableNodeSelection: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ];
  return getSchema(extensions);
}
