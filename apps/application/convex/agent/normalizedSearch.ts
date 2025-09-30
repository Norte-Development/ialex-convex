import { isWholeWord, normalizeAndBuildMaps, NormalizationOptions, normalizeQuery } from "./textNormalization";

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
  const opts = { contextWindow: 50, ...options } as Required<SearchOptions>;

  // Collect raw text and PM positions for each raw character
  const rawChars: string[] = [];
  const rawPmPos: number[] = []; // parallel to rawChars

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

    if (node.isText) {
      const text = node.text || "";
      for (let i = 0; i < text.length; i++) {
        rawChars.push(text[i]);
        rawPmPos.push(pos + i);
      }
    } else if (node.type && node.type.name === "hardBreak") {
      rawChars.push("\n");
      rawPmPos.push(pos);
    }
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
  const opts = { contextWindow: 50, ...options } as Required<SearchOptions>;
  const q = normalizeQuery(query, opts);
  if (!q) return [];

  const matches: NormalizedMatch[] = [];
  const text = docIndex.normalizedText;

  let start = 0;
  while (start <= text.length - q.length) {
    const idx = text.indexOf(q, start);
    if (idx === -1) break;

    const end = idx + q.length;

    if (opts.wholeWord && !isWholeWord(text, idx, end)) {
      start = idx + 1;
      continue;
    }

    // Context checks on normalized text
    if (opts.contextBefore) {
      const beforeSlice = text.slice(Math.max(0, idx - opts.contextWindow), idx);
      if (!beforeSlice.includes(normalizeQuery(opts.contextBefore, opts))) {
        start = idx + 1;
        continue;
      }
    }
    if (opts.contextAfter) {
      const afterSlice = text.slice(end, Math.min(text.length, end + opts.contextWindow));
      if (!afterSlice.includes(normalizeQuery(opts.contextAfter, opts))) {
        start = idx + 1;
        continue;
      }
    }

    // Map to PM positions; to is exclusive, so add 1 char past last
    const fromPos = docIndex.normToPmPos[idx];
    const lastCharPos = docIndex.normToPmPos[Math.max(idx, end - 1)];
    const toPos = lastCharPos + 1;
    matches.push({ normStart: idx, normEnd: end, from: fromPos, to: toPos });

    start = idx + 1;
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


