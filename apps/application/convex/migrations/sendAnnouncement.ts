/**
 * Send Migration Announcement (Phase 1.2)
 * 
 * This function sends migration announcement emails to all users
 * who have been migrated to the new system.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { FRONTEND_URL, EMAIL_TEMPLATES } from "./constants";

/**
 * Email service interface
 * Implement this based on your email provider (SendGrid, Resend, etc.)
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}) {
  // TODO: Implement actual email sending based on your email provider
  // For now, just log the email
  console.log(`[EMAIL] Sending to ${params.to}:`, {
    subject: params.subject,
    template: params.template,
    data: params.data,
  });

  // Example implementations:
  
  // Using Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'noreply@ialex.com',
  //   to: params.to,
  //   subject: params.subject,
  //   html: generateEmailHTML(params.template, params.data),
  // });

  // Using SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send({
  //   to: params.to,
  //   from: 'noreply@ialex.com',
  //   subject: params.subject,
  //   html: generateEmailHTML(params.template, params.data),
  // });

  return { success: true };
}

/**
 * Generate email HTML based on template
 */
function generateMigrationAnnouncementHTML(data: {
  name: string;
  migrationUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
        }
        .button {
          display: inline-block;
          background: #667eea;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>¡Bienvenido a la nueva iAlex!</h1>
      </div>
      <div class="content">
        <p>Hola ${data.name},</p>
        
        <p>
          Nos complace anunciar que hemos actualizado iAlex con una nueva plataforma 
          más rápida, segura y con nuevas funcionalidades que te ayudarán en tu práctica legal.
        </p>
        
        <h3>🎉 ¿Qué hay de nuevo?</h3>
        <ul>
          <li>✨ Interfaz renovada y más intuitiva</li>
          <li>⚡ Rendimiento mejorado</li>
          <li>🔐 Mayor seguridad en tus datos</li>
          <li>📱 Mejor experiencia en dispositivos móviles</li>
          <li>🤖 Asistente AI mejorado</li>
        </ul>
        
        <h3>🔄 Próximos pasos</h3>
        <p>
          Para completar la migración de tus datos, por favor visita el siguiente enlace:
        </p>
        
        <center>
          <a href="${data.migrationUrl}" class="button">
            Completar Migración
          </a>
        </center>
        
        <p>
          <strong>Importante:</strong> Tus datos están seguros y protegidos. Este proceso 
          te permitirá acceder a toda tu información en la nueva plataforma.
        </p>
        
        <p>
          Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
        </p>
        
        <p>
          Saludos,<br>
          <strong>El equipo de iAlex</strong>
        </p>
      </div>
      <div class="footer">
        <p>
          Este es un mensaje automático del sistema de migración de iAlex.<br>
          Por favor, no respondas a este correo.
        </p>
      </div>
    </body>
    </html>
  `;
}

export const sendMigrationAnnouncement = internalAction({
  args: {},
  returns: v.object({
    totalUsers: v.number(),
    emailsSent: v.number(),
    emailsFailed: v.number(),
    details: v.array(
      v.object({
        email: v.string(),
        status: v.string(),
        error: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx): Promise<{
    totalUsers: number;
    emailsSent: number;
    emailsFailed: number;
    details: Array<{
      email: string;
      status: string;
      error?: string;
    }>;
  }> => {
    console.log("Starting to send migration announcements...");

    // Get all users
    const users: Array<{ _id: Id<"users">; email: string; name: string }> = await ctx.runQuery(internal.migrations.helpers.getAllUsers, {});

    const results: {
      totalUsers: number;
      emailsSent: number;
      emailsFailed: number;
      details: Array<{
        email: string;
        status: string;
        error?: string;
      }>;
    } = {
      totalUsers: users.length,
      emailsSent: 0,
      emailsFailed: 0,
      details: [],
    };

    for (const user of users) {
      try {
        // Check migration status
        const migrationStatus = await ctx.runQuery(
          internal.migrations.helpers.getMigrationStatus,
          { userId: user._id }
        );

        // Only send to users with pending migration
        if (migrationStatus && migrationStatus.status === "pending") {
          const emailResult = await sendEmail({
            to: user.email,
            subject: "¡Bienvenido a la nueva iAlex!",
            template: EMAIL_TEMPLATES.MIGRATION_ANNOUNCEMENT,
            data: {
              name: user.name,
              migrationUrl: `${FRONTEND_URL}/migration/consent`,
            },
          });

          if (emailResult.success) {
            results.emailsSent++;
            results.details.push({
              email: user.email,
              status: "sent",
            });
            console.log(`Sent migration announcement to ${user.email}`);
          } else {
            results.emailsFailed++;
            results.details.push({
              email: user.email,
              status: "failed",
              error: "Email send failed",
            });
          }
        } else {
          results.details.push({
            email: user.email,
            status: "skipped",
            error: "No pending migration",
          });
        }
      } catch (error: any) {
        results.emailsFailed++;
        results.details.push({
          email: user.email,
          status: "error",
          error: error.message,
        });
        console.error(`Failed to send announcement to ${user.email}:`, error);
      }
    }

    console.log("Migration announcements completed:", {
      totalUsers: results.totalUsers,
      emailsSent: results.emailsSent,
      emailsFailed: results.emailsFailed,
    });

    return results;
  },
});

/**
 * Send a test announcement to a specific email
 * Useful for testing email templates
 */
export const sendTestAnnouncement = internalAction({
  args: {
    email: v.string(),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { email, name }) => {
    try {
      await sendEmail({
        to: email,
        subject: "¡Bienvenido a la nueva iAlex! (TEST)",
        template: EMAIL_TEMPLATES.MIGRATION_ANNOUNCEMENT,
        data: {
          name,
          migrationUrl: `${FRONTEND_URL}/migration/consent`,
        },
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

