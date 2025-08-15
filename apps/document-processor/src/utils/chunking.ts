import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
});


export const chunkText = async (text: string) => {
  const chunks = await textSplitter.splitText(text);
  return chunks;
}
