import { Extension } from "@tiptap/core";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Transaction, EditorState } from "@tiptap/pm/state";
import { createJsonDiff } from "../../../../../packages/shared/src/diff/jsonDiff";

type ReviewMode = "alwaysDiff" | "disabled";

export type ChangeReviewGroup = {
  id: string;
  label: string;
  source: "tool" | "user";
  createdAt: number;
  patches: Array<Patch>;
  visible: boolean;
};

export type Patch = {
  prevDocHash?: string;
  nextDocHash?: string;
  diff: unknown;
  ranges: Array<{ from: number; to: number }>;
  transactionId: string;
};

type Baseline = {
  snapshot: any;
  createdAt: number;
} | null;

type ChangeReviewStorage = {
  mode: ReviewMode;
  baseline: Baseline;
  groups: Record<string, ChangeReviewGroup>;
  activeGroupId: string | null;
};

const pluginKey = new PluginKey<{
  decorationSet: DecorationSet;
  storage: ChangeReviewStorage;
}>("changeReviewPlugin");

function getOrCreateGroup(storage: ChangeReviewStorage, id: string, label?: string, source: "tool" | "user" = "user"): ChangeReviewGroup {
  if (!storage.groups[id]) {
    storage.groups[id] = {
      id,
      label: label ?? id,
      source,
      createdAt: Date.now(),
      patches: [],
      visible: true,
    };
  }
  return storage.groups[id];
}

function collectInsertedRanges(tr: Transaction): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const mapping = tr.mapping;
  for (let i = 0; i < mapping.maps.length; i++) {
    const map = mapping.maps[i];
    map.forEach((
      _oldStart: number,
      _oldEnd: number,
      newStart: number,
      newEnd: number,
    ) => {
      if (newEnd > newStart) {
        ranges.push({ from: newStart, to: newEnd });
      }
    });
  }
  return ranges;
}

