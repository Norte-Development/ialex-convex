import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
  TableCell,
} from "../ui/table";
import { Case } from "types/cases";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Checkbox } from "../ui/checkbox";
import { useNavigate } from "react-router-dom";

interface CaseTableProps {
  cases: Case[] | undefined;
}

// Componente para mostrar equipos de un caso
function CaseTeams({ caseId }: { caseId: string }) {
  const teamsWithAccess = useQuery(api.functions.teams.getTeamsWithCaseAccess, {
    caseId: caseId as any,
  });

  if (!teamsWithAccess) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
      </div>
    );
  }

  if (teamsWithAccess.length === 0) {
    return <span className="text-gray-500 text-sm">Sin equipos</span>;
  }

  return (
    <div className="flex items-center gap-1 justify-center">
      {teamsWithAccess.slice(0, 3).map((team) => (
        <Avatar key={team._id} className="w-6 h-6">
          <AvatarFallback className="text-xs bg-gray-200 text-gray-800">
            {team.name
              .split(" ")
              .slice(0, 2)
              .map((word) => word.charAt(0))
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {teamsWithAccess.length > 3 && (
        <span className="text-xs text-gray-500">
          +{teamsWithAccess.length - 3}
        </span>
      )}
    </div>
  );
}

// Componente para mostrar usuarios de un caso
function CaseUsers({ caseId }: { caseId: string }) {
  const usersWithAccess = useQuery(
    api.functions.permissions.getNewUsersWithCaseAccess,
    { caseId: caseId as any },
  );

  if (!usersWithAccess) {
    return (
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
      </div>
    );
  }

  if (usersWithAccess.length === 0) {
    return <span className="text-gray-500 text-sm">Sin clientes</span>;
  }

  return (
    <div className="flex items-center justify-center gap-0">
      {usersWithAccess.slice(0, 3).map((user) => (
        <Avatar key={user.userId} className="w-6 h-6">
          <AvatarFallback className="text-xs bg-gray-200 text-gray-800">
            {user.user.name
              ?.split(" ")
              .slice(0, 2)
              .map((word) => word.charAt(0))
              .join("")
              .toUpperCase() ?? "UN"}
          </AvatarFallback>
        </Avatar>
      ))}
      {usersWithAccess.length > 3 && (
        <span className="text-xs text-gray-500">
          +{usersWithAccess.length - 3}
        </span>
      )}
    </div>
  );
}

// function getStatusBadgeVariant(status: Case["status"]) {
//   switch (status) {
//     case "pendiente":
//       return "secondary";
//     case "en progreso":
//       return "default";
//     case "completado":
//       return "outline";
//     case "archivado":
//       return "secondary";
//     case "cancelado":
//       return "destructive";
//     default:
//       return "secondary";
//   }
// }

function getStatusText(status: Case["status"]) {
  switch (status) {
    case "pendiente":
      return "Pendiente";
    case "en progreso":
      return "En progreso";
    case "completado":
      return "Completado";
    case "archivado":
      return "Archivado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

export default function CaseTable({ cases }: CaseTableProps) {
  const navigate = useNavigate();

  const handleRowClick = (caseId: string) => {
    navigate(`/caso/${caseId}`);
  };

  return (
    <Table>
      <TableHeader className="bg-gray-100 py-[16px] px-[8px] text-black ">
        <TableRow>
          <TableCell> </TableCell>
          <TableCell className="text-center">Casos</TableCell>
          <TableCell className="text-center">Estado</TableCell>
          <TableCell className="text-center">Equipos</TableCell>
          <TableCell className="text-center">Miembros</TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!cases || cases.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
              No hay casos disponibles
            </TableCell>
          </TableRow>
        ) : (
          cases.map((case_) => (
            <TableRow
              key={case_._id}
              onClick={() => handleRowClick(case_._id)}
              className="cursor-pointer hover:bg-gray-200 transition-colors"
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox className="h-5 w-5" />
              </TableCell>
              <TableCell className="text-center">
                <span className="font-medium">{case_.title}</span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={"basic"}>{getStatusText(case_.status)}</Badge>
              </TableCell>
              <TableCell className="text-center">
                <CaseTeams caseId={case_._id} />
              </TableCell>
              <TableCell className="text-center">
                <CaseUsers caseId={case_._id} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
