import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";
import { Users, Calendar, User } from "lucide-react";

export default function TeamTable() {
  const teams = useQuery(api.functions.teams.getTeams, {});

  if (teams === undefined) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Cargando equipos...</div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border">
        <Users className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay equipos
        </h3>
        <p className="text-gray-500 text-center">
          Crea tu primer equipo para comenzar a organizar a los miembros de tu
          organización.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Nombre del Equipo</TableHead>
            <TableHead className="text-left">Descripción</TableHead>
            <TableHead className="text-center">Líder</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            <TableHead className="text-center">Creado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teams.map((team: any) => (
            <TableRow
              key={team._id}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <TableCell className="font-medium">
                <Link
                  to={`/equipos/${team._id}`}
                  className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  {team.name}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">
                <Link to={`/equipos/${team._id}`} className="block">
                  {team.description || "Sin descripción"}
                </Link>
              </TableCell>
              <TableCell className="text-center">
                <Link to={`/equipos/${team._id}`} className="block">
                  <div className="flex items-center justify-center gap-1">
                    <User className="w-3 h-3 text-gray-500" />
                    <span className="text-sm text-gray-600">Líder</span>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="text-center">
                <Link to={`/equipos/${team._id}`} className="block">
                  <Badge
                    variant={team.isActive ? "default" : "secondary"}
                    className={
                      team.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  >
                    {team.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell className="text-center">
                <Link to={`/equipos/${team._id}`} className="block">
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(team._creationTime).toLocaleDateString("es-ES")}
                  </div>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
