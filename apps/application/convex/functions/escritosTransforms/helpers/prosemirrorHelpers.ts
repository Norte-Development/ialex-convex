/**
 * ProseMirror helper functions for creating and manipulating content
 */

/**
 * Create text content that properly handles newlines
 * Returns proper ProseMirror nodes, never raw strings
 * Returns null for empty strings to avoid creating empty text nodes
 */
export function createTextContent(
  schema: any,
  content: string
): any | any[] | null {
  // Empty content should not create a text node (ProseMirror doesn't allow empty text nodes)
  if (content.length === 0) {
    return null;
  }

  if (!content.includes("\n")) {
    return schema.text(content);
  }

  // Handle multiline content by creating explicit nodes
  const parts = content.split(/\n/);
  const nodes: any[] = [];

  parts.forEach((part, idx) => {
    if (part.length > 0) {
      nodes.push(schema.text(part));
    }
    if (idx < parts.length - 1) {
      // Insert a hard break explicitly for single newlines
      if (schema.nodes.hardBreak) {
        nodes.push(schema.nodes.hardBreak.create());
      } else {
        // Fallback: use a space if hardBreak is not available
        nodes.push(schema.text(" "));
      }
    }
  });

  return nodes.length === 1 ? nodes[0] : nodes;
}

/**
 * Insert content properly based on its type (single node or array)
 */
export function insertContentProperly(
  tr: any,
  pos: number,
  content: any | any[]
): any {
  if (Array.isArray(content)) {
    return tr.insert(pos, content);
  } else {
    return tr.insert(pos, [content]);
  }
}

/**
 * Replace content properly based on its type (single node or array)
 */
export function replaceContentProperly(
  tr: any,
  from: number,
  to: number,
  content: any | any[]
): any {
  if (Array.isArray(content)) {
    return tr.replaceWith(from, to, content);
  } else {
    return tr.replaceWith(from, to, content);
  }
}

/**
 * Create a ProseMirror node of a specific type with content
 */
export function createNodeOfType(
  schema: any,
  type: string,
  content: any,
  headingLevel?: number
) {
  try {
    switch (type) {
      case "paragraph":
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          if (Array.isArray(textContent)) {
            return schema.nodes.paragraph.createAndFill({}, textContent);
          }
          return schema.nodes.paragraph.createAndFill({}, textContent);
        }
        return schema.nodes.paragraph.createAndFill({}, content);

      case "heading":
        const level =
          headingLevel && headingLevel >= 1 && headingLevel <= 6
            ? headingLevel
            : 1;
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          if (Array.isArray(textContent)) {
            return schema.nodes.heading.createAndFill({ level }, textContent);
          }
          return schema.nodes.heading.createAndFill({ level }, textContent);
        }
        return schema.nodes.heading.createAndFill({ level }, content);

      case "blockquote":
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          const paragraph = Array.isArray(textContent)
            ? schema.nodes.paragraph.createAndFill({}, textContent)
            : schema.nodes.paragraph.createAndFill({}, textContent);
          return schema.nodes.blockquote.createAndFill({}, paragraph);
        }
        return schema.nodes.blockquote.createAndFill({}, content);

      case "codeBlock":
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          if (Array.isArray(textContent)) {
            return schema.nodes.codeBlock.createAndFill({}, textContent);
          }
          return schema.nodes.codeBlock.createAndFill({}, textContent);
        }
        return schema.nodes.codeBlock.createAndFill({}, content);

      case "bulletList":
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          const paragraph = Array.isArray(textContent)
            ? schema.nodes.paragraph.createAndFill({}, textContent)
            : schema.nodes.paragraph.createAndFill({}, textContent);
          const listItem = schema.nodes.listItem.createAndFill({}, paragraph);
          return schema.nodes.bulletList.createAndFill({}, listItem);
        }
        return schema.nodes.bulletList.createAndFill({}, content);

      case "orderedList":
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          const paragraph = Array.isArray(textContent)
            ? schema.nodes.paragraph.createAndFill({}, textContent)
            : schema.nodes.paragraph.createAndFill({}, textContent);
          const listItem = schema.nodes.listItem.createAndFill({}, paragraph);
          return schema.nodes.orderedList.createAndFill({}, listItem);
        }
        return schema.nodes.orderedList.createAndFill({}, content);

      default:
        // Fallback to paragraph
        if (typeof content === "string") {
          const textContent = createTextContent(schema, content);
          if (Array.isArray(textContent)) {
            return schema.nodes.paragraph.createAndFill({}, textContent);
          }
          return schema.nodes.paragraph.createAndFill({}, textContent);
        }
        return schema.nodes.paragraph.createAndFill({}, content);
    }
  } catch (error) {
    console.error(`Error creating node of type ${type}:`, error);
    // Fallback to simple paragraph
    if (typeof content === "string") {
      const textContent = createTextContent(schema, content);
      if (Array.isArray(textContent)) {
        return schema.nodes.paragraph.createAndFill({}, textContent);
      }
      return schema.nodes.paragraph.createAndFill({}, textContent);
    }
    return schema.nodes.paragraph.createAndFill({}, content);
  }
}

