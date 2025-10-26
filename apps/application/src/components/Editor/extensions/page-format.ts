import { Extension } from '@tiptap/core';
import { PageFormatPx, getDefaultPageFormat } from '../../../../../../packages/shared/src/tiptap/pageFormat';

export interface PageFormatOptions {
  onPageFormatChange?: (format: PageFormatPx) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageFormat: {
      setPageFormat: (format: PageFormatPx) => ReturnType;
    };
  }
}

/**
 * PageFormatExtension
 * Manages per-document page format settings including dimensions and margins
 */
export const PageFormatExtension = Extension.create<PageFormatOptions>({
  name: 'pageFormat',

  addOptions() {
    return {
      onPageFormatChange: undefined,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['doc'],
        attributes: {
          pageFormat: {
            default: null,
            parseHTML: (element) => {
              const data = element.getAttribute('data-page-format');
              if (data) {
                try {
                  return JSON.parse(data);
                } catch (e) {
                  return null;
                }
              }
              return null;
            },
            renderHTML: (attributes) => {
              if (attributes.pageFormat) {
                return {
                  'data-page-format': JSON.stringify(attributes.pageFormat),
                };
              }
              return {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setPageFormat:
        (format: PageFormatPx) =>
        ({ chain }) => {
          return chain()
            .updateAttributes('doc', { pageFormat: format })
            .run();
        },
    };
  },

  onUpdate() {
    const format = this.editor.getAttributes('doc').pageFormat || getDefaultPageFormat();
    
    // Apply inline styles to editor root element
    const editorElement = this.editor.view.dom.closest('.ProseMirror') as HTMLElement;
    if (editorElement) {
      editorElement.style.width = `${format.width}px`;
      editorElement.style.paddingTop = `${format.margins.top}px`;
      editorElement.style.paddingRight = `${format.margins.right}px`;
      editorElement.style.paddingBottom = `${format.margins.bottom}px`;
      editorElement.style.paddingLeft = `${format.margins.left}px`;
      editorElement.style.minHeight = `${format.height}px`;
      editorElement.style.boxSizing = 'border-box';
    }

    // Call optional callback for UI sync
    if (this.options.onPageFormatChange) {
      this.options.onPageFormatChange(format);
    }
  },

  onCreate() {
    const format = this.editor.getAttributes('doc').pageFormat || getDefaultPageFormat();
    
    // Apply inline styles to editor root element
    const editorElement = this.editor.view.dom.closest('.ProseMirror') as HTMLElement;
    if (editorElement) {
      editorElement.style.width = `${format.width}px`;
      editorElement.style.paddingTop = `${format.margins.top}px`;
      editorElement.style.paddingRight = `${format.margins.right}px`;
      editorElement.style.paddingBottom = `${format.margins.bottom}px`;
      editorElement.style.paddingLeft = `${format.margins.left}px`;
      editorElement.style.minHeight = `${format.height}px`;
      editorElement.style.boxSizing = 'border-box';
    }

    // Call optional callback for UI sync
    if (this.options.onPageFormatChange) {
      this.options.onPageFormatChange(format);
    }
  },
});

