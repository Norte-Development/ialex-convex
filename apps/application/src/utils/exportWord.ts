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
      const alignment = getAlignment(node.attrs?.textAlign);
      return new Paragraph({
        children: convertInlineContent(node.content || []),
        alignment: alignment,
        spacing: { after: 200 },
      });

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

    default:
      console.warn(`⚠️ Tipo de nodo no soportado: ${node.type}`);
      return new Paragraph({ text: "" });
  }
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
