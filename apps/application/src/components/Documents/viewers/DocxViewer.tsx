import { useEffect, useState } from "react";

type DocxViewerProps = {
  url: string;
  title: string;
};

export default function DocxViewer({ url, title }: DocxViewerProps) {
  const [html, setHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const mammothMod = await import("mammoth");
        const mammothAny = mammothMod as any;
        const result = await mammothAny.convertToHtml(
          { arrayBuffer },
          {
            convertImage: mammothAny.images.inline(async (element: any) => {
              const imageBuffer = await element.read("base64");
              return {
                src: `data:${element.contentType};base64,${imageBuffer}`,
              };
            }),
          },
        );
        if (!cancelled) setHtml(result.value);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar el documento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
        Cargando documento…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-700 mb-2">
          No se pudo renderizar el archivo DOCX.
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
        >
          Descargar
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-gray-100" aria-label={title}>
      <style>{`
        .docx-page {
          width: 100%;
          max-width: 816px; /* ~8.5in @ 96dpi */
          margin: 24px auto;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
          border-radius: 2px;
          padding: 96px; /* ~1in margins */
        }
        @media (max-width: 768px) {
          .docx-page {
            margin: 12px;
            padding: 24px; /* Reduced padding on mobile */
          }
        }
        .docx-page img { max-width: 100%; height: auto; }
        .docx-page table { width: 100%; border-collapse: collapse; overflow-x: auto; display: block; }
        .docx-page table, .docx-page th, .docx-page td { border: 1px solid #e5e7eb; }
        .docx-page th, .docx-page td { padding: 6px; }
        .docx-page h1, .docx-page h2, .docx-page h3 { margin-top: 1.25em; margin-bottom: 0.5em; }
        .docx-page p { margin: 0.5em 0; word-wrap: break-word; }
        .docx-page ul, .docx-page ol { padding-left: 1.5em; }
      `}</style>
      <div
        className="docx-page prose prose-neutral max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
