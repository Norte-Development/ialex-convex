import { Extension } from '@tiptap/core';
import { PageFormatPx, getDefaultPageFormat } from './pageFormat';

/**
 * PageFormatExtension for server-side schema
 * This is a minimal version that only defines the global attribute for doc persistence
 * No commands or lifecycle hooks since this is for server-side schema generation
 */
export const PageFormatExtension = Extension.create({
  name: 'pageFormat',

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
});

