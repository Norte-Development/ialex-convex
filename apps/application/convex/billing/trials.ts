import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "../_generated/server";
import { internal, api } from "../_generated/api";
import Stripe from "stripe";

const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Send welcome email when trial starts
 */
export const sendTrialWelcome = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    const subject = "Bienvenido a IAlex Derecho Argentino I Potenciado por IA";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5; text-align: center;">Bienvenido a IAlex Derecho Argentino I Potenciado por IA</h1>
        
        <p>Hola, ${args.name},</p>
        
        <p>Felicitaciones. Acabas de tomar una de las decisiones más estratégicas para el futuro de tu práctica legal.</p>
        
        <p>Durante los próximos 14 días, no solo vas a probar un software; vas a experimentar lo que se siente al operar desde un verdadero centro de mando legal, el caos administrativo y las tareas repetitivas son parte del pasado.</p>
        
        <p>Sabemos que tu tiempo es tu activo más valioso. Por eso, te proponemos tres acciones clave para que descubras el poder de iAlex en menos de 15 minutos:</p>
        
        <ol style="margin: 20px 0; padding-left: 20px;">
          <li style="margin: 10px 0;"><strong>Crea tu Primer Caso:</strong> Ve a "Casos", haz clic en "Nuevo Caso" y carga la información básica de un expediente real en el que estés trabajando ahora mismo.</li>
          
          <li style="margin: 10px 0;"><strong>Subí tu Primer Documento Clave:</strong> Ingresa a tu nuevo caso y arrastra un documento esencial (una demanda, una contestación, una prueba). Observa cómo iAlex lo centraliza y lo mantiene siempre a tu alcance.</li>
          
          <li style="margin: 10px 0;"><strong>Hacé tu Primera Búsqueda con IA:</strong> Utiliza nuestra barra de búsqueda inteligente para encontrar jurisprudencia o doctrina relevante para ese caso. Obtene respuestas contextualizadas en segundos, no en horas.</li>
        </ol>
        
        <p>Completar estos tres pasos te dará una visión clara de cómo iAlex transformará tu flujo de trabajo.</p>
        
        <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Aca podes encontrar unos tutoriales de como realizar las operaciones básicas dentro de IAlex</strong></p>
          <p style="margin: 10px 0 0 0;">
            <a href="https://www.youtube.com/channel/UC-zI1KzkNwY4QI4Pob7ElfQ" 
               style="color: #4F46E5; text-decoration: none;">
              IAlex Derecho Argentino I Potenciado por IA - YouTube
            </a>
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/casos" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
            Comenzar con iAlex
          </a>
        </div>
        
        <p style="margin-top: 30px;">Un saludo,<br><strong>El Equipo de IAlex</strong></p>
        
        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #6B7280;">
          <p>Este email fue enviado a ${args.email} porque comenzaste tu prueba gratuita de iAlex.</p>
        </div>
      </div>
    `;

    // Send email using the existing notification service
    await ctx.runMutation(internal.utils.resend.sendEmail, {
      from: "iAlex <notificaciones@ialex.com.ar>",
      to: args.email,
      subject,
      body: htmlContent,
    });

    console.log(`📧 Sent trial welcome email to ${args.email}`);
    return null;
  },
});

/**
 * Send trial reminder emails (day 7 and day 12)
 */
export const sendTrialReminder = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    reminderType: v.union(v.literal("mid_trial"), v.literal("final_warning")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Verify user still has active trial
    const user = await ctx.runQuery(api.billing.trials.getTrialUser, {
      userId: args.userId,
    });

    if (!user || user.trialStatus !== "active") {
      console.log(
        `⏭️  Skipping ${args.reminderType} email - user ${args.userId} no longer in trial`,
      );
      return null;
    }

    const daysLeft = Math.ceil(
      (user.trialEndDate - Date.now()) / (1000 * 60 * 60 * 24),
    );
    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    let subject: string;
    let htmlContent: string;

    if (args.reminderType === "mid_trial") {
      subject = `Tu prueba gratuita de iAlex - ${daysLeft} días restantes 🎉`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">¡Hola ${args.name}!</h1>
          <p>Te quedan <strong>${daysLeft} días</strong> de tu prueba gratuita de iAlex Premium.</p>
          <p>¿Cómo va tu experiencia? Estás disfrutando de:</p>
          <ul>
            <li>Casos ilimitados</li>
            <li>Documentos ilimitados</li>
            <li>Acceso a GPT-5</li>
            <li>Y mucho más...</li>
          </ul>
          <p>¿Tienes alguna pregunta? Estamos aquí para ayudarte.</p>
          <a href="${baseUrl}/preferencias?section=billing" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Ver opciones de actualización
          </a>
        </div>
      `;
    } else {
      subject = "Sobre el futuro de tu práctica legal";
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; text-align: center;">Sobre el futuro de tu práctica legal</h1>
          <p>Hola, ${args.name},</p>
          <p><strong>Tu prueba gratuita de iAlex termina en 48 horas.</strong></p>
          <p>Durante estos días tuviste la oportunidad de probar un sistema que te permite operar con claridad y control. Abogados como vos nos dicen que una vez que experimentan esa agilidad, volver atrás se siente como un retroceso inaceptable.</p>
          <p>iAlex no es un gasto, es la mejor inversión que podés hacer en tu eficiencia. Por menos de lo que cuesta un café por día, estás comprando tu recurso más valioso: <strong>tiempo para pensar, para crear estrategias y para captar nuevos clientes.</strong></p>
          <p>Te invitamos a seguir construyendo una práctica legal moderna, ágil y escalable.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/preferencias?section=billing&trial=upgrade" 
               style="display: inline-block; background: #4F46E5; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Continuar con iAlex Premium
            </a>
          </div>
          
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #374151;"><strong>¿Tenés alguna duda sobre los planes o funcionalidades?</strong></p>
            <p style="margin: 10px 0 0 0; color: #6B7280;">Simplemente respondé a este email y hablemos. Estamos para ayudarte a tomar la mejor decisión.</p>
          </div>
          
          <p style="margin-top: 30px;">Saludos,<br><strong>El Equipo de iAlex</strong></p>
        </div>
      `;
    }

    // Send email using the existing notification service
    await ctx.runMutation(internal.utils.resend.sendEmail, {
      from: "iAlex <notificaciones@ialex.com.ar>",
      to: args.email,
      subject,
      body: htmlContent,
    });

    console.log(`📧 Sent ${args.reminderType} email to ${args.email}`);
    return null;
  },
});

/**
 * Handle trial expiration - send email and attempt conversion
 */
export const handleTrialExpiration = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(api.billing.trials.getTrialUser, {
      userId: args.userId,
    });

    if (!user || user.trialStatus !== "active") {
      console.log(
        `⏭️  Skipping expiration - user ${args.userId} already processed`,
      );
      return null;
    }

    // Check if user has payment method
    const customer = await ctx.runQuery(
      api.billing.trials.getCustomerPaymentMethod,
      {
        userId: args.userId,
      },
    );

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    if (customer?.hasPaymentMethod) {
      // Attempt to create subscription
      try {
        await ctx.runAction(
          internal.billing.trials.createSubscriptionForExpiredTrial,
          {
            userId: args.userId,
            customerId: customer.customerId,
          },
        );

        // Send success email
        await ctx.runMutation(internal.utils.resend.sendEmail, {
          from: "iAlex <notificaciones@ialex.com.ar>",
          to: args.email,
          subject: "¡Bienvenido a iAlex Premium! 🎉",
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #10B981;">¡Bienvenido a Premium!</h1>
              <p>Hola ${args.name},</p>
              <p>Tu prueba gratuita ha terminado y hemos procesado exitosamente tu suscripción Premium.</p>
              <p>Continúa disfrutando de todas las funciones ilimitadas de iAlex.</p>
              <a href="${baseUrl}/casos" style="display: inline-block; background: #4F46E5; 
                     color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Ir a mis casos
              </a>
            </div>
          `,
        });

        console.log(`✅ Converted trial user ${args.userId} to paid`);
      } catch (error) {
        console.error(`❌ Failed to convert trial user ${args.userId}:`, error);
        // Fall through to expired flow
      }
    }

    // If no payment method or conversion failed, mark as expired
    await ctx.runMutation(internal.billing.trials.markTrialExpired, {
      userId: args.userId,
    });

    // Send trial expired email
    await ctx.runMutation(internal.utils.resend.sendEmail, {
      from: "iAlex <notificaciones@ialex.com.ar>",
      to: args.email,
      subject: "Últimas horas para mantener tu centro de mando",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; text-align: center;">Últimas horas para mantener tu centro de mando</h1>
          <p>Hola, ${args.name},</p>
          <p><strong>Tu prueba gratuita de iAlex finaliza hoy.</strong> Este es el último recordatorio para que no pierdas el acceso a tus beneficios y la estructura que has comenzado a construir.</p>
          <p>No dejes que el trabajo urgente le gane al trabajo importante. Invertir en tu propia eficiencia es la decisión más estratégica que podés tomar.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/preferencias?section=billing&trial=upgrade" 
               style="display: inline-block; background: #DC2626; color: white; padding: 16px 32px; 
                      text-decoration: none; border-radius: 6px; font-size: 18px; font-weight: bold;
                      box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
              QUIERO MANTENER MI ACCESO PREMIUM A IALEX
            </a>
          </div>
          
          <p style="color: #6B7280; font-style: italic; margin-top: 30px;">Ha sido un placer tenerte a bordo durante esta prueba. Esperamos seguir siendo tu aliado en el camino hacia una práctica más libre y poderosa.</p>
          
          <p style="margin-top: 30px;">Saludos cordiales,<br><strong>El Equipo de iAlex</strong></p>
        </div>
      `,
    });

    console.log(`📧 Sent trial expired email to ${args.email}`);
    return null;
  },
});

/**
 * Get trial user info (internal query)
 */
export const getTrialUser = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      trialStatus: v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("converted"),
        v.literal("none"),
      ),
      trialEndDate: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.trialStatus || !user.trialEndDate) {
      return null;
    }
    return {
      trialStatus: user.trialStatus,
      trialEndDate: user.trialEndDate,
    };
  },
});

/**
 * Check if customer has payment method
 */
export const getCustomerPaymentMethod = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      hasPaymentMethod: v.boolean(),
      customerId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();

    if (!customer) {
      return null;
    }

    return {
      hasPaymentMethod:
        customer.stripe?.invoice_settings?.default_payment_method != null,
      customerId: customer.customerId,
    };
  },
});

/**
 * Create subscription for expired trial user
 */
export const createSubscriptionForExpiredTrial = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const priceId = process.env.VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL;
    if (!priceId) {
      throw new Error("VITE_STRIPE_PRICE_PREMIUM_INDIVIDUAL not configured");
    }

    // Create subscription (will charge immediately)
    const subscription = await stripeSDK.subscriptions.create({
      customer: args.customerId,
      items: [{ price: priceId }],
      metadata: {
        userId: args.userId,
        convertedFromTrial: "true",
      },
    });

    // Mark as converted
    await ctx.runMutation(internal.billing.trials.markTrialConverted, {
      userId: args.userId,
    });

    return null;
  },
});

/**
 * Mark trial as expired
 */
export const markTrialExpired = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      trialStatus: "expired",
    });
    return null;
  },
});

/**
 * Mark trial as converted
 */
export const markTrialConverted = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      trialStatus: "converted",
    });
    return null;
  },
});

/**
 * Send day 3 email: Asistente de Investigación Personal
 */
export const sendDay3ResearchAssistant = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subject = "IAlex: Tu Asistente de Investigación Personal";
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5; text-align: center;">IAlex: Tu Asistente de Investigación Personal</h1>
        <p>Hola, ${args.name},</p>
        <p>¿Cuántas noches te quedaste hasta tarde buscando ESE fallo clave que podría cambiar el rumbo de tu caso?</p>
        <p>Sabemos que la investigación es donde se ganan los juicios, pero también es donde se pierden incontables horas.</p>
        <p>La búsqueda de iAlex no es un simple buscador de palabras clave. Es un asistente de IA contextual. Entiende tu caso y te trae no solo lo que pedís, sino lo que necesitás.</p>
        <p><strong>Probá esto ahora (te va a tomar 3 minutos):</strong></p>
        <ol style="margin: 20px 0; padding-left: 20px;">
          <li>Andá al caso que creaste en iAlex.</li>
          <li>Hacé clic en nuestra barra de búsqueda de IA.</li>
          <li>En lugar de buscar por palabras, hacele una pregunta directa y compleja sobre tu caso. Por ejemplo: <em>"¿Qué jurisprudencia en derecho laboral respalda un despido por pérdida de confianza por uso indebido de herramientas de trabajo?"</em></li>
        </ol>
        <p>Observa cómo iAlex te presenta los argumentos y precedentes más relevantes.</p>
        <p>Este es el primer paso para dejar de ser un "buscador de información" y convertirte en un "estratega que la utiliza".</p>
        <p>Seguí explorando, estás en el camino correcto.</p>
        <p style="margin-top: 30px;">Un saludo,<br><strong>El Equipo de iAlex</strong></p>
      </div>
    `;
    await ctx.runMutation(internal.utils.resend.sendEmail, {
      from: "iAlex <notificaciones@ialex.com.ar>",
      to: args.email,
      subject,
      body: htmlContent,
    });
    console.log(`📧 Sent day 3 research assistant email to ${args.email}`);
    return null;
  },
});

