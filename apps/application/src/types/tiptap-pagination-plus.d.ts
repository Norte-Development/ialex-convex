declare module "tiptap-pagination-plus" {
  import { Extension } from "@tiptap/core";

  export interface PaginationPlusOptions {
    pageHeight?: number;
    pageWidth?: number;
    pageGap?: number;
    pageGapBorderSize?: number;
    pageGapBorderColor?: string;
    pageBreakBackground?: string;
    pageHeaderHeight?: number;
    pageFooterHeight?: number;
    footerRight?: string;
    footerLeft?: string;
    headerRight?: string;
    headerLeft?: string;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    contentMarginTop?: number;
    contentMarginBottom?: number;
  }

  export const PaginationPlus: Extension<PaginationPlusOptions>;

  export const PAGE_SIZES: {
    A4: { width: number; height: number };
    Letter: { width: number; height: number };
    Legal: { width: number; height: number };
  };
}
