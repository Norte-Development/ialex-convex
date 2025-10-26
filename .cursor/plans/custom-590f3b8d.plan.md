<!-- 590f3b8d-32f4-4ee5-8e10-4af8a5e699c0 99c4d667-5f86-43c0-9aaa-2372a0db13dc -->
# Custom Page Formats (Per-Document) + Export & Line Height Integration

## Scope and Decisions

- Build a custom page-format solution (no Pro deps).
- Persist page format per-document via a `doc` global attribute.
- Update export to honor page size and per-side margins.
- Keep existing LineHeight; ensure it renders and exports correctly.

## Data/Types

- Create shared types and built-ins at `packages/shared/src/tiptap/pageFormat.ts`:
- `PageFormatId` | `PageMarginsPx` | `PageFormatPx`
- Built-ins: A4, A3, A5, Letter, Legal, Tabloid (px @96dpi) + margins
- helpers: `cmToPixels`, `mmToPixels`, `pixelsToMm`, `ensurePortraitFormat`

## TipTap Extension (PageFormatExtension)

- New file `apps/application/src/components/Editor/extensions/page-format.ts`:
- addGlobalAttributes on `doc`: `{ pageFormat?: PageFormatPx }` with default A4
- commands: `setPageFormat(format)`, `getPageFormat()`
- onUpdate hook: apply inline style to editor root (width = format.width, padding = margins)
- emits optional callback (prop) for UI sync

## Server Schema Support

- Include the extension in server schema builder to keep doc attrs round-trippable:
- Update `packages/shared/src/tiptap/schema.ts`: import `PageFormatExtension` and add to extensions array before building schema

## UI: Manage Formats

- Add selector + modal in Ribbon Home tab:
- `apps/application/src/components/Editor/Toolbar/PageFormatSelector.tsx`
- `apps/application/src/components/Editor/Toolbar/PageFormatModal.tsx`
- Features:
- Dropdown for built-ins (A4, Letter, …)
- "Custom…" opens modal to input width/height and margins (cm or px with live conversion)
- Apply saves to doc via `editor.commands.setPageFormat` (per-document)
- `onPageFormatChange` equivalent by listening to transaction + extension storage (update UI state)
- Wire into `Ribbon/HomeTab.tsx` alongside LineHeight controls

## Editor Integration

- `apps/application/src/components/Editor/extensions.ts`:
- import and add `PageFormatExtension` to the array
- `apps/application/src/components/Editor/tiptap-editor.tsx`:
- no structural change; extension handles root width/padding via inline styles
- CSS class `legal-editor-content` remains; ensure overflow visible and centered container wrapper

## CSS (screen and print)

- Add `apps/application/src/components/Editor/editor-pages.css`:
- Center content, white background, shadow, page-like look
- Optional print `@media print` to use `pageFormat` sizes if direct browser print is used
- Import CSS in `tiptap-editor.tsx`

## Export Updates (PDF)

- `apps/application/src/components/Editor/utils/exportPdf.ts`:
- Extend options: `format: BuiltInKey | { widthPx, heightPx, marginsPx }`
- Support per-side `marginsMm?: { top; right; bottom; left }`; derive from px via conversion helpers
- Map built-ins to mm (or pass `[wMm, hMm]` to jsPDF). Auto-orient by dimensions; allow override
- Use per-side margins when slicing and placing images
- Optional: accept `pageFormatFromEditor?: PageFormatPx` to avoid duplicate mapping in callers

## Wiring export with editor

- From export button/handler, read `editor.storage` (or `editor.getAttributes('doc')`) to fetch `pageFormat`
- Pass to `exportElementToPdf` using new signature

## Line Height

- Keep `LineHeight` extension as-is; ensure styles are applied on-screen
- No export change needed; html2canvas will capture computed CSS
- Add `Toolbar/LineHeightPicker.tsx` to UI if not already wired

## Backward Compatibility

- If a doc has no `pageFormat`, default to A4
- Server schema tolerates missing attr (optional)

## Validation & Testing

- Manual tests: switch formats, custom margins; verify on-screen width/padding
- Export A4/Letter/custom; verify margins and page breaks
- Regression: long tables and images slicing

### To-dos

- [ ] Add shared page format types, built-ins, unit helpers
- [ ] Implement PageFormatExtension with doc global attr + commands
- [ ] Include PageFormatExtension in shared server schema builder
- [ ] Create PageFormat selector and custom modal UI
- [ ] Add selector to Ribbon/HomeTab and sync state
- [ ] Add page look CSS and import into editor
- [ ] Update exportPdf to support per-side margins and custom format
- [ ] Pass editor pageFormat to export util
- [ ] Ensure LineHeightPicker is wired in toolbar
- [ ] Manual test built-ins, custom, and PDF output