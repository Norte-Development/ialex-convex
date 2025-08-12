// We cannot use Office Web Viewer due to non-public URLs.
// For now, show a helpful fallback with download.
export default function PptxViewer({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center">
      <div className="text-gray-800 font-medium mb-2">Vista previa de PowerPoint no disponible</div>
      <div className="text-gray-600 mb-4 max-w-md">
        No podemos mostrar presentaciones PPTX directamente. Descarga el archivo para verlo localmente.
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
        aria-label={`Descargar ${title}`}
      >
        Descargar
      </a>
    </div>
  );
}


