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
import {
  InlineChange,
  BlockChange,
  LineBreakChange,
} from "../../../../../packages/shared/src/tiptap/changeNodes";
import { TrackingExtension } from "./extensions/tracking";
import { PaginationPlus } from "tiptap-pagination-plus";

export const extensions = [
  StarterKit.configure({ horizontalRule: false }),
  TextStyle,
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
  // Pagination extension - Complete pagination solution
  PaginationPlus.configure({
    pageHeight: 1056, // A4 height in pixels (29.7cm)
    pageWidth: 816, // A4 width in pixels (21cm)
    pageGap: 50, // Gap between pages in pixels
    pageGapBorderSize: 1, // Border size for page gaps
    pageGapBorderColor: "#e5e5e5", // Border color for page gaps
    pageBreakBackground: "#ffffff", // Background color for page gaps
    pageHeaderHeight: 40, // Height of page header in pixels
    pageFooterHeight: 40, // Height of page footer in pixels
    footerRight: "Página {page}", // Page numbers in footer
    footerLeft: "", // Custom text for footer left
    headerRight: "", // Custom text for header right
    headerLeft: "", // Custom text for header left
    marginTop: 96, // Top margin (1 inch)
    marginBottom: 96, // Bottom margin (1 inch)
    marginLeft: 96, // Left margin (1 inch)
    marginRight: 96, // Right margin (1 inch)
    contentMarginTop: 10, // Top margin for content within pages
    contentMarginBottom: 10, // Bottom margin for content within pages
  }),
];
