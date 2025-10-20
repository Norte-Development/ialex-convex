import {
  Pencil,
  Archive,
  MoreVertical,
  FolderPlus,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ReactNode } from "react";

type FolderActionsMenuProps = {
  onCreateFolder: () => void;
  onCreateDocument: () => void;
  onRename: () => void;
  onArchive: () => void;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function FolderActionsMenu({
  onCreateFolder,
  onCreateDocument,
  onRename,
  onArchive,
  trigger,
  open,
  onOpenChange,
}: FolderActionsMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <button
            className="p-1 cursor-pointer hover:bg-gray-200 rounded transition-colors"
            onClick={(e) => e.stopPropagation()}
            data-folder-menu-trigger
            aria-label="Acciones de carpeta"
          >
            <MoreVertical size={14} className="text-gray-600" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCreateFolder();
          }}
          className="cursor-pointer"
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          <span>Nueva carpeta</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCreateDocument();
          }}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          <span>Nuevo documento</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="cursor-pointer"
        >
          <Pencil className="mr-2 h-4 w-4" />
          <span>Renombrar</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <Archive className="mr-2 h-4 w-4" />
          <span>Archivar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FolderActionsMenu;
