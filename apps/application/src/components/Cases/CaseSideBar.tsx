import {
  FileSearch2,
  FolderX,
  ArrowDown,
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
  Check,
  X,
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
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
  const { navigationItems } = usePermissionAwareNavigation(
    currentCase?._id || null,
  );
  const [isCreateEscritoOpen, setIsCreateEscritoOpen] = useState(false);
  const [isArchivadosOpen, setIsArchivadosOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<Id<"folders"> | null>(
    null,
  );
  const [editingFolderName, setEditingFolderName] = useState("");

  // Folder hierarchy states
  const [currentParentFolder, setCurrentParentFolder] =
    useState<Id<"folders"> | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [creatingInFolder, setCreatingInFolder] =
    useState<Id<"folders"> | null>(null);

  // For document Trigger
  const [showAddDocument, setShowAddDocument] = useState(false);

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

  // Folder mutations
  const createFolder = useMutation(api.functions.folders.createFolder);
  const updateFolder = useMutation(api.functions.folders.updateFolder);

  // Fetch folders for the current case and current parent folder
  const folders = useQuery(
    api.functions.folders.getFoldersForCase,
    currentCase
      ? {
          caseId: currentCase._id,
          parentFolderId: currentParentFolder || undefined,
        }
      : "skip",
  );

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

  const handleCreateFolder = async () => {
    if (!currentCase) return;

    try {
      const folderName = newFolderName.trim() || "Nueva carpeta";
      await createFolder({
        name: folderName,
        caseId: currentCase._id,
      });

      // Reset states
      setIsCreatingFolder(false);
      setNewFolderName("");
      setShowAddDocument(false);
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Error al crear la carpeta. Por favor intenta de nuevo.");
    }
  };

  const handleCancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleStartCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName("");
  };

  const handleStartEditFolder = (
    folderId: Id<"folders">,
    currentName: string,
  ) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleSaveEditFolder = async () => {
    if (!editingFolderId) return;

    try {
      const newName = editingFolderName.trim();
      if (!newName) {
        handleCancelEditFolder();
        return;
      }

      await updateFolder({
        folderId: editingFolderId,
        name: newName,
      });

      // Reset editing states
      setEditingFolderId(null);
      setEditingFolderName("");
    } catch (error) {
      console.error("Error updating folder:", error);
      alert("Error al actualizar la carpeta. Por favor intenta de nuevo.");
    }
  };

  const handleCancelEditFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
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

  console.log(showAddDocument);

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

      <div className="h-[70%] w-full flex flex-col justify-start items-center pl-5">
        <div className="w-full flex flex-col gap-2 h-[50%]">
          <IfCan permission={PERMISSIONS.ESCRITO_READ} fallback={null}>
            <Collapsible
              open={isEscritosOpen}
              onOpenChange={toggleEscritos}
              className="w-full "
            >
              <CollapsibleTrigger className="cursor-pointer flex justify-between items-center gap-1 w-full pr-2">
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
              <CollapsibleTrigger className="w-full cursor-pointer flex gap-1 justify-between items-center  pr-3">
                <div className="flex justify-center items-center gap-1">
                  <FolderArchive className="cursor-pointer" size={20} />
                  Documentos
                </div>
                <ArrowDown
                  size={15}
                  className={`transition-transform duration-200 ${isDocumentosOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
                <div className="flex justify-start items-center gap-1">
                  <Plus
                    className="cursor-pointer mt-2 bg-blue-300 text-blue-600 rounded-full p-1"
                    size={20}
                    onClick={() => setShowAddDocument(!showAddDocument)}
                  />

                  {showAddDocument && (
                    <div className="flex justify-center bg-gray-200 rounded-md px-3 flex-col items-center gap-1">
                      <button
                        className="cursor-pointer hover:text-blue-700"
                        onClick={handleStartCreateFolder}
                      >
                        Crear Carpeta
                      </button>
                      <button className="cursor-pointer hover:text-blue-700">
                        Crear Documento
                      </button>
                    </div>
                  )}
                </div>

                {/* Create folder input */}
                {isCreatingFolder && (
                  <div className="flex items-center gap-1 p-2 bg-blue-50 rounded border">
                    <Folder size={16} className="text-black" />
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Nueva carpeta"
                      className="flex-1 text-xs border-none outline-none bg-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateFolder();
                        } else if (e.key === "Escape") {
                          handleCancelCreateFolder();
                        }
                      }}
                    />
                    <button
                      onClick={handleCreateFolder}
                      className="p-1 hover:bg-green-100 rounded"
                    >
                      <Check size={12} className="text-green-600" />
                    </button>
                    <button
                      onClick={handleCancelCreateFolder}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <X size={12} className="text-red-600" />
                    </button>
                  </div>
                )}

                {/* Display folders */}
                {folders && folders.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {folders.map((folder) => (
                      <div
                        key={folder._id}
                        className="flex items-center gap-1 p-1 rounded hover:bg-gray-50"
                      >
                        <Folder size={16} className="text-blue-600" />
                        {editingFolderId === folder._id ? (
                          // Edit mode
                          <>
                            <input
                              type="text"
                              value={editingFolderName}
                              onChange={(e) =>
                                setEditingFolderName(e.target.value)
                              }
                              className="flex-1 text-xs border-none outline-none bg-transparent"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEditFolder();
                                } else if (e.key === "Escape") {
                                  handleCancelEditFolder();
                                }
                              }}
                              onBlur={handleSaveEditFolder}
                            />
                            <button
                              onClick={handleSaveEditFolder}
                              className="p-1 hover:bg-green-100 rounded"
                            >
                              <Check size={12} className="text-green-600" />
                            </button>
                            <button
                              onClick={handleCancelEditFolder}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <X size={12} className="text-red-600" />
                            </button>
                          </>
                        ) : (
                          // View mode
                          <span
                            className="text-xs truncate flex-1 cursor-pointer"
                            onDoubleClick={() =>
                              handleStartEditFolder(folder._id, folder.name)
                            }
                            title="Doble clic para editar"
                          >
                            {folder.name}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <CaseDocuments basePath={basePath} />
              </CollapsibleContent>
            </Collapsible>
          </IfCan>
        </div>

        <div className="w-full flex flex-col gap-2 h-[50%] ">
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
              className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-40"
              onClick={(e) => e.stopPropagation()}
            >
              <AIAgentThreadSelector />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <div className="w-full flex flex-col justify-center h-[20%] gap-2 pl-5">
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
