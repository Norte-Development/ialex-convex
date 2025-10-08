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
import { DocumentHeader, DocumentFooter } from "./extensions/header-footer";
import { Pagination } from "tiptap-pagination-breaks";

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
  // Header and Footer extensions
  DocumentHeader,
  DocumentFooter,
  // Pagination extension - automatic page breaks
  Pagination.configure({
    pageHeight: 1056, // A4 height in pixels (approx 29.7cm)
    pageWidth: 816, // A4 width in pixels (approx 21cm)
    pageMargin: 96, // 1 inch margin
    label: "Página",
    showPageNumber: true,
  }),
];
