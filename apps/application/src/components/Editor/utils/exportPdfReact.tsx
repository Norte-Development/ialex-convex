import {
  Document,
  Page,
  Text,
  View,
  Link,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
// @ts-ignore - TypeScript cache issue with @tiptap/core types
import type { JSONContent } from '@tiptap/react';

interface PdfExportOptions {
  title: string;
  courtName?: string;
  expedientNumber?: string;
  presentationDate?: number;
}

/**
 * Estilos globales para el documento PDF
 * Basados en el formato estándar de documentos legales
 */
const styles = StyleSheet.create({
  page: {
    padding: '10mm',
    fontSize: 11,
    fontFamily: 'Times-Roman',
    lineHeight: 1.5,
  },
  // Header metadata
  courtName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  expedientNumber: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Párrafos
  paragraph: {
    marginBottom: 8,
    textAlign: 'left',
  },
  // Headings
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 16,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 14,
  },
  heading3: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 12,
  },
  heading4: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 10,
  },
  heading5: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 8,
  },
  heading6: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 6,
  },
  // Listas
  listItem: {
    marginBottom: 4,
    marginLeft: 20,
    flexDirection: 'row',
  },
  listBullet: {
    width: 15,
  },
  listContent: {
    flex: 1,
  },
  // Blockquote
  blockquote: {
    marginLeft: 20,
    marginRight: 20,
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#cccccc',
    fontStyle: 'italic',
  },
  // Code block
  codeBlock: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'Courier',
    fontSize: 10,
  },
  // Tabla
  table: {
    marginTop: 8,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  tableCell: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#cccccc',
  },
  tableHeader: {
    flex: 1,
    padding: 4,
    backgroundColor: '#e0e0e0',
    fontWeight: 'bold',
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  // Link
  link: {
    color: '#0563C1',
    textDecoration: 'underline',
  },
  // Horizontal rule
  horizontalRule: {
    marginTop: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  // Image
  image: {
    marginTop: 12,
    marginBottom: 12,
    maxWidth: '100%',
    maxHeight: 400,
    objectFit: 'contain',
  },
});

/**
 * Convierte contenido de TipTap JSON a un documento PDF usando @react-pdf/renderer
 * Genera PDFs con texto seleccionable, archivos más livianos y mejor accesibilidad
 */
export async function exportToPdfReact(
  content: JSONContent,
  options: PdfExportOptions,
): Promise<void> {
  console.log('🔍 Contenido a exportar (React-PDF):', content);

  // Generar el documento PDF como blob
  const blob = await pdf(<EscritoDocument content={content} options={options} />).toBlob();

  // Descargar el archivo
  const filename = `${options.title.replace(/\s+/g, '_')}.pdf`;
  saveAs(blob, filename);

  console.log('✅ PDF generado con React-PDF:', filename);
}

/**
 * Componente principal del documento PDF
 */
function EscritoDocument({
  content,
  options,
}: {
  content: JSONContent;
  options: PdfExportOptions;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header con metadata */}
        {options.courtName && (
          <Text style={styles.courtName}>{options.courtName}</Text>
        )}

        {options.expedientNumber && (
          <Text style={styles.expedientNumber}>
            Expediente: {options.expedientNumber}
          </Text>
        )}

        {/* Título del documento */}
        <Text style={styles.documentTitle}>{options.title}</Text>

        {/* Contenido del documento */}
        {content.content?.map((node: JSONContent, index: number) => (
          <ConvertNode key={index} node={node} />
        ))}
      </Page>
    </Document>
  );
}

/**
 * Convierte un nodo individual de TipTap a componentes React-PDF
 */
function ConvertNode({ node }: { node: JSONContent }) {
  console.log('📝 Convirtiendo nodo:', node.type, node.attrs);

  switch (node.type) {
    case 'paragraph':
      return <ConvertParagraph node={node} />;

    case 'heading':
      return <ConvertHeading node={node} />;

    case 'bulletList':
    case 'orderedList':
      return <ConvertList node={node} numbered={node.type === 'orderedList'} />;

    case 'blockquote':
      return <ConvertBlockquote node={node} />;

    case 'codeBlock':
      return <ConvertCodeBlock node={node} />;

    case 'table':
      return <ConvertTable node={node} />;

    case 'image':
      return <ConvertImage node={node} />;

    case 'horizontalRule':
      return <View style={styles.horizontalRule} />;

    case 'hardBreak':
      return <Text style={{ marginBottom: 4 }}>{'\n'}</Text>;

    default:
      console.warn(`⚠️ Tipo de nodo no soportado aún: ${node.type}`);
      return null;
  }
}

