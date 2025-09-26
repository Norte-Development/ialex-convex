export type NormalizationOptions = {
  caseInsensitive?: boolean;
  normalizeWhitespace?: boolean; // collapse consecutive spaces
  unifyNbsp?: boolean; // replace NBSP with normal space
  removeSoftHyphen?: boolean; // remove \u00AD
  removeZeroWidth?: boolean; // remove ZW chars like \u200B, \u200E, \u200F
  normalizeQuotesAndDashes?: boolean; // smart quotes/dashes to ASCII
  unicodeForm?: "NFC" | "NFD" | "NFKC" | "NFKD"; // normalization form
};

const DEFAULT_OPTS: Required<NormalizationOptions> = {
  caseInsensitive: false,
  normalizeWhitespace: true,
  unifyNbsp: true,
  removeSoftHyphen: true,
  removeZeroWidth: true,
  normalizeQuotesAndDashes: true,
  unicodeForm: "NFC",
};

// Zero-width characters and control marks commonly found in Word-pasted text
const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u200E\u200F\u202A-\u202E\u2060\uFEFF]/g;

// Map of smart quotes and dashes to ASCII equivalents
function normalizePunctuationChar(ch: string): string {
  switch (ch) {
    case "\u2018": // ‘
    case "\u2019": // ’
    case "\u2032": // ′
      return "'";
    case "\u201C": // “
    case "\u201D": // ”
    case "\u2033": // ″
      return '"';
    case "\u2013": // –
    case "\u2014": // —
      return "-";
    default:
      return ch;
  }
}

export type NormalizationMaps = {
  normalizedText: string;
  origToNorm: Array<number>; // for each original index, normalized index at/before it
  normToOrig: Array<number>; // for each normalized index, originating original index
};

export function normalizeAndBuildMaps(
  input: string,
  options?: NormalizationOptions,
): NormalizationMaps {
  const opts = { ...DEFAULT_OPTS, ...(options || {}) };

  // Apply Unicode normalization first to stabilize combining marks
  let working = opts.unicodeForm ? input.normalize(opts.unicodeForm) : input;

  const origToNorm: number[] = new Array(working.length + 1);
  const normChars: string[] = [];
  const normToOrig: number[] = [];

  const pushChar = (origIndex: number, ch: string) => {
    normChars.push(ch);
    normToOrig.push(origIndex);
  };

  for (let i = 0; i < working.length; i++) {
    origToNorm[i] = normChars.length;
    let ch = working[i];

    // Replace NBSP with normal space
    if (opts.unifyNbsp && ch === "\u00A0") {
      ch = " ";
    }

    // Remove soft hyphen
    if (opts.removeSoftHyphen && ch === "\u00AD") {
      continue;
    }

    // Remove zero-width/control chars
    if (opts.removeZeroWidth && ZERO_WIDTH_RE.test(ch)) {
      // Reset lastIndex because of global flag usage across iterations
      ZERO_WIDTH_RE.lastIndex = 0;
      continue;
    }

    // Normalize smart quotes/dashes
    if (opts.normalizeQuotesAndDashes) {
      ch = normalizePunctuationChar(ch);
    }

    // Lowercase after punctuation normalization
    if (opts.caseInsensitive) {
      ch = ch.toLocaleLowerCase();
    }

    pushChar(i, ch);
  }

  // Finalize map entry for end-of-string
  origToNorm[working.length] = normChars.length;

  let normalizedText = normChars.join("");

  if (opts.normalizeWhitespace) {
    // Collapse consecutive whitespace to a single space
    const collapsed: string[] = [];
    const collapsedMap: number[] = [];
    let lastWasSpace = false;
    for (let j = 0; j < normalizedText.length; j++) {
      const ch = normalizedText[j];
      const isSpace = ch === " " || ch === "\n" || ch === "\t";
      if (isSpace) {
        if (!lastWasSpace) {
          collapsed.push(" ");
          collapsedMap.push(normToOrig[j]);
          lastWasSpace = true;
        }
      } else {
        collapsed.push(ch);
        collapsedMap.push(normToOrig[j]);
        lastWasSpace = false;
      }
    }
    normalizedText = collapsed.join("");
    // After collapsing, normToOrig must be updated
    normToOrig.length = 0;
    for (let k = 0; k < collapsedMap.length; k++) {
      normToOrig[k] = collapsedMap[k];
    }
  }

  return { normalizedText, origToNorm, normToOrig };
}

export function normalizeQuery(query: string, options?: NormalizationOptions): string {
  const { normalizedText } = normalizeAndBuildMaps(query, options);
  return normalizedText;
}

export function isWordChar(ch: string): boolean {
  // Unicode aware: Letter or Number
  return /[\p{L}\p{N}]/u.test(ch);
}

export function isWholeWord(
  text: string,
  start: number,
  end: number,
): boolean {
  const before = start - 1;
  const after = end;
  const beforeOk = before < 0 || !isWordChar(text[before] || "");
  const afterOk = after >= text.length || !isWordChar(text[after] || "");
  return beforeOk && afterOk;
}


