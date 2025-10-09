import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Upload, FolderPlus } from "lucide-react";
import {
  LibrarySearchBar,
  LibraryTabs,
  LibraryBreadcrumb,
  LibraryFilters,
  LibraryGrid,
  CreateFolderDialog,
  UploadDocumentDialog,
} from "@/components/Library/index";

export type LibraryScope =
  | { type: "personal" }
  | { type: "team"; teamId: Id<"teams"> };

export type SortOption = "lastModified" | "name" | "size" | "creationDate";
export type ViewMode = "grid" | "list";

export default function LibraryPage() {
  const [currentFolderId, setCurrentFolderId] = useState<
    Id<"libraryFolders"> | undefined
  >(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortOption>("lastModified");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Fetch user's teams
  const teams = useQuery(api.functions.teams.getTeams, {}) || [];

  // Default to personal library - userId is handled server-side via auth
  const [activeScope, setActiveScope] = useState<LibraryScope>({
    type: "personal",
  });

  const handleFolderClick = (folderId: Id<"libraryFolders">) => {
    setCurrentFolderId(folderId);
  };

  const handleBreadcrumbClick = (folderId: Id<"libraryFolders"> | undefined) => {
    setCurrentFolderId(folderId);
  };

  const handleTabChange = (scope: LibraryScope) => {
    setActiveScope(scope);
    setCurrentFolderId(undefined); // Reset to root when changing tabs
  };

  return (
    <section className="w-full h-full min-h-screen bg-white flex py-8 px-8 flex-col gap-6 mt-12">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Biblioteca de Documentos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona y organiza todos tus documentos legales en un solo lugar
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Subir Archivo
          </Button>
          <Button
            onClick={() => setShowCreateFolderDialog(true)}
            variant="outline"
            className="gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            Nueva Carpeta
          </Button>
        </div>
      </div>

      {/* Tabs Section */}
      <div>
        <LibraryTabs
          teams={teams}
          activeScope={activeScope}
          onTabChange={handleTabChange}
        />
      </div>

      {/* Search and Filters Section */}
      <div className="space-y-4">
        <LibrarySearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex items-center justify-between gap-4">
          <LibraryBreadcrumb
            currentFolderId={currentFolderId}
            onBreadcrumbClick={handleBreadcrumbClick}
            activeScope={activeScope}
          />

          <LibraryFilters
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </div>

      {/* Content Grid */}
      <LibraryGrid
        activeScope={activeScope}
        currentFolderId={currentFolderId}
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        sortBy={sortBy}
        viewMode={viewMode}
        onFolderClick={handleFolderClick}
      />

      <CreateFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        activeScope={activeScope}
        parentFolderId={currentFolderId}
      />

      <UploadDocumentDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        activeScope={activeScope}
        currentFolderId={currentFolderId}
      />
    </section>
  );
}

