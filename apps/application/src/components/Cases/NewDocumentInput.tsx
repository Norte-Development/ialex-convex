import { forwardRef, useImperativeHandle, useRef } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";
import { useBillingLimit } from "@/components/Billing";
import { toast } from "sonner";

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
  ({ caseId, folderId, onSuccess, onError, onUpgradeRequired, accept }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const generateUploadUrl = useAction(
      api.functions.documents.generateUploadUrl,
    );
    const createDocument = useMutation(api.functions.documents.createDocument);

    // Get current document count for the case
    const documents = useQuery(api.functions.documents.getDocuments, { caseId });
    const currentDocCount = documents?.length || 0;

    // Check document per case limit
    const documentsPerCaseCheck = useBillingLimit("documentsPerCase", { 
      currentCount: currentDocCount 
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

          // Note: Storage check should ideally be done with file size, but since we need
          // to check dynamically, we'll rely on the backend to enforce this limit
          // A warning could be shown if storage is getting full

          try {
            const signed = await generateUploadUrl({
              caseId,
              originalFileName: file.name,
              mimeType: file.type || "application/octet-stream",
              fileSize: file.size,
            } as any);

            const putResp = await fetch(signed.url, {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "application/octet-stream",
              },
              body: file,
            });
            if (!putResp.ok)
              throw new Error(`Upload failed: ${putResp.status}`);

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

            if (inputRef.current) inputRef.current.value = "";
            onSuccess?.();
          } catch (err) {
            console.error("Error uploading document:", err);
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
