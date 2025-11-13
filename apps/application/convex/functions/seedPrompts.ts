import { mutation } from "../_generated/server";

/**
 * Seeds the database with initial system prompts for the library.
 * This should only be run once during initial setup.
 */
export const seedPrompts = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if prompts already exist
    const existingPrompts = await ctx.db.query("prompts").collect();
    if (existingPrompts.length > 0) {
      return {
        success: false,
        message: "Prompts already exist in the database",
        count: existingPrompts.length,
      };
    }

    const now = Date.now();

    const systemPrompts = [
      {
        titulo:
          "Redacta una demanda por daños y perjuicios por un accidente de tránsito",
        category: "Civil",
        descripcion: "En minutos, tendrás un texto claro y bien fundamentado.",
        prompt:
          "Redacta una demanda por daños y perjuicios por un accidente de tránsito en [ciudad], con fundamentos del Código Civil y Comercial.",
        tags: ["demanda", "civil", "daños", "tránsito"],
      },
      {
        titulo: "Redacta una contestación de demanda laboral",
        category: "Laboral",
        descripcion:
          "Genera una respuesta legal estructurada para una demanda laboral.",
        prompt:
          "Redacta una contestación de demanda laboral por [motivo] en [jurisdicción], incluyendo excepciones preliminares y fundamentos del Derecho Laboral.",
        tags: ["laboral", "contestación", "demanda"],
      },
      {
        titulo: "Elabora un recurso de apelación penal",
        category: "Penal",
        descripcion:
          "Crea un recurso de apelación fundamentado en derecho penal.",
        prompt:
          "Elabora un recurso de apelación contra [tipo de sentencia] en causa penal [número], fundamentado en [motivos], aplicando el Código Penal y jurisprudencia relevante.",
        tags: ["penal", "apelación", "recurso"],
      },
      {
        titulo: "Redacta un contrato de compraventa inmobiliaria",
        category: "Civil",
        descripcion: "Genera un contrato completo de compraventa de inmueble.",
        prompt:
          "Redacta un contrato de compraventa de inmueble ubicado en [dirección completa], entre [vendedor] y [comprador], por un precio de [monto], con cláusulas de garantía, tradición y conformidad al Código Civil y Comercial.",
        tags: ["contrato", "compraventa", "inmueble", "civil"],
      },
      {
        titulo: "Elabora una demanda de divorcio vincular",
        category: "Familia",
        descripcion:
          "Crea una demanda de divorcio con todos los elementos necesarios.",
        prompt:
          "Elabora una demanda de divorcio vincular en [jurisdicción], solicitando [peticiones específicas], con fundamentos en el Código Civil y Comercial, incluyendo cuestiones de alimentos, régimen de comunicación y división de bienes si corresponde.",
        tags: ["divorcio", "familia", "demanda"],
      },
      {
        titulo: "Redacta un acuerdo de confidencialidad (NDA)",
        category: "Comercial",
        descripcion: "Genera un acuerdo de confidencialidad empresarial.",
        prompt:
          "Redacta un acuerdo de confidencialidad entre [parte 1] y [parte 2] para proteger información relacionada con [objeto], con cláusulas de duración, alcance, penalidades y jurisdicción aplicable.",
        tags: ["confidencialidad", "comercial", "contrato", "NDA"],
      },
      {
        titulo: "Elabora una carta documento por incumplimiento contractual",
        category: "Civil",
        descripcion: "Crea una carta documento formal por incumplimiento.",
        prompt:
          "Elabora una carta documento dirigida a [destinatario] por incumplimiento del contrato de [tipo] celebrado el [fecha], intimando al cumplimiento de [obligaciones específicas] en un plazo de [días] días, con fundamentos legales del Código Civil y Comercial.",
        tags: ["carta documento", "incumplimiento", "intimación"],
      },
      {
        titulo: "Redacta una demanda por despido sin causa",
        category: "Laboral",
        descripcion: "Genera una demanda laboral por despido injustificado.",
        prompt:
          "Redacta una demanda por despido sin causa de [nombre del trabajador], empleado de [nombre de la empresa] desde [fecha de ingreso] hasta [fecha de despido], reclamando indemnización por antigüedad, preaviso, integración mes de despido y vacaciones, con fundamento en la Ley de Contrato de Trabajo.",
        tags: ["despido", "laboral", "demanda", "indemnización"],
      },
      {
        titulo: "Elabora un recurso de amparo constitucional",
        category: "Constitucional",
        descripcion:
          "Crea un recurso de amparo por derechos constitucionales vulnerados.",
        prompt:
          "Elabora un recurso de amparo en [jurisdicción] por violación de [derecho constitucional vulnerado], solicitando [medidas cautelares si corresponde], con fundamento en la Constitución Nacional y jurisprudencia de la Corte Suprema.",
        tags: ["amparo", "constitucional", "recurso", "derechos"],
      },
      {
        titulo: "Redacta una demanda de escrituración",
        category: "Civil",
        descripcion:
          "Genera una demanda para exigir escrituración de inmueble.",
        prompt:
          "Redacta una demanda de escrituración de inmueble ubicado en [dirección] contra [demandado], en virtud del boleto de compraventa celebrado el [fecha] por un precio de [monto], solicitando [medidas cautelares] y con fundamento en el Código Civil y Comercial.",
        tags: ["escrituración", "inmueble", "demanda", "civil"],
      },
      {
        titulo: "Elabora una denuncia penal por estafa",
        category: "Penal",
        descripcion: "Crea una denuncia penal por el delito de estafa.",
        prompt:
          "Elabora una denuncia penal por el delito de estafa previsto en el artículo 172 del Código Penal, describiendo los hechos ocurridos [descripción breve], identificando al presunto autor [datos si se conocen], y solicitando medidas de prueba necesarias.",
        tags: ["denuncia", "penal", "estafa"],
      },
      {
        titulo: "Redacta un poder general de administración",
        category: "Civil",
        descripcion: "Genera un poder notarial para administración de bienes.",
        prompt:
          "Redacta un poder general de administración otorgado por [poderdante] a favor de [apoderado], con facultades para [especificar facultades], conforme al Código Civil y Comercial, para ser protocolizado ante Escribano Público.",
        tags: ["poder", "administración", "notarial"],
      },
      {
        titulo: "Elabora una demanda de alimentos",
        category: "Familia",
        descripcion: "Crea una demanda de cuota alimentaria.",
        prompt:
          "Elabora una demanda de alimentos a favor de [beneficiario/s] contra [alimentante] en [jurisdicción], solicitando una cuota mensual de [monto o porcentaje], con fundamento en el Código Civil y Comercial y considerando [circunstancias relevantes].",
        tags: ["alimentos", "familia", "demanda", "cuota"],
      },
      {
        titulo: "Redacta un contrato de locación de inmueble",
        category: "Civil",
        descripcion: "Genera un contrato de alquiler de vivienda o comercio.",
        prompt:
          "Redacta un contrato de locación de inmueble con destino [habitacional/comercial] ubicado en [dirección], entre [locador] y [locatario], por un plazo de [meses/años], precio mensual de [monto], con cláusulas de actualización, garantías y conforme a la Ley de Alquileres.",
        tags: ["locación", "alquiler", "contrato", "inmueble"],
      },
      {
        titulo: "Elabora una oposición a medida cautelar",
        category: "Procesal",
        descripcion:
          "Crea una presentación oponiéndose a una cautelar solicitada.",
        prompt:
          "Elabora una oposición a la medida cautelar de [tipo] solicitada en autos [carátula], fundada en [argumentos de ausencia de verosimilitud/peligro en la demora], con citas del Código Procesal y jurisprudencia aplicable.",
        tags: ["cautelar", "oposición", "procesal"],
      },
    ];

    const promptIds = [];
    for (const promptData of systemPrompts) {
      const promptId = await ctx.db.insert("prompts", {
        ...promptData,
        isPublic: true,
        createdBy: "system",
        usageCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      promptIds.push(promptId);
    }

    return {
      success: true,
      message: "System prompts seeded successfully",
      count: promptIds.length,
      promptIds,
    };
  },
});
