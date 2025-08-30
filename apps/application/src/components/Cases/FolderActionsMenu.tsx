import { Plus, Pencil, Archive } from "lucide-react";

type FolderActionsMenuProps = {
  onCreateFolder: () => void;
  onCreateDocument: () => void;
  onRename: () => void;
  onArchive: () => void;
  className?: string;
};

export function FolderActionsMenu({
  onCreateFolder,
  onCreateDocument,
  onRename,
  onArchive,
  className,
}: FolderActionsMenuProps) {
  return (
    <div
      className={
        "absolute right-2 top-7 z-10 w-36 rounded-md border bg-white shadow-md text-xs " +
        (className ?? "")
      }
      data-folder-menu
      onClick={(e) => e.stopPropagation()}
    >
      {/* Creation options */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
        onClick={onCreateFolder}
      >
        <Plus size={12} /> Nueva carpeta
      </button>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
        onClick={onCreateDocument}
      >
        <Plus size={12} /> Nuevo documento
      </button>
      <div className="my-1 border-t" />
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
        onClick={onRename}
      >
        <Pencil size={12} /> Renombrar
      </button>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left text-red-600"
        onClick={onArchive}
      >
        <Archive size={12} /> Archivar
      </button>
    </div>
  );
}

export default FolderActionsMenu;
