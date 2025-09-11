import { useCase } from "@/context/CaseContext";
import { useState } from "react";
import { Id } from "convex/_generated/dataModel";
import { FolderTree } from "./FolderTree";

interface CaseDocumentsProps {
  basePath: string;
}

export function CaseDocuments({ basePath }: CaseDocumentsProps) {
  const { currentCase } = useCase();

  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"folders"> | undefined
  >(undefined);

  return (
    <div className="flex flex-col gap-2 pl-2 text-[12px] pt-1 overflow-y-auto h-full">
      {/* Folder tree */}
      {currentCase && (
        <FolderTree
          caseId={currentCase._id}
          currentFolderId={currentFolderId}
          onFolderChange={setCurrentFolderId}
          basePath={basePath}
        />
      )}
    </div>
  );
}
