import { useCase } from "@/context/CaseContext";
import CaseLayout from "@/components/Cases/CaseLayout";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Calendar, Clock, MapPin, Plus, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/CasePermissionsContext";
import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function CaseEventsPage() {
  const { currentCase } = useCase();
  const { hasAccessLevel } = usePermissions();

  // Verificar permisos - advanced para ver y crear eventos
  const canViewEvents = hasAccessLevel("basic");
  const canCreateEvents = hasAccessLevel("advanced");

  if (!currentCase) {
    return (
      <CaseLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Caso no encontrado</div>
        </div>
      </CaseLayout>
    );
  }

  return (
    <CaseLayout>
      <CaseEventsPageInner
        caseId={currentCase._id}
        canViewEvents={canViewEvents}
        canCreateEvents={canCreateEvents}
      />
    </CaseLayout>
  );
}
interface CaseEventsPageInnerProps {
  caseId: Id<"cases">;
  canViewEvents: boolean;
  canCreateEvents: boolean;
}

function CaseEventsPageInner({
  caseId,
  canViewEvents,
  canCreateEvents,
}: CaseEventsPageInnerProps) {
  // Obtener eventos del caso
  const events = useQuery(api.functions.events.getCaseEvents, { caseId });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      audiencia: "🏛️ Audiencia",
      plazo: "⏰ Plazo",
      reunion_cliente: "👥 Reunión Cliente",
      presentacion: "📄 Presentación",
      reunion_equipo: "👨‍💼 Reunión Equipo",
      personal: "🙋 Personal",
      otro: "📌 Otro",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      programado: "default",
      completado: "secondary",
      cancelado: "destructive",
      reprogramado: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      programado: "border-l-blue-500",
      completado: "border-l-green-500",
      cancelado: "border-l-red-500",
      reprogramado: "border-l-yellow-500",
    };
    return colors[status] || "border-l-gray-500";
  };

  if (!canViewEvents) {
    return (
      <div className="max-w-7xl px-5 mx-auto bg-white space-y-6 pb-16">
        <div className="text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Acceso Denegado</h3>
          <p className="text-muted-foreground">
            No tienes permisos para ver los eventos de este caso
          </p>
        </div>
      </div>
    );
  }

  if (events === undefined) {
    return (
      <div className="max-w-7xl px-5 mx-auto bg-white space-y-6 pb-16">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Separar eventos por estado
  const upcomingEvents = events.filter(
    (e) => e.status === "programado" && e.startDate >= Date.now(),
  );
  const pastEvents = events.filter(
    (e) =>
      e.status === "completado" ||
      e.status === "cancelado" ||
      (e.status === "programado" && e.startDate < Date.now()),
  );

  const EventCard = ({ event }: { event: any }) => (
    <Link to={`/eventos/${event._id}`}>
      <Card
        className={`hover:shadow-lg transition-all cursor-pointer border-l-4 ${getStatusColor(event.status)}`}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>{getEventTypeLabel(event.eventType)}</span>
                {getStatusBadge(event.status)}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-muted-foreground" />
            <span>{formatDate(event.startDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={16} className="text-muted-foreground" />
            <span>
              {formatTime(event.startDate)} - {formatTime(event.endDate)}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-muted-foreground" />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {event.description}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="max-w-7xl px-5 mx-auto bg-white space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-light tracking-tight text-gray-900">
              Eventos del Caso
            </h1>
            <p className="text-base text-gray-600">
              Gestiona audiencias, plazos y reuniones relacionadas con este caso
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateEvents && <CreateEventDialog caseId={caseId} />}
          </div>
        </div>
      </div>

      {/* Eventos próximos */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Próximos Eventos ({upcomingEvents.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents
              .sort((a, b) => a.startDate - b.startDate)
              .map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
          </div>
        </div>
      )}

      {/* Eventos pasados */}
      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Eventos Pasados ({pastEvents.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastEvents
              .sort((a, b) => b.startDate - a.startDate)
              .map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar size={64} className="text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No hay eventos en este caso
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Crea tu primer evento para comenzar a organizar audiencias, plazos y
            reuniones relacionadas con este caso
          </p>
          {canCreateEvents && <CreateEventDialog caseId={caseId} />}
        </div>
      )}
    </div>
  );
}
