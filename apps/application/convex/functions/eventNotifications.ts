import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  eventReminderTemplate,
  eventInviteTemplate,
  eventUpdateTemplate,
} from "../services/emailTemplates";

/**
 * Envía notificación de invitación a evento
 */
export const sendEventInviteNotification = internalMutation({
  args: {
    eventId: v.id("events"),
    participantId: v.id("users"),
    organizerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Obtener datos del evento
    const event = await ctx.db.get(args.eventId);
    if (!event) return;

    // Obtener datos del participante
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return;

    // Obtener datos del organizador
    const organizer = await ctx.db.get(args.organizerId);
    if (!organizer) return;

    // Formatear fecha y hora
    const startDate = new Date(event.startDate).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const startTime = new Date(event.startDate).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Generar template
    const htmlBody = eventInviteTemplate(
      event.title,
      event.eventType,
      startDate,
      startTime,
      event.location,
      event.meetingUrl,
      organizer.name,
      participant.name,
    );

    // Enviar notificación
    await ctx.runMutation(
      internal.services.notificationService.sendNotificationIfEnabled,
      {
        userId: args.participantId,
        notificationType: "eventUpdate",
        subject: `Invitación: ${event.title}`,
        htmlBody,
      },
    );
  },
});

/**
 * Envía recordatorios de eventos próximos
 */
export const sendEventReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Obtener todos los eventos programados
    const events = await ctx.db
      .query("events")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "programado"),
          q.eq(q.field("isArchived"), false),
        ),
      )
      .collect();

    for (const event of events) {
      if (!event.reminderMinutes || event.reminderMinutes.length === 0)
        continue;

      const minutesUntilEvent = Math.floor(
        (event.startDate - now) / (1000 * 60),
      );

      // Verificar si algún recordatorio debe enviarse
      for (const reminderMinutes of event.reminderMinutes) {
        // Enviar si estamos dentro de una ventana de 5 minutos del recordatorio
        if (
          minutesUntilEvent <= reminderMinutes &&
          minutesUntilEvent > reminderMinutes - 5
        ) {
          // Obtener participantes del evento
          const participants = await ctx.db
            .query("eventParticipants")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .filter((q) => q.eq(q.field("isActive"), true))
            .collect();

          // Enviar recordatorio a cada participante
          for (const participant of participants) {
            const user = await ctx.db.get(participant.userId);
            if (!user) continue;

            // Formatear fecha y hora
            const startDate = new Date(event.startDate).toLocaleDateString(
              "es-ES",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            );

            const startTime = new Date(event.startDate).toLocaleTimeString(
              "es-ES",
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            );

            // Generar template
            const htmlBody = eventReminderTemplate(
              event.title,
              event.eventType,
              startDate,
              startTime,
              event.location,
              event.meetingUrl,
              user.name,
              reminderMinutes,
            );

            // Enviar notificación
            await ctx.runMutation(
              internal.services.notificationService.sendNotificationIfEnabled,
              {
                userId: participant.userId,
                notificationType: "eventReminder",
                subject: `⏰ Recordatorio: ${event.title}`,
                htmlBody,
              },
            );
          }
        }
      }
    }
  },
});

/**
 * Envía notificación de actualización de evento
 */
export const sendEventUpdateNotification = internalMutation({
  args: {
    eventId: v.id("events"),
    updateType: v.union(v.literal("status"), v.literal("details")),
    oldValue: v.string(),
    newValue: v.string(),
  },
  handler: async (ctx, args) => {
    // Obtener datos del evento
    const event = await ctx.db.get(args.eventId);
    if (!event) return;

    // Obtener participantes del evento
    const participants = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Enviar notificación a cada participante
    for (const participant of participants) {
      const user = await ctx.db.get(participant.userId);
      if (!user) continue;

      // Generar template
      const htmlBody = eventUpdateTemplate(
        event.title,
        args.updateType,
        args.oldValue,
        args.newValue,
        user.name,
      );

      // Enviar notificación
      await ctx.runMutation(
        internal.services.notificationService.sendNotificationIfEnabled,
        {
          userId: participant.userId,
          notificationType: "eventUpdate",
          subject: `Actualización: ${event.title}`,
          htmlBody,
        },
      );
    }
  },
});

/**
 * Cron job para enviar recordatorios automáticos
 * Se ejecuta cada 5 minutos
 */
export const cronSendEventReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.functions.eventNotifications.sendEventReminders, {});
  },
});
