import {
  FileSearch2,
  FolderX,
  FolderOpen,
  Folder,
  FolderArchive,
  FolderSymlink,
  ArrowLeft,
  ArrowRight,
  FileType2,
  Trash,
  BookCheck,
  Plus,
  Archive,
  RotateCcw,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLayout } from "@/context/LayoutContext";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { AIAgentThreadSelector } from "./CaseThreadSelector";
import { CaseDocuments } from "./CaseDocuments";
import { useThread } from "@/context/ThreadContext";
import { useCase } from "@/context/CaseContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CreateEscritoDialog } from "../CreateEscritoDialog";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Id } from "../../../convex/_generated/dataModel";
import { usePermissionAwareNavigation } from "@/hooks/usePermissionAwareNavigation";
import { PERMISSIONS } from "@/permissions/types";
import { IfCan } from "@/components/Permissions";
import { useHighlight } from "@/context/HighlightContext";

export default function CaseSidebar() {
  const {
    isCaseSidebarOpen,
    toggleCaseSidebar,
    isEscritosOpen,
    toggleEscritos,
    isDocumentosOpen,
    toggleDocumentos,
    isHistorialOpen,
    toggleHistorial,
    setIsInCaseContext,
  } = useLayout();

  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { setThreadId } = useThread();
  const { currentCase } = useCase();
  const { setHighlightedFolder } = useHighlight();
  const { navigationItems } = usePermissionAwareNavigation(
    currentCase?._id || null,
  );
  const [isCreateEscritoOpen, setIsCreateEscritoOpen] = useState(false);
  const [isArchivadosOpen, setIsArchivadosOpen] = useState(false);
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [newRootFolderName, setNewRootFolderName] = useState("");
  const rootInputRef = useRef<HTMLInputElement | null>(null);
  const [threadSearch, setThreadSearch] = useState("");

  const basePath = `/caso/${id}`;

  // Fetch actual escritos for the current case
  const escritos = useQuery(
    api.functions.documents.getEscritos,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Fetch archived escritos for the current case
  const archivedEscritos = useQuery(
    api.functions.documents.getArchivedEscritos,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Archive mutation
  const archiveEscrito = useMutation(api.functions.documents.archiveEscrito);
  // Create root folder mutation
  const createFolder = useMutation(api.functions.folders.createFolder);

  const handleNavigationFromCase = () => {
    setIsInCaseContext(true);
  };

  const handleEscritoCreated = (escritoId: Id<"escritos">) => {
    // Navigate to the newly created escrito
    navigate(`${basePath}/escritos/${escritoId}`);
  };

  const handleArchiveEscrito = async (
    escritoId: string,
    isArchived: boolean,
  ) => {
    try {
      await archiveEscrito({
        escritoId: escritoId as any,
        isArchived: isArchived,
      });
    } catch (error) {
      console.error("Error archiving/unarchiving escrito:", error);
      alert(
        "Error al archivar/desarchivar el escrito. Por favor intenta de nuevo.",
      );
    }
  };

  const getStatusColor = (status: string) => {
    return status === "terminado"
      ? "bg-green-100 text-green-800"
      : "bg-yellow-100 text-yellow-800";
  };

  const getStatusText = (status: string) => {
    return status === "terminado" ? "Terminado" : "Borrador";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    if (isCreatingRootFolder && rootInputRef.current) {
      const t = setTimeout(() => {
        rootInputRef.current?.focus();
        rootInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isCreatingRootFolder]);

  const submitCreateRootFolder = async () => {
    if (!currentCase?._id) return;
    const name = (newRootFolderName || "").trim() || "Nueva Carpeta";
    try {
      const newFolderId = await createFolder({
        name,
        caseId: currentCase._id,
      } as any);
      setHighlightedFolder(newFolderId);
      setNewRootFolderName("");
      setIsCreatingRootFolder(false);
    } catch (err) {
      console.error("Error creating root folder:", err);
      alert(err instanceof Error ? err.message : "No se pudo crear la carpeta");
    }
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-30 w-64 h-screen pt-14 bg-white border-r border-border flex flex-col text-sm transform transition-transform duration-300 ease-in-out ${
        isCaseSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <button
        className="absolute top-16 right-2 cursor-pointer"
        onClick={toggleCaseSidebar}
      >
        <ArrowLeft size={15} />
      </button>

      {!isCaseSidebarOpen && (
        <button
          onClick={toggleCaseSidebar}
          className="absolute top-1/2 -right-5 cursor-pointer"
        >
          <ArrowRight size={15} />
        </button>
      )}

      <div className={`flex gap-4 justify-center items-center h-[10%] `}>
        {/* Base de datos - always show for now as it's not permission-dependent */}
        <Link
          to={`${basePath}/base-de-datos`}
          onClick={handleNavigationFromCase}
        >
          <FileSearch2
            className="cursor-pointer"
            size={20}
            color={location.pathname === "/base-de-datos" ? "blue" : "black"}
          />
        </Link>

        {/* Permission-aware navigation items */}
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavigationFromCase}
          >
            <item.icon
              className="cursor-pointer"
              size={20}
              color={
                location.pathname.includes(item.path.split("/").pop() || "")
                  ? "blue"
                  : "black"
              }
            />
          </Link>
        ))}

        {/* Modelos - always show for now as it's template-related */}
        <IfCan permission={PERMISSIONS.CASE_VIEW} fallback={null}>
          <Link to={`${basePath}/modelos`} onClick={handleNavigationFromCase}>
            <BookCheck
              className="cursor-pointer"
              size={20}
              color={location.pathname.includes("/modelos") ? "blue" : "black"}
            />
          </Link>
        </IfCan>
      </div>

      <div className="h-[60%] w-full flex flex-col justify-start items-center pl-5 ">
        <div className="w-full flex flex-col gap-2 h-[70%] ">
          <IfCan permission={PERMISSIONS.ESCRITO_READ} fallback={null}>
            <Collapsible
              open={isEscritosOpen}
              onOpenChange={toggleEscritos}
              className="w-full "
            >
              <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full">
                <span className="flex items-center gap-1">
                  {isEscritosOpen ? (
                    <FolderOpen className="cursor-pointer" size={20} />
                  ) : (
                    <Folder className="cursor-pointer" size={20} />
                  )}
                  Escritos
                </span>
                <IfCan permission={PERMISSIONS.ESCRITO_WRITE} fallback={null}>
                  <Plus
                    className="cursor-pointer transition-colors rounded-full p-1 hover:bg-blue-100 hover:text-blue-600"
                    size={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreateEscritoOpen(true);
                    }}
                  />
                </IfCan>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
                {escritos && escritos.length > 0 ? (
                  escritos.map((escrito) => (
                    <div
                      key={escrito._id}
                      className={`flex flex-col gap-1 p-2 rounded hover:bg-gray-50 ${
                        location.pathname.includes(`/escritos/${escrito._id}`)
                          ? "bg-blue-50 border-l-2 border-blue-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          to={`${basePath}/escritos/${escrito._id}`}
                          className="flex items-center gap-1 text-foreground hover:text-blue-600 flex-1"
                          onClick={handleNavigationFromCase}
                        >
                          <FileType2 className="cursor-pointer" size={16} />
                          <span className="truncate">{escrito.title}</span>
                        </Link>
                        <IfCan
                          permission={PERMISSIONS.ESCRITO_DELETE}
                          fallback={null}
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 hover:bg-gray-200"
                                  onClick={() =>
                                    handleArchiveEscrito(escrito._id, true)
                                  }
                                >
                                  <Archive
                                    size={12}
                                    className="text-gray-500"
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Archivar escrito</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </IfCan>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${getStatusColor(escrito.status)}`}
                        >
                          {getStatusText(escrito.status)}
                        </Badge>
                        <span>{formatDate(escrito.lastEditedAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-xs p-2">
                    No hay escritos
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </IfCan>

          <IfCan permission={PERMISSIONS.DOC_READ} fallback={null}>
            <Collapsible
              open={isDocumentosOpen}
              onOpenChange={toggleDocumentos}
              className="w-full"
            >
              <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full">
                <span className="flex items-center gap-1">
                  <FolderArchive className="cursor-pointer" size={20} />
                  Documentos
                </span>
                <IfCan permission={PERMISSIONS.DOC_WRITE} fallback={null}>
                  <Plus
                    className="cursor-pointer transition-colors rounded-full p-1 hover:bg-blue-100 hover:text-blue-600"
                    size={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingRootFolder(true);
                    }}
                  />
                </IfCan>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-[200px]">
                {isCreatingRootFolder && (
                  <div className="flex items-center gap-2 p-1 pr-3 ">
                    <Input
                      ref={rootInputRef}
                      placeholder="Nombre de la carpeta"
                      value={newRootFolderName}
                      onChange={(e) => setNewRootFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitCreateRootFolder();
                        else if (e.key === "Escape") {
                          setIsCreatingRootFolder(false);
                          setNewRootFolderName("");
                        }
                      }}
                      className="h-4 text-xs placeholder:text-xs border-2 border-blue-400 animate-highlight "
                    />
                  </div>
                )}
                <CaseDocuments basePath={basePath} />
              </CollapsibleContent>
            </Collapsible>
          </IfCan>
        </div>

        <div className="w-full flex flex-col gap-2 h-[30%] ">
          <Collapsible
            open={isHistorialOpen}
            onOpenChange={toggleHistorial}
            className="w-full"
          >
            <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full">
              <span className="flex items-center gap-1">
                <FolderSymlink className="cursor-pointer" size={20} />
                Historial de chat
              </span>
              <Plus
                className="cursor-pointer transition-colors rounded-full p-1 hover:bg-blue-100 hover:text-blue-600"
                size={25}
                onClick={(e) => {
                  e.stopPropagation();
                  setThreadId(undefined);
                }}
              />
            </CollapsibleTrigger>
            <CollapsibleContent
              className="flex flex-col gap-2 pl-2 pr-2 text-[12px] pt-1 overflow-y-auto max-h-40"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-1 pb-1">
                <Input
                  placeholder="Buscar threads por título..."
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  className="h-5 text-xs placeholder:text-xs"
                />
              </div>
              <AIAgentThreadSelector searchTerm={threadSearch} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="w-full flex flex-col justify-center h-[30%] gap-2 pl-5">
        <Collapsible
          open={isArchivadosOpen}
          onOpenChange={setIsArchivadosOpen}
          className="w-full"
        >
          <CollapsibleTrigger className="cursor-pointer flex gap-4 items-center">
            <FolderX className="cursor-pointer" size={20} />
            <p>Archivados</p>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1 pl-6 text-[12px] pt-1 overflow-y-auto max-h-32">
            {archivedEscritos && archivedEscritos.length > 0 ? (
              archivedEscritos.map((escrito) => (
                <div
                  key={escrito._id}
                  className="flex flex-col gap-1 p-2 rounded hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to={`${basePath}/escritos/${escrito._id}`}
                      className="flex items-center gap-1 text-foreground hover:text-blue-600 flex-1"
                      onClick={handleNavigationFromCase}
                    >
                      <FileType2 className="cursor-pointer" size={16} />
                      <span className="truncate">{escrito.title}</span>
                    </Link>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-gray-200"
                            onClick={() =>
                              handleArchiveEscrito(escrito._id, false)
                            }
                          >
                            <RotateCcw size={12} className="text-gray-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Restaurar escrito</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getStatusColor(escrito.status)}`}
                    >
                      {getStatusText(escrito.status)}
                    </Badge>
                    <span>{formatDate(escrito.lastEditedAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-xs p-2">
                No hay escritos archivados
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-4 items-center text-red-400 cursor-pointer">
          <Trash className="cursor-pointer" size={20} />
          <p>Eliminados</p>
        </div>
      </div>

      {/* Create Escrito Dialog */}
      <CreateEscritoDialog
        open={isCreateEscritoOpen}
        setOpen={setIsCreateEscritoOpen}
        onEscritoCreated={handleEscritoCreated}
      />
    </aside>
  );
}
