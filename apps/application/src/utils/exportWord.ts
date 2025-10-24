import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
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
 * Convierte nodos de TipTap a párrafos de DOCX
 * Versión inicial - solo texto básico
 */
function convertTipTapToDocx(content: JSONContent): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (!content.content || !Array.isArray(content.content)) {
    console.warn("⚠️ No hay contenido para convertir");
    return [new Paragraph({ text: "" })];
  }

  // Recorrer cada nodo del documento
  content.content.forEach((node) => {
    const para = convertNode(node);
    if (para) {
      paragraphs.push(...(Array.isArray(para) ? para : [para]));
    }
  });

  return paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: "" })];
}

/**
 * Convierte un nodo individual de TipTap
 */
function convertNode(node: JSONContent): Paragraph | Paragraph[] | null {
  console.log("📝 Convirtiendo nodo:", node.type);

  switch (node.type) {
    case "paragraph":
      return new Paragraph({
        children: convertInlineContent(node.content || []),
        spacing: { after: 200 },
      });

    case "heading":
      const level = node.attrs?.level || 1;
      const headingLevel = getHeadingLevel(level);
      return new Paragraph({
        text: extractText(node.content || []),
        heading: headingLevel,
        spacing: { before: 400, after: 200 },
      });

    case "bulletList":
    case "orderedList":
      // Por ahora, convertir listas a párrafos simples con prefijo
      return convertList(node, node.type === "orderedList");

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

  content.forEach((node) => {
    if (node.type === "text") {
      const text = node.text || "";
      const marks = node.marks || [];

      runs.push(
        new TextRun({
          text,
          bold: marks.some((m) => m.type === "bold"),
          italics: marks.some((m) => m.type === "italic"),
          underline: marks.some((m) => m.type === "underline") ? {} : undefined,
        }),
      );
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
