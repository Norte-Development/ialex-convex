import { isWholeWord, normalizeAndBuildMaps, NormalizationOptions, normalizeQuery } from "./textNormalization";
import { 
  DIFF_CONFIG, 
  searchLog, 
  truncateForLog 
} from "../../../../../../packages/shared/src/diff/constants";

export type SearchOptions = NormalizationOptions & {
  wholeWord?: boolean;
  contextBefore?: string;
  contextAfter?: string;
  contextWindow?: number; // characters around match to check context
};

type DocIndex = {
  normalizedText: string;
  normToPmPos: number[]; // for each normalized char index → PM position
};

// Build a normalized text index from a ProseMirror doc with mapping back to PM positions
export function buildDocIndex(doc: any, options?: SearchOptions): DocIndex {
  const opts = { contextWindow: DIFF_CONFIG.CONTEXT_WINDOW_DEFAULT, ...options } as Required<SearchOptions>;

  // Collect raw text and PM positions for each raw character
  const rawChars: string[] = [];
  const rawPmPos: number[] = []; // parallel to rawChars

  // Helper to check if a node is a block-level node
  function isBlockNode(node: any): boolean {
    if (!node.type) return false;
    const blockTypes = ["paragraph", "heading", "blockquote", "listItem", "codeBlock"];
    return blockTypes.includes(node.type.name);
  }

  // Track the last block node position and whether it had text
  let lastBlockPos: number | null = null;
  let lastBlockHadText = false;

  // Process nodes and add separators between consecutive blocks
  doc.descendants((node: any, pos: number) => {
    // Handle change nodes - skip deleted ones, but process added ones
    if (node.type && (node.type.name === "inlineChange" || node.type.name === "blockChange" || node.type.name === "lineBreakChange")) {
      const changeType = node.attrs?.changeType;
      if (changeType === "deleted") {
        return false; // Skip this node and its children entirely
      }
      // For added/modified change nodes, continue processing their children
      return true;
    }

    // Check if this is a block node (at the start of a block)
    if (isBlockNode(node)) {
      // Add separator if previous block had text content
      if (lastBlockPos !== null && lastBlockHadText && rawChars.length > 0) {
        // Check if last char is not already a newline
        if (rawChars[rawChars.length - 1] !== "\n") {
          rawChars.push("\n");
          rawPmPos.push(pos - 1);
        }
      }
      // Reset tracking for this new block
      lastBlockPos = pos;
      lastBlockHadText = false;
      // Continue to process children
      return true;
    }

    if (node.isText) {
      const text = node.text || "";
      if (text.length > 0) {
        // Mark that current block has text
        if (lastBlockPos !== null) {
          lastBlockHadText = true;
        }
        for (let i = 0; i < text.length; i++) {
          rawChars.push(text[i]);
          rawPmPos.push(pos + i);
        }
      }
    } else if (node.type && node.type.name === "hardBreak") {
      rawChars.push("\n");
      rawPmPos.push(pos);
    }
    
    return true; // Continue traversing
  });

  const raw = rawChars.join("");
  // Normalize the raw text but do NOT collapse whitespace to preserve PM mapping for now
  const normMaps = normalizeAndBuildMaps(raw, {
    caseInsensitive: opts.caseInsensitive,
    normalizeWhitespace: false,
    unifyNbsp: opts.unifyNbsp,
    removeSoftHyphen: opts.removeSoftHyphen,
    removeZeroWidth: opts.removeZeroWidth,
    normalizeQuotesAndDashes: opts.normalizeQuotesAndDashes,
    unicodeForm: opts.unicodeForm,
  });

  const normToPmPos: number[] = new Array(normMaps.normalizedText.length);
  for (let i = 0; i < normMaps.normalizedText.length; i++) {
    const origIndex = normMaps.normToOrig[i];
    normToPmPos[i] = rawPmPos[Math.max(0, Math.min(origIndex, rawPmPos.length - 1))];
  }

  return { normalizedText: normMaps.normalizedText, normToPmPos };
}

export type NormalizedMatch = {
  normStart: number;
  normEnd: number;
  from: number; // PM pos inclusive
  to: number;   // PM pos exclusive
};

