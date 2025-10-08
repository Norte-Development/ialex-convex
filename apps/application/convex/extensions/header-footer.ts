import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Extension for document headers (server-side version)
 */
export const DocumentHeader = Node.create({
  name: "documentHeader",

  group: "block",

  content: "block+",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="document-header"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "document-header",
        class: "document-header",
      }),
      0,
    ];
  },
});

/**
 * Extension for document footers (server-side version)
 */
export const DocumentFooter = Node.create({
  name: "documentFooter",

  group: "block",

  content: "block+",

  parseHTML() {
    return [
      {
        tag: 'div[data-type="document-footer"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "document-footer",
        class: "document-footer",
      }),
      0,
    ];
  },
});
