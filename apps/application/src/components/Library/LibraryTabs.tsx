import { LibraryScope } from "@/pages/LibraryPage";
import { Doc } from "../../../convex/_generated/dataModel";

interface LibraryTabsProps {
  teams: Doc<"teams">[];
  activeScope: LibraryScope;
  onTabChange: (scope: LibraryScope) => void;
}

export function LibraryTabs({
  teams,
  activeScope,
  onTabChange,
}: LibraryTabsProps) {
  const isActive = (scope: LibraryScope) => {
    if (scope.type === "personal" && activeScope.type === "personal") {
      return true;
    }
    if (
      scope.type === "team" &&
      activeScope.type === "team" &&
      scope.teamId === activeScope.teamId
    ) {
      return true;
    }
    return false;
  };

  return (
    <div className="flex items-center gap-8 border-b border-border">
      <button
        onClick={() => onTabChange({ type: "personal" })}
        className={`relative pb-4 text-sm font-medium transition-colors ${
          activeScope.type === "personal"
            ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Mi Biblioteca
      </button>
      {teams.map((team) => (
        <button
          key={team._id}
          onClick={() => onTabChange({ type: "team", teamId: team._id })}
          className={`relative pb-4 text-sm font-medium transition-colors ${
            isActive({ type: "team", teamId: team._id })
              ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {team.name}
        </button>
      ))}
    </div>
  );
}

