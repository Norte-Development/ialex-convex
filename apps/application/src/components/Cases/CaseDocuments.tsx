// import { useMutation, useQuery } from "convex/react";
// import { api } from "../../../convex/_generated/api";
import { useCase } from "@/context/CaseContext";
// import { Link } from "react-router-dom";
// import { useLocation } from "react-router-dom";
// import { Badge } from "../ui/badge";
// import { Button } from "../ui/button";
// import {
//   FileText,
//   Trash2,
//   AlertCircle,
//   CheckCircle,
//   Clock,
//   Loader2,
// } from "lucide-react";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "../ui/tooltip";
import { useState } from "react";
// import { IfCan } from "@/components/Permissions";
// import { PERMISSIONS } from "@/permissions/types";
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
