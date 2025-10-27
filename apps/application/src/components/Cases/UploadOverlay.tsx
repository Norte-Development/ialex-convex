import { Loader2, CheckCircle, XCircle, FileText } from "lucide-react";
import { useUpload } from "@/context/UploadContext";

export function UploadOverlay() {
  const { uploadFiles } = useUpload();

  if (uploadFiles.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      {uploadFiles.map((uploadFile) => (
        <div
          key={uploadFile.id}
          className={`bg-white rounded-lg shadow-lg border p-3 transition-all duration-300 ${
            uploadFile.status === "error"
              ? "border-red-200"
              : uploadFile.status === "success"
                ? "border-green-200"
                : "border-blue-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {uploadFile.status === "uploading" && (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              {uploadFile.status === "success" && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {uploadFile.status === "error" && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadFile.file.name}
                </p>
              </div>

              {uploadFile.status === "uploading" && (
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadFile.progress}% complete
                  </p>
                </div>
              )}

              {uploadFile.status === "success" && (
                <p className="text-xs text-green-600 mt-1">
                  Archivo subido correctamente
                </p>
              )}

              {uploadFile.status === "error" && (
                <p className="text-xs text-red-600 mt-1">
                  {uploadFile.error || "Upload failed"}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
