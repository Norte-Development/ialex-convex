import { useState, useCallback } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LibraryScope } from "@/pages/LibraryPage";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { X, Upload as UploadIcon, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBillingLimit, UpgradeModal, LimitWarningBanner } from "@/components/Billing";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeScope: LibraryScope;
  currentFolderId: Id<"libraryFolders"> | undefined;
}

interface FileUploadItem {
  file: File;
  title: string;
  description: string;
  tags: string[];
  status: "pending" | "uploading" | "completed" | "failed";
  progress: number;
  error?: string;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  activeScope,
  currentFolderId,
}: UploadDocumentDialogProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const generateUploadUrl = useAction(
    api.functions.libraryDocument.generateUploadUrl
  );
  const createDocument = useMutation(
    api.functions.libraryDocument.createLibraryDocument
  );

  // Get Root folder ID - when currentFolderId is undefined, we're uploading to Root
  const rootFolder = useQuery(
    api.functions.libraryFolders.getLibraryRootFolder,
    activeScope.type === "personal"
      ? {}
      : { teamId: activeScope.teamId },
  );

  // Resolve actual folder ID: use Root ID when currentFolderId is undefined
  const actualFolderId = currentFolderId || rootFolder?._id;

  // Check library document limit
  const teamId = activeScope.type === "team" ? activeScope.teamId : undefined;
  const { allowed, isWarning, percentage, reason, currentCount, limit } = useBillingLimit(
    "libraryDocuments",
    { teamId }
  );

  // Get user plan for upgrade modal
  const currentUser = useQuery(api.functions.users.getCurrentUser, {});
  const userPlan = useQuery(
    api.billing.features.getUserPlan,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  const handleFilesAdded = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);

    const allowedFiles: File[] = [];
    for (const file of fileArray) {
      if (file.type?.startsWith("image/")) {
        toast.error("Formato no soportado", {
          description: `${file.name} es una imagen. Por ahora solo se pueden subir documentos (PDF, Word, etc.).`,
        });
        continue;
      }
      allowedFiles.push(file);
    }

    if (allowedFiles.length === 0) {
      return;
    }

    const uploadItems: FileUploadItem[] = allowedFiles.map((file) => ({
      file,
      title: file.name.replace(/\.[^/.]+$/, ""),
      description: "",
      tags: [],
      status: "pending" as const,
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...uploadItems]);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesAdded(e.dataTransfer.files);
      }
    },
    [handleFilesAdded]
  );

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFileIndex >= index && selectedFileIndex > 0) {
      setSelectedFileIndex((prev) => prev - 1);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && files[selectedFileIndex]) {
      const currentTags = files[selectedFileIndex].tags;
      if (!currentTags.includes(newTag.trim())) {
        updateFile(selectedFileIndex, {
          tags: [...currentTags, newTag.trim()],
        });
        setNewTag("");
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    if (files[selectedFileIndex]) {
      updateFile(selectedFileIndex, {
        tags: files[selectedFileIndex].tags.filter((t) => t !== tag),
      });
    }
  };

  const updateFile = (index: number, updates: Partial<FileUploadItem>) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  };

  const uploadToGCS = (
    url: string,
    file: File,
    onProgress: (progress: number) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);
    });
  };

  const uploadSingleFile = async (index: number) => {
    const item = files[index];
    
    if (!item.title.trim()) {
      updateFile(index, {
        status: "failed",
        error: "El título es requerido",
      });
      return;
    }

    try {
      updateFile(index, { status: "uploading", progress: 0 });

      // Step 1: Generate signed upload URL
      const uploadData = await generateUploadUrl({
        title: item.file.name,
        mimeType: item.file.type,
        fileSize: item.file.size,
      });

      // Step 2: Upload file to GCS
      await uploadToGCS(uploadData.url, item.file, (progress) => {
        updateFile(index, { progress });
      });

      // Step 3: Create document record in Convex
      // Use Root ID when currentFolderId is undefined (uploading to root level)
      await createDocument({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        teamId: activeScope.type === "team" ? activeScope.teamId : undefined,
        folderId: actualFolderId,
        gcsBucket: uploadData.bucket,
        gcsObject: uploadData.object,
        mimeType: item.file.type,
        fileSize: item.file.size,
        tags: item.tags.length > 0 ? item.tags : undefined,
      });

      updateFile(index, { status: "completed", progress: 100 });
    } catch (error: any) {
      updateFile(index, {
        status: "failed",
        error: error.message || "Error al subir el archivo",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      toast.error("Por favor selecciona al menos un archivo");
      return;
    }

    // Check billing limit before uploading
    if (!allowed) {
      toast.error("Límite alcanzado", {
        description: reason,
      });
      setShowUpgradeModal(true);
      return;
    }

    setIsUploading(true);

    try {
      // Upload all files sequentially
      for (let i = 0; i < files.length; i++) {
        if (files[i].status === "pending") {
          await uploadSingleFile(i);
        }
      }

      const successCount = files.filter((f) => f.status === "completed").length;
      const failCount = files.filter((f) => f.status === "failed").length;

      if (successCount > 0) {
        toast.success(
          `${successCount} documento(s) subido(s) exitosamente${
            failCount > 0 ? ` (${failCount} fallaron)` : ""
          }`
        );
      }

      if (failCount === 0) {
        // Only close if all uploads succeeded
        handleClose();
      }
    } catch (error: any) {
      toast.error("Error durante la carga de archivos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setSelectedFileIndex(0);
      setNewTag("");
      onOpenChange(false);
    }
  };

  const currentFile = files[selectedFileIndex];
  const completedCount = files.filter((f) => f.status === "completed").length;
  const failedCount = files.filter((f) => f.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Subir Documentos</DialogTitle>
              <DialogDescription>
                Sube uno o más documentos a tu biblioteca. Los documentos serán
                indexados automáticamente.
              </DialogDescription>
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap ml-4">
              {currentCount}/{limit === Infinity ? "∞" : limit}
            </span>
          </div>
        </DialogHeader>

        {/* Warning banner if approaching limit */}
        {isWarning && (
          <LimitWarningBanner
            limitType="libraryDocuments"
            percentage={percentage}
            currentCount={currentCount}
            limit={limit}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        )}

        <div className="grid gap-4 py-4">
          {/* Drag and Drop Zone */}
          {files.length === 0 && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-2">
                Arrastra archivos aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Puedes subir múltiples archivos a la vez
              </p>
              <Input
                type="file"
                multiple
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/csv,application/vnd.ms-excel"
              />
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {/* Left: File List */}
              <div className="col-span-1 border rounded-lg p-2">
                <div className="flex items-center justify-between mb-2 px-2">
                  <Label className="text-xs font-semibold">
                    Archivos ({files.length})
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById("add-more-files")?.click()}
                    disabled={isUploading}
                    className="h-7 text-xs"
                  >
                    + Agregar
                  </Button>
                  <Input
                    id="add-more-files"
                    type="file"
                    multiple
                    onChange={handleFileInputChange}
                    className="hidden"
                    accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/csv,application/vnd.ms-excel"
                  />
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1">
                    {files.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedFileIndex(index)}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedFileIndex === index
                            ? "bg-primary/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        {item.status === "completed" && (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {item.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                        {item.status === "uploading" && (
                          <div className="h-4 w-4 flex-shrink-0">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          </div>
                        )}
                        {item.status === "pending" && (
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {item.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {!isUploading && item.status === "pending" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(index);
                            }}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Right: File Details Editor */}
              <div className="col-span-2">
                {currentFile && (
                  <ScrollArea className="h-[340px] pr-4">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-3">
                          Detalles del Documento
                        </h4>
                        
                        {currentFile.status === "uploading" && (
                          <div className="mb-4 p-3 bg-muted rounded-lg">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span>Subiendo...</span>
                              <span>{currentFile.progress}%</span>
                            </div>
                            <Progress value={currentFile.progress} />
                          </div>
                        )}

                        {currentFile.status === "failed" && (
                          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive">
                              {currentFile.error}
                            </p>
                          </div>
                        )}

                        {currentFile.status === "completed" && (
                          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <p className="text-sm text-green-700 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4" />
                              Subido exitosamente
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="title">Título *</Label>
                        <Input
                          id="title"
                          value={currentFile.title}
                          onChange={(e) =>
                            updateFile(selectedFileIndex, {
                              title: e.target.value,
                            })
                          }
                          placeholder="Título del documento"
                          disabled={
                            isUploading || currentFile.status === "completed"
                          }
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                          id="description"
                          value={currentFile.description}
                          onChange={(e) =>
                            updateFile(selectedFileIndex, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Descripción (opcional)"
                          rows={3}
                          disabled={
                            isUploading || currentFile.status === "completed"
                          }
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="tags">Etiquetas</Label>
                        <div className="flex gap-2">
                          <Input
                            id="tags"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTag();
                              }
                            }}
                            placeholder="Agregar etiqueta"
                            disabled={
                              isUploading || currentFile.status === "completed"
                            }
                          />
                          <Button
                            type="button"
                            onClick={handleAddTag}
                            variant="outline"
                            disabled={
                              isUploading || currentFile.status === "completed"
                            }
                          >
                            Agregar
                          </Button>
                        </div>
                        {currentFile.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentFile.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                                {currentFile.status !== "completed" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="ml-1 hover:text-destructive"
                                    disabled={isUploading}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {isUploading && (
                <span>
                  {completedCount} de {files.length} completados
                  {failedCount > 0 && ` (${failedCount} fallaron)`}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
              >
                {isUploading ? "Cerrar" : "Cancelar"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isUploading || files.length === 0}
              >
                {isUploading ? (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4 animate-pulse" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Subir {files.length} {files.length === 1 ? "Documento" : "Documentos"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>

        {/* Upgrade Modal */}
        <UpgradeModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          reason={reason}
          currentPlan={userPlan || "free"}
          recommendedPlan="premium_individual"
        />
      </DialogContent>
    </Dialog>
  );
}