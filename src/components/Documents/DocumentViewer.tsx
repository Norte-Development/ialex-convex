import { lazy, Suspense } from "react";

const DocxViewer = lazy(() => import("./viewers/DocxViewer"));
const XlsxViewer = lazy(() => import("./viewers/XlsxViewer"));
const CsvViewer = lazy(() => import("./viewers/CsvViewer"));
const TxtViewer = lazy(() => import("./viewers/TxtViewer"));
const VideoViewer = lazy(() => import("./viewers/VideoViewer"));
const AudioViewer = lazy(() => import("./viewers/AudioViewer"));
const PptxViewer = lazy(() => import("./viewers/PptxViewer"));

export type DocumentViewerProps = {
  url: string;
  mimeType: string;
  title: string;
  fileSize?: number; // bytes
  heightClassName?: string; // allow caller to control height
};

const COMPLEX_PREVIEW_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB

function isPdf(mimeType: string) {
  return mimeType === "application/pdf";
}

function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}

function isVideo(mimeType: string) {
  return mimeType.startsWith("video/");
}

function isAudio(mimeType: string) {
  return mimeType.startsWith("audio/");
}

function isDocx(mimeType: string) {
  return (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isXlsx(mimeType: string) {
  return (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function isCsv(mimeType: string) {
  return (
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    mimeType === "application/vnd.ms-excel"
  );
}

function isTxt(mimeType: string) {
  return mimeType === "text/plain";
}

function isPptx(mimeType: string) {
  return (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
}

export default function DocumentViewer({
  url,
  mimeType,
  title,
  fileSize,
  heightClassName = "h-[calc(100vh-200px)]",
}: DocumentViewerProps) {
  const exceedsComplexLimit =
    (isDocx(mimeType) || isXlsx(mimeType) || isPptx(mimeType)) &&
    typeof fileSize === "number" &&
    fileSize > COMPLEX_PREVIEW_LIMIT_BYTES;

  if (isPdf(mimeType)) {
    return (
      <iframe src={url} title={title} className={`w-full ${heightClassName} border-0`} />
    );
  }

  if (isImage(mimeType)) {
    return (
      <div className="flex justify-center p-4">
        <img
          src={url}
          alt={title}
          className="max-w-full h-auto rounded shadow-sm"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        />
      </div>
    );
  }

  if (exceedsComplexLimit) {
    return (
      <div className="flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Archivo demasiado grande para vista previa</h3>
        <p className="text-gray-600 mb-4 max-w-md">
          Los archivos de Word, Excel y PowerPoint mayores a 5MB no pueden visualizarse en el navegador.
          Puedes descargar el archivo para verlo localmente.
        </p>
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
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto ${heightClassName}`}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-gray-500 text-sm">Cargando vista previa…</div>
          </div>
        }
      >
        {isDocx(mimeType) && <DocxViewer url={url} title={title} />}
        {isXlsx(mimeType) && <XlsxViewer url={url} title={title} />}
        {isCsv(mimeType) && <CsvViewer url={url} title={title} />}
        {isTxt(mimeType) && <TxtViewer url={url} title={title} />}
        {isVideo(mimeType) && <VideoViewer url={url} title={title} />}
        {isAudio(mimeType) && <AudioViewer url={url} title={title} />}
        {isPptx(mimeType) && <PptxViewer url={url} title={title} />}
        {![
          isDocx,
          isXlsx,
          isCsv,
          isTxt,
          isVideo,
          isAudio,
          isPptx,
        ].some((fn) => fn(mimeType)) && (
          <div className="p-6 text-center text-gray-600">
            Vista previa no disponible para este tipo de archivo.
          </div>
        )}
      </Suspense>
    </div>
  );
}


