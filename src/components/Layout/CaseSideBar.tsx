import {
  FileSearch2,
  UserIcon,
  TvMinimalPlay,
  UsersRound,
  FolderX,
  FolderOpen,
  Folder,
  FolderArchive,
  FolderSymlink,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

export default function CaseSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-1/5 h-full  bg-white  border-r border-border flex flex-col text-sm">
      <div className={`flex gap-4 justify-center items-center h-[10%] `}>
        <button onClick={() => {}}>
          <FileSearch2 className="cursor-pointer" size={20} />
        </button>
        <UserIcon fill="currentColor" className="cursor-pointer" size={20} />
        <TvMinimalPlay className="cursor-pointer" size={20} />
        <UsersRound className="cursor-pointer" size={20} />
      </div>
      <div className="h-[70%] w-full flex flex-col justify-start items-center overflow-y-auto pl-5">
        <div className="w-full flex flex-col gap-2 h-[50%] overflow-y-auto">
          <Collapsible open={open} onOpenChange={setOpen} className="w-full ">
            <CollapsibleTrigger className="cursor-pointer flex gap-1">
              {open ? (
                <FolderOpen className="cursor-pointer" size={20} />
              ) : (
                <Folder className="cursor-pointer" size={20} />
              )}{" "}
              Escritos
            </CollapsibleTrigger>
            <CollapsibleContent>Content de escritos</CollapsibleContent>
          </Collapsible>
          <Collapsible className="w-full">
            <CollapsibleTrigger className="cursor-pointer flex gap-1">
              <FolderArchive className="cursor-pointer" size={20} />
              Documentos
            </CollapsibleTrigger>
            <CollapsibleContent>Content de documentos</CollapsibleContent>
          </Collapsible>
        </div>
        <div className="w-full flex flex-col gap-2 h-[50%] overflow-y-auto">
          <Collapsible className="w-full">
            <CollapsibleTrigger className="cursor-pointer flex gap-1">
              <FolderSymlink className="cursor-pointer" size={20} />
              Historial de chat
            </CollapsibleTrigger>
            <CollapsibleContent>Content de historial</CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <div className="w-full  flex flex-col justify-center items-center h-[20%] gap-2">
        <div className="flex gap-4 items-center">
          <FolderX className="cursor-pointer" size={20} />
          <p>Archivados</p>
        </div>
        <div className="flex gap-4 items-center">
          <FolderX className="cursor-pointer" size={20} />
          <p>Eliminados</p>
        </div>
      </div>
    </div>
  );
}
