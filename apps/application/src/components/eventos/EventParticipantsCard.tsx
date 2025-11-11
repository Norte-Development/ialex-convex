import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserMinus } from "lucide-react";
import AddParticipantDialog from "./AddParticipantDialog";
import { Id } from "../../../convex/_generated/dataModel";

interface EventParticipantsCardProps {
  eventId: string;
  participants: any[] | undefined;
  isOrganizer: boolean;
  currentUserId?: Id<"users">;
  onRemoveParticipant: (userId: Id<"users">, userName: string) => void;
}

export default function EventParticipantsCard({
  eventId,
  participants,
  isOrganizer,
  currentUserId,
  onRemoveParticipant,
}: EventParticipantsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Participantes
          <span className="ml-2 text-sm font-normal text-gray-500">
            {participants?.length || 0}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {participants && participants.length > 0 ? (
          <>
            {participants.map((participant) => (
              <div
                key={participant._id}
                className="flex items-center justify-between group py-2"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-blue-700">
                      {participant.user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {participant.user?.name}
                    </p>
                    <p className="text-xs text-gray-500">{participant.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {participant.attendanceStatus}
                  </Badge>
                  {isOrganizer &&
                    participant.role !== "organizador" &&
                    participant.userId !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          onRemoveParticipant(
                            participant.userId,
                            participant.user?.name || "Usuario",
                          )
                        }
                      >
                        <UserMinus size={14} className="text-destructive" />
                      </Button>
                    )}
                </div>
              </div>
            ))}

            {isOrganizer && (
              <>
                <Separator className="my-2" />
                <AddParticipantDialog
                  eventId={eventId as Id<"events">}
                  existingParticipants={participants}
                />
              </>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-3">No hay participantes</p>
            {isOrganizer && (
              <AddParticipantDialog
                eventId={eventId as Id<"events">}
                existingParticipants={[]}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
