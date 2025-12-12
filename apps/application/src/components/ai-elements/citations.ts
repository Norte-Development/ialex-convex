/**
 * Shared citation extraction utilities.
 *
 * Tool outputs can arrive in different shapes depending on the tool adapter/runtime:
 * - output.value.citations (common ai-sdk wrapper)
 * - output.citations (some adapters)
 * - output.value being a JSON string containing { citations: [...] }
 *
 * We normalize these into a consistent list for the Sources UI.
 */

export type ToolCitation = {
  id: string;
  type: string;
  title: string;
  url?: string;
};

type RecordLike = Record<string, unknown>;

function isRecordLike(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Fast check to avoid parsing arbitrary strings.
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function addCitationsFromContainer(
  container: unknown,
  addCitation: (raw: unknown) => void,
  opts?: { depth?: number; maxNodes?: number },
) {
  const depth = opts?.depth ?? 3;
  const maxNodes = opts?.maxNodes ?? 500;

  let visited = 0;
  const seenObjects = new Set<unknown>();

  const visit = (node: unknown, remainingDepth: number) => {
    if (visited++ > maxNodes) return;
    if (!node) return;

    if (isRecordLike(node) || Array.isArray(node)) {
      if (seenObjects.has(node)) return;
      seenObjects.add(node);
    }

    if (isRecordLike(node)) {
      const maybe = node["citations"];
      if (Array.isArray(maybe)) {
        for (const raw of maybe) addCitation(raw);
      }
    }

    if (remainingDepth <= 0) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item, remainingDepth - 1);
      return;
    }

    if (isRecordLike(node)) {
      for (const value of Object.values(node)) visit(value, remainingDepth - 1);
    }
  };

  visit(container, depth);
}

/**
 * Extract citations from tool outputs in message parts.
 */
export function extractCitationsFromToolOutputs(
  parts: readonly unknown[],
): ToolCitation[] {
  const citations: ToolCitation[] = [];
  const seen = new Set<string>();

  const addCitation = (raw: unknown) => {
    const c = raw as { id?: unknown; type?: unknown; title?: unknown; url?: unknown };
    if (!c?.id || !c?.type) return;
    const id = String(c.id);
    const type = String(c.type);
    const key = `${type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    citations.push({
      id,
      type,
      title: String(c.title || "Fuente"),
      url: c.url ? String(c.url) : undefined,
    });
  };

  for (const part of parts) {
    const p = part as { type?: unknown; state?: unknown; output?: unknown };
    if (typeof p.type !== "string") continue;
    if (!p.type.startsWith("tool-")) continue;
    if (p.state !== "output-available") continue;

    const output = p.output;
    if (!output) continue;

    // Common ai-sdk ToolUIPart wrapper: { type, value }
    if (isRecordLike(output) && "value" in output) {
      addCitationsFromContainer((output as RecordLike).value, addCitation);
      const parsed = tryParseJsonString((output as RecordLike).value);
      if (parsed) addCitationsFromContainer(parsed, addCitation);
    }

    // Some adapters: citations directly on output
    addCitationsFromContainer(output, addCitation);

    // Handle stringified JSON output itself
    const parsedFromOutput = tryParseJsonString(output);
    if (parsedFromOutput) addCitationsFromContainer(parsedFromOutput, addCitation);
  }

  return citations;
}


