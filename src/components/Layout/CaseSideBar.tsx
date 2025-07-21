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
  ArrowRight,
  FileType2,
  FileArchive,
  Trash,
  BookCheck,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLayout } from "@/context/LayoutContext";
import { useLocation, useParams } from "react-router-dom";
import { Link } from "react-router-dom";

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
  const { id } = useParams();

  const isAgreements = location.pathname.includes("acuerdos");
  const isNameOfDocument = location.pathname.includes("nombre-del-documento");

  const basePath = `/caso/${id}`;

  const handleNavigationFromCase = () => {
    setIsInCaseContext(true);
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
        <Link to={`${basePath}/clientes`} onClick={handleNavigationFromCase}>
          <UserIcon
            fill={location.pathname.includes("/clientes") ? "blue" : "black"}
            className="cursor-pointer"
            size={20}
            color={location.pathname.includes("/clientes") ? "blue" : "black"}
          />
        </Link>
        <Link to={`${basePath}/modelos`} onClick={handleNavigationFromCase}>
          <BookCheck
            className="cursor-pointer"
            size={20}
            color={location.pathname.includes("/modelos") ? "blue" : "black"}
          />
        </Link>
        <UsersRound className="cursor-pointer" size={20} />
      </div>
      <div className="h-[70%] w-full flex flex-col justify-start items-center overflow-y-auto pl-5">
        <div className="w-full flex flex-col gap-2 h-[50%] overflow-y-auto">
          <Collapsible
            open={isEscritosOpen}
            onOpenChange={toggleEscritos}
            className="w-full "
          >
            <CollapsibleTrigger className="cursor-pointer flex gap-1">
              {isEscritosOpen ? (
                <FolderOpen className="cursor-pointer" size={20} />
              ) : (
                <Folder className="cursor-pointer" size={20} />
              )}{" "}
              Escritos
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1">
              <div
                className={`flex gap-1 items-center ${isAgreements ? "text-blue-500" : ""}`}
              >
                <FileType2 className="cursor-pointer" size={20} />
                <Link to={`${basePath}/acuerdos`}>Acuerdos</Link>
              </div>
              <div
                className={`flex gap-1 items-center ${isNameOfDocument ? "text-blue-500" : ""}`}
              >
                <FileType2 className="cursor-pointer" size={20} />
                <Link to={`${basePath}/nombre-del-documento`}>
                  Nombre del documento
                </Link>
              </div>
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
            <CollapsibleContent className="flex flex-col gap-1 pl-2 text-[12px] pt-1">
              <div
                className={`flex gap-1 items-center ${isNameOfDocument ? "text-blue-500" : ""}`}
              >
                <FileArchive className="cursor-pointer" size={20} />
                <Link to={`${basePath}/nombre-del-documento`}>
                  Nombre del documento
                </Link>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <div className="w-full flex flex-col gap-2 h-[50%] overflow-y-auto ">
          <Collapsible
            open={isHistorialOpen}
            onOpenChange={toggleHistorial}
            className="w-full"
          >
            <CollapsibleTrigger className="cursor-pointer flex gap-1">
              <FolderSymlink className="cursor-pointer" size={20} />
              Historial de chat
            </CollapsibleTrigger>
            <CollapsibleContent>Content de historial</CollapsibleContent>
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
  );
}
