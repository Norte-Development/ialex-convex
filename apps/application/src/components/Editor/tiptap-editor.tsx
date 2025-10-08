// components/editor/Tiptap.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { useTiptapSync } from "@convex-dev/prosemirror-sync/tiptap";
import { Editor, JSONContent } from "@tiptap/core";
import { RibbonBar } from "./Ribbon";
import { extensions } from "./extensions";
import { updateCursorContext } from "./cursorUtils";
import { api } from "../../../convex/_generated/api";
import { useEscrito } from "@/context/EscritoContext";
import "./editor-styles.css";
import { useTemplate } from "./template";
import { Id } from "../../../convex/_generated/dataModel";
import EscritosLoadingState from "../Escritos/EscritosLoadingState";
import { useMutation } from "convex/react";
import { useSearchParams } from "react-router-dom";

interface TiptapProps {
  documentId?: string;
  onReady?: (editor: Editor) => void;
  onDestroy?: () => void;
  readOnly?: boolean;
  templateId?: Id<"modelos"> | null;
}

export interface TiptapRef {
  getContent: () => JSONContent | null;
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
    const { setEscritoId, setCursorPosition, setTextAroundCursor } =
      useEscrito();
    const incrementModeloUsage = useMutation(
      api.functions.templates.incrementModeloUsage,
    );
    const [searchParams, setSearchParams] = useSearchParams();

    // Track if template has been applied to prevent reapplying on reload
    const templateAppliedRef = useRef(false);

    // Always call useTemplate hook to maintain hook order (passes null to skip when no template)
    const initialContent = useTemplate({ templateId });

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
        onUpdate: ({ editor }) =>
          updateCursorContext(editor, setCursorPosition, setTextAroundCursor),
        onSelectionUpdate: ({ editor }) =>
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
              sync.create(docxContent as JSONContent);
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
          sync.create(initialContent as JSONContent);
          templateAppliedRef.current = true;

          // Increment template usage counter
          incrementModeloUsage({ modeloId: templateId });

          // Remove templateId from URL after applying to prevent reapplication on reload
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete("templateId");
          setSearchParams(newSearchParams, { replace: true });
        } else if (!templateId && !templateAppliedRef.current) {
          // No template, just create empty document
          sync.create(initialContent as JSONContent);
          templateAppliedRef.current = true;
        }
      }
    }, [
      sync,
      templateId,
      initialContent,
      searchParams,
      setSearchParams,
      incrementModeloUsage,
      documentId,
    ]);

    useEffect(() => {
      if (editor) editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    console.log("editor", editor?.getJSON());

    useImperativeHandle(ref, () => ({
      getContent: () => editor?.getJSON() ?? null,
    }));

    if (sync.isLoading) return <EscritosLoadingState />;
    if (!editor) return <EscritosLoadingState />;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {!readOnly && <RibbonBar editor={editor} />}

        {readOnly && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-amber-800 text-sm">
            Modo de solo lectura - No tienes permisos para editar este escrito
          </div>
        )}

        <EditorContent editor={editor} className="w-full min-h-[600px]" />

        <div className="border-t border-gray-200 bg-gray-50/50 px-4 py-2 text-xs text-gray-500">
          Words: {editor.storage.characterCount?.words() ?? 0} | Characters:{" "}
          {editor.storage.characterCount?.characters() ?? 0}
        </div>
      </div>
    );
  },
);
