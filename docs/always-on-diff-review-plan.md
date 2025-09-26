### Always‑On Diff Review for Editor Tools (Execute/Stream) — Plan

#### Goal
Keep diffs visible at all times while allowing continuous edits (from tools or users), instead of forcing accept/reject gating per edit. Provide global controls like “Apply All”, and granular controls like “Apply/Revert Group”.

#### Principles
- Always show accumulated diffs against a single baseline snapshot.
- Do not block subsequent edits; new edits add more diff data.
- Group diffs by origin (e.g., toolCallId or “User Edit”).
- Support streaming updates (merge chunks into the same group).
- Make resolution explicit with “Apply All”, “Apply Group”, “Revert Group”, “Clear”.

---

### Architecture Overview

- Baseline Manager
  - Captures a baseline document snapshot `B0` (ProseMirror JSON) when review starts or on first diffable edit.
  - Can be refreshed (“Apply All”) to set `B0 := currentDoc` and clear accumulated diffs.

- Change Review Extension (TipTap/ProseMirror Plugin)
  - Maintains `ChangeState` with:
    - `baseline`: the `B0` snapshot
    - `groups: Record<GroupId, ChangeGroup>`
    - `decorationSet`: rendered inserted/deleted ranges
    - `visibility controls`: per‑group show/hide
  - Applies decorations for added/removed text/blocks across groups with distinct colors.
  - Supports mapping through subsequent transactions so highlights stay aligned (uses ProseMirror `Mapping` from steps).

- Executor Bridge (executeTool/streamTool)
  - Wraps each document‑changing operation in metadata for the plugin:
    - `meta: { changeReview: { groupId, label, source: 'tool' | 'user', timestamp } }`
  - For streaming: repeatedly annotate with the same `groupId` until `hasFinished`.
  - Non‑blocking: Applies mutations immediately; the plugin computes and records deltas per transaction.

---

### Data Model

- ChangeGroup
  - `id: string` (e.g., toolCallId or generated UUID)
  - `label: string` (e.g., toolName + short description)
  - `source: 'tool' | 'user'`
  - `createdAt: number`
  - `patches: Array<Patch>` (ordered)
  - `visible: boolean` (default true)

- Patch
  - `prevDocHash: string` (optional, integrity/debug)
  - `nextDocHash: string` (optional)
  - `diff: JsonDiff` (struct for insert/delete/replace at ranges)
  - `ranges: Array<TrackedRange>`: concrete positions used for decorations; kept current via Mapping
  - `transactionId: string`

- Baseline
  - `snapshot: PMJSON`
  - `createdAt: number`

Notes:
- We compute diffs incrementally transaction‑by‑transaction so each Patch has a small scope and an inverse can be produced if needed.
- For display as “current vs baseline”, we can derive a composite diff by folding all patches over `B0` OR simply render all patch ranges with layered decorations (preferred for performance and UX clarity).

---

### Diff Computation Strategy

1) Transaction‑level diffs
   - On each transaction that carries `meta.changeReview`, compute a JSON diff between `prevDoc` and `nextDoc` to produce a `Patch`.
   - Convert the diff to `TrackedRange` spans for decorations (text blocks, inline, or node boundaries).
   - Store in the addressed `ChangeGroup`.

2) Mapping and stability
   - Persist `DecorationSet` and remap via `tr.mapping` on subsequent transactions to keep highlights aligned.
   - When a group’s content is edited again (by user or other tools), new patches simply add to that or another group; ranges may overlap (see Overlaps below).

3) Overlaps
   - Allow overlaps; render with priority by recency or by group order. Provide a per‑group visibility toggle to reduce visual noise.

---

### Rendering

- Use a dedicated TipTap extension (e.g., `ChangeReviewExtension`) to:
  - Maintain plugin state (`ChangeState`).
  - Draw inserted text with background color and underline; deleted text as gutter markers and inline strike ghosts (optional) or side annotations.
  - Provide widgets for block‑level insertions/deletions (e.g., paragraph added/removed indicators in the left gutter).

- Sidebar/Panel UI
  - List `ChangeGroup`s with counts and timestamps.
  - Controls: Show/Hide, Apply Group, Revert Group.
  - Global controls: Apply All, Revert All, Clear (discard review state only).

---

### Executor Integration

- executeTool(options)
  - Accept `reviewOptions.mode = 'alwaysDiff' | 'disabled'` (default to `alwaysDiff`).
  - For any document change, annotate the transaction with `meta.changeReview` containing `groupId`, `label`, `source: 'tool'`.
  - Baseline auto‑starts on first diffable operation.

