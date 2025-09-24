import { useState, useEffect } from "react";
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactDescription,
  ArtifactActions,
  ArtifactAction,
  ArtifactContent,
} from "../ai-elements/artifact";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckIcon,
  FileEditIcon,
  XIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/core";

interface EditorChangesOverlayProps {
  editor: Editor;
  isVisible: boolean;
  onDismiss?: () => void;
}

export function EditorChangesOverlay({
  editor,
  isVisible,
  onDismiss,
}: EditorChangesOverlayProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true); // Expandido por defecto
  const [changeNodes, setChangeNodes] = useState<any[]>([]);

  // Count change nodes in the editor
  useEffect(() => {
    if (!editor || !isVisible) {
      setChangeNodes([]);
      return;
    }

    const nodes: any[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (
        node.type.name === "inlineChange" ||
        node.type.name === "blockChange" ||
        node.type.name === "lineBreakChange"
      ) {
        nodes.push({
          type: node.type.name,
          changeType: node.attrs.changeType,
          changeId: node.attrs.changeId,
          position: pos,
          text: node.textContent || "Cambio de formato",
        });
      }
    });

    setChangeNodes(nodes);
  }, [editor, isVisible]);

  // Apply/remove artifact-active class to hide TipTap buttons
  //   useEffect(() => {
  //     if (!editor?.view.dom) return;

  //     const editorWrapper =
  //       editor.view.dom.closest(".legal-editor-content-wrapper") ||
  //       editor.view.dom.closest('[class*="editor"]') ||
  //       editor.view.dom.parentElement;

  //     if (!editorWrapper) {
  //       console.warn("⚠️ No se encontró el contenedor del editor");
  //       return;
  //     }

  //     if (isVisible && changeNodes.length > 0) {
  //       editorWrapper.classList.add("artifact-active");
  //       console.log("✅ Clase artifact-active aplicada - botones TipTap ocultos");
  //     } else {
  //       editorWrapper.classList.remove("artifact-active");
  //       console.log(
  //         "🔄 Clase artifact-active removida - botones TipTap visibles",
  //       );
  //     }

  //     // Cleanup function
  //     return () => {
  //       editorWrapper.classList.remove("artifact-active");
  //     };
  //   }, [editor, isVisible, changeNodes.length]);

  // Accept individual change by changeId
  const handleAcceptChange = async (changeId: string) => {
    if (!editor) return;

    try {
      console.log("🎯 Aceptando cambio individual:", changeId);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          try {
            const tr = editor.state.tr;
            let processed = false;

            // Find and process the specific change
            editor.state.doc.descendants((node: any, pos: number) => {
              if (
                (node.type.name === "inlineChange" ||
                  node.type.name === "blockChange" ||
                  node.type.name === "lineBreakChange") &&
                node.attrs.changeId === changeId
              ) {
                try {
                  if (node.attrs.changeType === "added") {
                    // Accept additions: replace change node with its content
                    if (node.type.name === "lineBreakChange") {
                      tr.replaceWith(
                        pos,
                        pos + node.nodeSize,
                        editor.schema.nodes.hardBreak.create(),
                      );
                    } else {
                      tr.replaceWith(pos, pos + node.nodeSize, node.content);
                    }
                  } else if (node.attrs.changeType === "deleted") {
                    // Accept deletions: remove the change node
                    tr.delete(pos, pos + node.nodeSize);
                  }
                  processed = true;
                } catch (nodeError) {
                  console.warn(
                    "⚠️ Error procesando nodo individual:",
                    nodeError,
                  );
                }
              }
            });

            if (processed && tr.steps.length > 0) {
              editor.view.dispatch(tr);
              console.log(`✅ Cambio ${changeId} aceptado`);
            }

            resolve();
          } catch (error) {
            console.error(
              "❌ Error en requestAnimationFrame individual:",
              error,
            );
            resolve();
          }
        });
      });
    } catch (error) {
      console.error("❌ Error aceptando cambio individual:", error);
    }
  };

  // Reject individual change by changeId
  const handleRejectChange = async (changeId: string) => {
    if (!editor) return;

    try {
      console.log("🎯 Rechazando cambio individual:", changeId);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          try {
            const tr = editor.state.tr;
            let processed = false;

            // Find and process the specific change
            editor.state.doc.descendants((node: any, pos: number) => {
              if (
                (node.type.name === "inlineChange" ||
                  node.type.name === "blockChange" ||
                  node.type.name === "lineBreakChange") &&
                node.attrs.changeId === changeId
              ) {
                try {
                  if (node.attrs.changeType === "added") {
                    // Reject additions: remove the change node
                    tr.delete(pos, pos + node.nodeSize);
                  } else if (node.attrs.changeType === "deleted") {
                    // Reject deletions: replace change node with its content
                    if (node.type.name === "lineBreakChange") {
                      tr.replaceWith(
                        pos,
                        pos + node.nodeSize,
                        editor.schema.nodes.hardBreak.create(),
                      );
                    } else {
                      tr.replaceWith(pos, pos + node.nodeSize, node.content);
                    }
                  }
                  processed = true;
                } catch (nodeError) {
                  console.warn(
                    "⚠️ Error procesando nodo individual:",
                    nodeError,
                  );
                }
              }
            });

            if (processed && tr.steps.length > 0) {
              editor.view.dispatch(tr);
              console.log(`✅ Cambio ${changeId} rechazado`);
            }

            resolve();
          } catch (error) {
            console.error(
              "❌ Error en requestAnimationFrame individual:",
              error,
            );
            resolve();
          }
        });
      });
    } catch (error) {
      console.error("❌ Error rechazando cambio individual:", error);
    }
  };

  const handleAcceptAll = async () => {
    if (!editor) return;

    setIsAccepting(true);

    try {
      console.log("🎯 Aceptando todos los cambios...");

      // Use requestAnimationFrame to ensure the editor is in a stable state
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          try {
            // Get a fresh transaction from the current state
            const tr = editor.state.tr;
            const nodesToProcess: Array<{ node: any; pos: number }> = [];

            // Collect all change nodes in the current document
            editor.state.doc.descendants((node: any, pos: number) => {
              if (
                node.type.name === "inlineChange" ||
                node.type.name === "blockChange" ||
                node.type.name === "lineBreakChange"
              ) {
                nodesToProcess.push({ node, pos });
              }
            });

            if (nodesToProcess.length === 0) {
              console.log("ℹ️ No hay cambios que aceptar");
              resolve();
              return;
            }

            // Process nodes in reverse order to maintain correct positions
            nodesToProcess.reverse().forEach(({ node, pos }) => {
              try {
                if (node.attrs.changeType === "added") {
                  // Accept additions: replace change node with its content
                  if (node.type.name === "lineBreakChange") {
                    tr.replaceWith(
                      pos,
                      pos + node.nodeSize,
                      editor.schema.nodes.hardBreak.create(),
                    );
                  } else {
                    tr.replaceWith(pos, pos + node.nodeSize, node.content);
                  }
                } else if (node.attrs.changeType === "deleted") {
                  // Accept deletions: remove the change node
                  tr.delete(pos, pos + node.nodeSize);
                }
              } catch (nodeError) {
                console.warn("⚠️ Error procesando nodo:", nodeError);
              }
            });

            // Only dispatch if we have changes and the transaction is valid
            if (tr.steps.length > 0) {
              editor.view.dispatch(tr);
              console.log(`✅ Aceptados ${nodesToProcess.length} cambios`);
            }

            resolve();
          } catch (error) {
            console.error("❌ Error en requestAnimationFrame:", error);
            resolve(); // Still resolve to continue
          }
        });
      });

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

    try {
      console.log("🎯 Rechazando todos los cambios...");

      // Use requestAnimationFrame to ensure the editor is in a stable state
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          try {
            // Get a fresh transaction from the current state
            const tr = editor.state.tr;
            const nodesToProcess: Array<{ node: any; pos: number }> = [];

            // Collect all change nodes in the current document
            editor.state.doc.descendants((node: any, pos: number) => {
              if (
                node.type.name === "inlineChange" ||
                node.type.name === "blockChange" ||
                node.type.name === "lineBreakChange"
              ) {
                nodesToProcess.push({ node, pos });
              }
            });

            if (nodesToProcess.length === 0) {
              console.log("ℹ️ No hay cambios que rechazar");
              resolve();
              return;
            }

            // Process nodes in reverse order to maintain correct positions
            nodesToProcess.reverse().forEach(({ node, pos }) => {
              try {
                if (node.attrs.changeType === "added") {
                  // Reject additions: remove the change node
                  tr.delete(pos, pos + node.nodeSize);
                } else if (node.attrs.changeType === "deleted") {
                  // Reject deletions: replace change node with its content
                  if (node.type.name === "lineBreakChange") {
                    tr.replaceWith(
                      pos,
                      pos + node.nodeSize,
                      editor.schema.nodes.hardBreak.create(),
                    );
                  } else {
                    tr.replaceWith(pos, pos + node.nodeSize, node.content);
                  }
                }
              } catch (nodeError) {
                console.warn("⚠️ Error procesando nodo:", nodeError);
              }
            });

            // Only dispatch if we have changes and the transaction is valid
            if (tr.steps.length > 0) {
              editor.view.dispatch(tr);
              console.log(`✅ Rechazados ${nodesToProcess.length} cambios`);
            }

            resolve();
          } catch (error) {
            console.error("❌ Error en requestAnimationFrame:", error);
            resolve(); // Still resolve to continue
          }
        });
      });

      setTimeout(() => {
        onDismiss?.();
      }, 300);
    } catch (error) {
      console.error("❌ Error rechazando cambios:", error);
    }
  };

  if (!isVisible || changeNodes.length === 0) {
    return null;
  }

  const addedNodes = changeNodes.filter((n) => n.changeType === "added");
  const deletedNodes = changeNodes.filter((n) => n.changeType === "deleted");

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4">
      <Artifact className="shadow-lg border-2 border-blue-200 bg-white">
        <ArtifactHeader>
          <div className="flex items-center gap-2">
            <FileEditIcon className="w-5 h-5 text-blue-600" />
            <div>
              <ArtifactTitle className="text-sm">
                Cambios pendientes en el documento
              </ArtifactTitle>
              <ArtifactDescription className="text-xs">
                {changeNodes.length} cambio{changeNodes.length !== 1 ? "s" : ""}{" "}
                esperando revisión
              </ArtifactDescription>
            </div>
          </div>

          <ArtifactActions>
            <div className="flex items-center gap-1 mr-2">
              {addedNodes.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-green-700 border-green-300 text-xs"
                >
                  +{addedNodes.length}
                </Badge>
              )}
              {deletedNodes.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-red-700 border-red-300 text-xs"
                >
                  -{deletedNodes.length}
                </Badge>
              )}
            </div>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 px-2 text-xs"
              >
                {isExpanded ? (
                  <ChevronUpIcon className="w-3 h-3" />
                ) : (
                  <ChevronDownIcon className="w-3 h-3" />
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

        {isExpanded && (
          <ArtifactContent className="max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {changeNodes.map((node, index) => (
                <div
                  key={`${node.changeId}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0.5 font-medium",
                        node.changeType === "added" &&
                          "text-green-700 border-green-300 bg-green-50",
                        node.changeType === "deleted" &&
                          "text-red-700 border-red-300 bg-red-50",
                      )}
                    >
                      {node.changeType === "added" ? "+" : "-"}
                    </Badge>
                    <span className="text-gray-700 truncate flex-1 min-w-0">
                      {node.text || "Cambio de formato"}
                    </span>
                  </div>

                  {/* Individual action buttons */}
                  <div className="flex gap-1 ml-2">
                    <Button
                      onClick={() => handleAcceptChange(node.changeId)}
                      size="sm"
                      className="h-6 w-6 p-0 bg-green-600 hover:bg-green-700 text-white"
                      title="Aceptar este cambio"
                    >
                      <CheckIcon className="w-3 h-3" />
                    </Button>
                    <Button
                      onClick={() => handleRejectChange(node.changeId)}
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                      title="Rechazar este cambio"
                    >
                      <XIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {changeNodes.length === 0 && (
                <div className="text-center text-xs text-gray-500 py-4">
                  No hay cambios para mostrar
                </div>
              )}
            </div>
          </ArtifactContent>
        )}

        <div className="border-t bg-gray-50 p-3 flex gap-2">
          <Button
            onClick={handleAcceptAll}
            disabled={isAccepting}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9"
            size="sm"
          >
            {isAccepting ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Aceptando...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4 mr-2" />
                Aceptar todos los cambios
              </>
            )}
          </Button>

          <Button
            onClick={handleRejectAll}
            disabled={isAccepting}
            variant="outline"
            className="h-9 px-4"
            size="sm"
          >
            Rechazar todo
          </Button>
        </div>
      </Artifact>
    </div>
  );
}
