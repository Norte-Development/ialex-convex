import {
  FileSearch2,
  FolderX,
  Folder,
  ArrowLeft,
  ArrowRight,
  FileType2,
  Trash,
  BookCheck,
  ListChecks,
  Archive,
  RotateCcw,
  ChevronDown,
  CirclePlus,
  FilePen,
  FileDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLayout } from "@/context/LayoutContext";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { CaseDocuments } from "./CaseDocuments";
import { useCase } from "@/context/CaseContext";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CreateEscritoDialog } from "../CreateEscritoDialog";
import NewDocumentInput, { NewDocumentInputHandle } from "./NewDocumentInput";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
import { usePermissions } from "@/context/CasePermissionsContext";
import { useHighlight } from "@/context/HighlightContext";

export default function CaseSidebar() {
  const {
    isCaseSidebarOpen,
    toggleCaseSidebar,
    isEscritosOpen,
    toggleEscritos,
    isDocumentosOpen,
    toggleDocumentos,
    setIsInCaseContext,
  } = useLayout();

  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCase } = useCase();
  const { setHighlightedFolder } = useHighlight();
  const { navigationItems } = usePermissionAwareNavigation(
    currentCase?._id || null,
  );
  const [isCreateEscritoOpen, setIsCreateEscritoOpen] = useState(false);
  const [isArchivadosOpen, setIsArchivadosOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("archivados-open");
      return stored !== null ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });
  const [isCreatingRootFolder, setIsCreatingRootFolder] = useState(false);
  const [newRootFolderName, setNewRootFolderName] = useState("");
  const [isDocumentPopoverOpen, setIsDocumentPopoverOpen] = useState(false);
  const rootInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<NewDocumentInputHandle>(null);

  const documents = useQuery(
    api.functions.documents.getDocuments,
    currentCase ? { caseId: currentCase._id } : "skip",
  );

  // Permisos usando el nuevo sistema
  const { can } = usePermissions();

  const basePath = `/caso/${id}`;

  // Determinar la sección actual basada en la ruta
  const getCurrentSection = () => {
    const path = location.pathname;
    if (path.includes("/base-de-datos"))
      return { name: "Base de Datos", icon: FileSearch2 };
    if (path.includes("/configuracion/reglas"))
      return { name: "Reglas del Agente", icon: ListChecks };
    if (path.includes("/modelos")) return { name: "Modelos", icon: BookCheck };

    // Buscar en navigationItems
    for (const item of navigationItems) {
      const itemPath = item.path.split("/").pop() || "";
      if (path.includes(itemPath)) {
        return { name: item.path.split("/").pop() || "", icon: item.icon };
      }
    }

    return { name: "Navegación", icon: FileSearch2 };
  };

  const currentSection = getCurrentSection();

  // Search state for escritos
  const [escritosSearchQuery, setEscritosSearchQuery] = useState("");

  // 1. If searching, use search query
  const searchResults = useQuery(
    api.functions.documents.searchEscritos,
    currentCase && escritosSearchQuery.length >= 2
      ? { caseId: currentCase._id, query: escritosSearchQuery }
      : "skip",
  );

  // 2. Otherwise, show recent escritos only (limit 10)
  const recentEscritos = useQuery(
    api.functions.documents.getRecentEscritos,
    currentCase && !escritosSearchQuery
      ? { caseId: currentCase._id, limit: 5 }
      : "skip",
  );

  // Determine which escritos to display
  const displayedEscritos = escritosSearchQuery
    ? searchResults
    : recentEscritos;

  const totalEscritos = displayedEscritos?.length || 0;

  const totalDocumentos = documents?.length || 0;

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

  const handleCreateDocument = () => {
    documentInputRef.current?.open();
  };

  const handleDocumentSuccess = () => {
    toast.success("Documento subido exitosamente");
  };

  const handleDocumentError = (error: unknown) => {
    console.error("Error uploading document:", error);
    toast.error("Error al subir el documento");
  };

  return (
    <>
      {/* Open sidebar button - positioned outside the sidebar container */}
      {!isCaseSidebarOpen && (
        <button
          onClick={toggleCaseSidebar}
          className="fixed top-1/2 left-0 z-40 bg-white border border-border rounded-r-lg shadow-lg hover:shadow-xl transition-all duration-200 p-2 hover:bg-gray-50"
          style={{ transform: "translateY(-50%)" }}
        >
          <ArrowRight size={16} className="text-gray-600" />
        </button>
      )}

      <aside
        className={`fixed top-0 left-0 z-30 w-64 h-screen pt-1 bg-white border-r border-border flex flex-col text-sm transform transition-transform duration-300 ease-in-out  ${
          isCaseSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          className="absolute top-16 right-2 cursor-pointer z-10"
          onClick={toggleCaseSidebar}
        >
          <ArrowLeft size={15} />
        </button>

        {/* Dropdown de navegación - Fixed */}
        <div className="pl-1 py-2 border-b border-gray-200 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full cursor-pointer justify-start flex items-center gap-2  px-3 py-2 rounded-lg  transition-colors group">
              <div className="flex items-center justify-center gap-1">
                <currentSection.icon size={18} className="text-black" />
                <span className="text-sm font-medium text-gray-900">
                  {currentSection.name}
                </span>
              </div>
              <ChevronDown
                size={16}
                className="text-gray-500 group-hover:text-gray-700"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuItem asChild>
                <Link
                  to={`${basePath}/base-de-datos`}
                  onClick={handleNavigationFromCase}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FileSearch2 size={16} />
                  <span>Base de Datos</span>
                </Link>
              </DropdownMenuItem>

              {navigationItems.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <Link
                    to={item.path}
                    onClick={handleNavigationFromCase}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <item.icon size={16} />
                    <span className="capitalize">
                      {item.path.split("/").pop()}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}

              {can.viewCase && (
                <DropdownMenuItem asChild>
                  <Link
                    to={`${basePath}/configuracion/reglas`}
                    onClick={handleNavigationFromCase}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <ListChecks size={16} />
                    <span>Reglas del Agente</span>
                  </Link>
                </DropdownMenuItem>
              )}

              {can.viewCase && (
                <DropdownMenuItem asChild>
                  <Link
                    to={`${basePath}/modelos`}
                    onClick={handleNavigationFromCase}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BookCheck size={16} />
                    <span>Modelos</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contenido scrolleable */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "white transparent",
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Escritos */}
            {can.escritos.read && (
              <Collapsible
                open={isEscritosOpen}
                onOpenChange={toggleEscritos}
                className="w-full"
              >
                <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full">
                  <span className="flex items-center gap-4">
                    <div className="w-1.5 h-5 rounded-r-2xl bg-[#3946D7]" />
                    {isEscritosOpen ? (
                      <FilePen size={18} className="text-[#3946D7]" />
                    ) : (
                      <FilePen size={18} className="text-[#3946D7]" />
                    )}
                    Escritos
                  </span>
                  {can.escritos.write && (
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xs text-gray-500">({totalEscritos})</p>
                      <CirclePlus
                        className="cursor-pointer transition-colors rounded-full p-0.5  text-tertiary  hover:bg-tertiary hover:text-white"
                        size={20}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCreateEscritoOpen(true);
                        }}
                      />
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1">
                  {/* Search Input */}
                  <div className="px-2 py-1 mb-1">
                    <Input
                      placeholder="Buscar escritos..."
                      value={escritosSearchQuery}
                      onChange={(e) => {
                        setEscritosSearchQuery(e.target.value);
                      }}
                      className="h-7 text-xs placeholder:text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* View All Button */}
                  <div className="px-2 pb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/escritos`);
                      }}
                      className="w-full h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Ver todos los escritos
                    </Button>
                  </div>

                  {/* Search Results Count */}
                  {escritosSearchQuery && searchResults && (
                    <div className="px-2 pb-1 text-xs text-muted-foreground">
                      {searchResults.length > 0
                        ? `${searchResults.length} resultado${searchResults.length !== 1 ? "s" : ""}`
                        : "Sin resultados"}
                    </div>
                  )}

                  {/* Escritos List */}
                  {displayedEscritos && displayedEscritos.length > 0 ? (
                    displayedEscritos.map((escrito) => (
                      <div
                        key={escrito._id}
                        className={`flex flex-col gap-1 p-2 rounded hover:bg-gray-50 ${
                          location.pathname.includes(`/escritos/${escrito._id}`)
                            ? "bg-blue-50 border-l-2 border-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <Link
                            to={`${basePath}/escritos/${escrito._id}`}
                            className="flex items-center gap-1 text-foreground hover:text-blue-600 flex-1 min-w-0"
                            onClick={handleNavigationFromCase}
                          >
                            <FileType2
                              className="cursor-pointer flex-shrink-0"
                              size={16}
                            />
                            <span className="truncate">{escrito.title}</span>
                          </Link>
                          {can.escritos.delete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-gray-200 flex-shrink-0"
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
                          )}
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
                      {escritosSearchQuery
                        ? "No se encontraron escritos"
                        : "No hay escritos"}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Documentos */}
            {can.docs.read && (
              <Collapsible
                open={isDocumentosOpen}
                onOpenChange={toggleDocumentos}
                className="w-full"
              >
                <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full">
                  <span className="flex items-center gap-4">
                    <div className="w-1.5 h-5 rounded-r-2xl bg-[#3946D7]" />
                    <FileDown
                      className="cursor-pointer"
                      size={18}
                      color="#3946D7"
                    />
                    Documentos
                  </span>
                  {can.docs.write && (
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xs text-gray-500">
                        ({totalDocumentos})
                      </p>
                      <Popover
                        open={isDocumentPopoverOpen}
                        onOpenChange={setIsDocumentPopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <CirclePlus
                            className="cursor-pointer transition-colors rounded-full p-0.5 text-tertiary hover:bg-tertiary hover:text-white"
                            size={20}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="end">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-2 text-tertiary h-8 px-2 text-sm"
                              onClick={() => {
                                setIsCreatingRootFolder(true);
                                setIsDocumentPopoverOpen(false);
                              }}
                            >
                              <Folder size={16} />
                              Crear carpeta
                            </Button>
                            <Button
                              variant="ghost"
                              className="w-full justify-start gap-2 text-tertiary h-8 px-2 text-sm"
                              onClick={() => {
                                handleCreateDocument();
                                setIsDocumentPopoverOpen(false);
                              }}
                            >
                              <FileDown size={16} />
                              Cargar archivo
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1">
                  {/* View All Documents Button */}
                  <div className="px-2 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/documentos`);
                      }}
                      className="w-full h-6 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Ver todos los documentos
                    </Button>
                  </div>

                  {isCreatingRootFolder && (
                    <div className="flex items-center gap-2 p-1 pr-3">
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
                        className="h-4 text-xs placeholder:text-xs border-2 border-blue-400 animate-highlight"
                      />
                    </div>
                  )}
                  <CaseDocuments basePath={basePath} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        {/* Sección inferior fija - Archivados y Eliminados */}
        <div className="border-t border-gray-200 px-5 py-4 flex-shrink-0">
          <div className="flex flex-col gap-4">
            {/* Archivados */}
            <Collapsible
              open={isArchivadosOpen}
              onOpenChange={(open) => {
                setIsArchivadosOpen(open);
                try {
                  localStorage.setItem("archivados-open", JSON.stringify(open));
                } catch {
                  // Ignore localStorage errors
                }
              }}
              className="w-full"
            >
              <CollapsibleTrigger className="cursor-pointer flex gap-4 items-center">
                <FolderX className="cursor-pointer" size={20} />
                <p>Archivados</p>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-6 text-[12px] pt-1">
                {archivedEscritos && archivedEscritos.length > 0 ? (
                  archivedEscritos.map((escrito) => (
                    <div
                      key={escrito._id}
                      className="flex flex-col gap-1 p-2 rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-1 min-w-0">
                        <Link
                          to={`${basePath}/escritos/${escrito._id}`}
                          className="flex items-center gap-1 text-foreground hover:text-blue-600 flex-1 min-w-0"
                          onClick={handleNavigationFromCase}
                        >
                          <FileType2
                            className="cursor-pointer flex-shrink-0"
                            size={16}
                          />
                          <span className="truncate">{escrito.title}</span>
                        </Link>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-gray-200 flex-shrink-0"
                                onClick={() =>
                                  handleArchiveEscrito(escrito._id, false)
                                }
                              >
                                <RotateCcw
                                  size={12}
                                  className="text-gray-500"
                                />
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

            {/* Eliminados */}
            <div className="flex gap-4 items-center text-red-400 cursor-pointer">
              <Trash className="cursor-pointer" size={20} />
              <p>Eliminados</p>
            </div>
          </div>
        </div>

        {/* Create Escrito Dialog */}
        <CreateEscritoDialog
          open={isCreateEscritoOpen}
          setOpen={setIsCreateEscritoOpen}
          onEscritoCreated={handleEscritoCreated}
        />

        {/* Upload Document Input */}
        {currentCase && (
          <NewDocumentInput
            ref={documentInputRef}
            caseId={currentCase._id}
            folderId={undefined}
            onSuccess={handleDocumentSuccess}
            onError={handleDocumentError}
          />
        )}
      </aside>
    </>
  );
}
