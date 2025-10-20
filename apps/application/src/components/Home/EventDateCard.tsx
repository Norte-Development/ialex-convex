import { Link } from "react-router-dom";

interface Event {
  _id: string;
  title: string;
  startDate: number;
  endDate: number;
  eventType:
    | "audiencia"
    | "plazo"
    | "reunion_cliente"
    | "presentacion"
    | "reunion_equipo"
    | "personal"
    | "otro";
  status: "programado" | "completado" | "cancelado" | "reprogramado";
  caseId?: string;
}

export default function EventDateCard({ event }: { event: Event }) {
  // Formatear fecha
  const eventDate = new Date(event.startDate);
  const today = new Date();
  const isToday = eventDate.toDateString() === today.toDateString();

  const dateLabel = isToday
    ? "Hoy"
    : eventDate.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      });

  // Día de la semana truncado
  const dayOfWeek = isToday
    ? "Hoy"
    : eventDate.toLocaleDateString("es-ES", { weekday: "short" });

  // Formatear hora
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Link
      to={`/eventos/${event._id}`}
      className="h-[50px]  w-fit rounded-2xl bg-transparent hover:bg-gray-50 transition-colors cursor-pointer flex items-center px-6 py-4 gap-6 "
    >
      {/* Columna izquierda: Fecha */}
      <div className="flex flex-col items-center justify-center min-w-[60px]">
        <p className="text-[#5E5D5A] text-sm font-normal text-center">
          {dateLabel}
        </p>
        <p className="text-[#5E5D5A] text-xs font-normal text-center">
          {dayOfWeek}
        </p>
      </div>

      {/* Separador vertical */}
      <div className="h-12 w-[4px] rounded-full bg-gray-300/50" />

      {/* Columna derecha: Título y hora */}
      <div className="flex flex-col justify-center w-fit ">
        <p className="text-[#5E5D5A] font-medium text-base truncate">
          {event.title}
        </p>
        <p className="text-[#5E5D5A] text-sm font-normal">
          {formatTime(event.startDate)}
        </p>
      </div>
    </Link>
  );
}
