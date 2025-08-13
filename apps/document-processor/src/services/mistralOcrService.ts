import "dotenv/config";
import { logger } from "../middleware/logging";
import { Mistral } from "@mistralai/mistralai";

type Options = { pageWindow: number };

// Initialize a single SDK client instance
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

async function encodePdf(file: Buffer) {
  try {
      // Read the PDF file as a buffer
      const pdfBuffer = file;

      // Convert the buffer to a Base64-encoded string
      const base64Pdf = pdfBuffer.toString('base64');
      return base64Pdf;
  } catch (error) {
      console.error(`Error: ${error}`);
      return null;
  }
}

export async function extractWithMistralOCR(documentUrl: string, _opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  console.log("Running Mistral OCR");

  try {
    // Convert PDF buffer to a data URL so it can be passed via the SDK

    const ocrResponse = await mistral.ocr.process({
      model: "mistral-ocr-latest",
      document: {
          type: "document_url",
          documentUrl: documentUrl
      },
      includeImageBase64: false
  });

    const text = (ocrResponse.pages || [])
      .map((page) => page.markdown || "")
      .join("\n\n");

    if (!text.trim()) throw new Error("Mistral OCR returned no text");
    console.log("text", text);
    return text;
  } catch (err) {
    logger.error("Mistral OCR error", { err: err instanceof Error ? err.message : String(err) });
    throw new Error("Mistral OCR failed");
  }
}


