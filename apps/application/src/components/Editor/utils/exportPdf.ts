import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { PageFormatPx, pixelsToMm } from '../../../../../../packages/shared/src/tiptap/pageFormat';

type PageFormat = 'a4' | 'letter' | [number, number];
type Orientation = 'portrait' | 'landscape'| 'l' | 'p';

export interface PageMarginsMm {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface PdfExportOptions {
    element: HTMLElement | string;              
    filename?: string;                          
    marginMm?: number;                          // Deprecated: use marginsMm for per-side margins
    marginsMm?: PageMarginsMm;                  // Per-side margins in mm
    format?: PageFormat | PageFormatPx;         // Support both old format and new PageFormatPx
    orientation?: Orientation;                  
    scale?: number;                             
    backgroundColor?: string;                   
    onProgress?: (progress: number) => void;    
    pageFormatFromEditor?: PageFormatPx;        // Optional: pass format directly from editor
}

/**
 * Convert PageFormatPx to jsPDF format
 */
function pageFormatToJsPdfFormat(format: PageFormatPx): [number, number] {
    const widthMm = pixelsToMm(format.width);
    const heightMm = pixelsToMm(format.height);
    return [widthMm, heightMm];
}

/**
 * Determine orientation from dimensions
 */
function determineOrientation(widthMm: number, heightMm: number): Orientation {
    return heightMm > widthMm ? 'portrait' : 'landscape';
}

export async function exportElementToPdf(options: PdfExportOptions) {
    const {
        element,
        filename = 'export.pdf',
        marginMm = 10,
        marginsMm,
        format = 'a4',
        orientation,
        scale = 2,
        backgroundColor = '#ffffff',
        onProgress,
        pageFormatFromEditor,
    } = options;

    const node = typeof element === 'string' ? document.querySelector(element) : element;

    if (!node) {
        throw new Error('Error al exportar el elemento a PDF');
    }

    // Determine the actual format and margins
    let pdfFormat: string | [number, number] = format as string | [number, number];
    let margins: PageMarginsMm;
    let pdfOrientation: Orientation = orientation || 'p';

    if (pageFormatFromEditor) {
        // Use format from editor
        const [widthMm, heightMm] = pageFormatToJsPdfFormat(pageFormatFromEditor);
        pdfFormat = [widthMm, heightMm];
        pdfOrientation = determineOrientation(widthMm, heightMm);
        margins = {
            top: pixelsToMm(pageFormatFromEditor.margins.top),
            right: pixelsToMm(pageFormatFromEditor.margins.right),
            bottom: pixelsToMm(pageFormatFromEditor.margins.bottom),
            left: pixelsToMm(pageFormatFromEditor.margins.left),
        };
    } else if (typeof format === 'object' && 'width' in format) {
        // PageFormatPx passed as format
        const [widthMm, heightMm] = pageFormatToJsPdfFormat(format);
        pdfFormat = [widthMm, heightMm];
        pdfOrientation = orientation || determineOrientation(widthMm, heightMm);
        margins = {
            top: pixelsToMm(format.margins.top),
            right: pixelsToMm(format.margins.right),
            bottom: pixelsToMm(format.margins.bottom),
            left: pixelsToMm(format.margins.left),
        };
    } else if (marginsMm) {
        // Use per-side margins if provided
        margins = marginsMm;
    } else {
        // Use uniform margin (backward compatible)
        margins = {
            top: marginMm,
            right: marginMm,
            bottom: marginMm,
            left: marginMm,
        };
    }

    const canvas = await html2canvas(node as HTMLElement, {
        scale,
        backgroundColor,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.clientWidth,
    });

    const pdf = new jsPDF(pdfOrientation, "mm", pdfFormat);
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    
    // Calculate usable area with per-side margins
    const usableWidthMm = pageWidthMm - margins.left - margins.right;
    const usableHeightMm = pageHeightMm - margins.top - margins.bottom;

    const pxPerMm = canvas.width / usableWidthMm;
    const pageHeightPx = Math.floor(usableHeightMm * pxPerMm);

    let y = 0;
    let pageIndex = 0;

    while (y < canvas.height) {
        const sliceHeight = Math.min(pageHeightPx, canvas.height - y);

        // Create a slice canvas to crop the original
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
    
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("exportElementToPdf: 2D context unavailable");
    
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          y,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const sliceHeightMm = sliceHeight / pxPerMm;
    
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          imgData,
          "JPEG",
          margins.left,
          margins.top,
          usableWidthMm,
          sliceHeightMm,
        );
    
        y += sliceHeight;
        pageIndex += 1;
        if (onProgress) onProgress(Math.min(1, y / canvas.height));
    }

    pdf.save(filename);
}

