// components/editor/Tiptap.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { Editor } from "@tiptap/core";
// @ts-ignore - TypeScript cache issue with @tiptap/core types  
import type { JSONContent } from "@tiptap/core";
import { RibbonBar } from "./Ribbon";
import { extensions } from "./extensions";
import { updateCursorContext } from "./cursorUtils";
import { api } from "../../../convex/_generated/api";
import { useEscrito } from "@/context/EscritoContext";
import "./editor-styles.css";
import { useTemplate } from "./template";
import { Id } from "../../../convex/_generated/dataModel";
import EscritosLoadingState from "../Escritos/EscritosLoadingState";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "../ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { EditorContextMenu } from "./EditorContextMenu";
import { chatSelectionBus } from "@/lib/chatSelectionBus";

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { textAlign: null }, content: [] }],
};

interface TiptapProps {
  documentId?: string;
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
  readOnly?: boolean;
  templateId?: Id<"modelos"> | null;
}

export interface TiptapRef {
  getContent: () => JSONContent | null;
  hasPendingSuggestions?: () => boolean;
}

export const Tiptap = forwardRef<TiptapRef, TiptapProps>(
  (
    {
      documentId = "default-document",
      templateId = null,
      onReady,
      onDestroy,
      readOnly = false,
    },
    ref,
  ) => {
    const sync = useTiptapSync(api.prosemirror, documentId);
    const { setEscritoId, setCursorPosition, setTextAroundCursor, escritoId } =
      useEscrito();
    const incrementModeloUsage = useMutation(
      api.functions.templates.incrementModeloUsage,
    );
    const [searchParams, setSearchParams] = useSearchParams();
    
    // Query escrito if escritoId is a Convex ID (starts with letter) to get prosemirrorId
    // escritoId can be either Convex ID (from URL) or prosemirrorId (set by Tiptap)
    const escrito = useQuery(
      api.functions.documents.getEscrito,
      escritoId && /^[a-z]/.test(escritoId) ? { escritoId: escritoId as Id<"escritos"> } : "skip",
    );
    const activeProsemirrorId = escrito?.prosemirrorId || escritoId;

    // Track if template has been applied to prevent reapplying on reload
    const templateAppliedRef = useRef(false);

    // Always call useTemplate hook to maintain hook order (passes null to skip when no template)
    const templateResult = useTemplate({ templateId });
    const { content: initialContent, isLoading: templateLoading, error: templateError, templateNotFound } = templateResult;

    const editor = useEditor(
      {
        extensions: [
          ...extensions,
          ...(sync.extension ? [sync.extension] : []),
        ],
        content: sync.initialContent,
        editable: !readOnly,
        editorProps: {
          attributes: {
            class: `legal-editor-content prose prose-lg focus:outline-none px-12 py-8 min-h-screen ${
              readOnly ? "cursor-default select-text" : ""
            }`,
            "data-placeholder": readOnly
              ? ""
              : "Comience a escribir su documento legal...",
          },
        },
        onUpdate: ({ editor }: { editor: Editor }) =>
          updateCursorContext(editor, setCursorPosition, setTextAroundCursor),
        onSelectionUpdate: ({ editor }: { editor: Editor }) =>
          updateCursorContext(editor, setCursorPosition, setTextAroundCursor),
      },
      [
        sync.initialContent,
        sync.extension,
        setCursorPosition,
        setTextAroundCursor,
      ],
    );

    useEffect(() => {
      if (editor && onReady) {
        onReady(editor);
        setEscritoId(documentId);
        updateCursorContext(editor, setCursorPosition, setTextAroundCursor);
      }
    }, [editor, setCursorPosition, setTextAroundCursor]);

    useEffect(() => {
      return () => onDestroy?.();
    }, [onDestroy]);

    useEffect(() => {
      if (sync.initialContent === null && !sync.isLoading && "create" in sync) {
        // Check for initial content from DOCX conversion first
        const storedData = sessionStorage.getItem(
          `escrito-initial-${documentId}`,
        );

        if (storedData && !templateAppliedRef.current) {
          try {
            const {
              initialContent: docxContent,
              fromDocxConversion,
              conversionMetadata,
            } = JSON.parse(storedData);

            if (fromDocxConversion && docxContent) {
              console.log(
                "Aplicando contenido inicial desde conversión DOCX:",
                conversionMetadata,
              );
              sync.create?.(docxContent as JSONContent);
              templateAppliedRef.current = true;

              // Clean up stored data after using it
              sessionStorage.removeItem(`escrito-initial-${documentId}`);

              // Show success message with conversion details
              console.log("✅ Contenido DOCX aplicado exitosamente");
              return;
            }
          } catch (error) {
            console.error("Error parsing stored DOCX content:", error);
            // Continue with normal flow if stored data is corrupted
          }
        }

        // Normal template/empty document flow
        if (templateId && !templateAppliedRef.current) {
          // Check if template loading failed
          if (templateError) {
            console.error("Template loading failed:", templateError);
            // Still create document but with empty content
            sync.create?.(EMPTY_DOC as JSONContent);
            templateAppliedRef.current = true;
            return;
          }

          // Check if template is still loading
          if (templateLoading) {
            return; // Wait for template to load
          }

          sync.create?.(initialContent as JSONContent);
          templateAppliedRef.current = true;

          // Increment template usage counter only if template loaded successfully
          if (!templateNotFound && !templateError) {
            incrementModeloUsage({ modeloId: templateId });
          }

          // Remove templateId from URL after applying to prevent reapplication on reload
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("templateId");
          setSearchParams(newSearchParams, { replace: true });
        } else if (!templateId && !templateAppliedRef.current) {
          // No template, just create empty document
          sync.create?.(initialContent as JSONContent);
          templateAppliedRef.current = true;
        }
      }
    }, [
      sync,
      templateId,
      initialContent,
      templateLoading,
      templateError,
      templateNotFound,
      searchParams,
      setSearchParams,
      incrementModeloUsage,
      documentId,
    ]);

    useEffect(() => {
      if (editor) editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    // Handle scroll-to-range events from chat
    useEffect(() => {
      if (!editor) return;

      const handleScrollToRange = (e: CustomEvent<{ escritoId: string; from: number; to: number }>) => {
        const { escritoId, from, to } = e.detail;
        
        // Only handle if this is the correct escrito
        if (escritoId !== documentId) return;

        try {
          // Set selection and scroll into view
          editor.chain().focus().setTextSelection({ from, to }).run();
          
          // Scroll into view
          const domPos = editor.view.domAtPos(from);
          if (domPos.node && domPos.node.nodeType === Node.TEXT_NODE) {
            (domPos.node.parentElement || domPos.node as Element)?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else if (domPos.node && domPos.node.nodeType === Node.ELEMENT_NODE) {
            (domPos.node as Element).scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        } catch (error) {
          console.error("Error scrolling to range:", error);
        }
      };

      window.addEventListener("ialex:scrollToEscritoRange", handleScrollToRange as EventListener);
      return () => {
        window.removeEventListener("ialex:scrollToEscritoRange", handleScrollToRange as EventListener);
      };
    }, [editor, documentId]);

    // Handle chat hotkey to inject context (selection or active escrito)
    useEffect(() => {
      if (!editor || !documentId) return;

      const handleChatHotkey = () => {
        // Check if this editor should handle the hotkey
        // escritoId can be Convex ID (from URL) or prosemirrorId (set by Tiptap)
        // documentId is always the prosemirrorId
        // activeProsemirrorId is the prosemirrorId (either from escrito query or directly from escritoId)
        const shouldHandle = activeProsemirrorId === documentId;
        
        if (!shouldHandle) {
          console.debug("[ChatHotkey] Skipping - not the active editor", { 
            escritoId, 
            documentId,
            activeProsemirrorId,
            escritoProsemirrorId: escrito?.prosemirrorId,
            note: "activeProsemirrorId should match documentId when this editor is active"
          });
          return;
        }

        // Check TipTap selection state
        const selection = editor.state.selection;
        const { from, to } = selection;
        let hasSelection = !selection.empty && from !== to;
        
        // Also check DOM selection as fallback (in case TipTap state was cleared)
        const domSelection = window.getSelection();
        const hasDomSelection = domSelection && domSelection.rangeCount > 0 && domSelection.toString().trim().length > 0;
        
        // If TipTap selection is empty but DOM has selection, try to restore it
        if (!hasSelection && hasDomSelection && domSelection) {
          const range = domSelection.getRangeAt(0);
          const editorElement = editor.view.dom;
          
          // Check if the selection is within this editor
          if (editorElement.contains(range.commonAncestorContainer)) {
            try {
              // Try to get the ProseMirror positions from the DOM range
              const startPos = editor.view.posAtDOM(range.startContainer, range.startOffset);
              const endPos = editor.view.posAtDOM(range.endContainer, range.endOffset);
              
              if (startPos !== null && endPos !== null && startPos !== endPos) {
                // Update TipTap selection
                editor.chain().setTextSelection({ from: startPos, to: endPos }).run();
                hasSelection = true;
                // Update local variables
                const updatedSelection = editor.state.selection;
                const updatedFrom = updatedSelection.from;
                const updatedTo = updatedSelection.to;
                
                console.debug("[ChatHotkey] Restored selection from DOM", { 
                  from: updatedFrom, 
                  to: updatedTo 
                });
                
                // Use the updated selection
                const content = editor.state.doc.textBetween(updatedFrom, updatedTo);
                
                if (content && content.trim().length > 0) {
                  const textBeforeSelection = editor.state.doc.textBetween(0, updatedFrom);
                  const lines = textBeforeSelection.split('\n');
                  const line = lines.length;
                  const column = lines[lines.length - 1].length + 1;
                  const preview = content.length > 50 
                    ? `${content.substring(0, 50)}...` 
                    : content;

                  const referenceEscritoId = escrito?._id || escritoId;
                  if (!referenceEscritoId) {
                    console.debug("[ChatHotkey] No escritoId available for selection");
                    return;
                  }
                  
                  // TypeScript now knows referenceEscritoId is string
                  const escritoIdString: string = referenceEscritoId;
                  chatSelectionBus.publish({
                    type: "selection",
                    id: `${escritoIdString}-${updatedFrom}-${updatedTo}`,
                    name: preview,
                    selection: {
                      content,
                      position: { line, column },
                      range: { from: updatedFrom, to: updatedTo },
                      escritoId: escritoIdString,
                    },
                  });
                  return;
                }
              }
            } catch (error) {
              console.debug("[ChatHotkey] Failed to restore selection from DOM", error);
            }
          }
        }

        console.debug("[ChatHotkey] Selection check", { 
          hasSelection, 
          from, 
          to, 
          empty: selection.empty,
          hasDomSelection,
          escritoId 
        });

        // Use the Convex escritoId for references (not prosemirrorId)
        const referenceEscritoId = escrito?._id || escritoId;
        
        if (hasSelection && referenceEscritoId) {
          // Publish selection reference (reuse logic from EditorContextMenu)
          const content = editor.state.doc.textBetween(from, to);
          
          if (!content || content.trim().length === 0) {
            console.debug("[ChatHotkey] Selection has no content, falling back to escrito");
            // Fall through to escrito reference
          } else {
            // Calculate line and column from position
            const textBeforeSelection = editor.state.doc.textBetween(0, from);
            const lines = textBeforeSelection.split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length + 1;

            // Create preview (truncate if too long)
            const preview = content.length > 50 
              ? `${content.substring(0, 50)}...` 
              : content;

            console.debug("[ChatHotkey] Publishing selection", { preview, contentLength: content.length });

            // Publish selection to chat bus
            chatSelectionBus.publish({
              type: "selection",
              id: `${referenceEscritoId}-${from}-${to}`,
              name: preview,
              selection: {
                content,
                position: { line, column },
                range: { from, to },
                escritoId: referenceEscritoId,
              },
            });
            return;
          }
        }

        // Fallback: publish active escrito reference
        if (referenceEscritoId) {
          console.debug("[ChatHotkey] Publishing escrito reference", { escritoId: referenceEscritoId });
          chatSelectionBus.publish({
            type: "escrito",
            id: referenceEscritoId,
            name: "Escrito actual",
          });
        }
      };

      window.addEventListener("ialex:chatHotkey", handleChatHotkey as EventListener);
      return () => {
        window.removeEventListener("ialex:chatHotkey", handleChatHotkey as EventListener);
      };
    }, [editor, documentId, escritoId, escrito, activeProsemirrorId]);

    console.log("editor", editor?.getJSON());

    useImperativeHandle(ref, () => ({
      getContent: () => editor?.getJSON() ?? null,
      hasPendingSuggestions: () => {
        if (!editor) return false;
        let found = false;
        editor.state.doc.descendants((node: any) => {
          if (
            node.type.name === "inlineChange" ||
            node.type.name === "blockChange" ||
            node.type.name === "lineBreakChange"
          ) {
            found = true;
          }
        });
        return found;
      },
    }));

    // Show loading state for sync or template loading
    if (sync.isLoading || templateLoading) return <EscritosLoadingState />;
    if (!editor) return <EscritosLoadingState />;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {!readOnly && <RibbonBar editor={editor} />}

        {readOnly && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
            Modo de solo lectura - No tienes permisos para editar este escrito
          </div>
        )}

        {/* Template loading error feedback */}
        {templateError && (
          <Alert className="mx-4 mt-4 border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <div className="flex items-center justify-between">
                <span>{templateError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Remove templateId from URL to continue with empty document
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete("templateId");
                    setSearchParams(newSearchParams, { replace: true });
                  }}
                  className="ml-2 text-orange-700 border-orange-300 hover:bg-orange-100"
                >
                  Continuar sin plantilla
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <EditorContextMenu editor={editor} readOnly={readOnly}>
          <div className="w-full min-h-[600px]">
            <EditorContent editor={editor} className="w-full min-h-[600px]" />
          </div>
        </EditorContextMenu>

        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-2 text-xs text-gray-500">
          Words: {editor.storage.characterCount?.words() ?? 0} | Characters:{" "}
          {editor.storage.characterCount?.characters() ?? 0}
        </div>
      </div>
    );
  },
);
