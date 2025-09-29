import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import {TextStyle} from "@tiptap/extension-text-style";
import { InlineChange, BlockChange, LineBreakChange } from "./changeNodes";
import { getSchema } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { Node } from "@tiptap/core";

// Custom node to handle unknown HTML elements
const UnknownElement = Node.create({
  name: "unknownElement",
  
  group: "inline",
  inline: true,
  
  addAttributes() {
    return {
      tag: {
        default: "span",
      },
      attributes: {
        default: {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "*",
        getAttrs: (dom) => {
          // Only match elements that don't have a specific node type
          const tagName = (dom as HTMLElement).tagName.toLowerCase();
          const knownTags = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "li", "strong", "em", "code", "pre", "br", "a", "img", "span", "div"];
          
          if (knownTags.includes(tagName)) {
            return false; // Don't parse known tags
          }
          
          return {
            tag: tagName,
            attributes: Array.from((dom as HTMLElement).attributes).reduce((acc, attr) => {
              acc[attr.name] = attr.value;
              return acc;
            }, {} as Record<string, string>),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tag = HTMLAttributes.tag || "span";
    return [tag, HTMLAttributes.attributes || {}, 0];
  },
});

// Export the extensions array so it can be reused
export const getServerExtensions = () => [
  StarterKit.configure({
    horizontalRule: false,
    // Disable underline from StarterKit since we're adding it explicitly
    underline: false,
  }),
  TextStyle,
  InlineChange,
  BlockChange,
  LineBreakChange,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Underline,
  // Note: UnknownElement removed from server extensions to avoid HTML generation issues
  // Note: TrackingExtension is client-side only and doesn't affect schema
];

export function buildServerSchema(): Schema {
  const extensions = getServerExtensions();
  return getSchema(extensions);
}


