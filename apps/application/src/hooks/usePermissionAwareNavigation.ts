import { useMemo } from "react";
import { usePermissions } from "@/context/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { Users, Shield } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export function usePermissionAwareNavigation(caseId: Id<"cases"> | null) {
  const { can, isLoading } = usePermissions();

  const navigationItems = useMemo(() => {
    if (isLoading) return [];
    
    const items: Array<{ path: string; label: string; icon: any; permission: string }>= [];
    
    
    
    if (can.clients.read) {
      items.push({
        path: `/caso/${caseId}/clientes`,
        label: "Clientes",
        icon: Users,
        permission: PERMISSIONS.CLIENT_READ
      });
    }
    
    if (can.teams.read) {
      items.push({
        path: `/caso/${caseId}/equipos`,
        label: "Equipos",
        icon: Shield,
        permission: PERMISSIONS.TEAM_READ
      });
    }
    
    
    return items;
  }, [caseId, can, isLoading]);

  return { navigationItems, isLoading };
} 