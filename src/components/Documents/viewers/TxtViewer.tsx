import { useEffect, useState } from "react";

type TxtViewerProps = {
  url: string;
  title: string;
};

export default function TxtViewer({ url }: TxtViewerProps) {
  const [text, setText] = useState<string>("");
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
        const txt = await res.text();
        if (!cancelled) setText(txt);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar el archivo de texto");
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
        Cargando texto…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-700 mb-2">No se pudo cargar el archivo TXT.</div>
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
    <pre className="p-4 whitespace-pre-wrap text-sm font-mono text-gray-800 overflow-auto h-full">
      {text}
    </pre>
  );
}


