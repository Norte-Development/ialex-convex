import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentHeader: {
      setHeader: (content?: string) => ReturnType;
      toggleHeader: () => ReturnType;
    };
    documentFooter: {
      setFooter: (content?: string) => ReturnType;
      toggleFooter: () => ReturnType;
    };
  }
}

/**
 * Extension for document headers
 * Headers appear at the top of each page and can contain text, images, page numbers, etc.
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

  addCommands() {
    return {
      setHeader:
        (content?: string) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            content: content
              ? [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: content }],
                  },
                ]
              : [{ type: "paragraph" }],
          });
        },
      toggleHeader:
        () =>
        ({ state, commands }: any) => {
          // Check if header exists
          let hasHeader = false;
          state.doc.descendants((node: any) => {
            if (node.type.name === this.name) {
              hasHeader = true;
              return false;
            }
          });

          if (hasHeader) {
            // Remove header
            return commands.command(({ tr, state }: any) => {
              let headerPos = -1;
              let headerSize = 0;

              state.doc.descendants((node: any, pos: number) => {
                if (node.type.name === this.name) {
                  headerPos = pos;
                  headerSize = node.nodeSize;
                  return false;
                }
              });

              if (headerPos >= 0) {
                tr.delete(headerPos, headerPos + headerSize);
                return true;
              }
              return false;
            });
          } else {
            // Add header at the beginning
            return commands.insertContentAt(0, {
              type: this.name,
              content: [{ type: "paragraph" }],
            });
          }
        },
    };
  },
});

/**
 * Extension for document footers
 * Footers appear at the bottom of each page and can contain text, page numbers, dates, etc.
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

  addCommands() {
    return {
      setFooter:
        (content?: string) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: this.name,
            content: content
              ? [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: content }],
                  },
                ]
              : [{ type: "paragraph" }],
          });
        },
      toggleFooter:
        () =>
        ({ state, commands }: any) => {
          // Check if footer exists
          let hasFooter = false;
          state.doc.descendants((node: any) => {
            if (node.type.name === this.name) {
              hasFooter = true;
              return false;
            }
          });

          if (hasFooter) {
            // Remove footer
            return commands.command(({ tr, state }: any) => {
              let footerPos = -1;
              let footerSize = 0;

              state.doc.descendants((node: any, pos: number) => {
                if (node.type.name === this.name) {
                  footerPos = pos;
                  footerSize = node.nodeSize;
                  return false;
                }
              });

              if (footerPos >= 0) {
                tr.delete(footerPos, footerPos + footerSize);
                return true;
              }
              return false;
            });
          } else {
            // Add footer at the end
            const endPos = state.doc.content.size;
            return commands.insertContentAt(endPos, {
              type: this.name,
              content: [{ type: "paragraph" }],
            });
          }
        },
    };
  },
});
