import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Enviar recordatorios de eventos cada 5 minutos
crons.interval(
  "send-event-reminders",
  { minutes: 5 },
  internal.functions.eventNotifications.cronSendEventReminders,
);

export default crons;
