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
import { Button } from "../ui/button";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Checkbox } from "../ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../convex/_generated/dataModel";
import EditCaseDialog from "./EditCaseDialog";
import { PaginationControls } from "../ui/pagination-controls";

interface CaseTableProps {
  casesResult: {
    page: Case[];
    isDone: boolean;
    continueCursor: string | null;
    totalCount: number;
  };
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  searchQuery: string;
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

export default function CaseTable({ 
  casesResult, 
  currentPage, 
  pageSize, 
  onPageChange, 
  searchQuery 
}: CaseTableProps) {
  const navigate = useNavigate();
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const [caseToEdit, setCaseToEdit] = useState<Case | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteCase = useMutation(api.functions.cases.deleteCase);

  // Extract cases from result
  const cases = casesResult?.page;

  const handleRowClick = (caseId: string) => {
    navigate(`/caso/${caseId}`);
  };

  const handleSelectCase = (caseId: string, checked: boolean) => {
    const newSelected = new Set(selectedCases);
    if (checked) {
      newSelected.add(caseId);
    } else {
      newSelected.delete(caseId);
    }
    setSelectedCases(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && cases) {
      setSelectedCases(new Set(cases.map((c) => c._id)));
    } else {
      setSelectedCases(new Set());
    }
  };

  const handleEdit = (case_: Case) => {
    setCaseToEdit(case_);
  };

  const handleDeleteSingle = async () => {
    if (!caseToDelete) return;

    setIsDeleting(true);
    try {
      await deleteCase({ caseId: caseToDelete._id as Id<"cases"> });
      toast.success("Caso eliminado exitosamente");
      setCaseToDelete(null);
      // Remover de selección si estaba seleccionado
      const newSelected = new Set(selectedCases);
      newSelected.delete(caseToDelete._id);
      setSelectedCases(newSelected);
    } catch (error) {
      console.error("Error deleting case:", error);
      toast.error("Error al eliminar el caso: " + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    // Filtrar solo casos donde el usuario es admin
    const casesToDelete = cases?.filter(
      (c) => selectedCases.has(c._id) && c.accessLevel === "admin"
    ) || [];

    if (casesToDelete.length === 0) {
      toast.error("No tienes permisos de administrador en los casos seleccionados");
      return;
    }

    setIsDeleting(true);
    try {
      await Promise.all(
        casesToDelete.map((case_) =>
          deleteCase({ caseId: case_._id as Id<"cases"> }),
        ),
      );
      toast.success(`${casesToDelete.length} casos eliminados exitosamente`);
      setSelectedCases(new Set());
    } catch (error) {
      console.error("Error deleting cases:", error);
      toast.error("Error al eliminar los casos: " + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const allSelected =
    cases && cases.length > 0 && selectedCases.size === cases.length;
  const someSelected =
    selectedCases.size > 0 && selectedCases.size < (cases?.length ?? 0);
  
  // Contar cuántos casos seleccionados tienen permiso admin
  const selectedAdminCases = cases?.filter(
    (c) => selectedCases.has(c._id) && c.accessLevel === "admin"
  ).length || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] w-full">
      {/* Barra de acciones masivas */}
      {selectedCases.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-medium text-blue-900">
                {selectedCases.size} caso{selectedCases.size > 1 ? "s" : ""}{" "}
                seleccionado{selectedCases.size > 1 ? "s" : ""}
              </span>
              {selectedAdminCases < selectedCases.size && (
                <span className="text-xs text-gray-600">
                  ({selectedAdminCases} con permiso de eliminación)
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCases(new Set())}
              className="h-8"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar selección
            </Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                size="sm" 
                disabled={isDeleting || selectedAdminCases === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar seleccionados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Eliminar {selectedAdminCases} caso{selectedAdminCases > 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. {selectedAdminCases === selectedCases.size 
                    ? "Los casos seleccionados serán eliminados permanentemente."
                    : `Solo se eliminarán los ${selectedAdminCases} casos donde tienes permisos de administrador.`
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteSelected}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Scrollable table container */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <Table>
        <TableHeader className="bg-gray-100 py-[16px] px-[8px] text-black ">
          <TableRow>
            <TableCell className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Seleccionar todos"
                className="h-5 w-5"
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
              />
            </TableCell>
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
                className={`group relative cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedCases.has(case_._id) ? "bg-blue-50" : ""
                }`}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedCases.has(case_._id)}
                    onCheckedChange={(checked) =>
                      handleSelectCase(case_._id, checked as boolean)
                    }
                    className="h-5 w-5"
                  />
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
                {/* Menú de acciones debe estar dentro de una celda para HTML válido */}
                {(
                  case_.accessLevel === "advanced" || case_.accessLevel === "admin"
                ) && (
                  <TableCell className="!p-0">
                    <div
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 hover:!opacity-100 transition-opacity bg-white shadow-sm"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(case_.accessLevel === "advanced" ||
                            case_.accessLevel === "admin") && (
                            <DropdownMenuItem
                              onClick={() => handleEdit(case_)}
                              className="cursor-pointer"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Editar</span>
                            </DropdownMenuItem>
                          )}
                          {case_.accessLevel === "admin" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setCaseToDelete(case_)}
                                className="cursor-pointer text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Eliminar</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
        </Table>
      </div>

      {/* Fixed pagination controls at bottom */}
      {cases && cases.length > 0 && (
        <div className="mt-4 flex-shrink-0">
          <PaginationControls
            totalResults={casesResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((casesResult?.totalCount || 0) / pageSize)}
            isSearchMode={!!searchQuery.trim()}
            searchQuery={searchQuery}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {/* Dialog de confirmación para eliminar un caso */}
      <AlertDialog
        open={!!caseToDelete}
        onOpenChange={(open) => !open && setCaseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar caso?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el caso "
              {caseToDelete?.title}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de edición */}
      <EditCaseDialog
        case_={caseToEdit}
        open={!!caseToEdit}
        onOpenChange={(open) => !open && setCaseToEdit(null)}
      />
    </div>
  );
}
