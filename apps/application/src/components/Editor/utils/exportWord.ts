import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  ExternalHyperlink,
} from "docx";
import { saveAs } from "file-saver";
import type { JSONContent } from "@tiptap/core";

interface ExportOptions {
  title: string;
  courtName?: string;
  expedientNumber?: string;
  presentationDate?: number;
}

/**
 * Convierte contenido de TipTap JSON a un documento Word
 * Implementación básica - iremos mejorando paso a paso
 */
export async function exportToWord(
  content: JSONContent,
  options: ExportOptions,
): Promise<void> {
  console.log("🔍 Contenido a exportar:", content);

  // Crear el documento
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header con metadata
          ...(options.courtName
            ? [
                new Paragraph({
                  text: options.courtName,
                  heading: HeadingLevel.HEADING_2,
                  alignment: AlignmentType.CENTER,
                }),
              ]
            : []),

          ...(options.expedientNumber
            ? [
                new Paragraph({
                  text: `Expediente: ${options.expedientNumber}`,
                  alignment: AlignmentType.CENTER,
                }),
              ]
            : []),

          // Título del escrito
          new Paragraph({
            text: options.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Contenido - por ahora solo convertimos lo básico
          ...convertTipTapToDocx(content),
        ],
      },
    ],
  });

  // Generar y descargar
  const blob = await Packer.toBlob(doc);
  const filename = `${options.title.replace(/\s+/g, "_")}.docx`;
  saveAs(blob, filename);

  console.log("✅ Documento Word generado:", filename);
}

/**
 * Convierte nodos de TipTap a elementos de DOCX (Párrafos o Tablas)
 */
function convertTipTapToDocx(content: JSONContent): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  if (!content.content || !Array.isArray(content.content)) {
    console.warn("⚠️ No hay contenido para convertir");
    return [new Paragraph({ text: "" })];
  }

  // Recorrer cada nodo del documento
  content.content.forEach((node) => {
    const result = convertNode(node);
    if (result) {
      if (Array.isArray(result)) {
        elements.push(...result);
      } else {
        elements.push(result);
      }
    }
  });

  return elements.length > 0 ? elements : [new Paragraph({ text: "" })];
}

/**
 * Convierte un nodo individual de TipTap
 */
function convertNode(
  node: JSONContent,
): Paragraph | Paragraph[] | Table | null {
  console.log("📝 Convirtiendo nodo:", node.type, node.attrs);

  switch (node.type) {
    case "paragraph":
      return convertParagraphNode(node);

    case "heading":
      const level = node.attrs?.level || 1;
      const headingLevel = getHeadingLevel(level);
      const headingAlign = getAlignment(node.attrs?.textAlign);
      return new Paragraph({
        text: extractText(node.content || []),
        heading: headingLevel,
        alignment: headingAlign,
        spacing: { before: 400, after: 200 },
      });

    case "bulletList":
    case "orderedList":
      return convertList(node, node.type === "orderedList");

    case "blockquote":
      return convertBlockquote(node);

    case "codeBlock":
      return convertCodeBlock(node);

    case "table":
      return convertTable(node);

    case "horizontalRule":
      return new Paragraph({
        text: "─".repeat(50),
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });

    case "hardBreak":
      return new Paragraph({
        text: "",
        spacing: { after: 100 },
      });

    case "image":
      return convertImage(node);

    default:
      console.warn(`⚠️ Tipo de nodo no soportado: ${node.type}`);
      return new Paragraph({ text: "" });
  }
}

/**
 * Convierte un párrafo manejando imágenes inline (divide en múltiples párrafos si es necesario)
 */
