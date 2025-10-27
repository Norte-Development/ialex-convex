import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

export interface UploadFile {
  id: string;
  file: File;
  status: "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface UploadContextType {
  uploadFiles: UploadFile[];
  addUpload: (file: File) => string;
  updateUpload: (id: string, updates: Partial<UploadFile>) => void;
  removeUpload: (id: string) => void;
  isUploading: (fileName: string, fileSize: number, caseId: string) => boolean;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const enqueuedUploadsRef = useRef<Set<string>>(new Set());

  const addUpload = useCallback((file: File) => {
    const fileId = `${Date.now()}-${Math.random()}`;
    setUploadFiles((prev) => [
      ...prev,
      {
        id: fileId,
        file,
        status: "uploading",
        progress: 0,
      },
    ]);
    return fileId;
  }, []);

  const updateUpload = useCallback(
    (id: string, updates: Partial<UploadFile>) => {
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  const removeUpload = useCallback((id: string) => {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isUploading = useCallback(
    (fileName: string, fileSize: number, caseId: string) => {
      const dedupeKey = `${caseId}:${fileName}:${fileSize}`;
      return enqueuedUploadsRef.current.has(dedupeKey);
    },
    [],
  );

  return (
    <UploadContext.Provider
      value={{
        uploadFiles,
        addUpload,
        updateUpload,
        removeUpload,
        isUploading,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
