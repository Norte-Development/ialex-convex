import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import ClientDetailDialog from "./ClientDetailDialog";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Checkbox } from "../ui/checkbox";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { PaginationControls } from "../ui/pagination-controls";

interface ClientsTableProps {
  clientsResult: any;
  caseId?: Id<"cases">; // If provided, table adapts to case context (hide case count, enable unlink)
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  searchQuery?: string;
}

export default function ClientsTable({
  clientsResult,
  caseId,
  currentPage = 1,
  pageSize = 20,
  onPageChange,
  searchQuery = "",
}: ClientsTableProps) {
  const navigate = useNavigate();
  const removeClientFromCase = useMutation(
    api.functions.cases.removeClientFromCase,
  );

  if (!clientsResult) {
    return <div>Cargando clientes...</div>;
  }

  const clients = clientsResult.page;

  if (!clients || clients.length === 0) {
    return <div>No se encontraron clientes</div>;
  }

  const handleUnlink = async (clientId: Id<"clients">) => {
    if (!caseId) return;
    if (!confirm("¿Desvincular este cliente del caso?")) return;
    try {
      await removeClientFromCase({ clientId, caseId });
    } catch (e) {
      toast.error("Error al desvincular: " + (e as Error).message);
    }
  };
  console.log(clientsResult);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden w-full">
      <Table className="w-full">
        <TableHeader className="">
          <TableRow className="">
            <TableHead className="">
              <Checkbox />
            </TableHead>

            <TableHead className="">Nombre</TableHead>
            <TableHead className="">DNI/CUIT</TableHead>
            {!caseId && <TableHead className="">Casos vinculados</TableHead>}
            <TableHead className=" w-[1%] whitespace-nowrap">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="">
          {clients.map((client: any, index: number) => (
            <TableRow key={client._id || index} className="">
              <TableCell className="">
                <Checkbox />
              </TableCell>
              <TableCell className="">
                <div className="flex items-center gap-1">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                      {client.name
                        ?.split(" ")
                        .slice(0, 2)
                        .map((n: string) => n.charAt(0).toUpperCase())
                        .join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-medium">{client.name}</span>
                    {client.email && (
                      <span className="text-sm text-gray-500">
                        {client.email}
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="">
                {client.dni || client.cuit || "N/A"}
              </TableCell>
              {!caseId && (
                <TableCell className="">
                  {client.cases && client.cases.length > 0 ? (
                    <TooltipProvider>
                      <div className="flex items-center gap-1">
                        {client.cases
                          .slice(0, 3)
                          .map((caseRelation: any, idx: number) => (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <Avatar
                                  className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    navigate(`/caso/${caseRelation.case._id}`)
                                  }
                                >
                                  <AvatarFallback className="bg-purple-100 text-purple-600 text-xs font-medium">
                                    {caseRelation.case.title
                                      ?.split(" ")
                                      .slice(0, 2)
                                      .map((word: string) =>
                                        word.charAt(0).toUpperCase(),
                                      )
                                      .join("") || "C"}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm font-medium">
                                  {caseRelation.case.title}
                                </p>
                                <p className="text-xs text-white">
                                  {caseRelation.role}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        {client.cases.length > 3 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium cursor-pointer hover:bg-gray-200 transition-colors">
                                +{client.cases.length - 3}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm mb-3">
                                  Todos los casos ({client.cases.length})
                                </h4>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                  {client.cases.map(
                                    (caseRelation: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() =>
                                          navigate(
                                            `/caso/${caseRelation.case._id}`,
                                          )
                                        }
                                      >
                                        <Avatar className="w-8 h-8">
                                          <AvatarFallback className="bg-purple-100 text-purple-600 text-xs font-medium">
                                            {caseRelation.case.title
                                              ?.split(" ")
                                              .slice(0, 2)
                                              .map((word: string) =>
                                                word.charAt(0).toUpperCase(),
                                              )
                                              .join("") || "C"}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">
                                            {caseRelation.case.title}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            {caseRelation.case.description && (
                                              <p className="text-xs text-gray-500 truncate">
                                                {caseRelation.case.description}
                                              </p>
                                            )}
                                            <span className="text-xs text-purple-600 font-medium whitespace-nowrap">
                                              {caseRelation.role}
                                            </span>
                                          </div>
                                        </div>
                                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </TooltipProvider>
                  ) : (
                    <span className="text-sm text-gray-500">Sin casos</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right space-x-2 flex-col flex gap-1">
                <ClientDetailDialog
                  clientId={client._id}
                  initialClient={client}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[12px]  cursor-pointer hover:bg-gray-300"
                  >
                    Ver / Editar
                  </Button>
                </ClientDetailDialog>

                {caseId && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-[10px] cursor-pointer"
                    onClick={() => handleUnlink(client._id)}
                  >
                    Desvincular
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Pagination controls */}
      {clients && clients.length > 0 && onPageChange && (
        <div className="mt-4">
          <PaginationControls
            totalResults={clientsResult?.totalCount || 0}
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={Math.ceil((clientsResult?.totalCount || 0) / pageSize)}
            isSearchMode={!!searchQuery.trim()}
            searchQuery={searchQuery}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
