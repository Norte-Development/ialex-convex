import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Tiptap } from "@/components/Editor/tiptap-editor";
import { usePermissions } from "@/context/CasePermissionsContext";
import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { EscritoToolsTester } from "@/components/Editor/EscritoToolsTester";
import { ReadEscritoHelpersTester } from "@/components/Editor/ReadEscritoHelpersTester";

export default function EscritoDetail({ escrito, templateId }: { escrito: any, templateId?: Id<"modelos"> }) {
  const { can } = usePermissions();
  const [showToolsTester, setShowToolsTester] = useState(false);
  const [showReadHelpersTester, setShowReadHelpersTester] = useState(false);

  if (escrito === undefined) {
    return (
      <div className="flex items-center justify-center h-96">
        <p>Cargando escrito...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">{escrito?.title}</h1>
          {/* metadata */}
        </div>
        {can.escritos.write && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowToolsTester(!showToolsTester)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {showToolsTester ? "Hide" : "Show"} Tools
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReadHelpersTester(!showReadHelpersTester)}
            >
              <FileText className="h-4 w-4 mr-2" />
              {showReadHelpersTester ? "Hide" : "Show"} Helpers
            </Button>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex gap-6">
          <div className="flex-1">
            <Tiptap
              documentId={escrito?.prosemirrorId}
              templateId={templateId}
              readOnly={!can.escritos.write}
            />
          </div>
          
          {showToolsTester && (
            <div className="w-80 flex-shrink-0">
              <EscritoToolsTester />
            </div>
          )}
          
          {showReadHelpersTester && (
            <div className="w-80 flex-shrink-0">
              <ReadEscritoHelpersTester />
            </div>
          )}
        </div>
      </div>
    </>
  );
}