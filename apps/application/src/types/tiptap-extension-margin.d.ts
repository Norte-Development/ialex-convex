declare module "tiptap-extension-margin" {
  import { Extension } from "@tiptap/core";

  export interface MarginOptions {
    types?: string[];
  }

  export interface MarginAttributes {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  }

  const Margin: Extension<MarginOptions>;
  export default Margin;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    margin: {
      /**
       * Set margins for the current selection
       */
      setMargin: (margins: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
      }) => ReturnType;
      /**
       * Unset margins for the current selection
       */
      unsetMargin: () => ReturnType;
    };
  }
}
