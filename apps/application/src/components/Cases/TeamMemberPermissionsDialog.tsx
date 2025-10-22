import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Shield, Eye, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type AccessLevel = "basic" | "advanced" | "admin";

interface TeamMemberPermissionsDialogProps {
  member: {
    _id: Id<"users">;
    name: string;
    email: string;
    role: string;
  };
  caseId: Id<"cases">;
  teamId: Id<"teams">;
}

const ACCESS_LEVEL_OPTIONS = [
  {
    id: "basic" as AccessLevel,
    label: "Básico",
    description: "Ver información (solo lectura)",
    icon: Eye,
    color: "bg-green-100 text-green-800",
  },
  {
    id: "advanced" as AccessLevel,
    label: "Avanzado",
    description: "Editar y crear contenido",
    icon: Shield,
    color: "bg-blue-100 text-blue-800",
  },
  {
    id: "admin" as AccessLevel,
    label: "Administrador",
    description: "Acceso completo",
    icon: Shield,
    color: "bg-purple-100 text-purple-800",
  },
];

export default function TeamMemberPermissionsDialog({
  member,
  caseId,
  teamId,
}: TeamMemberPermissionsDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current member permissions
  const currentAccess = useQuery(
    api.functions.teams.getTeamMembersWithCaseAccess,
    { caseId, teamId },
  );

  // Mutations
  const grantPermissions = useMutation(
    api.functions.teams.grantTeamMemberCaseAccess,
  );

  // Find current member's access level
  const memberAccess = currentAccess?.find(
    (access) => access.user._id === member._id,
  );
  const currentAccessLevel =
    memberAccess?.individualAccess?.accessLevel ||
    memberAccess?.teamAccess?.accessLevel ||
    "basic";

  // Get current level config
  const currentLevelConfig =
    ACCESS_LEVEL_OPTIONS.find((opt) => opt.id === currentAccessLevel) ||
    ACCESS_LEVEL_OPTIONS[0];

  const handleAccessLevelChange = async (newLevel: AccessLevel) => {
    if (newLevel === currentAccessLevel) return;

    setIsUpdating(true);
    try {
      await grantPermissions({
        caseId,
        teamId,
        userId: member._id,
        accessLevel: newLevel,
      });

      const newLevelConfig = ACCESS_LEVEL_OPTIONS.find(
        (opt) => opt.id === newLevel,
      );
      toast.success(
        `Nivel actualizado a ${newLevelConfig?.label} para ${member.name}`,
      );
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex text-center items-center justify-center gap-1 bg-[#E9F2FE] border-[#1868DB] border-1 px-3 py-2 rounded-sm text-sm font-medium transition-colors hover:opacity-80 min-w-[140px] ${isUpdating ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Actualizando...</span>
            </>
          ) : (
            <>
              <span className="text-[#1868DB]">{currentLevelConfig.label}</span>
              <ChevronDown className="h-3 w-3 text-[#1868DB]" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-gray-500">
          Cambiar nivel de acceso
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACCESS_LEVEL_OPTIONS.map((level) => {
          const Icon = level.icon;
          const isCurrent = level.id === currentAccessLevel;

          return (
            <DropdownMenuItem
              key={level.id}
              onClick={() => handleAccessLevelChange(level.id)}
              disabled={isCurrent || isUpdating}
              className={`cursor-pointer ${isCurrent ? "bg-gray-100" : ""}`}
            >
              <div className="flex items-start gap-2 w-full">
                <Icon
                  className={`h-4 w-4 mt-0.5 ${isCurrent ? "text-blue-600" : "text-gray-600"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${isCurrent ? "text-blue-600" : ""}`}
                    >
                      {level.label}
                    </span>
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0"
                      >
                        Actual
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {level.description}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
