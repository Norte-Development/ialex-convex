import { useState } from "react";
import {
  Artifact,
  ArtifactHeader,
  ArtifactActions,
  ArtifactAction,
} from "../ai-elements/artifact";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, FileEditIcon, Loader2 } from "lucide-react";
import type { Editor } from "@tiptap/core";

interface AcceptAllChangesButtonProps {
  editor: Editor;
  isVisible: boolean;
  onDismiss?: () => void;
}

export function AcceptAllChangesButton({
  editor,
  isVisible,
  onDismiss,
}: AcceptAllChangesButtonProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

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

  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
      <Artifact className="shadow-lg border-2 border-blue-200 bg-white">
        <ArtifactHeader>
          <div className="flex items-center gap-2">
            <FileEditIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-medium text-sm">Cambios pendientes</h3>
              <p className="text-xs text-gray-600">Revisar y aceptar cambios</p>
            </div>
          </div>

          <ArtifactActions>
            <div className="flex gap-2">
              <Button
                onClick={handleAcceptAll}
                disabled={isAccepting || isRejecting}
                className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                size="sm"
              >
                {isAccepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aceptando...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Aceptar todo
                  </>
                )}
              </Button>

              <Button
                onClick={handleRejectAll}
                disabled={isAccepting || isRejecting}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-3"
                size="sm"
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rechazando...
                  </>
                ) : (
                  <>
                    <XIcon className="w-4 h-4 mr-2" />
                    Rechazar todo
                  </>
                )}
              </Button>

              <ArtifactAction
                tooltip="Cerrar"
                icon={XIcon}
                onClick={onDismiss}
                className="text-gray-500 hover:text-gray-700"
              />
            </div>
          </ArtifactActions>
        </ArtifactHeader>
      </Artifact>
    </div>
  );
}
