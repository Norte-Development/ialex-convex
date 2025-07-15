import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import {
  createJsonDiff,
  buildContentWithJsonChanges,
} from "./utils/core";

interface TrackingStorage {
  isTracking: boolean;
  startContent: any | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tracking: {
      startTracking: () => ReturnType;
      stopTracking: () => ReturnType;
      isTracking: () => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
    };
  }
}

export const TrackingExtension = Extension.create({
  name: "tracking",

  // estado global para el tracking
  addStorage() {
    return {
      isTracking: false,
      startContent: null,
    } as TrackingStorage;
  },

  addCommands() {
    return {
      startTracking:
        () =>
        ({ editor }) => {
          // solamente iniciar si no estamos ya en tracking
          if (this.storage.isTracking) {
            console.log("Already tracking changes");
            return false;
          }

          // guardar el contenido actual del editor
          this.storage.startContent = editor.getJSON();
          this.storage.isTracking = true;

          console.log("Started tracking changes");
          console.log(
            "Initial content:",
            JSON.stringify(this.storage.startContent, null, 2)
          );

          return true;
        },

      stopTracking:
        () =>
        ({ editor }) => {
          // solamente si estamos en tracking
          if (!this.storage.isTracking || !this.storage.startContent) {
            console.log("Not currently tracking changes");
            return false;
          }

          // agarrar el contenido actual del editor
          const currentContent = editor.getJSON();

          console.log("=== Tracking Session Changes ===");
          console.log(
            "Start doc:",
            JSON.stringify(this.storage.startContent, null, 2)
          );
          console.log("End doc:", JSON.stringify(currentContent, null, 2));

          // calcular diferencias
          const delta = createJsonDiff(
            this.storage.startContent,
            currentContent
          );

          if (!delta) {
            console.log("No changes detected");
            this.storage.isTracking = false;
            this.storage.startContent = null;
            return true;
          }

          console.log("Delta:", JSON.stringify(delta, null, 2));

          // construir contenido con cambios
          const mergedContent = buildContentWithJsonChanges(
            this.storage.startContent,
            currentContent,
            delta
          );

          console.log(
            "Merged content:",
            JSON.stringify(mergedContent, null, 2)
          );

          // validacion de contenido
          try {
            const schema = editor.schema;
            const testDoc = schema.nodeFromJSON(mergedContent);
            console.log("Schema validation passed:", testDoc);
          } catch (error) {
            console.error("Schema validation failed:", error);
            console.log("Will try to set content anyway...");
          }

          // mostrar el contenido con cambios destacados
          // usamos setTimeout para mover setContent(esto generaba el error en la consola) fuera del contexto de transacción actual
          setTimeout(() => {
            editor.commands.setContent(mergedContent);

            // verificar el resultado
            const actualContent = editor.getJSON();
            console.log(
              "Actual editor content after setting:",
              JSON.stringify(actualContent, null, 2)
            );
            console.log("Content set in editor");
          }, 0);

          // reiniciar el estado de tracking
          this.storage.isTracking = false;
          this.storage.startContent = null;

          return true;
        },

      isTracking: () => () => {
        return this.storage.isTracking;
      },

      acceptAllChanges:
        () =>
        ({ editor }) => {
          const tr = editor.state.tr;
          const nodesToProcess: Array<{ node: any; pos: number }> = [];

          // Collect all change nodes in the document
          editor.state.doc.descendants((node: any, pos: number) => {
            if (
              node.type.name === "inlineChange" ||
              node.type.name === "blockChange" ||
              node.type.name === "lineBreakChange"
            ) {
              nodesToProcess.push({ node, pos });
            }
          });

          // Process nodes in reverse order to maintain correct positions
          nodesToProcess.reverse().forEach(({ node, pos }) => {
            if (node.attrs.changeType === "added") {
              // Accept additions: replace change node with its content
              if (node.type.name === "lineBreakChange") {
                tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.hardBreak.create());
              } else {
                tr.replaceWith(pos, pos + node.nodeSize, node.content);
              }
            } else if (node.attrs.changeType === "deleted") {
              // Accept deletions: remove the change node
              tr.delete(pos, pos + node.nodeSize);
            }
          });

          if (nodesToProcess.length > 0) {
            editor.view.dispatch(tr);
            console.log(`Accepted ${nodesToProcess.length} changes`);
          } else {
            console.log("No changes to accept");
          }

          return true;
        },

      rejectAllChanges:
        () =>
        ({ editor }) => {
          const tr = editor.state.tr;
          const nodesToProcess: Array<{ node: any; pos: number }> = [];

          // Collect all change nodes in the document
          editor.state.doc.descendants((node: any, pos: number) => {
            if (
              node.type.name === "inlineChange" ||
              node.type.name === "blockChange" ||
              node.type.name === "lineBreakChange"
            ) {
              nodesToProcess.push({ node, pos });
            }
          });

          // Process nodes in reverse order to maintain correct positions
          nodesToProcess.reverse().forEach(({ node, pos }) => {
            if (node.attrs.changeType === "deleted") {
              // Reject deletions: restore the content by replacing change node with its content
              if (node.type.name === "lineBreakChange") {
                tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.hardBreak.create());
              } else {
                tr.replaceWith(pos, pos + node.nodeSize, node.content);
              }
            } else if (node.attrs.changeType === "added") {
              // Reject additions: remove the change node
              tr.delete(pos, pos + node.nodeSize);
            }
          });

          if (nodesToProcess.length > 0) {
            editor.view.dispatch(tr);
            console.log(`Rejected ${nodesToProcess.length} changes`);
          } else {
            console.log("No changes to reject");
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tracking"),
      }),
    ];
  },
});
