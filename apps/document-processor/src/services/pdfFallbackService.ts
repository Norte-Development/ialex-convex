// Use legacy build to avoid worker requirements in Node environments
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

type Options = { pageWindow: number };

export async function extractWithPdfFallback(buffer: Buffer, _opts: Options): Promise<string> {
  // In Node, when using the legacy build, a worker is not required.
  // Ensure no worker path is attempted (prevents "fake worker" setup errors).
  // @ts-expect-error - workerSrc isn't used by legacy build in Node
  GlobalWorkerOptions.workerSrc = undefined;

  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  let text = "";
  const numPages = pdf.numPages;
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? (item as any).str : ""))
      .join(" ");
    text += pageText + "\n";
  }
  return text;
}


