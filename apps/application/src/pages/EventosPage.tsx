import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Calendar, Clock, MapPin } from "lucide-react";
import CreateEventDialog from "@/components/eventos/CreateEventDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

export default function EventosPage() {
  const upcomingEvents = useQuery(api.functions.events.getUpcomingEvents, {
    days: 30,
  });
  const allEvents = useQuery(api.functions.events.getMyEvents, {});

  const allEventsData = allEvents || [];

  // "Próximos" = eventos programados en los próximos 30 días
  const events = upcomingEvents || [];

  // Filtrar eventos por estado (todos, sin filtro de fecha)
  const programados = allEventsData.filter((e) => e.status === "programado");
  const completados = allEventsData.filter((e) => e.status === "completado");
  const cancelados = allEventsData.filter((e) => e.status === "cancelado");

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

  const EventCard = ({ event }: { event: any }) => (
    <Link to={`/eventos/${event._id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg mb-2">{event.title}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
    <div className=" mx-auto flex flex-col justify-center items-center min-h-full w-full  px-4 ">
      <div className="flex justify-between w-full items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Calendario de Eventos</h1>
          <p className="text-muted-foreground">
            Gestiona tus audiencias, plazos y reuniones
          </p>
        </div>
        <CreateEventDialog showCaseSelector showTeamSelector />
      </div>

      <Tabs defaultValue="programados" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4 h-auto">
          <TabsTrigger
            value="proximos"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos programados en los próximos 30 días"
          >
            Próximos ({events.length})
          </TabsTrigger>
          <TabsTrigger
            value="programados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Todos los eventos programados (sin límite de fecha)"
          >
            Programados ({programados.length})
          </TabsTrigger>
          <TabsTrigger
            value="completados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos ya realizados"
          >
            Completados ({completados.length})
          </TabsTrigger>
          <TabsTrigger
            value="cancelados"
            className="text-xs sm:text-sm px-2 py-2"
            title="Eventos cancelados"
          >
            Cancelados ({cancelados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proximos" className="mt-6">
          {events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={64} className="text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No hay eventos próximos
              </h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer evento para comenzar
              </p>
              <CreateEventDialog showCaseSelector showTeamSelector />
            </div>
          )}
        </TabsContent>

        <TabsContent value="programados" className="mt-6">
          {programados.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programados.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No hay eventos programados
            </div>
          )}
        </TabsContent>

        <TabsContent value="completados" className="mt-6">
          {completados.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completados.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No hay eventos completados
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelados" className="mt-6">
          {cancelados.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cancelados.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No hay eventos cancelados
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
