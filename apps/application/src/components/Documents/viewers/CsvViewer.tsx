import { useEffect, useState } from "react";

type CsvViewerProps = {
  url: string;
  title: string;
};

export default function CsvViewer({ url }: CsvViewerProps) {
  const [rows, setRows] = useState<string[][]>([]);
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
        const text = await res.text();
        const Papa = await import("papaparse");
        const parsed = Papa.parse(text, { skipEmptyLines: true, dynamicTyping: true });
        if (!cancelled) setRows((parsed.data as unknown as any[][]).map(r => r.map(c => (c == null ? '' : String(c)))));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar el CSV");
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
        Cargando CSV…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-700 mb-2">No se pudo renderizar el archivo CSV.</div>
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

  const MAX_ROWS = 5000;
  const displayRows = rows.slice(0, MAX_ROWS);

  return (
    <div className="w-full h-full overflow-auto">
      <table className="min-w-full text-xs">
        <tbody>
          {displayRows.map((row, rIdx) => (
            <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="border border-gray-200 p-2 whitespace-pre-wrap align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MAX_ROWS && (
        <div className="p-3 text-center text-gray-600 text-xs">
          Mostrando {MAX_ROWS.toLocaleString()} de {rows.length.toLocaleString()} filas.
        </div>
      )}
    </div>
  );
}


