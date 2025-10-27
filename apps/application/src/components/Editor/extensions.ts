// components/editor/extensions.ts
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Extension } from "@tiptap/core";
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "../../../../../packages/shared/src/tiptap/changeNodes";
import { TrackingExtension } from "./extensions/tracking";

// Custom extension to add line-height support to paragraphs
const LineHeight = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.lineHeight || null,
            renderHTML: (attributes: { lineHeight?: string }) => {
              if (!attributes.lineHeight) {
                return {};
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands }: any) => {
          return commands.updateAttributes("paragraph", { lineHeight });
        },
      unsetLineHeight:
        () =>
        ({ commands }: any) => {
          return commands.resetAttributes("paragraph", "lineHeight");
        },
    };
  },
});

export const extensions = [
  StarterKit.configure({
    horizontalRule: false,
  }),
  TextStyle,
  LineHeight, // Add line-height support
  InlineChange,
  BlockChange,
  LineBreakChange,
  TrackingExtension,
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
