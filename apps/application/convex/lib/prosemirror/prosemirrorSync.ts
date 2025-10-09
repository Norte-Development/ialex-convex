import { components } from "../../../_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";

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

      4. **Update Search Index**  
        - Refresh the search index for this document to include the new chunks.  

    */

    // TODO: Implement chunking, embedding generation, and RAG storage
    console.log('Document snapshot received:', id, version);
  },
});