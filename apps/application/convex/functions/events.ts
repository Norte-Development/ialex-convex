import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentUserFromAuth } from "../auth_utils";
import { requireNewCaseAccess, checkNewCaseAccess } from "../auth_utils";

// ========================================
// CREATE EVENTS
// ========================================

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    teamId: v.optional(v.id("teams")),
    eventType: v.union(
      v.literal("audiencia"),
      v.literal("plazo"),
      v.literal("reunion_cliente"),
      v.literal("presentacion"),
      v.literal("reunion_equipo"),
      v.literal("personal"),
      v.literal("otro"),
    ),
    startDate: v.number(),
    endDate: v.number(),
    allDay: v.boolean(),
    location: v.optional(v.string()),
    isVirtual: v.boolean(),
    meetingUrl: v.optional(v.string()),
    reminderMinutes: v.optional(v.array(v.number())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verificar permisos según tipo de evento
    if (args.caseId) {
      // Evento de caso: requiere acceso "basic" al caso
      await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");
    }

    if (args.teamId) {
      // Evento de equipo: verificar que sea miembro del equipo
      const teamId = args.teamId;
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", teamId).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) {
        throw new Error("No tienes acceso a este equipo");
      }
    }

    // Crear evento
    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      caseId: args.caseId,
      teamId: args.teamId,
      eventType: args.eventType,
      startDate: args.startDate,
      endDate: args.endDate,
      allDay: args.allDay,
      location: args.location,
      isVirtual: args.isVirtual,
      meetingUrl: args.meetingUrl,
      reminderMinutes: args.reminderMinutes,
      notes: args.notes,
      status: "programado",
      createdBy: currentUser._id,
      isArchived: false,
    });

    // Agregar creador como organizador
    await ctx.db.insert("eventParticipants", {
      eventId,
      userId: currentUser._id,
      role: "organizador",
      attendanceStatus: "aceptado",
      addedBy: currentUser._id,
      isActive: true,
    });

    return eventId;
  },
});

// ========================================
// READ EVENTS
// ========================================

export const getEventById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar acceso
    if (event.caseId) {
      await requireNewCaseAccess(ctx, currentUser._id, event.caseId, "basic");
    } else if (event.teamId) {
      const teamId = event.teamId; // Type narrowing
      const membership = await ctx.db
        .query("teamMemberships")
        .withIndex("by_team_and_user", (q) =>
          q.eq("teamId", teamId).eq("userId", currentUser._id),
        )
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      if (!membership) {
        throw new Error("No tienes acceso a este evento");
      }
    } else {
      // Evento personal: verificar que sea participante
      const participation = await ctx.db
        .query("eventParticipants")
        .withIndex("by_event_and_user", (q) =>
          q.eq("eventId", args.eventId).eq("userId", currentUser._id),
        )
        .first();

      if (!participation) {
        throw new Error("No tienes acceso a este evento");
      }
    }

    return event;
  },
});

export const getCaseEvents = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verificar acceso al caso
    await requireNewCaseAccess(ctx, currentUser._id, args.caseId, "basic");

    // Obtener eventos del caso
    const events = await ctx.db
      .query("events")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return events;
  },
});

export const getTeamEvents = query({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const teamId = args.teamId; // Type narrowing

    // Verificar que sea miembro del equipo
    const membership = await ctx.db
      .query("teamMemberships")
      .withIndex("by_team_and_user", (q) =>
        q.eq("teamId", teamId).eq("userId", currentUser._id),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!membership) {
      throw new Error("No tienes acceso a este equipo");
    }

    // Obtener eventos del equipo
    const events = await ctx.db
      .query("events")
      .withIndex("by_team", (q) => q.eq("teamId", teamId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return events;
  },
});

export const getMyEvents = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Obtener participaciones del usuario
    const participations = await ctx.db
      .query("eventParticipants")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Obtener eventos correspondientes
    const events = await Promise.all(
      participations.map((p) => ctx.db.get(p.eventId)),
    );

    // Filtrar eventos válidos y no archivados
    let validEvents = events.filter(
      (e) => e !== null && !e.isArchived,
    ) as Array<(typeof events)[number] & { _id: any }>;

    // Filtrar por rango de fechas si se proporciona
    if (args.startDate !== undefined) {
      validEvents = validEvents.filter((e) => e.startDate >= args.startDate!);
    }
    if (args.endDate !== undefined) {
      validEvents = validEvents.filter((e) => e.startDate <= args.endDate!);
    }

    // Ordenar por fecha de inicio
    validEvents.sort((a, b) => a.startDate - b.startDate);

    return validEvents;
  },
});

export const getUpcomingEvents = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const days = args.days ?? 7;

    const now = Date.now();
    const futureDate = now + days * 24 * 60 * 60 * 1000;

    // Obtener participaciones del usuario
    const participations = await ctx.db
      .query("eventParticipants")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Obtener eventos correspondientes
    const events = await Promise.all(
      participations.map((p) => ctx.db.get(p.eventId)),
    );

    // Filtrar eventos próximos
    const upcomingEvents = events.filter(
      (e) =>
        e !== null &&
        !e.isArchived &&
        e.status === "programado" &&
        e.startDate >= now &&
        e.startDate <= futureDate,
    ) as Array<(typeof events)[number] & { _id: any }>;

    // Ordenar por fecha de inicio
    upcomingEvents.sort((a, b) => a.startDate - b.startDate);

    return upcomingEvents;
  },
});

