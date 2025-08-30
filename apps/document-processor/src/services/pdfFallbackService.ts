import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

type Options = { pageWindow: number };

export async function extractWithPdfFallback(buffer: Buffer, _opts: Options): Promise<string> {
  // pdfjs-dist worker config is required in some environments; in Node, it's not used
  // but we set it to suppress warnings.
  // @ts-ignore
  GlobalWorkerOptions.workerSrc = "node_modules/pdfjs-dist/build/pdf.worker.js";

  const loadingTask = getDocument({ data: buffer });
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


