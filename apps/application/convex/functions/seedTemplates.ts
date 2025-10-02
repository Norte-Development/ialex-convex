import { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Seeds the database with sample legal templates (modelos).
 * This should be called once to populate initial templates.
 * 
 * Creates a variety of common legal document templates in both HTML and JSON formats.
 */
export const seedTemplates = internalMutation({
  args: {},
  returns: v.object({
    created: v.number(),
    templateIds: v.array(v.id("modelos")),
  }),
  handler: async (ctx) => {
    const templateIds: Array<Id<"modelos">> = [];
    
    // Template 1: Demanda Civil (HTML)
    const demandaCivilId = await ctx.db.insert("modelos", {
      name: "Demanda Civil",
      description: "Plantilla estándar para presentación de demanda en materia civil",
      category: "Derecho Civil",
      content_type: "html",
      content: `
        <h1>DEMANDA</h1>
        <p><strong>SEÑOR JUEZ CIVIL:</strong></p>
        <p>[NOMBRE DEL DEMANDANTE], DNI [NÚMERO], con domicilio real en [DIRECCIÓN], constituyendo domicilio procesal en [DIRECCIÓN PROCESAL], a V.S. respetuosamente dice:</p>
        
        <h2>I. OBJETO</h2>
        <p>Que por la presente y en legal forma, vengo a promover DEMANDA por [TIPO DE ACCIÓN] contra [NOMBRE DEL DEMANDADO], DNI [NÚMERO], con domicilio en [DIRECCIÓN], por los fundamentos de hecho y de derecho que a continuación se exponen.</p>
        
        <h2>II. HECHOS</h2>
        <p>[Descripción detallada de los hechos que fundamentan la demanda]</p>
        
        <h2>III. DERECHO</h2>
        <p>Los hechos expuestos encuentran su fundamento legal en:</p>
        <ul>
          <li>[Artículo y ley aplicable]</li>
          <li>[Artículo y ley aplicable]</li>
        </ul>
        
        <h2>IV. PETITORIO</h2>
        <p>Por lo expuesto, solicito a V.S.:</p>
        <ol>
          <li>Se admita la presente demanda</li>
          <li>Se corra traslado a la parte demandada</li>
          <li>Oportunamente se haga lugar a la demanda con costas</li>
        </ol>
        
        <p>PROVEER DE CONFORMIDAD,<br/>
        SERÁ JUSTICIA</p>
      `,
      isPublic: true,
      createdBy: "system",
      tags: ["demanda", "civil", "general"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(demandaCivilId);

    // Template 2: Contestación de Demanda (HTML)
    const contestacionId = await ctx.db.insert("modelos", {
      name: "Contestación de Demanda",
      description: "Plantilla para contestar una demanda civil",
      category: "Derecho Civil",
      content_type: "html",
      content: `
        <h1>CONTESTACIÓN DE DEMANDA</h1>
        <p><strong>SEÑOR JUEZ:</strong></p>
        <p>[NOMBRE DEL DEMANDADO], DNI [NÚMERO], en los autos caratulados "[CARÁTULA]" Expte. N° [NÚMERO], constituyendo domicilio procesal en [DIRECCIÓN], a V.S. respetuosamente dice:</p>
        
        <h2>I. OBJETO</h2>
        <p>Que dentro del plazo legal vengo a contestar la demanda interpuesta en mi contra, negando, rechazando y contradictoriamente los hechos y el derecho invocados por la parte actora.</p>
        
        <h2>II. NEGATIVA DE LOS HECHOS</h2>
        <p>Niego categóricamente los hechos invocados por la parte actora en los siguientes términos:</p>
        <p>[Detalle de la negativa de los hechos]</p>
        
        <h2>III. DEFENSAS</h2>
        <p>[Exposición de las defensas y argumentos]</p>
        
        <h2>IV. PRUEBA</h2>
        <p>Ofrezco la siguiente prueba:</p>
        <ul>
          <li>Documental: [Detalle]</li>
          <li>Testimonial: [Detalle]</li>
        </ul>
        
        <h2>V. PETITORIO</h2>
        <p>Por lo expuesto, solicito a V.S.:</p>
        <ol>
          <li>Se tenga por contestada la demanda en tiempo y forma</li>
          <li>Se admitan las defensas opuestas</li>
          <li>Oportunamente se rechace la demanda con costas</li>
        </ol>
        
        <p>PROVEER DE CONFORMIDAD,<br/>
        SERÁ JUSTICIA</p>
      `,
      isPublic: true,
      createdBy: "system",
      tags: ["contestación", "defensa", "civil"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(contestacionId);

    // Template 3: Recurso de Apelación (JSON)
    const recursoApelacionId = await ctx.db.insert("modelos", {
      name: "Recurso de Apelación",
      description: "Plantilla para interponer recurso de apelación",
      category: "Derecho Procesal",
      content_type: "json",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, textAlign: null },
            content: [{ type: "text", text: "RECURSO DE APELACIÓN" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", marks: [{ type: "bold" }], text: "SEÑOR JUEZ:" }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[NOMBRE], DNI [NÚMERO], en los autos caratulados \"[CARÁTULA]\" Expte. N° [NÚMERO], a V.S. respetuosamente dice:" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "I. OBJETO" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "Que vengo a interponer RECURSO DE APELACIÓN contra la resolución de fecha [FECHA] que [DESCRIPCIÓN DE LA RESOLUCIÓN APELADA]." }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "II. AGRAVIOS" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "La resolución apelada causa agravio a mi parte por los siguientes fundamentos:" }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[Detalle de los agravios]" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "III. PETITORIO" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "Por lo expuesto, solicito a V.S.:" }
            ]
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    attrs: { textAlign: null },
                    content: [{ type: "text", text: "Se conceda el presente recurso de apelación" }]
                  }
                ]
              },
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    attrs: { textAlign: null },
                    content: [{ type: "text", text: "Se eleven las actuaciones al Superior Tribunal" }]
                  }
                ]
              }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "PROVEER DE CONFORMIDAD," },
              { type: "hardBreak" },
              { type: "text", text: "SERÁ JUSTICIA" }
            ]
          }
        ]
      }),
      isPublic: true,
      createdBy: "system",
      tags: ["recurso", "apelación", "procesal"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(recursoApelacionId);

    // Template 4: Escrito de Inicio de Divorcio (HTML)
    const divorcioId = await ctx.db.insert("modelos", {
      name: "Demanda de Divorcio",
      description: "Plantilla para iniciar trámite de divorcio",
      category: "Derecho de Familia",
      content_type: "html",
      content: `
        <h1>DEMANDA DE DIVORCIO</h1>
        <p><strong>SEÑOR JUEZ DE FAMILIA:</strong></p>
        <p>[NOMBRE DEL DEMANDANTE], DNI [NÚMERO], con domicilio real en [DIRECCIÓN], constituyendo domicilio procesal en [DIRECCIÓN PROCESAL], a V.S. respetuosamente dice:</p>
        
        <h2>I. OBJETO</h2>
        <p>Que por la presente vengo a promover DEMANDA DE DIVORCIO VINCULAR contra [NOMBRE DEL CÓNYUGE], DNI [NÚMERO], con domicilio en [DIRECCIÓN].</p>
        
        <h2>II. HECHOS</h2>
        <p>Que me encuentro unido/a en matrimonio con el/la demandado/a desde el día [FECHA DE MATRIMONIO], conforme acta de matrimonio que se acompaña.</p>
        <p>Que de dicha unión nacieron [NÚMERO] hijos: [NOMBRES Y EDADES].</p>
        <p>Que las relaciones matrimoniales se encuentran interrumpidas desde [FECHA], existiendo voluntad de ambas partes de disolver el vínculo matrimonial.</p>
        
        <h2>III. CONVENIO REGULADOR</h2>
        <p>Las partes hemos acordado los siguientes términos:</p>
        <ul>
          <li><strong>Régimen de comunicación con hijos:</strong> [Detalle]</li>
          <li><strong>Cuota alimentaria:</strong> [Detalle]</li>
          <li><strong>Atribución del hogar conyugal:</strong> [Detalle]</li>
          <li><strong>Distribución de bienes:</strong> [Detalle]</li>
        </ul>
        
        <h2>IV. DERECHO</h2>
        <p>Fundo la presente en lo dispuesto por el Código Civil y Comercial de la Nación, artículos 435 y concordantes.</p>
        
        <h2>V. PETITORIO</h2>
        <p>Por lo expuesto, solicito a V.S.:</p>
        <ol>
          <li>Se admita la presente demanda</li>
          <li>Se cite a audiencia a las partes</li>
          <li>Se homologue el convenio regulador presentado</li>
          <li>Oportunamente se decrete el divorcio vincular</li>
        </ol>
        
        <p>PROVEER DE CONFORMIDAD,<br/>
        SERÁ JUSTICIA</p>
      `,
      isPublic: true,
      createdBy: "system",
      tags: ["divorcio", "familia", "matrimonio"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(divorcioId);

    // Template 5: Carta Documento (HTML)
    const cartaDocumentoId = await ctx.db.insert("modelos", {
      name: "Carta Documento",
      description: "Plantilla para redactar una carta documento",
      category: "Derecho Civil",
      content_type: "html",
      content: `
        <h1>CARTA DOCUMENTO</h1>
        <p><strong>A: [NOMBRE DEL DESTINATARIO]</strong><br/>
        <strong>Domicilio:</strong> [DIRECCIÓN]</p>
        
        <p>De mi mayor consideración:</p>
        
        <p>Por medio de la presente, y en carácter de [CALIDAD EN LA QUE ACTÚA], me dirijo a Ud. a los efectos de notificarle lo siguiente:</p>
        
        <p>[CUERPO DE LA CARTA - Descripción de la situación]</p>
        
        <p>En virtud de lo expuesto, le notifico que:</p>
        <ul>
          <li>[Punto 1]</li>
          <li>[Punto 2]</li>
          <li>[Punto 3]</li>
        </ul>
        
        <p>Le otorgo un plazo de [NÚMERO] días hábiles a partir de la recepción de la presente para [REQUERIMIENTO ESPECÍFICO].</p>
        
        <p>Caso contrario, me veré obligado/a a iniciar las acciones legales que correspondan para la defensa de mis derechos, con expresa reserva de reclamar daños y perjuicios.</p>
        
        <p>Sin otro particular, saludo a Ud. atentamente.</p>
        
        <p>[NOMBRE Y FIRMA]<br/>
        DNI [NÚMERO]<br/>
        [FECHA]</p>
      `,
      isPublic: true,
      createdBy: "system",
      tags: ["carta documento", "notificación", "intimación"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(cartaDocumentoId);

    // Template 6: Contrato de Compraventa (HTML)
    const compraventaId = await ctx.db.insert("modelos", {
      name: "Contrato de Compraventa",
      description: "Plantilla de contrato de compraventa de bien inmueble",
      category: "Derecho Comercial",
      content_type: "html",
      content: `
        <h1>CONTRATO DE COMPRAVENTA</h1>
        
        <p>En la ciudad de [CIUDAD], a los [NÚMERO] días del mes de [MES] de [AÑO], entre:</p>
        
        <p><strong>VENDEDOR:</strong> [NOMBRE COMPLETO], DNI [NÚMERO], con domicilio en [DIRECCIÓN], en adelante "EL VENDEDOR".</p>
        
        <p><strong>COMPRADOR:</strong> [NOMBRE COMPLETO], DNI [NÚMERO], con domicilio en [DIRECCIÓN], en adelante "EL COMPRADOR".</p>
        
        <p>Las partes acuerdan celebrar el presente contrato de compraventa, sujeto a las siguientes cláusulas:</p>
        
        <h2>PRIMERA - OBJETO</h2>
        <p>EL VENDEDOR vende al COMPRADOR, quien acepta comprar, el inmueble ubicado en [DIRECCIÓN COMPLETA], cuya matrícula es [NÚMERO DE MATRÍCULA], con una superficie de [MEDIDAS] metros cuadrados.</p>
        
        <h2>SEGUNDA - PRECIO</h2>
        <p>El precio total de la compraventa se establece en la suma de $ [MONTO] ([MONTO EN LETRAS]), que el COMPRADOR abonará de la siguiente manera:</p>
        <ul>
          <li>$ [MONTO] al momento de la firma del presente contrato</li>
          <li>$ [MONTO] al momento de la escrituración</li>
        </ul>
        
        <h2>TERCERA - ESTADO DEL INMUEBLE</h2>
        <p>El inmueble se vende en el estado en que se encuentra, declarando el COMPRADOR conocerlo y aceptarlo.</p>
        
        <h2>CUARTA - ESCRITURACIÓN</h2>
        <p>La escritura traslativa de dominio se realizará dentro del plazo de [NÚMERO] días corridos a contar desde la fecha del presente.</p>
        
        <h2>QUINTA - GASTOS</h2>
        <p>Los gastos de escrituración e impuestos de transmisión serán a cargo de [PARTE RESPONSABLE].</p>
        
        <h2>SEXTA - JURISDICCIÓN</h2>
        <p>Para todos los efectos legales del presente contrato, las partes se someten a la jurisdicción de los Tribunales Ordinarios de [CIUDAD].</p>
        
        <p>En prueba de conformidad, se firman [NÚMERO] ejemplares de un mismo tenor y a un solo efecto.</p>
        
        <p><br/><br/>
        _______________________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;_______________________<br/>
        FIRMA VENDEDOR&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;FIRMA COMPRADOR</p>
      `,
      isPublic: true,
      createdBy: "system",
      tags: ["contrato", "compraventa", "inmueble", "comercial"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(compraventaId);

    // Template 7: Alegatos (JSON)
    const alegatosId = await ctx.db.insert("modelos", {
      name: "Alegatos",
      description: "Plantilla para presentar alegatos finales",
      category: "Derecho Procesal",
      content_type: "json",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1, textAlign: null },
            content: [{ type: "text", text: "ALEGATOS" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", marks: [{ type: "bold" }], text: "SEÑOR JUEZ:" }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[NOMBRE], en representación de [PARTE], en los autos \"[CARÁTULA]\" Expte. N° [NÚMERO], a V.S. respetuosamente dice:" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "I. OBJETO" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "Que cerrado el período probatorio, vengo en tiempo y forma a presentar los alegatos de mi parte." }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "II. HECHOS ACREDITADOS" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "De las pruebas producidas en autos, han quedado acreditados los siguientes hechos:" }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[Análisis de la prueba producida y hechos acreditados]" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "III. VALORACIÓN DE LA PRUEBA" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[Valoración detallada de cada prueba]" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "IV. DERECHO APLICABLE" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "[Fundamentos jurídicos]" }
            ]
          },
          {
            type: "heading",
            attrs: { level: 2, textAlign: null },
            content: [{ type: "text", text: "V. CONCLUSIÓN" }]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "Por todo lo expuesto, solicito a V.S. haga lugar a la pretensión de mi parte con costas." }
            ]
          },
          {
            type: "paragraph",
            attrs: { textAlign: null },
            content: [
              { type: "text", text: "PROVEER DE CONFORMIDAD," },
              { type: "hardBreak" },
              { type: "text", text: "SERÁ JUSTICIA" }
            ]
          }
        ]
      }),
      isPublic: true,
      createdBy: "system",
      tags: ["alegatos", "procesal", "conclusión"],
      usageCount: 0,
      isActive: true,
    });
    templateIds.push(alegatosId);

    console.log(`Created ${templateIds.length} sample templates`);
    
    return {
      created: templateIds.length,
      templateIds: templateIds,
    };
  },
});