export const ChangeReviewExtension = Extension.create<{ reviewOptions?: { mode?: ReviewMode } }>({
  name: "changeReview",

  addStorage(): ChangeReviewStorage {
    return {
      mode: (this.options?.reviewOptions?.mode ?? "alwaysDiff") as ReviewMode,
      baseline: null,
      groups: {},
      activeGroupId: null,
    };
  },

  addCommands() {
    return {
      startReview:
        (options?: { resetBaseline?: boolean }) =>
        ({ editor }: { editor: TiptapEditor }) => {
          const storage = this.storage as ChangeReviewStorage;
          if (options?.resetBaseline || !storage.baseline) {
            storage.baseline = { snapshot: editor.getJSON(), createdAt: Date.now() };
          }
          return true;
        },

      applyAll:
        () =>
        ({ editor }: { editor: TiptapEditor }) => {
          const storage = this.storage as ChangeReviewStorage;
          storage.baseline = { snapshot: editor.getJSON(), createdAt: Date.now() };
          storage.groups = {};
          // Clear decorations by resetting plugin state
          const view = editor.view;
          const pluginState = pluginKey.getState(view.state);
          if (pluginState) {
            const empty = DecorationSet.empty;
            const tr = view.state.tr.setMeta(pluginKey, { resetDecorations: true });
            view.dispatch(tr);
            (pluginState as any).decorationSet = empty;
          }
          return true;
        },

      clearReviewState:
        () =>
        () => {
          const storage = this.storage as ChangeReviewStorage;
          storage.groups = {};
          return true;
        },

      applyGroup:
        (groupId: string) =>
        ({ editor }: { editor: TiptapEditor }) => {
          const storage = this.storage as ChangeReviewStorage;
          if (!storage.groups[groupId]) return false;
          // Remove decorations for this group by issuing a meta update
          const view = editor.view;
          const tr = view.state.tr.setMeta(pluginKey, { removeGroup: groupId });
          view.dispatch(tr);
          delete storage.groups[groupId];
          return true;
        },

      revertAll:
        () =>
        () => {
          // Placeholder: full inverse application is non-trivial; implement later
          console.warn("revertAll not implemented yet");
          return false;
        },

      revertGroup:
        (_groupId: string) =>
        () => {
          // Placeholder: group inverse; implement later
          console.warn("revertGroup not implemented yet");
          return false;
        },

      toggleGroupVisibility:
        (groupId: string, visible?: boolean) =>
        () => {
          const storage = this.storage as ChangeReviewStorage;
          const group = storage.groups[groupId];
          if (!group) return false;
          group.visible = visible ?? !group.visible;
          return true;
        },

      setChangeReviewGroup:
        (args: { id: string; label?: string; source?: "tool" | "user" } | null) =>
        () => {
          const storage = this.storage as ChangeReviewStorage;
          if (args === null) {
            storage.activeGroupId = null;
            return true;
          }
          const { id, label, source } = args;
          storage.activeGroupId = id;
          getOrCreateGroup(storage, id, label, source ?? "tool");
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as ChangeReviewStorage;
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_config: unknown, state: EditorState) => {
            return {
              decorationSet: DecorationSet.create(state.doc, []),
              storage,
            };
          },
          apply: (
            tr: Transaction,
            pluginState: { decorationSet: DecorationSet; storage: ChangeReviewStorage },
            oldState: EditorState,
            newState: EditorState,
          ) => {
            let decorationSet = pluginState.decorationSet.map(tr.mapping, tr.doc);

            // Clear all decorations if requested
            const meta = tr.getMeta(pluginKey) as any;
            if (meta?.resetDecorations) {
              decorationSet = DecorationSet.empty;
            }
            if (meta?.removeGroup) {
              // Filter out decorations tagged with this group
              const groupId = meta.removeGroup as string;
              const decorations: Decoration[] = [];
              decorationSet.find().forEach((d: Decoration) => {
                if ((d.spec as any)?.groupId !== groupId) decorations.push(d);
              });
              decorationSet = DecorationSet.create(tr.doc, decorations);
            }

            // Establish baseline lazily on first doc change
            if (!storage.baseline && tr.docChanged && storage.mode === "alwaysDiff") {
              storage.baseline = { snapshot: oldState.doc.toJSON(), createdAt: Date.now() };
            }

            // Only track diffs when enabled and doc changed
            if (storage.mode === "alwaysDiff" && tr.docChanged) {
              const prevDoc = oldState.doc.toJSON();
              const nextDoc = newState.doc.toJSON();
              const diff = createJsonDiff(prevDoc, nextDoc);

              const ranges = collectInsertedRanges(tr);

              // Render simple inline decorations for inserted ranges
              const decos: Decoration[] = [];
              const groupId = storage.activeGroupId ?? `user:${Date.now()}`;
              getOrCreateGroup(storage, groupId, storage.activeGroupId ? storage.groups[groupId]?.label : "User Edit", storage.activeGroupId ? storage.groups[groupId]?.source : "user");

              for (const r of ranges) {
                if (r.to > r.from) {
                  decos.push(
                    Decoration.inline(r.from, r.to, {
                      class: "cr-inserted",
                      groupId,
                    })
                  );
                }
              }

              if (decos.length > 0) {
                decorationSet = decorationSet.add(tr.doc, decos);
              }

              // Save patch metadata to the group
              const group = storage.groups[groupId];
              group.patches.push({
                prevDocHash: undefined,
                nextDocHash: undefined,
                diff,
                ranges,
                transactionId: String((tr as any).curId ?? Date.now()),
              });
            }

            return {
              decorationSet,
              storage,
            };
          },
        },
        props: {
          decorations: (state: EditorState) => {
            const ps = pluginKey.getState(state);
            return ps?.decorationSet ?? null;
          },
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    changeReview: {
      startReview: (options?: { resetBaseline?: boolean }) => ReturnType;
      applyAll: () => ReturnType;
      clearReviewState: () => ReturnType;
      applyGroup: (groupId: string) => ReturnType;
      revertAll: () => ReturnType;
      revertGroup: (groupId: string) => ReturnType;
      toggleGroupVisibility: (groupId: string, visible?: boolean) => ReturnType;
      setChangeReviewGroup: (args: { id: string; label?: string; source?: "tool" | "user" } | null) => ReturnType;
    };
  }
}