/**
 * Convierte un párrafo con su contenido inline
 * Maneja imágenes dividiendo el párrafo en segmentos
 */
function ConvertParagraph({ node }: { node: JSONContent }) {
  const alignment = getAlignment(node.attrs?.textAlign);
  const content = node.content || [];

  // Verificar si hay imágenes en el contenido
  const hasImage = content.some((n: JSONContent) => n.type === 'image');

  // Si no hay imágenes, renderizar normalmente
  if (!hasImage) {
    return (
      <Text style={[styles.paragraph, { textAlign: alignment }]}>
        {content.map((child: JSONContent, index: number) => (
          <ConvertInlineNode key={index} node={child} />
        ))}
      </Text>
    );
  }

  // Si hay imágenes, dividir en segmentos
  const elements: any[] = [];
  let textSegment: JSONContent[] = [];

  const flushTextSegment = () => {
    if (textSegment.length > 0) {
      elements.push(
        <Text key={`text-${elements.length}`} style={[styles.paragraph, { textAlign: alignment }]}>
          {textSegment.map((child: JSONContent, index: number) => (
            <ConvertInlineNode key={index} node={child} />
          ))}
        </Text>
      );
      textSegment = [];
    }
  };

  content.forEach((child: JSONContent) => {
    if (child.type === 'image') {
      // Vaciar el segmento de texto actual
      flushTextSegment();
      
      // Agregar la imagen
      const src = child.attrs?.src;
      if (src) {
        elements.push(
          <Image
            key={`image-${elements.length}`}
            src={src}
            style={styles.image}
          />
        );
      }
    } else {
      // Acumular nodos de texto
      textSegment.push(child);
    }
  });

  // Vaciar cualquier texto restante
  flushTextSegment();

  // Retornar todos los elementos (puede ser una mezcla de Text e Image)
  return (
    <>
      {elements}
    </>
  );
}

/**
 * Convierte un heading según su nivel
 */
function ConvertHeading({ node }: { node: JSONContent }) {
  const level = node.attrs?.level || 1;
  const alignment = getAlignment(node.attrs?.textAlign);
  const headingStyle = getHeadingStyle(level);
  const text = extractText(node.content || []);

  return (
    <Text style={[headingStyle, { textAlign: alignment }]}>
      {text}
    </Text>
  );
}

/**
 * Convierte contenido inline (texto con formato)
 */
function ConvertInlineNode({ node }: { node: JSONContent }) {
  // Las imágenes inline se manejan en ConvertParagraph
  if (node.type === 'image') {
    // No debería llegar aca si ConvertParagraph hace su trabajo
    return null;
  }

  if (node.type === 'text') {
    const text = node.text || '';
    const marks = node.marks || [];

    // Construir el objeto de estilo basado en las marks
    const textStyle: any = {};

    // Check if there's a link mark
    const linkMark = marks.find((m: any) => m.type === 'link');
    if (linkMark?.attrs?.href) {
      return (
        <Link src={linkMark.attrs.href} style={styles.link}>
          {text}
        </Link>
      );
    }

    // Bold
    if (marks.some((m: any) => m.type === 'bold')) {
      textStyle.fontWeight = 'bold';
    }

    // Italic
    if (marks.some((m: any) => m.type === 'italic')) {
      textStyle.fontStyle = 'italic';
    }

    // Underline
    if (marks.some((m: any) => m.type === 'underline')) {
      textStyle.textDecoration = 'underline';
    }

    // Color (desde textStyle mark)
    const colorMark = marks.find((m: any) => m.type === 'textStyle');
    if (colorMark?.attrs?.color) {
      textStyle.color = colorMark.attrs.color;
    }

    // Strike through
    if (marks.some((m: any) => m.type === 'strike')) {
      textStyle.textDecoration = 'line-through';
    }

    return <Text style={textStyle}>{text}</Text>;
  }

  if (node.type === 'hardBreak') {
    return <Text>{'\n'}</Text>;
  }

  return null;
}

