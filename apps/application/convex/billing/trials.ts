import { v } from "convex/values";
import { internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal, api } from "../_generated/api";
import Stripe from "stripe";

const stripeSDK = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
      console.log(`⏭️  Skipping ${args.reminderType} email - user ${args.userId} no longer in trial`);
      return null;
    }

    const daysLeft = Math.ceil((user.trialEndDate - Date.now()) / (1000 * 60 * 60 * 24));
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
      subject = `⏰ ¡Última oportunidad! Tu prueba gratuita termina en ${daysLeft} días`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #DC2626;">¡Última oportunidad!</h1>
          <p>Tu prueba gratuita de iAlex Premium termina en <strong>${daysLeft} días</strong>.</p>
          <p>No pierdas acceso a todas las funciones Premium que has estado disfrutando.</p>
          <p><strong>Actualiza ahora y mantén:</strong></p>
          <ul>
            <li>✅ Casos y documentos ilimitados</li>
            <li>✅ Acceso completo a GPT-5</li>
            <li>✅ Todas las funciones Premium</li>
          </ul>
          <a href="${baseUrl}/preferencias?section=billing&trial=upgrade" 
             style="display: inline-block; background: #DC2626; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0; font-size: 16px;">
            Actualizar a Premium ahora
          </a>
          <p style="color: #6B7280; font-size: 14px;">
            Si no actualizas, volverás al plan gratuito el ${new Date(user.trialEndDate).toLocaleDateString('es-AR')}.
          </p>
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
      console.log(`⏭️  Skipping expiration - user ${args.userId} already processed`);
      return null;
    }

    // Check if user has payment method
    const customer = await ctx.runQuery(api.billing.trials.getCustomerPaymentMethod, {
      userId: args.userId,
    });

    const baseUrl = process.env.VITE_APP_URL || "http://localhost:5173";

    if (customer?.hasPaymentMethod) {
      // Attempt to create subscription
      try {
        await ctx.runAction(internal.billing.trials.createSubscriptionForExpiredTrial, {
          userId: args.userId,
          customerId: customer.customerId,
        });

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
      subject: "Tu prueba gratuita de iAlex ha terminado",
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Tu prueba gratuita ha terminado</h1>
          <p>Hola ${args.name},</p>
          <p>Esperamos que hayas disfrutado de iAlex Premium durante los últimos 14 días.</p>
          <p>Tu cuenta ha vuelto al plan gratuito, pero puedes actualizar en cualquier momento para recuperar:</p>
          <ul>
            <li>Casos y documentos ilimitados</li>
            <li>Acceso completo a GPT-5</li>
            <li>Todas las funciones Premium</li>
          </ul>
          <a href="${baseUrl}/preferencias?section=billing" 
             style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Actualizar a Premium
          </a>
          <p style="color: #6B7280; font-size: 14px;">
            ¿Necesitas ayuda? <a href="${baseUrl}/soporte">Contacta a nuestro equipo</a>
          </p>
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
      trialStatus: v.union(v.literal("active"), v.literal("expired"), v.literal("converted"), v.literal("none")),
      trialEndDate: v.number(),
    }),
    v.null()
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
    v.null()
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
      hasPaymentMethod: customer.stripe?.invoice_settings?.default_payment_method != null,
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
