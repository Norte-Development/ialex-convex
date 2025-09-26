import { useState } from "react";
import {
  Artifact,
  ArtifactHeader,
  ArtifactActions,
} from "../ai-elements/artifact";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, FileEditIcon, Loader2 } from "lucide-react";
import { useEditorContext } from "../../context/EditorContext";

interface AcceptAllChangesButtonProps {
  onDismiss?: () => void;
}

export function AcceptAllChangesButton({
  onDismiss,
}: AcceptAllChangesButtonProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Get editor from context
  const { editor } = useEditorContext();

  // Check if there are changes in the document
  const hasChanges = editor
    ? (() => {
        let foundChanges = false;
        editor.state.doc.descendants((node) => {
          if (
            node.type.name === "inlineChange" ||
            node.type.name === "blockChange" ||
            node.type.name === "lineBreakChange"
          ) {
            foundChanges = true;
            return false; // Stop descending
          }
        });
        return foundChanges;
      })()
    : false;

  const handleAcceptAll = async () => {
    if (!editor) return;

    setIsAccepting(true);

    try {
      editor.chain().focus().acceptAllChanges().run();

      // Small delay to let the editor update
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    } catch (error) {
      console.error("❌ Error aceptando cambios:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRejectAll = async () => {
    if (!editor) return;

    setIsRejecting(true);

    try {
      editor.chain().focus().rejectAllChanges().run();

      // Small delay to let the editor update
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    } catch (error) {
      console.error("❌ Error rechazando cambios:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  // Don't show if no editor or no changes
  if (!editor || !hasChanges) {
    return null;
  }

  return (
    <div className="mx-4 mb-2">
      <Artifact className="border-blue-200 bg-blue-50">
        <ArtifactHeader className="py-2 px-3">
          <div className="flex items-center gap-2">
            <FileEditIcon className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-blue-800 font-medium">
              Hay cambios pendientes
            </span>
          </div>

          <ArtifactActions>
            <div className="flex gap-1">
              <Button
                onClick={handleAcceptAll}
                disabled={isAccepting || isRejecting}
                className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                size="sm"
              >
                {isAccepting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckIcon className="w-3 h-3" />
                )}
              </Button>
              <Button
                onClick={handleRejectAll}
                disabled={isAccepting || isRejecting}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 h-6 px-2 text-xs"
                size="sm"
              >
                {isRejecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <XIcon className="w-3 h-3" />
                )}
              </Button>
            </div>
          </ArtifactActions>
        </ArtifactHeader>
      </Artifact>
    </div>
  );
}