export function findMatches(
  docIndex: DocIndex,
  query: string,
  options?: SearchOptions,
): NormalizedMatch[] {
  const opts = { contextWindow: DIFF_CONFIG.CONTEXT_WINDOW_DEFAULT, ...options } as Required<SearchOptions>;
  
  // Collapse whitespace in the document text (normalizeWhitespace: true)
  // This allows matching regardless of \n vs \n\n differences
  const collapsedDocMaps = normalizeAndBuildMaps(docIndex.normalizedText, {
    ...opts,
    normalizeWhitespace: true, // Collapse consecutive whitespace to single space
  });
  const text = collapsedDocMaps.normalizedText; // Collapsed document text
  // Map: collapsed index -> original normalized index (in docIndex.normalizedText)
  const collapsedToNorm = collapsedDocMaps.normToOrig;

  // Collapse whitespace in the query the same way
  const qMaps = normalizeAndBuildMaps(query, {
    ...opts,
    normalizeWhitespace: true, // Collapse consecutive whitespace to single space
  });
  const q = qMaps.normalizedText;
  if (!q) return [];

  const matches: NormalizedMatch[] = [];

  searchLog(`  [findMatches] Searching for: "${truncateForLog(q)}" (len: ${q.length})`);
  // console.log(`  [findMatches] Collapsed document length: ${text.length}, Query length: ${q.length}`);
  
  let start = 0;
  let matchCount = 0;
  while (start <= text.length - q.length) {
    const idx = text.indexOf(q, start);
    if (idx === -1) break;

    matchCount++;
    // console.log(`  [findMatches] Potential match #${matchCount} found at collapsed position ${idx}`);
    
    const end = idx + q.length;

    if (opts.wholeWord && !isWholeWord(text, idx, end)) {
      // console.log(`    ❌ Whole word check FAILED - rejecting match`);
      start = idx + 1;
      continue;
    }
    // console.log(`    ✅ Whole word check passed (or disabled)`);

    // Context checks on collapsed text
    if (opts.contextBefore) {
      const beforeSlice = text.slice(Math.max(0, idx - opts.contextWindow), idx);
      const normalizedContextBefore = normalizeAndBuildMaps(opts.contextBefore, {
        ...opts,
        normalizeWhitespace: true,
      }).normalizedText;
      // console.log(`    [Context Before Check]`);
      // console.log(`      Raw context: "${opts.contextBefore}"`);
      // console.log(`      Normalized (collapsed) context: "${normalizedContextBefore}"`);
      // console.log(`      Before slice (${opts.contextWindow} chars): "${beforeSlice}"`);
      // console.log(`      Contains? ${beforeSlice.includes(normalizedContextBefore)}`);
      if (!beforeSlice.includes(normalizedContextBefore)) {
        // console.log(`      ❌ Context before check FAILED - rejecting match`);
        start = idx + 1;
        continue;
      }
      // console.log(`      ✅ Context before check PASSED`);
    }
    if (opts.contextAfter) {
      const afterSlice = text.slice(end, Math.min(text.length, end + opts.contextWindow));
      const normalizedContextAfter = normalizeAndBuildMaps(opts.contextAfter, {
        ...opts,
        normalizeWhitespace: true,
      }).normalizedText;
      // console.log(`    [Context After Check]`);
      // console.log(`      Raw context: "${opts.contextAfter}"`);
      // console.log(`      Normalized (collapsed) context: "${normalizedContextAfter}"`);
      // console.log(`      After slice (${opts.contextWindow} chars): "${afterSlice}"`);
      // console.log(`      Contains? ${afterSlice.includes(normalizedContextAfter)}`);
      if (!afterSlice.includes(normalizedContextAfter)) {
        // console.log(`      ❌ Context after check FAILED - rejecting match`);
        start = idx + 1;
        continue;
      }
      // console.log(`      ✅ Context after check PASSED`);
    }

    // Map collapsed indices -> original normalized indices -> PM positions
    // Use the mapping from collapsed text back to original normalized text
    const normStart = collapsedToNorm[idx];
    const normEnd = collapsedToNorm[Math.max(idx, end - 1)] + 1; // +1 to make exclusive

    // Map to PM positions using the original normalized indices
    const fromPos = docIndex.normToPmPos[normStart];
    const lastCharPos = docIndex.normToPmPos[Math.max(normStart, normEnd - 1)];
    const toPos = lastCharPos + 1;
    // console.log(`    ✅✅ MATCH ACCEPTED - Adding to results (PM pos: ${fromPos} to ${toPos})`);
    matches.push({ normStart, normEnd, from: fromPos, to: toPos });

    start = idx + 1;
  }

  // console.log(`  [findMatches] Total matches found: ${matches.length}`);
  return matches;
}