- streamTool({ toolCallId, hasFinished })
  - Use a stable `groupId = toolCallId`.
  - Each partial mutation carries the same group metadata; the plugin appends patches to that group.
  - On `hasFinished: true`, mark group as complete (no special gating; purely metadata).

---

### Commands & Controls

- Global
  - `startReview({ resetBaseline?: boolean })`
  - `applyAll()` → sets `baseline = currentDoc` and clears groups
  - `revertAll()` → compute inverse of all patches (from most recent to oldest) and apply as a single transaction
  - `clearReviewState()` → leave document as‑is; clear groups and keep baseline or reset

- Per Group
  - `applyGroup(groupId)` → no change to doc content (already applied); this simply marks the group as resolved, or folds it into baseline immediately by updating baseline and removing only that group’s decorations.
  - `revertGroup(groupId)` → compute inverse of the group’s patches and apply
  - `toggleGroupVisibility(groupId, visible)`

Note: Because edits are applied immediately, “Apply” actions conceptually mean “accept and remove from review” (i.e., bake into baseline state).

---

### Persistence & Replay (Optional, Phase 2)

- Persist review state (baseline hash, groups metadata) in UI state or Convex (per thread/document) for reconnect durability.
- Rehydrate on load, re‑scan document to rebuild `DecorationSet` when possible.

---

### Performance Considerations

- Decorations
  - Use `DecorationSet` remapping; batch updates; throttle expensive recomputations.
  - Cap max visible groups or switch to cluster rendering for very large documents.

- Diff granularity
  - Prefer transaction‑level diffs for locality and easy inverse.
  - For large node replacements, generate block‑level markers rather than full inline spans.

---

### Streaming Behavior Details

- Open Group per `toolCallId` stays active during stream; patches appended as chunks arrive.
- InsertContent streaming: first chunk determines anchor; subsequent chunks extend ranges.
- On finish, group marked complete; decorations remain until “Apply/Revert”.

---

### API Sketches

```ts
// Executor options (client)
type ExecuteToolOptions = {
  toolName: string;
  input: unknown;
  reviewOptions?: { mode?: 'alwaysDiff' | 'disabled' };
  metadata?: { groupId?: string; label?: string };
};

type StreamToolOptions = {
  toolCallId: string;
  toolName: string;
  input: unknown; // partial when streaming
  hasFinished?: boolean;
  reviewOptions?: { mode?: 'alwaysDiff' | 'disabled' };
};

// Plugin commands
editor.commands.startReview({ resetBaseline?: boolean });
editor.commands.applyAll();
editor.commands.revertAll();
editor.commands.clearReviewState();
editor.commands.applyGroup(groupId: string);
editor.commands.revertGroup(groupId: string);
editor.commands.toggleGroupVisibility(groupId: string, visible?: boolean);
```

---

### UI/UX

- Always‑visible diff overlays in the editor.
- Right (or left) side panel listing change groups (badge counts, timestamps).
- “Apply All” primary action; secondary actions per group.
- Hovering a group highlights its ranges; clicking scrolls to first range.

---

### Edge Cases

- Overlapping groups → deterministic z‑index by recency or fixed color order; visibility toggles to reduce clutter.
- Deletions of entire blocks → show gutter tombstones and panel entries; revert restores content from patch.
- Large content replacements → collapse to block markers with an expand toggle.
- Concurrent edits (user typing during tool streaming) → both produce patches; mapping keeps decorations aligned.

---

### Phased Implementation

1) Foundation
   - Create `ChangeReviewExtension` with baseline, groups, decoration rendering, and remapping.
   - Provide editor commands for baseline and group operations.

2) Executor Integration
   - Update local executor to stamp transactions with `meta.changeReview` (groupId/label/source).
   - Implement `executeTool`/`streamTool` wiring.

3) UI Panel
   - Sidebar listing groups; toggles and actions (Apply/Revert/Clear).
   - “Apply All” button in toolbar.

4) Streaming Polish
   - Group chunk merging; better anchors for streamed insertions.
   - Stress test mapping with long sessions.

5) Performance & Persistence
   - Throttle decoration updates; lazy rendering for large docs.
   - Optional Convex persistence for review state.

---

### Open Questions

- Should “Apply Group” immediately update the baseline (partial baseline bake), or only mark resolved and delay baseline refresh to “Apply All”? (Plan suggests immediate baseline bake for that group.)
- Color strategy for many groups (hash of groupId vs rotating palette)?
- Persistence needs: per session only or per thread/document across sessions?


