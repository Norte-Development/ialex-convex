import { EditorState } from "@tiptap/pm/state";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "../../../../../../packages/shared/src/diff/jsonDiff";

/**
 * Apply diff-based merge to preserve change tracking
 */
export function applyDiffMerge(
  schema: any,
  originalDoc: any,
  newDoc: any
): any {
  try {
    const originalDocJson = originalDoc.toJSON();
    const newDocJson = newDoc.toJSON();

    const delta = createJsonDiff(originalDocJson, newDocJson);
    const merged = buildContentWithJsonChanges(
      originalDocJson,
      newDocJson,
      delta
    );

    const mergedNode = schema.nodeFromJSON(merged);
    const finalState = EditorState.create({ doc: originalDoc });

    return finalState.tr.replaceWith(
      0,
      finalState.doc.content.size,
      mergedNode.content
    );
  } catch (error) {
    console.error("Error in diff merge, using fallback:", error);
    // Fallback: use the new document directly if merge fails
    const finalState = EditorState.create({ doc: originalDoc });
    return finalState.tr.replaceWith(
      0,
      finalState.doc.content.size,
      newDoc.content
    );
  }
}