/**
 * Extrae texto plano de contenido inline
 */
function extractText(content: JSONContent[]): string {
  return content
    .filter((node) => node.type === 'text')
    .map((node) => node.text || '')
    .join('');
}

/**
 * Obtiene la alineación de texto
 */
function getAlignment(align?: string): 'left' | 'center' | 'right' | 'justify' {
  switch (align) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    case 'justify':
      return 'justify';
    default:
      return 'left';
  }
}

/**
 * Obtiene el estilo de heading según el nivel
 */
function getHeadingStyle(level: number) {
  const headingStyles: { [key: number]: any } = {
    1: styles.heading1,
    2: styles.heading2,
    3: styles.heading3,
    4: styles.heading4,
    5: styles.heading5,
    6: styles.heading6,
  };
  return headingStyles[level] || styles.heading1;
}

/**
 * Convierte una lista (ordenada  o no ordenada)
 */
function ConvertList({ node, numbered }: { node: JSONContent; numbered: boolean }) {
  const items = node.content || [];
  
  return (
    <>
      {items.map((item: JSONContent, index: number) => {
        const itemContent = item.content || [];
        const firstParagraph = itemContent[0];
        const text = firstParagraph ? extractText(firstParagraph.content || []) : '';
        const bullet = numbered ? `${index + 1}. ` : '• ';
        
        return (
          <View key={index} style={styles.listItem}>
            <Text style={styles.listBullet}>{bullet}</Text>
            <Text style={styles.listContent}>{text}</Text>
          </View>
        );
      })}
    </>
  );
}

/**
 * Convierte un blockquote
 */
function ConvertBlockquote({ node }: { node: JSONContent }) {
  const content = node.content || [];
  
  return (
    <View style={styles.blockquote}>
      {content.map((childNode: JSONContent, index: number) => {
        if (childNode.type === 'paragraph') {
          const text = extractText(childNode.content || []);
          return <Text key={index}>{text}</Text>;
        }
        return null;
      })}
    </View>
  );
}

/**
 * Convierte un bloque de código
 */
function ConvertCodeBlock({ node }: { node: JSONContent }) {
  const text = extractText(node.content || []);
  
  return (
    <View style={styles.codeBlock}>
      <Text>{text}</Text>
    </View>
  );
}

/**
 * Convierte una tabla
 */
function ConvertTable({ node }: { node: JSONContent }) {
  const rows = node.content || [];
  
  return (
    <View style={styles.table}>
      {rows.map((rowNode: JSONContent, rowIndex: number) => {
        if (rowNode.type === 'tableRow') {
          const cells = rowNode.content || [];
          
          return (
            <View key={rowIndex} style={styles.tableRow}>
              {cells.map((cellNode: JSONContent, cellIndex: number) => {
                const isHeader = cellNode.type === 'tableHeader';
                const cellContent = cellNode.content || [];
                
                // Extraer texto de los párrafos dentro de la celda
                const text = cellContent
                  .map((content: JSONContent) => {
                    if (content.type === 'paragraph') {
                      return extractText(content.content || []);
                    }
                    return '';
                  })
                  .join(' ');
                
                return (
                  <View key={cellIndex} style={isHeader ? styles.tableHeader : styles.tableCell}>
                    <Text>{text}</Text>
                  </View>
                );
              })}
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

/**
 * Convierte una imagen
 */
function ConvertImage({ node }: { node: JSONContent }) {
  const src = node.attrs?.src;
  const alt = node.attrs?.alt || 'Imagen';
  
  if (!src) {
    console.warn('⚠️ Imagen sin src, creando texto placeholder');
    return (
      <Text style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
        [Imagen: {alt}]
      </Text>
    );
  }

  try {
    // react-pdf soporta directamente base64 y URLs
    return (
      <Image
        src={src}
        style={styles.image}
      />
    );
  } catch (error) {
    console.error('❌ Error al procesar imagen:', error);
    return (
      <Text style={{ textAlign: 'center', marginTop: 8, marginBottom: 8 }}>
        [Error cargando imagen: {alt}]
      </Text>
    );
  }
}

