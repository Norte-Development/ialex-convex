// Helper function to validate edit types
export function validateEditType(type: string): boolean {
  const validTypes = [
    "replace", "insert", "delete",
    // camelCase
    "addMark", "removeMark", "replaceMark", "addParagraph",
    // snake_case
    "add_mark", "remove_mark", "replace_mark", "add_paragraph"
  ];
  return validTypes.includes(type);
}

// Helper function to validate mark types
export function validateMarkType(markType: string): boolean {
  const validMarkTypes = ["bold", "italic", "code", "strike", "underline"];
  return validMarkTypes.includes(markType);
}

// Helper function to validate paragraph types
export function validateParagraphType(paragraphType: string): boolean {
  const validParagraphTypes = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock"];
  return validParagraphTypes.includes(paragraphType);
}

// Map camelCase type to snake_case type expected by mutation
export function normalizeEditType(type: string): string {
  switch (type) {
    case "addMark":
      return "add_mark";
    case "removeMark":
      return "remove_mark";
    case "replaceMark":
      return "replace_mark";
    case "addParagraph":
      return "add_paragraph";
    default:
      return type; // replace, insert, delete already match
  }
}
