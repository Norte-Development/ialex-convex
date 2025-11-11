import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import { PaginationControls } from "../ui/pagination-controls";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Link } from "react-router-dom";
import CreateEventDialog from "./CreateEventDialog";

interface EventsContainerProps {
  eventType: "upcoming" | "programados" | "completados" | "cancelados";
  pageSize: number;
}

export default function EventsContainer({
  eventType,
  pageSize,
}: EventsContainerProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Query events based on type
  const upcomingEvents = useQuery(
    api.functions.events.getUpcomingEvents,
    eventType === "upcoming"
      ? {
          days: 30,
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  const allEvents = useQuery(
    api.functions.events.getMyEvents,
    eventType !== "upcoming"
      ? {
          paginationOpts: {
            numItems: pageSize,
            cursor: ((currentPage - 1) * pageSize).toString(),
          },
        }
      : "skip",
  );

  // Handle pagination - memoized to prevent unnecessary re-renders
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Reset pagination when event type changes
  useEffect(() => {
    setCurrentPage(1);
  }, [eventType]);

  // Get events based on type
  const getEventsForType = () => {
    if (eventType === "upcoming") {
      return upcomingEvents?.page || [];
    }

    const allEventsData = allEvents?.page || [];
    switch (eventType) {
      case "programados":
        return allEventsData.filter((e: any) => e.status === "programado");
      case "completados":
        return allEventsData.filter((e: any) => e.status === "completado");
      case "cancelados":
        return allEventsData.filter((e: any) => e.status === "cancelado");
      default:
        return [];
    }
  };

  const events = getEventsForType();
  const isLoading =
    eventType === "upcoming"
      ? upcomingEvents === undefined
      : allEvents === undefined;

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-8">
        <div className="text-gray-500">Cargando eventos...</div>
      </div>
    );
  }

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
      audiencia: "Audiencia",
      plazo: "Plazo",
      reunion_cliente: "Reunión Cliente",
      presentacion: "Presentación",
      reunion_equipo: "Reunión Equipo",
      personal: "Personal",
      otro: "Otro",
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

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar size={64} className="text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          No hay eventos {eventType === "upcoming" ? "próximos" : eventType}
        </h3>
        <p className="text-muted-foreground mb-4">
          {eventType === "upcoming"
            ? "Crea tu primer evento para comenzar"
            : `No hay eventos ${eventType}`}
        </p>
        {eventType === "upcoming" && (
          <CreateEventDialog showCaseSelector showTeamSelector />
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event: any) => (
          <EventCard key={event._id} event={event} />
        ))}
      </div>

      {/* Pagination controls */}
      {events.length > 0 && (
        <div className="mt-6">
          <PaginationControls
            totalResults={
              eventType === "upcoming"
                ? upcomingEvents?.totalCount || 0
                : allEvents?.totalCount || 0
            }
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil(
              (eventType === "upcoming"
                ? upcomingEvents?.totalCount || 0
                : allEvents?.totalCount || 0) / pageSize,
            )}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