// ========================================
// UPDATE EVENTS
// ========================================

export const updateEvent = mutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    eventType: v.optional(
      v.union(
        v.literal("audiencia"),
        v.literal("plazo"),
        v.literal("reunion_cliente"),
        v.literal("presentacion"),
        v.literal("reunion_equipo"),
        v.literal("personal"),
        v.literal("otro"),
      ),
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    allDay: v.optional(v.boolean()),
    location: v.optional(v.string()),
    isVirtual: v.optional(v.boolean()),
    meetingUrl: v.optional(v.string()),
    reminderMinutes: v.optional(v.array(v.number())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar que sea organizador
    const participation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (!participation || participation.role !== "organizador") {
      throw new Error("Solo el organizador puede editar el evento");
    }

    // Actualizar evento
    const { eventId, ...updates } = args;
    await ctx.db.patch(eventId, updates);

    return eventId;
  },
});

export const updateEventStatus = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("programado"),
      v.literal("completado"),
      v.literal("cancelado"),
      v.literal("reprogramado"),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar que sea organizador
    const participation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (!participation || participation.role !== "organizador") {
      throw new Error("Solo el organizador puede cambiar el estado del evento");
    }

    const oldStatus = event.status;
    await ctx.db.patch(args.eventId, { status: args.status });

    // Enviar notificación de actualización si el estado cambió
    if (oldStatus !== args.status) {
      await ctx.scheduler.runAfter(
        0,
        internal.functions.eventNotifications.sendEventUpdateNotification,
        {
          eventId: args.eventId,
          updateType: "status",
          oldValue: oldStatus,
          newValue: args.status,
        },
      );
    }

    return args.eventId;
  },
});

// ========================================
// DELETE EVENTS
// ========================================

export const deleteEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar que sea organizador
    const participation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (!participation || participation.role !== "organizador") {
      throw new Error("Solo el organizador puede eliminar el evento");
    }

    // Soft delete
    await ctx.db.patch(args.eventId, { isArchived: true });

    return args.eventId;
  },
});

// ========================================
// PARTICIPANTS MANAGEMENT
// ========================================

export const addParticipant = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("users"),
    role: v.union(
      v.literal("organizador"),
      v.literal("participante"),
      v.literal("opcional"),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar que sea organizador
    const participation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (!participation || participation.role !== "organizador") {
      throw new Error("Solo el organizador puede agregar participantes");
    }

    // Verificar que el usuario no esté ya agregado
    const existingParticipation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", args.userId),
      )
      .first();

    if (existingParticipation) {
      throw new Error("El usuario ya es participante del evento");
    }

    // Agregar participante
    const participantId = await ctx.db.insert("eventParticipants", {
      eventId: args.eventId,
      userId: args.userId,
      role: args.role,
      attendanceStatus: "pendiente",
      addedBy: currentUser._id,
      isActive: true,
    });

    // Enviar notificación de invitación
    await ctx.scheduler.runAfter(
      0,
      internal.functions.eventNotifications.sendEventInviteNotification,
      {
        eventId: args.eventId,
        participantId: args.userId,
        organizerId: currentUser._id,
      },
    );

    return participantId;
  },
});

export const removeParticipant = mutation({
  args: {
    eventId: v.id("events"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Verificar que sea organizador
    const organizerParticipation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (
      !organizerParticipation ||
      organizerParticipation.role !== "organizador"
    ) {
      throw new Error("Solo el organizador puede remover participantes");
    }

    // No permitir remover al organizador
    const targetParticipation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", args.userId),
      )
      .first();

    if (!targetParticipation) {
      throw new Error("Participante no encontrado");
    }

    if (targetParticipation.role === "organizador") {
      throw new Error("No se puede remover al organizador del evento");
    }

    // Soft delete
    await ctx.db.patch(targetParticipation._id, { isActive: false });

    return targetParticipation._id;
  },
});

export const updateAttendanceStatus = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("pendiente"),
      v.literal("aceptado"),
      v.literal("rechazado"),
      v.literal("tentativo"),
    ),
  },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);

    // Buscar participación del usuario
    const participation = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event_and_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", currentUser._id),
      )
      .first();

    if (!participation) {
      throw new Error("No eres participante de este evento");
    }

    // Actualizar estado de asistencia
    await ctx.db.patch(participation._id, { attendanceStatus: args.status });

    return participation._id;
  },
});

export const getEventParticipants = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const currentUser = await getCurrentUserFromAuth(ctx);
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      throw new Error("Evento no encontrado");
    }

    // Verificar acceso al evento
    if (event.caseId) {
      await requireNewCaseAccess(ctx, currentUser._id, event.caseId, "basic");
    }

    // Obtener participantes
    const participants = await ctx.db
      .query("eventParticipants")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Enriquecer con datos de usuarios
    const participantsWithUsers = await Promise.all(
      participants.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          ...p,
          user: user
            ? {
                _id: user._id,
                name: user.name,
                email: user.email,
                profileImage: user.profileImage,
              }
            : null,
        };
      }),
    );

    return participantsWithUsers;
  },
});
