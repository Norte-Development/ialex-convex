declare module "tiptap-pagination-breaks" {
  import { Extension } from "@tiptap/core";

  export interface PaginationOptions {
    pageHeight?: number;
    pageWidth?: number;
    pageMargin?: number;
    label?: string;
    showPageNumber?: boolean;
  }

  export const Pagination: Extension<PaginationOptions>;
}
