/**
 * Page Format Types and Built-ins
 * Defines standard page sizes and margin configurations for document formatting
 */

export type PageFormatId = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | 'Custom';

export interface PageMarginsPx {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageFormatPx {
  id: PageFormatId;
  width: number;    // in pixels at 96 DPI
  height: number;   // in pixels at 96 DPI
  margins: PageMarginsPx;
}

/**
 * Unit conversion helpers
 * Standard: 96 DPI (CSS pixels)
 */
export const DPI = 96;
export const CM_PER_INCH = 2.54;
export const MM_PER_INCH = 25.4;

export function cmToPixels(cm: number): number {
  return Math.round((cm / CM_PER_INCH) * DPI);
}

export function mmToPixels(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * DPI);
}

export function pixelsToCm(px: number): number {
  return Math.round((px * CM_PER_INCH / DPI) * 100) / 100;
}

export function pixelsToMm(px: number): number {
  return Math.round((px * MM_PER_INCH / DPI) * 100) / 100;
}

/**
 * Built-in page formats
 * All dimensions are in pixels at 96 DPI
 */
export const BUILT_IN_FORMATS: Record<Exclude<PageFormatId, 'Custom'>, PageFormatPx> = {
  A4: {
    id: 'A4',
    width: mmToPixels(210),
    height: mmToPixels(297),
    margins: {
      top: mmToPixels(25),
      right: mmToPixels(25),
      bottom: mmToPixels(25),
      left: mmToPixels(25),
    },
  },
  A3: {
    id: 'A3',
    width: mmToPixels(297),
    height: mmToPixels(420),
    margins: {
      top: mmToPixels(25),
      right: mmToPixels(25),
      bottom: mmToPixels(25),
      left: mmToPixels(25),
    },
  },
  A5: {
    id: 'A5',
    width: mmToPixels(148),
    height: mmToPixels(210),
    margins: {
      top: mmToPixels(20),
      right: mmToPixels(20),
      bottom: mmToPixels(20),
      left: mmToPixels(20),
    },
  },
  Letter: {
    id: 'Letter',
    width: Math.round(8.5 * DPI),
    height: Math.round(11 * DPI),
    margins: {
      top: Math.round(1 * DPI),
      right: Math.round(1 * DPI),
      bottom: Math.round(1 * DPI),
      left: Math.round(1 * DPI),
    },
  },
  Legal: {
    id: 'Legal',
    width: Math.round(8.5 * DPI),
    height: Math.round(14 * DPI),
    margins: {
      top: Math.round(1 * DPI),
      right: Math.round(1 * DPI),
      bottom: Math.round(1 * DPI),
      left: Math.round(1 * DPI),
    },
  },
  Tabloid: {
    id: 'Tabloid',
    width: Math.round(11 * DPI),
    height: Math.round(17 * DPI),
    margins: {
      top: Math.round(1 * DPI),
      right: Math.round(1 * DPI),
      bottom: Math.round(1 * DPI),
      left: Math.round(1 * DPI),
    },
  },
};

/**
 * Ensure format is in portrait orientation (height > width)
 */
export function ensurePortraitFormat(format: PageFormatPx): PageFormatPx {
  if (format.width > format.height) {
    return {
      ...format,
      width: format.height,
      height: format.width,
      margins: {
        top: format.margins.left,
        right: format.margins.top,
        bottom: format.margins.right,
        left: format.margins.bottom,
      },
    };
  }
  return format;
}

/**
 * Get default page format (A4)
 */
export function getDefaultPageFormat(): PageFormatPx {
  return BUILT_IN_FORMATS.A4;
}

/**
 * Create a custom page format
 */
export function createCustomPageFormat(
  width: number,
  height: number,
  margins?: Partial<PageMarginsPx>
): PageFormatPx {
  return {
    id: 'Custom',
    width,
    height,
    margins: {
      top: margins?.top ?? mmToPixels(25),
      right: margins?.right ?? mmToPixels(25),
      bottom: margins?.bottom ?? mmToPixels(25),
      left: margins?.left ?? mmToPixels(25),
    },
  };
}

