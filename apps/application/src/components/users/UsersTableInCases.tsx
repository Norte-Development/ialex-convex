import {
  Table,
  TableCell,
  TableBody,
  TableRow,
  TableHeader,
} from "../ui/table";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { Badge } from "../ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function UserTableInCases({ caseId }: { caseId: Id<"cases"> }) {
  const users = useQuery(api.functions.permissions.getNewUsersWithCaseAccess, {
    caseId,
  });
  const { user } = useAuth();
  // Esto filtra en base al rol del usuario actual, si no es admin no ve admins,
  //  despues lo descomentamos ahora es para testear
  // const filteredUsers = users?.filter(
  //   (u) => u.userId !== user?._id && u.accessLevel !== "admin",
  // );

  const isMe = (userId: string) => userId === user?._id;

  if (!users) return <div>Cargando</div>;

  return (
    <Table>
      <TableHeader className="bg-[#F5F5F5]">
        <TableRow className="text-[14px]">
          <TableCell className="min-w-[200px] text-bold">Nombre</TableCell>
          <TableCell className="min-w-[120px] text-bold">Rol</TableCell>
          <TableCell className="min-w-[250px] text-bold">Correo</TableCell>
          <TableCell className="min-w-[180px] text-bold">Permisos</TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.userId}>
            <TableCell className="min-w-[200px]">{user.user.name}</TableCell>
            <TableCell className="min-w-[120px]">
              <Badge variant={"basic"}>{user.accessLevel}</Badge>
            </TableCell>
            <TableCell className="min-w-[250px]">
              <Link
                to={`/users/${user.userId}`}
                className="text-blue-500 hover:underline"
              >
                {user.user.email}
              </Link>
            </TableCell>
            <TableCell className="min-w-[180px]">
              <Select disabled={isMe(user.userId)}>
                <SelectTrigger className="w-[150px]">
                  {user.accessLevel}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Leer</SelectItem>
                  <SelectItem value="write">Escribir</SelectItem>
                  <SelectItem value="admin">Administrar</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
