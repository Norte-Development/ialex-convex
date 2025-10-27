import { forwardRef, useImperativeHandle, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useBillingLimit } from "@/components/Billing";
import { toast } from "sonner";
import { useUpload } from "@/context/UploadContext";

type Props = {
  caseId: Id<"cases">;
  folderId: Id<"folders"> | undefined;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onUpgradeRequired?: () => void;
  accept?: string;
};

export type NewDocumentInputHandle = {
  open: () => void;
};

const NewDocumentInput = forwardRef<NewDocumentInputHandle, Props>(
  (
    { caseId, folderId, onSuccess, onError, onUpgradeRequired, accept },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { addUpload, updateUpload, removeUpload } = useUpload();

    const generateUploadUrl = useAction(
      api.functions.documents.generateUploadUrl,
    );
    const createDocument = useMutation(api.functions.documents.createDocument);

    // Get current document count for the case
    const documents = useQuery(api.functions.documents.getDocuments, {
      caseId,
    });
    const currentDocCount = documents?.length || 0;

    // Check document per case limit
    const documentsPerCaseCheck = useBillingLimit("documentsPerCase", {
      currentCount: currentDocCount,
    });

    useImperativeHandle(ref, () => ({
      open: () => inputRef.current?.click(),
    }));

    return (
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          // Check document per case limit
          if (!documentsPerCaseCheck.allowed) {
            toast.error("Límite alcanzado", {
              description: documentsPerCaseCheck.reason,
            });
            onUpgradeRequired?.();
            if (inputRef.current) inputRef.current.value = "";
            return;
          }

          // Add file to upload queue
          const fileId = addUpload(file);

          try {
            // Update progress to 25%
            updateUpload(fileId, { progress: 25 });

            const signed = await generateUploadUrl({
              caseId,
              originalFileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
            } as any);

            // Update progress to 50%
            updateUpload(fileId, { progress: 50 });

            const putResp = await fetch(signed.url, {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
              },
              body: file,
            });
            if (!putResp.ok)
              throw new Error(`Upload failed: ${putResp.status}`);

            // Update progress to 75%
            updateUpload(fileId, { progress: 75 });

            await createDocument({
              title: file.name,
              caseId,
              folderId,
              gcsBucket: signed.bucket,
              gcsObject: signed.object,
              originalFileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
            } as any);

            // Update to success
            updateUpload(fileId, { status: "success", progress: 100 });

            console.log(`File "${file.name}" uploaded successfully via input`);

            // Remove success files after 3 seconds
            setTimeout(() => {
              removeUpload(fileId);
            }, 3000);

            if (inputRef.current) inputRef.current.value = "";
            onSuccess?.();
          } catch (err) {
            console.error("Error uploading document:", err);

            // Update to error
            updateUpload(fileId, {
              status: "error",
              error: err instanceof Error ? err.message : "Upload failed",
            });

            // Remove error files after 5 seconds
            setTimeout(() => {
              removeUpload(fileId);
            }, 5000);

            onError?.(err);
            if (inputRef.current) inputRef.current.value = "";
          }
        }}
      />
    );
  },
);

NewDocumentInput.displayName = "NewDocumentInput";

export default NewDocumentInput;
