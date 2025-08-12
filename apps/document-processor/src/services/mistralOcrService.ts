import "dotenv/config";
import { logger } from "../middleware/logging";
import { Mistral } from "@mistralai/mistralai";

type Options = { pageWindow: number };

// Initialize a single SDK client instance
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export async function extractWithMistralOCR(buffer: Buffer, _opts: Options): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("Missing Mistral OCR config");

  try {
    // Convert PDF buffer to a data URL so it can be passed via the SDK
    const base64 = buffer.toString("base64");

    const ocrResponse = await mistral.ocr.process({
      model: 'mistral-ocr-latest',
      document: {
        type: "document_url",
        documentUrl: `data:application/pdf;base64,${base64}`,
      },
      includeImageBase64: false,
    });

    const text = (ocrResponse.pages || [])
      .map((page) => page.markdown || "")
      .join("\n\n");

    if (!text.trim()) throw new Error("Mistral OCR returned no text");
    return text;
  } catch (err) {
    logger.error("Mistral OCR error", { err: err instanceof Error ? err.message : String(err) });
    throw new Error("Mistral OCR failed");
  }
}


