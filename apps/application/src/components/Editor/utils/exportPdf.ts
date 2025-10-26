import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

type PageFormat = 'a4' | 'letter' | [number, number];
type Orientation = 'portrait' | 'landscape'| 'l' | 'p';

export interface PdfExportOptions {
    element: HTMLElement | string;              
    filename?: string;                          
    marginMm?: number;                          
    format?: PageFormat;                        
    orientation?: Orientation;                  
    scale?: number;                             
    backgroundColor?: string;                   
    onProgress?: (progress: number) => void;    
}

export async function exportElementToPdf(options: PdfExportOptions) {
    const {
        element,
        filename = 'export.pdf',
        marginMm = 10,
        format = 'a4',
        orientation = 'p',
        scale = 2,
        backgroundColor = '#ffffff',
        onProgress,
    } = options;


    const node = typeof element === 'string' ? document.querySelector(element) : element;

    if (!node) {
        throw new Error('Error al exportar el elemento a PDF');
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

    const pdf = new jsPDF(orientation, "mm", format);
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();
    const usableWidthMm = pageWidthMm - marginMm * 2;
    const usableHeightMm = pageHeightMm - marginMm * 2;

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
          marginMm,
          marginMm,
          usableWidthMm,
          sliceHeightMm,
        );
    
        y += sliceHeight;
        pageIndex += 1;
        if (onProgress) onProgress(Math.min(1, y / canvas.height));

    }

    pdf.save(filename);
}