function convertParagraphNode(node: JSONContent): Paragraph | Paragraph[] {
  const alignment = getAlignment(node.attrs?.textAlign);
  const inline = node.content || [];

  // Si no hay imágenes, devolvemos un único párrafo normal
  const hasImage = inline.some((n) => n.type === "image");
  if (!hasImage) {
    return new Paragraph({
      children: convertInlineContent(inline),
      alignment,
      spacing: { after: 200 },
    });
  }

  // Si hay imágenes, dividimos el contenido en segmentos: texto antes, imagen, texto después, etc.
  const paragraphs: Paragraph[] = [];
  let currentTextRuns: TextRun[] = [];

  const flushTextParagraph = () => {
    if (currentTextRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: currentTextRuns,
          alignment,
          spacing: { after: 200 },
        }),
      );
      currentTextRuns = [];
    }
  };

  for (const child of inline) {
    if (child.type === "image") {
      // Primero cerramos el párrafo de texto acumulado
      flushTextParagraph();
      // Luego insertamos la imagen como su propio párrafo
      const imgPara = convertImage(child);
      paragraphs.push(imgPara);
    } else if (child.type === "hardBreak") {
      currentTextRuns.push(new TextRun({ text: "", break: 1 }));
    } else if (child.type === "text") {
      // Reutilizamos la lógica de estilos
      const [textRun] = convertInlineContent([child]);
      currentTextRuns.push(textRun);
    } else {
      // Para cualquier otro nodo inline, lo intentamos convertir a runs genéricos
      currentTextRuns.push(...convertInlineContent([child]));
    }
  }

  // Volcar el texto restante
  flushTextParagraph();

  // Garantizar al menos un párrafo vacío si por alguna razón no hay contenido
  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: "" })];
}

/**
 * Convierte contenido inline (texto con formato)
 */
function convertInlineContent(content: JSONContent[]): TextRun[] {
  const runs: TextRun[] = [];

  if (!content || content.length === 0) {
    return [new TextRun({ text: "" })];
  }

  content.forEach((node) => {
    if (node.type === "text") {
      const text = node.text || "";
      const marks = node.marks || [];

      // Extraer color si existe
      const colorMark = marks.find((m) => m.type === "textStyle");
      const color = colorMark?.attrs?.color;

      runs.push(
        new TextRun({
          text,
          bold: marks.some((m) => m.type === "bold"),
          italics: marks.some((m) => m.type === "italic"),
          underline: marks.some((m) => m.type === "underline") ? {} : undefined,
          color: color ? color.replace("#", "") : undefined, // Word usa hex sin #
        }),
      );
    } else if (node.type === "hardBreak") {
      // Agregar salto de línea dentro del párrafo
      runs.push(new TextRun({ text: "", break: 1 }));
    } else if (node.type === "image") {
      // Las imágenes inline NO se renderizan dentro del mismo párrafo en DOCX.
      // convertParagraphNode manejará separar la imagen en su propio párrafo.
      // Aquí insertamos un marcador de salto para cortar el párrafo antes de la imagen.
      runs.push(new TextRun({ text: "" }));
    }
  });

  return runs.length > 0 ? runs : [new TextRun({ text: "" })];
}

/**
 * Extrae texto plano de contenido inline
 */
function extractText(content: JSONContent[]): string {
  return content
    .filter((node) => node.type === "text")
    .map((node) => node.text || "")
    .join("");
}

/**
 * Convierte listas
 */
function convertList(node: JSONContent, numbered: boolean): Paragraph[] {
  const items = node.content || [];
  return items.map((item, index) => {
    const text = extractText(item.content?.[0]?.content || []);
    const prefix = numbered ? `${index + 1}. ` : "• ";

    return new Paragraph({
      text: prefix + text,
      spacing: { after: 100 },
      indent: { left: 720 }, // Indentación
    });
  });
}

/**
 * Convierte un blockquote
 */
function convertBlockquote(node: JSONContent): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const content = node.content || [];

  content.forEach((childNode) => {
    if (childNode.type === "paragraph") {
      // Obtener el contenido y hacerlo itálico
      const inlineContent = childNode.content || [];
      const runs: TextRun[] = [];

      inlineContent.forEach((inlineNode) => {
        if (inlineNode.type === "text") {
          const marks = inlineNode.marks || [];
          runs.push(
            new TextRun({
              text: inlineNode.text || "",
              italics: true, // Todo el blockquote en itálica
              bold: marks.some((m) => m.type === "bold"),
              underline: marks.some((m) => m.type === "underline")
                ? {}
                : undefined,
            }),
          );
        }
      });

      paragraphs.push(
        new Paragraph({
          children: runs.length > 0 ? runs : [new TextRun({ text: "" })],
          indent: { left: 720, right: 720 },
          spacing: { before: 200, after: 200 },
          border: {
            left: {
              color: "CCCCCC",
              space: 1,
              style: "single",
              size: 6,
            },
          },
        }),
      );
    }
  });

  return paragraphs;
}

/**
 * Convierte un code block
 */