/**
 * Send day 5 email: El cliente no paga por tus horas
 */
export const sendDay5ClientTranquility = internalAction({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subject =
      "El cliente no paga por tus horas, paga por su tranquilidad";
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5; text-align: center;">El cliente no paga por tus horas, paga por su tranquilidad</h1>
        <p>Hola, ${args.name},</p>
        <p>En el último email, vimos cómo podés reducir drásticamente las horas de investigación.</p>
        <p>Ahora, la pregunta es: <strong>¿qué hacés con ese tiempo recuperado?</strong></p>
        <p>El mayor valor que podés ofrecerle a un cliente no es solo un resultado, es la <strong>confianza y la tranquilidad</strong> durante todo el proceso.</p>
        <p>Ahí es cuando tu centro de mando iAlex se vuelve tu mejor aliado de comunicación.</p>
        <p>Al tener cada caso perfectamente organizado —documentos, plazos, notas— dejás de reaccionar a las ansiedades de tu cliente. Te anticipás a ellas. Podés enviar un resumen prolijo del estado del caso en minutos, porque no tenés que pasar una hora buscando papeles.</p>
        
        <div style="background-color: #EEF2FF; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #4F46E5;">
          <p style="margin: 0; font-weight: 600; color: #4F46E5; margin-bottom: 12px;">Un pequeño hábito que lo cambia todo:</p>
          <p style="margin: 0; color: #1F2937;">Después de cada avance importante en un caso, entrá a iAlex y creá un escrito vacío, pedile al asistente que resuma el caso y los avances. La próxima vez que tu cliente llame, tendrás la respuesta al instante, proyectando una imagen de control y profesionalismo absoluto.</p>
        </div>
        
        <p style="font-style: italic; color: #6B7280;">Estás construyendo más que un estudio organizado; estás construyendo una reputación.</p>
        <p style="margin-top: 30px;">Saludos,<br><strong>El Equipo de iAlex</strong></p>
      </div>
    `;
    await ctx.runMutation(internal.utils.resend.sendEmail, {
      from: "iAlex <notificaciones@ialex.com.ar>",
      to: args.email,
      subject,
      body: htmlContent,
    });
    console.log(`📧 Sent day 5 client tranquility email to ${args.email}`);
    return null;
  },
});
