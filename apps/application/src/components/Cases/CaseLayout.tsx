import type React from "react";
import CaseSidebar from "./CaseSideBar";
import SidebarChatbot from "../CaseAgent/SidebarChatbot";
import NavBar from "../Layout/Navbar/NavBar";
import { useLayout } from "@/context/LayoutContext";
import { useChatbot } from "@/context/ChatbotContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
import { useEscrito } from "@/context/EscritoContext";
import { useLocation } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { usePermissions } from "@/context/CasePermissionsContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useBillingLimit,
  UpgradeModal,
  useBillingData,
} from "@/components/Billing";
import { UploadProvider, useUpload } from "@/context/UploadContext";
import { UploadOverlay } from "./UploadOverlay";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  return (
    <UploadProvider>
      <InnerCaseLayout>{children}</InnerCaseLayout>
    </UploadProvider>
  );
}

function InnerCaseLayout({ children }: CaseDetailLayoutProps) {
  // All hooks must be called before any conditional returns
  const { isCaseSidebarOpen } = useLayout();
  const { currentCase } = useCase();
  const { hasAccess, isLoading, can } = usePermissions();
  const { isChatbotOpen, toggleChatbot, chatbotWidth, setChatbotWidth } =
    useChatbot();
  const { escritoId, setEscritoId, setCursorPosition, setTextAroundCursor } =
    useEscrito();
  const location = useLocation();
  const [isResizing, setIsResizing] = useState(false);
  const { addUpload, updateUpload, removeUpload } = useUpload();
  const [isGlobalDragActive, setIsGlobalDragActive] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Clear escrito context when navigating away from escrito routes
  useEffect(() => {
    // Check if we're on any escrito route (detail or list)
    const isOnEscritoRoute = location.pathname.includes("/escritos");
    // If we're not on an escrito route and there's an escritoId in context, clear it and related state
    if (!isOnEscritoRoute && escritoId) {
      setEscritoId(undefined);
      setCursorPosition(undefined);
      setTextAroundCursor(undefined);
    }
  }, [
    location.pathname,
    escritoId,
    setEscritoId,
    setCursorPosition,
    setTextAroundCursor,
  ]);

  // Persistent dedupe tracking and drop guard
  const enqueuedUploadsRef = useRef<Set<string>>(new Set());
  const dropInProgressRef = useRef(false);

  // Convex mutations
  const generateUploadUrl = useAction(
    api.functions.documents.generateUploadUrl,
  );
  const createDocument = useMutation(api.functions.documents.createDocument);

  // Get documents for case to check limit
  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip",
  );
  const currentDocCount = documents?.length || 0;

  // Check document per case limit
  const documentsPerCaseCheck = useBillingLimit("documentsPerCase", {
    currentCount: currentDocCount,
  });

  // Get current user plan for upgrade modal
  const { plan: userPlan } = useBillingData();

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

      // Check document per case limit
      if (!documentsPerCaseCheck.allowed) {
        toast.error("Límite alcanzado", {
          description: documentsPerCaseCheck.reason,
        });
        setShowUpgradeModal(true);
        return;
      }

      const dedupeKey = `${currentCase._id}:${file.name}:${file.size}`;
      if (enqueuedUploadsRef.current.has(dedupeKey)) {
        console.warn("Skipping duplicate upload in session", {
          name: file.name,
          size: file.size,
        });
        return;
      }
      enqueuedUploadsRef.current.add(dedupeKey);

      const fileId = addUpload(file);

      try {
        // Update progress to 25%
        updateUpload(fileId, { progress: 25 });

        // Step 1: Get a short-lived upload URL (GCS signed URL for PUT)
        const postUrl = await generateUploadUrl({
          caseId: currentCase._id,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        // Update progress to 50%
        updateUpload(fileId, { progress: 50 });

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
        updateUpload(fileId, { progress: 75 });

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
        updateUpload(fileId, { status: "success", progress: 100 });

        console.log(`File "${file.name}" uploaded successfully`);

        // Remove success files after 3 seconds
        setTimeout(() => {
          removeUpload(fileId);
        }, 3000);
      } catch (error) {
        console.error("Error uploading file:", error);

        // Check if this is a limit error
        const errorMessage = error instanceof Error ? error.message : "";
        if (
          errorMessage.includes("Límite de 10 documentos por caso alcanzado")
        ) {
          setShowUpgradeModal(true);
        }

        // Update to error
        updateUpload(fileId, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });

        // Remove error files after 5 seconds
        setTimeout(() => {
          removeUpload(fileId);
        }, 5000);
      } finally {
        enqueuedUploadsRef.current.delete(dedupeKey);
      }
    },
    [
      currentCase,
      generateUploadUrl,
      createDocument,
      can.docs.write,
      documentsPerCaseCheck,
      addUpload,
      updateUpload,
      removeUpload,
    ],
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Prevent duplicate drop handling
      if (dropInProgressRef.current) {
        console.warn("Drop already in progress, ignoring duplicate event");
        return;
      }

      dropInProgressRef.current = true;
      try {
        console.log("Files dropped:", acceptedFiles);

        // Upload each file sequentially
        for (const file of acceptedFiles) {
          await uploadFile(file);
        }
      } finally {
        dropInProgressRef.current = false;
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
      // "image/*": [".png", ".jpg", ".jpeg", ".gif"],
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

  // Global Cmd/Ctrl+K handler to open chat and add context
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      const isModifierPressed = e.metaKey || e.ctrlKey;
      const isKKey = e.key === "k" || e.key === "K";

      if (isModifierPressed && isKKey) {
        e.preventDefault();
        e.stopPropagation();

        // Ensure chat is open (don't close if already open)
        if (!isChatbotOpen) {
          toggleChatbot();
        }

        // Dispatch event for context injection (editor will handle it)
        window.dispatchEvent(new CustomEvent("ialex:chatHotkey"));

        // Focus chat input after a short delay to allow sidebar animation
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("ialex:focusChatInput"));
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isChatbotOpen, toggleChatbot]);

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
    <div className="relative h-screen w-screen flex overflow-hidden">
      {/* Left Sidebar - full height, fixed position, floating on mobile */}
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

      {/* Backdrop for mobile when sidebar is open */}
      {isCaseSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 md:hidden"
          onClick={() => {
            const event = new CustomEvent("toggle-case-sidebar");
            window.dispatchEvent(event);
          }}
        />
      )}

      {/* Main container - pushed by sidebars on desktop, full width on mobile */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden max-md:!ml-0 ${
          isResizing
            ? "transition-none"
            : "transition-all duration-300 ease-in-out"
        }`}
        style={{
          marginLeft: isCaseSidebarOpen ? "256px" : "0px",
        }}
      >
        {/* Navbar at top */}
        <NavBar />

        {/* Content area with chatbot */}
        <div className="flex-1 flex overflow-hidden">
          <main
            className={`flex-1 overflow-y-auto bg-white ${
              isResizing
                ? "transition-none"
                : "transition-all duration-300 ease-in-out"
            }`}
            style={{
              marginRight: isChatbotOpen ? `${chatbotWidth}px` : "0px",
            }}
          >
            {children}
          </main>

          {/* Right Sidebar Chatbot */}
          <SidebarChatbot
            isOpen={isChatbotOpen}
            onToggle={toggleChatbot}
            width={chatbotWidth}
            onWidthChange={handleWidthChange}
            onResizeStart={handleResizeStart}
            onResizeEnd={handleResizeEnd}
          />
        </div>
      </div>

      {/* Upload Feedback Overlay */}
      <UploadOverlay />

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

      {/* Upgrade Modal for drag-and-drop */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        reason="Límite de 10 documentos por caso alcanzado."
        currentPlan={userPlan || "free"}
        recommendedPlan="premium_individual"
      />
    </div>
  );
}
