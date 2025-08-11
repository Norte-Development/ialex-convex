import { useEffect, useMemo, useState } from "react";

type XlsxViewerProps = {
  url: string;
  title: string;
};

type SheetData = {
  name: string;
  rows: (string | number | null)[][];
};

export default function XlsxViewer({ url }: XlsxViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
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
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const parsedSheets: SheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];
          return { name, rows: json };
        });
        if (!cancelled) setSheets(parsedSheets);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error al cargar el Excel");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const activeSheet = useMemo(() => sheets[activeIndex], [sheets, activeIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
        Cargando hoja de cálculo…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-700 mb-2">No se pudo renderizar el archivo XLSX.</div>
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

  if (!activeSheet) {
    return <div className="p-6 text-center text-gray-600">No hay hojas para mostrar.</div>;
  }

  // Cap rows shown to improve performance; allow loading more in the future if needed
  const MAX_ROWS = 1000;
  const displayRows = activeSheet.rows.slice(0, MAX_ROWS);

  return (
    <div className="flex flex-col w-full h-full">
      <div className="border-b border-gray-200 bg-gray-50 p-2 flex gap-2 overflow-x-auto">
        {sheets.map((s, idx) => (
          <button
            key={s.name}
            onClick={() => setActiveIndex(idx)}
            className={`px-3 py-1 rounded text-sm border ${
              activeIndex === idx ? "bg-white border-gray-300" : "bg-gray-100 border-transparent"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="min-w-full text-xs">
          <tbody>
            {displayRows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="border border-gray-200 p-2 whitespace-pre-wrap align-top">
                    {cell as any}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {activeSheet.rows.length > MAX_ROWS && (
          <div className="p-3 text-center text-gray-600 text-xs">
            Mostrando {MAX_ROWS.toLocaleString()} de {activeSheet.rows.length.toLocaleString()} filas.
          </div>
        )}
      </div>
    </div>
  );
}