function convertCodeBlock(node: JSONContent): Paragraph {
  const text = extractText(node.content || []);

  return new Paragraph({
    text: text,
    shading: {
      fill: "F5F5F5",
    },
    indent: { left: 360 },
    spacing: { before: 200, after: 200 },
    style: "Code",
  });
}

/**
 * Convierte una tabla de TipTap a DOCX
 */
function convertTable(node: JSONContent): Table {
  const rows: TableRow[] = [];
  const tableContent = node.content || [];

  tableContent.forEach((rowNode) => {
    if (rowNode.type === "tableRow") {
      const cells: TableCell[] = [];
      const rowContent = rowNode.content || [];

      rowContent.forEach((cellNode) => {
        if (cellNode.type === "tableCell" || cellNode.type === "tableHeader") {
          const isHeader = cellNode.type === "tableHeader";
          const cellContent = cellNode.content || [];

          // Convertir el contenido de la celda
          const cellParagraphs: Paragraph[] = [];
          cellContent.forEach((contentNode) => {
            if (contentNode.type === "paragraph") {
              cellParagraphs.push(
                new Paragraph({
                  children: convertInlineContent(contentNode.content || []),
                }),
              );
            }
          });

          cells.push(
            new TableCell({
              children:
                cellParagraphs.length > 0
                  ? cellParagraphs
                  : [new Paragraph({ text: "" })],
              shading: isHeader
                ? {
                    fill: "E0E0E0", // Fondo gris para headers
                  }
                : undefined,
            }),
          );
        }
      });

      rows.push(
        new TableRow({
          children: cells,
        }),
      );
    }
  });

  return new Table({
    rows: rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  });
}

/**
 * Convierte una imagen de TipTap a DOCX
 */
function convertImage(node: JSONContent): Paragraph {
  console.log("🖼️ Convirtiendo imagen:", node.attrs);
  
  const src = node.attrs?.src;
  const alt = node.attrs?.alt || "Imagen";
  const width = node.attrs?.width;
  const height = node.attrs?.height;
  
  if (!src) {
    console.warn("⚠️ Imagen sin src, creando párrafo de texto");
    return new Paragraph({
      text: `[Imagen: ${alt}]`,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  }

  try {
    // Determinar si es una imagen base64 o URL
    const isBase64 = src.startsWith('data:');
    const isUrl = src.startsWith('http://') || src.startsWith('https://');
    
    if (isBase64) {
      // Manejar imagen base64
      const base64Data = src.split(',')[1];
      const mimeType = src.split(',')[0].split(':')[1].split(';')[0];
      
      // Convertir base64 a ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log("✅ Imagen base64 convertida, tamaño:", bytes.length, "bytes", "tipo:", mimeType);
      
      // Determinar el tipo de imagen para DOCX
      let imageType: "jpg" | "png" | "gif" | "bmp" = "png";
      if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
        imageType = "jpg";
      } else if (mimeType.includes("gif")) {
        imageType = "gif";
      } else if (mimeType.includes("bmp")) {
        imageType = "bmp";
      }
      
      const imageRun = new ImageRun({
        data: bytes,
        transformation: {
          width: width ? Math.min(width, 600) : 300,
          height: height ? Math.min(height, 400) : 200,
        },
        type: imageType,
      });
      
      return new Paragraph({
        children: [imageRun],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });
      
    } else if (isUrl) {
      // Para URLs, crear un enlace externo (no podemos cargar la imagen directamente)
      const hyperlink = new ExternalHyperlink({
        link: src,
        children: [new TextRun({ text: `[Imagen: ${alt}]`, color: "0563C1" })],
      });
      
      return new Paragraph({
        children: [hyperlink],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });
      
    } else {
      // Imagen local o ruta relativa
      console.warn("⚠️ Tipo de imagen no soportado:", src.substring(0, 50));
      return new Paragraph({
        text: `[Imagen: ${alt}]`,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      });
    }
    
  } catch (error) {
    console.error("❌ Error procesando imagen:", error);
    return new Paragraph({
      text: `[Error cargando imagen: ${alt}]`,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    });
  }
}

/**
 * Obtiene la alineación de texto
 */
function getAlignment(
  align?: string,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case "left":
      return AlignmentType.LEFT;
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

/**
 * Mapea nivel de heading de TipTap a DOCX
 */
function getHeadingLevel(
  level: number,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  const map: {
    [key: number]: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  } = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };
  return map[level] || HeadingLevel.HEADING_1;
}
