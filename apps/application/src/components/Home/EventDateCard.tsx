import { Link } from "react-router-dom";
import { Calendar, Clock, Gavel, FileText, Users, User } from "lucide-react";

interface Event {
  _id: string;
  title: string;
  startDate: number;
  endDate: number;
  eventType: "audiencia" | "plazo" | "reunion_cliente" | "presentacion" | "reunion_equipo" | "personal" | "otro";
  status: "programado" | "completado" | "cancelado" | "reprogramado";
  caseId?: string;
}

export default function EventDateCard({ event }: { event: Event }) {
  function getNameOfMonth(monthNumber: number) {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString("es-ES", { month: "long" });
  }

  // Formatear fecha
  const eventDate = getNameOfMonth(new Date(event.startDate).getMonth() + 1).slice(0, 3);
  const eventDay = new Date(event.startDate).getDate();

  // Formatear horarios
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Icono según tipo de evento
  const getEventIcon = () => {
    switch (event.eventType) {
      case "audiencia":
        return <Gavel size={14} className="text-tertiary" />;
      case "plazo":
        return <Clock size={14} className="text-red-500" />;
      case "reunion_cliente":
        return <Users size={14} className="text-blue-500" />;
      case "presentacion":
        return <FileText size={14} className="text-green-500" />;
      case "reunion_equipo":
        return <Users size={14} className="text-purple-500" />;
      case "personal":
        return <User size={14} className="text-gray-500" />;
      default:
        return <Calendar size={14} className="text-gray-400" />;
    }
  };

  return (
    <Link
      to={`/eventos/${event._id}`}
      className="h-[91px] cursor-pointer flex justify-center items-end w-[233px] bg-[#F4F7FC] rounded-3xl hover:shadow-md transition-shadow"
    >
      <div className="w-[35%] h-full border-r-1 border-black flex flex-col justify-center items-center">
        <span className="text-tertiary text-[20px] font-[700]">
          {eventDay}
        </span>
        <span className="text-tertiary text-[20px] font-[700]">
          {eventDate}
        </span>
      </div>
      <div className="w-[65%] h-full flex flex-col justify-center items-start pl-3 pr-3 gap-1">
        <div className="flex items-center gap-1 w-full">
          {getEventIcon()}
          <span className="font-[700] text-sm truncate flex-1 min-w-0">
            {event.title}
          </span>
        </div>
        <span className="text-xs text-gray-500 truncate w-full">
          {formatTime(event.startDate)} - {formatTime(event.endDate)}
        </span>
      </div>
    </Link>
  );
}
