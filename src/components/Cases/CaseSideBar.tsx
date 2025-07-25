import {
  FileSearch2,
  UserIcon,
  UsersRound,
  FolderX,
  FolderOpen,
  Folder,
  FolderArchive,
  FolderSymlink,
  ArrowLeft,
  FileType2,
  FileArchive,
  Trash,
  BookCheck,
  Plus,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLayout } from "@/context/LayoutContext";
import { useLocation, useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { AIAgentThreadSelector } from "./CaseThreadSelector";
import { useGenerateNewThreadId } from "@/context/ThreadContext";
import { CreateEscritoDialog } from "../CreateEscritoDialog";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function CaseSidebar() {
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const {
    isCaseSidebarOpen,
    toggleCaseSidebar,
    isEscritosOpen,
    toggleEscritos,
    isDocumentosOpen,
    toggleDocumentos,
    isHistorialOpen,
    toggleHistorial,
  } = useLayout();

  const location = useLocation();
  const { id } = useParams();

  const basePath = `/caso/${id}`;

  const escritos = useQuery(api.functions.documents.getEscritos, {
    caseId: id as Id<"cases">,
  });

  return (
    <>
      <aside
        className={`relative z-30 h-full border-r bg-white border-border flex flex-col text-sm transition-all duration-300 ease-in-out overflow-hidden ${
          isCaseSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <button
          className="absolute top-4 right-2 cursor-pointer"
          onClick={toggleCaseSidebar}
        >
          <ArrowLeft size={15} />
        </button>

        <div className={`flex gap-4 justify-center items-center h-[10%] `}>
          <Link to={`${basePath}/base-de-datos`}>
            <FileSearch2
              className="cursor-pointer"
              size={20}
              color={location.pathname === "/base-de-datos" ? "blue" : "black"}
            />
          </Link>
          <Link to={`${basePath}/clientes`}>
            <UserIcon
              fill={location.pathname.includes("/clientes") ? "blue" : "black"}
              className="cursor-pointer"
              size={20}
              color={location.pathname.includes("/clientes") ? "blue" : "black"}
            />
          </Link>
          <Link to={`${basePath}/modelos`}>
            <BookCheck
              className="cursor-pointer"
              size={20}
              color={location.pathname.includes("/modelos") ? "blue" : "black"}
            />
          </Link>
          <Link to={`${basePath}/equipos`}>
            <UsersRound
              className="cursor-pointer"
              size={20}
              color={location.pathname.includes("/equipos") ? "blue" : "black"}
            />
          </Link>
        </div>

        <div className="h-[70%] w-full flex flex-col justify-start items-center pl-5">
          <div className="w-full flex flex-col gap-2 h-[50%]">
            <Collapsible
              open={isEscritosOpen}
              onOpenChange={toggleEscritos}
              className="w-full "
            >
              <CollapsibleTrigger className="cursor-pointer flex pr-2 gap-1 justify-between items-center w-full">
                {isEscritosOpen ? (
                  <span className="flex gap-1 items-center">
                    <FolderOpen className="cursor-pointer" size={20} />
                    Escritos
                  </span>
                ) : (
                  <span className="flex gap-1 items-center">
                    <Folder className="cursor-pointer" size={20} />
                    Escritos
                  </span>
                )}
                <Plus
                  className="cursor-pointer transition-colors rounded-full p-1 hover:bg-blue-100 hover:text-blue-600"
                  size={25}
                  onClick={() => setOpenCreateDialog(true)}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
                {escritos?.length === 0 ? (
                  <p className="text-center">No hay escritos</p>
                ) : (
                  <>
                    {escritos?.map((escrito) => (
                      <div
                        key={escrito._id}
                        className={`flex gap-1 items-center`}
                      >
                        <FileType2 className="cursor-pointer" size={20} />
                        <Link to={`${basePath}/escritos/${escrito._id}`}>
                          {escrito.title}
                        </Link>
                      </div>
                    ))}
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Collapsible
              open={isDocumentosOpen}
              onOpenChange={toggleDocumentos}
              className="w-full"
            >
              <CollapsibleTrigger className="cursor-pointer flex gap-1">
                <FolderArchive className="cursor-pointer" size={20} />
                Documentos
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-32">
                <div className={`flex gap-1 items-center`}>
                  <FileArchive className="cursor-pointer" size={20} />
                  <Link to={`${basePath}/nombre-del-documento`}>
                    Nombre del documento
                  </Link>
                </div>
              </CollapsibleContent>
            </Collapsible>
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
                  onClick={useGenerateNewThreadId}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1 overflow-y-auto max-h-40">
                <AIAgentThreadSelector />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <div className="w-full  flex flex-col justify-center  h-[20%] gap-2 pl-5">
          <div className="flex gap-4 items-center">
            <FolderX className="cursor-pointer" size={20} />
            <p>Archivados</p>
          </div>
          <div className="flex gap-4 items-center text-red-400 cursor-pointer">
            <Trash className="cursor-pointer" size={20} />
            <p>Eliminados</p>
          </div>
        </div>
      </aside>

      <CreateEscritoDialog
        open={openCreateDialog}
        setOpen={setOpenCreateDialog}
      />
    </>
  );
}
