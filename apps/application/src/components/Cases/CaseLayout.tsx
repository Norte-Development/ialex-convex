import type React from "react";
import CaseSidebar from "./CaseSideBar";
import SidebarChatbot from "../CaseAgent/SidebarChatbot";
import NavBar from "../Layout/Navbar/NavBar";
import { useLayout } from "@/context/LayoutContext";
import { useChatbot } from "@/context/ChatbotContext";
import { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import {
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { usePermissions } from "@/context/CasePermissionsContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

interface UploadFile {
  id: string;
  file: File;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  return <InnerCaseLayout>{children}</InnerCaseLayout>;
}

function InnerCaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout();
  const { currentCase } = useCase();
  const { hasAccess, isLoading, can } = usePermissions();
  const { isChatbotOpen, toggleChatbot, chatbotWidth, setChatbotWidth } =
    useChatbot();
  const [isResizing, setIsResizing] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isGlobalDragActive, setIsGlobalDragActive] = useState(false);

  const enqueuedUploads = new Set<string>();

  // Convex mutations
  const generateUploadUrl = useAction(
    api.functions.documents.generateUploadUrl,
  );
  const createDocument = useMutation(api.functions.documents.createDocument);

  // Save width to localStorage
  const handleWidthChange = (newWidth: number) => {
    setChatbotWidth(newWidth);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // Document upload handlers
  const uploadFile = useCallback(
    async (file: File) => {
      if (!currentCase) {
        console.error("No case selected");
        return;
      }

      if (!can.docs.write) {
        console.error("No permission to upload documents");
        toast.error("No tienes permisos para subir documentos");
        return;
      }

      const dedupeKey = `${currentCase._id}:${file.name}:${file.size}`;
      if (enqueuedUploads.has(dedupeKey)) {
        console.warn("Skipping duplicate upload in session", {
          name: file.name,
          size: file.size,
        });
        return;
      }
      enqueuedUploads.add(dedupeKey);

      const fileId = `${Date.now()}-${Math.random()}`;

      // Add file to upload queue
      setUploadFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          status: "uploading",
          progress: 0,
        },
      ]);

      try {
        // Update progress to 25%
        setUploadFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 25 } : f)),
        );

        // Step 1: Get a short-lived upload URL (GCS signed URL for PUT)
        const postUrl = await generateUploadUrl({
          caseId: currentCase._id,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        // Update progress to 50%
        setUploadFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 50 } : f)),
        );

        // Step 2: PUT the file to the signed URL
        const putResp = await fetch(postUrl.url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putResp.ok) {
          throw new Error(`Upload failed: ${putResp.status}`);
        }

        // Update progress to 75%
        setUploadFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 75 } : f)),
        );

        // Step 3: Save the GCS metadata to the database (idempotent on backend)
        await createDocument({
          title: file.name,
          caseId: currentCase._id,
          gcsBucket: postUrl.bucket,
          gcsObject: postUrl.object,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        // Update to success
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "success", progress: 100 } : f,
          ),
        );

        console.log(`File "${file.name}" uploaded successfully`);

        // Remove success files after 3 seconds
        setTimeout(() => {
          setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
        }, 3000);
      } catch (error) {
        console.error("Error uploading file:", error);

        // Update to error
        setUploadFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : f,
          ),
        );

        // Remove error files after 5 seconds
        setTimeout(() => {
          setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
        }, 5000);
      } finally {
        enqueuedUploads.delete(dedupeKey);
      }
    },
    [currentCase, generateUploadUrl, createDocument, can.docs.write],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log("Files dropped:", acceptedFiles);

      // Upload each file sequentially
      for (const file of acceptedFiles) {
        await uploadFile(file);
      }
    },
    [uploadFile],
  );

  const onDragEnter = useCallback(() => {
    setIsGlobalDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsGlobalDragActive(false);
  }, []);

  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach(({ file, errors }) => {
        const reason = errors
          .map((e) => e.message)
          .filter(Boolean)
          .join(", ");
        toast.error(
          `Archivo no permitido: ${file.name}${reason ? ` (${reason})` : ""}`,
        );
      });
    },
    onDragEnter,
    onDragLeave,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
      "text/csv": [".csv"],
      "application/csv": [".csv"],
      // Treat some CSV uploads that use the legacy Excel MIME
      "application/vnd.ms-excel": [".csv"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "text/plain": [".txt"],
      "audio/*": [".mp3", ".wav"],
      "video/*": [".mp4", ".mov"],
    },
    multiple: true,
    noClick: true, // Don't trigger on click, only drag
    disabled: !can.docs.write, // Disable dropzone if no write permission
  });

  // Global drag listeners to detect drags over iframes and nested viewers
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      // Necessary to allow drop
      e.preventDefault();
      if (!can.docs.write) return;

      // Only show overlay for external files, not internal document drags
      if (
        e.dataTransfer &&
        e.dataTransfer.types.includes("Files") &&
        !e.dataTransfer.types.includes("application/x-ialex-document")
      ) {
        setIsGlobalDragActive(true);
      }
    };
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!can.docs.write) return;

      // Only show overlay for external files, not internal document drags
      if (
        e.dataTransfer &&
        e.dataTransfer.types.includes("Files") &&
        !e.dataTransfer.types.includes("application/x-ialex-document")
      ) {
        setIsGlobalDragActive(true);
      }
    };
    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsGlobalDragActive(false);
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) {
        setIsGlobalDragActive(false);
      }
    };
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("dragenter", handleWindowDragEnter);
    window.addEventListener("drop", handleWindowDrop);
    window.addEventListener("dragleave", handleWindowDragLeave);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("dragenter", handleWindowDragEnter);
      window.removeEventListener("drop", handleWindowDrop);
      window.removeEventListener("dragleave", handleWindowDragLeave);
    };
  }, [can.docs.write]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 mb-6">
            No tienes los permisos necesarios para acceder a este caso.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Contacta al administrador del caso para solicitar acceso.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className="relative h-screen w-screen flex overflow-hidden"
    >
      {/* Left Sidebar - full height, fixed position */}
      <div
        className={`fixed top-0 left-0 h-screen z-20 ${
          isResizing
            ? "transition-none"
            : "transition-all duration-300 ease-in-out"
        }`}
        style={{
          width: isCaseSidebarOpen ? "256px" : "0px",
        }}
      >
        <CaseSidebar />
      </div>

      {/* Main container - pushed by sidebar */}
      <div
        className={`flex-1 flex flex-col h-screen ${
          isResizing
            ? "transition-none"
            : "transition-all duration-300 ease-in-out"
        }`}
        style={{
          marginLeft: isCaseSidebarOpen ? "256px" : "0px",
          marginRight: isChatbotOpen ? `${chatbotWidth}px` : "0px",
        }}
      >
        {/* Navbar at top */}
        <NavBar />

        {/* Main content - scrollable */}
        <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      </div>

      {/* Upload Feedback Overlay */}
      {uploadFiles.length > 0 && (
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
      )}

      {/* Right Sidebar Chatbot */}
      <SidebarChatbot
        isOpen={isChatbotOpen}
        onToggle={toggleChatbot}
        width={chatbotWidth}
        onWidthChange={handleWidthChange}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />

      {/* Global drag overlay to capture drops over iframes/viewers */}
      {can.docs.write && (isGlobalDragActive || isDragActive) && (
        <div
          {...getRootProps()}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onDragLeave={onDragLeave}
        >
          <div className="pointer-events-none select-none bg-white/90 border border-dashed border-gray-400 rounded-xl px-6 py-4 text-gray-700 shadow">
            Suelta archivos para subirlos…
          </div>
        </div>
      )}
    </div>
  );
}
