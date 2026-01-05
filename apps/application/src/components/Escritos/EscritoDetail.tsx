import { Tiptap, TiptapRef } from "@/components/Editor/tiptap-editor";
import { usePermissions } from "@/context/CasePermissionsContext";
import type { Id } from "../../../convex/_generated/dataModel";
import EscritosLoadingState from "./EscritosLoadingState";
import { RefObject, useRef } from "react";
import { EscritoStatusBadge } from "./EscritoStatusBadge";
import { ExportarButton } from "./ExportarButton";
export default function EscritoDetail({
  escrito,
  templateId,
}: {
  escrito: any;
  templateId?: Id<"modelos">;
}) {
  const { can } = usePermissions();
  const editorRef = useRef<TiptapRef>(null);

  if (escrito === undefined) {
    return <EscritosLoadingState />;
  }

  return (
    <>
      <div className="bg-white border-b px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto sm:flex-1 sm:min-w-0">
          <h1 className="text-lg sm:text-2xl font-semibold truncate" title={escrito?.title}>
            {escrito?.title}
          </h1>
          <EscritoStatusBadge
            escritoId={escrito._id}
            currentStatus={escrito.status}
          />
        </div>
        <div className="flex gap-2  justify-end   w-full">
          <ExportarButton escrito={escrito} editorRef={editorRef as RefObject<TiptapRef>} />
        </div>
      </div>

      <div className="p-3 sm:p-6 overflow-x-hidden">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <Tiptap
              documentId={escrito?.prosemirrorId}
              templateId={templateId}
              readOnly={!can.escritos.write}
              escritoId={escrito?._id}
              caseId={escrito?.caseId}
              ref={editorRef}
            />
          </div>
        </div>
      </div>
    </>
  );
}
