/**
 * AIAgentPage - Página principal del agente legal general
 *
 * Ruta: /ai
 *
 * Muestra lista de conversaciones y permite crear nuevas.
 * Sin caso específico - agente general.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputButton,
} from "@/components/ai-elements/prompt-input";
import { Globe, AlertTriangle, Paperclip } from "lucide-react";
import { useHomeThreads } from "@/components/HomeAgent/hooks/useHomeThreads";
import { HomeAgentLayout } from "@/components/HomeAgent/HomeAgentLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { HomeAgentAttachmentPreview } from "@/components/HomeAgent/HomeAgentAttachmentPreview";
import type { HomeAgentMediaRef } from "@/components/HomeAgent/types";
import { HOME_AGENT_MAX_MEDIA_BYTES } from "@/components/HomeAgent/types";

export default function HomeAgentPage() {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [mediaAttachments, setMediaAttachments] = useState<HomeAgentMediaRef[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getUploadUrl = useAction(api.agents.home.media.getHomeMediaUploadUrl);

  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("homeAgentWebSearchEnabled");
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("homeAgentWebSearchEnabled", String(webSearchEnabled));
  }, [webSearchEnabled]);

  const { sendMessage } = useHomeThreads();

  const handleFileButtonClick = () => fileInputRef.current?.click();

  const handleRemoveMedia = useCallback((gcsObject: string) => {
    setMediaAttachments((prev) =>
      prev.filter((item) => item.gcsObject !== gcsObject),
    );
  }, []);

  const handleFilesSelected = useCallback(
    async (filesInput: FileList | File[]) => {
      if (isUploadingMedia) {
        toast.error("Espera a que termine la carga actual.");
        return;
      }

      const files = Array.from(filesInput as ArrayLike<File>);
      if (files.length === 0) {
        return;
      }

      // Reset input value to allow selecting same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setIsUploadingMedia(true);
      try {
        for (const file of files) {
          const kind =
            file.type === "application/pdf"
              ? "pdf"
              : file.type.startsWith("image/")
                ? "image"
                : null;

          if (!kind) {
            toast.error("Formato no soportado", {
              description: `${file.name} no es una imagen ni PDF.`,
            });
            continue;
          }

          if (file.size > HOME_AGENT_MAX_MEDIA_BYTES) {
            toast.error("Archivo demasiado grande", {
              description: `${file.name} supera los ${(HOME_AGENT_MAX_MEDIA_BYTES / (1024 * 1024)).toFixed(0)}MB permitidos.`,
            });
            continue;
          }

          try {
            const uploadConfig = await getUploadUrl({
              filename: file.name,
              contentType: file.type,
              kind,
            });

            if (file.size > uploadConfig.maxSize) {
              toast.error("Archivo supera el límite permitido", {
                description: `${file.name} excede ${(
                  uploadConfig.maxSize /
                  (1024 * 1024)
                ).toFixed(0)}MB.`,
              });
              continue;
            }

            const response = await fetch(uploadConfig.uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": file.type,
              },
              body: file,
            });

            if (!response.ok) {
              throw new Error(
                `Fallo la carga (${response.status} ${response.statusText})`,
              );
            }

            setMediaAttachments((prev) => [
              ...prev,
              {
                url: uploadConfig.publicUrl,
                gcsBucket: uploadConfig.gcsBucket,
                gcsObject: uploadConfig.gcsObject,
                contentType: uploadConfig.contentType,
                filename: uploadConfig.filename,
                size: file.size,
                kind,
              },
            ]);
          } catch (error) {
            console.error("Error uploading media", error);
            const description =
              error instanceof Error ? error.message : "Intenta nuevamente.";
            toast.error("No se pudo subir el archivo", {
              description,
            });
          }
        }
      } finally {
        setIsUploadingMedia(false);
      }
    },
    [getUploadUrl, isUploadingMedia],
  );

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isCreating || isUploadingMedia) return;

    const message = inputValue.trim();
    setIsCreating(true);

    try {
      // Send message (will create thread automatically with message as title)
      const result = await sendMessage(message, webSearchEnabled, mediaAttachments);

      if (result.threadId) {
        // Navigate to the new thread
        navigate(`/ai/${result.threadId}`);
      }
    } catch (error) {
      console.error("Error creating thread:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <HomeAgentLayout>
      <div
        className="flex items-center justify-center h-full p-6 bg-transparent pt-15"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="w-full max-w-4xl space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-4">
            <h1 className="font-poppins font-[500] text-[#130261] justify-center items-center lg:text-[54px] text-xl flex flex-col ">
              ¡Hola! Soy iAlex<span>¿En qué puedo ayudarte?</span>
            </h1>
            <p className="text-[#666666] text-[20px] mt-10">
              Puede preguntarme y pedirme lo que quiera
            </p>
          </div>

          <div className="relative w-full max-w-4xl h-fit mx-auto">
            {/* Web search hallucination warning */}
            {webSearchEnabled && (
              <div className="mb-2">
                <Alert className="border-amber-400 bg-amber-50">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <AlertTitle className="text-amber-900 text-xs">
                    Búsqueda web activada
                  </AlertTitle>
                  <AlertDescription className="text-[11px] text-amber-800">
                    Las respuestas con búsqueda web son más propensas a alucinaciones. Verifica siempre la información con fuentes confiables antes de usarla en tu caso.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <PromptInput onSubmit={handleSendMessage} className="border-2 border-[#E5E7EB] shadow-[0px_4.27px_34.18px_-4.27px_rgba(99,140,243,0.32)] rounded-2xl">
              <HomeAgentAttachmentPreview
                media={mediaAttachments}
                onRemove={handleRemoveMedia}
                isUploading={isUploadingMedia}
              />
              <PromptInputTextarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Listo cuando usted lo esté"
                className="min-h-[150px] max-h-[300px] px-6 py-5 bg-white placeholder:text-[#9CA3AF] resize-none focus:outline-none text-base"
                disabled={isCreating}
              />
              <PromptInputToolbar className="px-6 pb-4 bg-white">
                <div className="flex items-center gap-2">
                  <PromptInputButton
                    onClick={handleFileButtonClick}
                    className="rounded-full transition-all h-8 w-8"
                    title="Adjuntar archivo"
                    disabled={isCreating || isUploadingMedia}
                    type="button"
                  >
                    <Paperclip className="size-4" />
                  </PromptInputButton>
                  <PromptInputButton
                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                    className={cn(
                      "rounded-full transition-all h-8 w-8",
                      webSearchEnabled && "bg-blue-100 text-blue-600 hover:bg-blue-200"
                    )}
                    title={webSearchEnabled ? "Búsqueda web activada" : "Activar búsqueda web"}
                    type="button"
                  >
                    <Globe className="size-4" />
                    <span className="sr-only">Toggle Web Search</span>
                  </PromptInputButton>
                </div>
                <div className="flex-1" />
                <PromptInputSubmit
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isCreating || isUploadingMedia}
                  className="bg-transparent hover:bg-transparent text-black"
                  size="icon"
                />
              </PromptInputToolbar>
            </PromptInput>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesSelected(e.target.files);
                }
              }}
            />
          </div>
        </div>
      </div>
    </HomeAgentLayout>
  );
}
