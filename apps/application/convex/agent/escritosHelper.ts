/**
 * Helper functions for editing Escritos with text-based operations.
 * Provides efficient mapping between plain text offsets and ProseMirror positions.
 */

export type TextRange = {
  textStart: number;
  textEnd: number;
  pmStart: number;
  pmEnd: number;
};

/**
 * Extract plain text from ProseMirror JSON and build mapping ranges
 * from text offsets → ProseMirror positions.
 */
export function extractTextWithMapping(content: any): {
  text: string;
  ranges: TextRange[];
} {
  let text = "";
  const ranges: TextRange[] = [];

  // Parse when content is a JSON string
  let root = content;
  if (typeof root === "string") {
    try {
      root = JSON.parse(root);
    } catch {
      return { text: "", ranges: [] };
    }
  }

  function walk(
    node: any,
    pos: number,
    textOffset: number
  ): { pos: number; textOffset: number } {
    if (!node) return { pos, textOffset };

    if (Array.isArray(node)) {
      for (const child of node) {
        ({ pos, textOffset } = walk(child, pos, textOffset));
      }
      return { pos, textOffset };
    }

    // Text nodes
    if (node.type === "text" && typeof node.text === "string") {
      const startOffset = textOffset;
      const startPos = pos;
      text += node.text;
      textOffset += node.text.length;
      const endPos = pos + node.text.length;
      
      ranges.push({
        textStart: startOffset,
        textEnd: textOffset,
        pmStart: startPos,
        pmEnd: endPos,
      });
      
      return { pos: endPos, textOffset };
    }

    // Treat hard/line breaks as a newline in plain text
    if (node.type === "hardBreak" || node.type === "lineBreak") {
      const startOffset = textOffset;
      const startPos = pos;
      text += "\n";
      textOffset += 1;
      const endPos = pos + 1;
      
      ranges.push({
        textStart: startOffset,
        textEnd: textOffset,
        pmStart: startPos,
        pmEnd: endPos,
      });
      
      return { pos: endPos, textOffset };
    }

    // Container nodes
    if (node.content) {
      pos += 1; // opening token
      for (const child of node.content) {
        ({ pos, textOffset } = walk(child, pos, textOffset));
      }
      pos += 1; // closing token
      return { pos, textOffset };
    }

    // Leaf non-text node: contributes to PM position but not to plain text
    if (node.type) {
      pos += 1; // Most leaf nodes are just one position
      // Special cases for nodes that take 2 positions could go here
    }
    
    return { pos, textOffset };
  }

  walk(root, 1, 0); // Start at position 1 (after document opening)
  return { text, ranges };
}

/**
 * Map a plain-text offset to a ProseMirror position using binary search.
 */
export function mapOffsetToPM(offset: number, ranges: TextRange[]): number {
  // Handle edge case: offset 0 maps to first range start
  if (offset === 0 && ranges.length > 0) {
    return ranges[0].pmStart;
  }
  
  let lo = 0,
    hi = ranges.length - 1;
    
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    
    if (offset < r.textStart) {
      hi = mid - 1;
    } else if (offset > r.textEnd) { // Changed from >= to >
      lo = mid + 1;
    } else {
      // offset is within [r.textStart, r.textEnd]
      if (offset === r.textEnd && mid < ranges.length - 1) {
        // If we're at the exact end and there's a next range, 
        // check if the next range starts at the same text position
        const nextRange = ranges[mid + 1];
        if (nextRange.textStart === offset) {
          return nextRange.pmStart;
        }
      }
      return r.pmStart + (offset - r.textStart);
    }
  }
  
  // If not found, try to handle boundary cases
  if (ranges.length > 0) {
    const lastRange = ranges[ranges.length - 1];
    if (offset === lastRange.textEnd) {
      return lastRange.pmEnd;
    }
  }
  
  throw new Error(`Offset ${offset} not found in mapping. Available ranges: ${JSON.stringify(ranges.map(r => ({textStart: r.textStart, textEnd: r.textEnd})))}`);
}
/**
 * Find all matches of a string in text, with optional context.
 */
