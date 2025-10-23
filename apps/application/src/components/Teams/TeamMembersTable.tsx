import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, User, Shield, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamMembersTableProps {
  members: any;
  isLoading?: boolean;
  onRemoveMember: (memberId: string) => void;
  removingMember: string | null;
  isAdmin?: boolean;
}

export function TeamMembersTable({
  members,
  isLoading = false,
  onRemoveMember,
  removingMember,
  isAdmin = false,
}: TeamMembersTableProps) {
  if (isLoading || members === undefined) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-500">
        <Users className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay miembros
        </h3>
        <p className="text-gray-500 text-center">
          Agrega el primer miembro a este equipo.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-[#F5F5F5]">
        <TableRow>
          <TableHead className="text-left">Nombre</TableHead>
          <TableHead className="text-left">Email</TableHead>
          <TableHead className="text-left">Rol en el Equipo</TableHead>
          {isAdmin && (
            <TableHead className="w-[100px] text-left">Acciones</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member: any) => (
          <TableRow key={member._id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="font-medium">{member.name}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4" />
                {member.email}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <Badge variant="outline" className="capitalize">
                  {member.teamRole}
                </Badge>
              </div>
            </TableCell>
            {isAdmin && (
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveMember(member._id as string)}
                  disabled={removingMember === member._id}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  {removingMember === member._id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <>
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remover
                    </>
                  )}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