/**
 * Finds matches for large text blocks by matching start and end segments (fuzzy matching).
 * Used when exact matching fails for large blocks.
 */
export function findLargeBlockMatches(
  docIndex: DocIndex,
  query: string,
  options?: SearchOptions
): NormalizedMatch[] {
  // Only use this for large queries
  if (query.length < DIFF_CONFIG.FUZZY_MIN_QUERY_LENGTH) return [];

  const HEAD_TAIL_LENGTH = DIFF_CONFIG.FUZZY_HEAD_TAIL_LENGTH;
  
  const opts = { contextWindow: DIFF_CONFIG.CONTEXT_WINDOW_DEFAULT, ...options } as Required<SearchOptions>;
  
  // Normalize the full query to get the head and tail
  // We need normalized text to slice properly
  const qMaps = normalizeAndBuildMaps(query, {
    ...opts,
    normalizeWhitespace: true,
  });
  const q = qMaps.normalizedText;
  
  if (q.length < HEAD_TAIL_LENGTH * 2) return [];

  const head = q.slice(0, HEAD_TAIL_LENGTH);
  const tail = q.slice(-HEAD_TAIL_LENGTH);

  searchLog(`  [findLargeBlockMatches] Attempting fuzzy block match`);
  searchLog(`    Head: "${truncateForLog(head)}..."`);
  searchLog(`    Tail: "...${truncateForLog(tail)}"`);

  // Find matches for head and tail
  // Pass contexts to head/tail searches appropriately
  // Head gets contextBefore
  const headMatches = findMatches(docIndex, head, { 
    ...opts, 
    contextBefore: opts.contextBefore, 
    contextAfter: undefined 
  });
  
  // Tail gets contextAfter
  const tailMatches = findMatches(docIndex, tail, { 
    ...opts, 
    contextBefore: undefined, 
    contextAfter: opts.contextAfter 
  });

  searchLog(`    Head matches: ${headMatches.length}, Tail matches: ${tailMatches.length}`);

  const matches: NormalizedMatch[] = [];

  // Look for valid pairs
  for (const h of headMatches) {
    for (const t of tailMatches) {
      // Tail must start after head starts
      if (t.normStart > h.normStart) {
        // Calculate distance
        const dist = t.normEnd - h.normStart;
        const expectedLen = q.length;
        const diff = Math.abs(dist - expectedLen);
        
        // Allow configurable length variation for edits in the middle
        // This handles cases where the AI modified the content significantly but kept start/end
        if (diff < expectedLen * DIFF_CONFIG.FUZZY_TOLERANCE_PERCENT) {
             searchLog(`    ✅ Fuzzy Match Pair Found: Head(${h.from}) -> Tail(${t.to})`);
             matches.push({
               normStart: h.normStart,
               normEnd: t.normEnd,
               from: h.from,
               to: t.to
             });
        }
      }
    }
  }

  return matches;
}

export function selectByOccurrence<T>(
  all: T[],
  occurrenceIndex?: number,
  maxOccurrences?: number,
  replaceAll?: boolean,
): T[] {
  if (occurrenceIndex !== undefined) {
    const idx = occurrenceIndex - 1;
    return idx >= 0 && idx < all.length ? [all[idx]] : [];
  }
  if (maxOccurrences !== undefined) {
    return all.slice(0, Math.max(0, maxOccurrences));
  }
  if (replaceAll) return all;
  return all.length ? [all[0]] : [];
}

export function findAnchorPosition(
  docIndex: DocIndex,
  opts: { afterText?: string; beforeText?: string; occurrenceIndex?: number },
  searchOpts?: SearchOptions,
): number | null {
  if (opts.afterText) {
    const m = findMatches(docIndex, opts.afterText, searchOpts);
    if (!m.length) return null;
    const choice = selectByOccurrence(m, opts.occurrenceIndex, undefined, false);
    if (!choice.length) return null;
    return choice[0].to;
  }
  if (opts.beforeText) {
    const m = findMatches(docIndex, opts.beforeText, searchOpts);
    if (!m.length) return null;
    const choice = selectByOccurrence(m, opts.occurrenceIndex, undefined, false);
    if (!choice.length) return null;
    return choice[0].from;
  }
  return null;
}
