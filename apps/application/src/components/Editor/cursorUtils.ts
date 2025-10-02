// components/editor/cursorUtils.ts
import { Editor } from "@tiptap/core";

interface CursorPosition {
  line: number;
  column: number;
}

interface TextAroundCursor {
  before: string;
  after: string;
  currentLine: string;
}

export function updateCursorContext(
  editor: Editor,
  setCursorPosition: (position: CursorPosition) => void,
  setTextAroundCursor: (text: TextAroundCursor) => void,
) {
  const { from, to } = editor.state.selection;
  const pos = editor.state.doc.resolve(from);
  const line = pos.parentOffset;
  const column = from - pos.start();

  setCursorPosition({ line, column });

  const doc = editor.state.doc;
  const beforeText = doc.textBetween(Math.max(0, from - 100), from);
  const afterText = doc.textBetween(to, Math.min(doc.content.size, to + 100));

  const currentLineText = doc.textBetween(pos.start(), pos.end());

  setTextAroundCursor({
    before: beforeText,
    after: afterText,
    currentLine: currentLineText,
  });
}