/**
 * Build inline content from lightweight style tags: [b]..[/b], [i]..[/i], [u]..[/u], [code]..[/code]
 */
export function buildInlineFromStyledText(schema: any, text: string): any[] {
  const nodes: any[] = [];
  const tagRe = /\[(\/)?(b|i|u|code)\]/g;
  const markMap: Record<string, string> = {
    b: "bold",
    i: "italic",
    u: "underline",
    code: "code",
  } as const;
  let active: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  
  while ((m = tagRe.exec(text)) !== null) {
    const idx = m.index;
    if (idx > last) {
      const chunk = text.slice(last, idx);
      if (chunk) {
        const marks = active
          .map((t) => markMap[t])
          .map((name) => (schema.marks[name] ? schema.marks[name].create() : null))
          .filter(Boolean);
        nodes.push(schema.text(chunk, marks));
      }
    }
    const closing = !!m[1];
    const tag = m[2];
    if (closing) {
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i] === tag) {
          active.splice(i, 1);
          break;
        }
      }
    } else {
      active.push(tag);
    }
    last = tagRe.lastIndex;
  }
  
  if (last < text.length) {
    const chunk = text.slice(last);
    if (chunk) {
      const marks = active
        .map((t) => markMap[t])
        .map((name) => (schema.marks[name] ? schema.marks[name].create() : null))
        .filter(Boolean);
      nodes.push(schema.text(chunk, marks));
    }
  }
  
  return nodes;
}

/**
 * Build ProseMirror paragraph nodes from multiline text with inline styles
 */
export function createParagraphNodesFromText(
  schema: any,
  text: string
): any[] {
  const paragraphs = text.split(/\n{2,}/);
  const nodes: any[] = [];
  
  for (const p of paragraphs) {
    const content = (() => {
      if (!p.includes("\n")) return buildInlineFromStyledText(schema, p);
      const parts = p.split("\n");
      const seq: any[] = [];
      for (let i = 0; i < parts.length; i++) {
        const inline = buildInlineFromStyledText(schema, parts[i]);
        if (inline.length) seq.push(...inline);
        if (i < parts.length - 1) {
          // Use explicit hardBreak nodes for proper line break handling
          if (schema.nodes.hardBreak) {
            seq.push(schema.nodes.hardBreak.create());
          } else {
            // Fallback: use a space if hardBreak is not available
            seq.push(schema.text(" "));
          }
        }
      }
      return seq;
    })();
    const para = schema.nodes.paragraph.createAndFill({}, content);
    if (para) nodes.push(para);
  }
  
  if (!nodes.length)
    nodes.push(schema.nodes.paragraph.createAndFill({}, schema.text(""))!);
  
  return nodes;
}
