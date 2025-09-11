import { components } from "./_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { rag } from "./rag/rag";

export const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

const syncApi = prosemirrorSync.syncApi({
  checkRead(ctx, id) {
    // Validate that the user can read this document
    // You can implement your authorization logic here
  },

  checkWrite(ctx, id) {
    // Validate that the user can write to this document
    // You can implement your authorization logic here
  },

  async onSnapshot(ctx, id, snapshot, version) {
    /*

      1. **Extract Chunks**  
        - Break the ProseMirror snapshot into logical units (paragraphs, headings, sections).  
        - Each chunk gets an index and structural metadata (e.g. "heading level 2", "paragraph after section X").

      2. **Generate Embeddings**  
        - For each chunk, create a semantic embedding vector using your chosen model.  

      3. **Store in convex rag db**  
        - Store each chunk in convex rag with:  
          - The vector (for semantic search)  
          - Metadata payload (document ID, version, section index, text)  

      4. **Maintain Supplemental Metadata in Convex**  
        - Save a lighter outline or structural map (headings, sections, ordering) in Convex DB.  
        - This makes it easy for edits to reference *where* in the doc they should go.

      5. **Future Retrieval**  
        - Later, when an AI agent needs context:  
          - Convert the query/edit target into an embedding.  
          - Search Qdrant for relevant chunks limited to the document ID.  
          - Use Convex-stored outline to align results with document structure.  

      6. **Editing Context**  
        - Returned chunks provide `findText`, plus `contextBefore/contextAfter` and section location.  
        - That context makes `editEscritoTool` efficient, because the tool can apply edits on just the relevant section.

    */

  },
});

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = syncApi;

export default syncApi;