export function findTextMatches(
  text: string,
  searchText: string,
  contextBefore?: string,
  contextAfter?: string
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  let index = 0;

  while (true) {
    const matchIndex = text.indexOf(searchText, index);
    if (matchIndex === -1) break;

    const start = matchIndex;
    const end = matchIndex + searchText.length;

    let contextMatches = true;

    if (contextBefore) {
      const beforeStart = Math.max(0, start - contextBefore.length);
      const beforeText = text.slice(beforeStart, start);
      if (!beforeText.includes(contextBefore)) {
        contextMatches = false;
      }
    }

    if (contextAfter && contextMatches) {
      const afterText = text.slice(end, end + contextAfter.length);
      if (!afterText.includes(contextAfter)) {
        contextMatches = false;
      }
    }

    if (contextMatches) {
      matches.push({ start, end });
    }

    index = end;
  }

  return matches;
}

/**
 * Process a single edit request and return ProseMirror operations.
 */
export function processEditWithMapping(
  edit: any,
  currentText: string,
  ranges: TextRange[]
): { operations: any[]; updatedText: string; error?: string } {
  const operations: any[] = [];
  let updatedText = currentText;

  switch (edit.type) {
    case "replace": {
      const matches = findTextMatches(
        currentText,
        edit.findText,
        edit.contextBefore,
        edit.contextAfter
      );

      if (matches.length === 0) {
        return {
          operations: [],
          updatedText,
          error: `Text "${edit.findText}" not found`,
        };
      }

      const matchesToProcess = edit.replaceAll ? matches : [matches[0]];
      matchesToProcess.reverse().forEach((m) => {
        // For replace_range, we need to map the exact text boundaries
        const from = mapOffsetToPM(m.start, ranges);
        const to = mapOffsetToPM(m.end, ranges); // Use m.end directly, not m.end - 1

        operations.push({
          type: "replace_range",
          from,
          to,
          text: edit.replaceText,
        });

        updatedText =
          updatedText.slice(0, m.start) +
          edit.replaceText +
          updatedText.slice(m.end);
      });
      break;
    }

    case "insert": {
      let insertPos = 0;
      let insertOffset = 0; // text offset in plain text

      if (edit.afterText) {
        const matches = findTextMatches(currentText, edit.afterText);
        if (matches.length === 0) {
          return {
            operations: [],
            updatedText,
            error: `Text "${edit.afterText}" not found`,
          };
        }
        insertOffset = matches[0].end; // after the match in plain text
        insertPos = mapOffsetToPM(insertOffset - 1, ranges) + 1; // PM pos after last char
      } else if (edit.beforeText) {
        const matches = findTextMatches(currentText, edit.beforeText);
        if (matches.length === 0) {
          return {
            operations: [],
            updatedText,
            error: `Text "${edit.beforeText}" not found`,
          };
        }
        insertOffset = matches[0].start; // before the match in plain text
        insertPos = mapOffsetToPM(insertOffset, ranges); // PM pos at first char
      } else {
        insertOffset = 0;
        insertPos = 0;
      }

      operations.push({
        type: "insert_text",
        pos: insertPos,
        text: edit.insertText,
      });

      // Update simulated text using TEXT offset, not PM position
      updatedText =
        updatedText.slice(0, insertOffset) +
        edit.insertText +
        updatedText.slice(insertOffset);
      break;
    }

    case "delete": {
      const matches = findTextMatches(
        currentText,
        edit.deleteText,
        edit.contextBefore,
        edit.contextAfter
      );
      if (matches.length === 0) {
        return {
          operations: [],
          updatedText,
          error: `Text "${edit.deleteText}" not found`,
        };
      }
      if (matches.length > 1) {
        return {
          operations: [],
          updatedText,
          error: `Multiple matches for "${edit.deleteText}". Add context.`,
        };
      }

      const m = matches[0];
      const from = mapOffsetToPM(m.start, ranges);
      const to = mapOffsetToPM(m.end - 1, ranges) + 1;

      operations.push({
        type: "delete_text",
        from,
        to,
        text: "",
      });

      updatedText = updatedText.slice(0, m.start) + updatedText.slice(m.end);
      break;
    }
  }

  return { operations, updatedText };
}