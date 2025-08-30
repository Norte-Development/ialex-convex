import { forwardRef, useImperativeHandle, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "convex/_generated/dataModel";

type Props = {
  caseId: Id<"cases">;
  folderId: Id<"folders"> | undefined;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  accept?: string;
};

export type NewDocumentInputHandle = {
  open: () => void;
};

const NewDocumentInput = forwardRef<NewDocumentInputHandle, Props>(
  ({ caseId, folderId, onSuccess, onError, accept }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const generateUploadUrl = useAction(
      api.functions.documents.generateUploadUrl,
    );
    const createDocument = useMutation(api.functions.documents.createDocument);

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
