import { useMemo } from "react";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { PERMISSIONS } from "@/permissions/types";
import { Home, FileText, BookOpen, Users, Shield, MessageSquare } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export function usePermissionAwareNavigation(caseId: Id<"cases"> | null) {
  const { can, isLoading } = useCasePermissions(caseId);

  const navigationItems = useMemo(() => {
    if (isLoading) return [];
    
    const items = [];
    
    if (can.viewCase) {
      items.push({
        path: `/caso/${caseId}`,
        label: "Resumen",
        icon: Home,
        permission: PERMISSIONS.CASE_VIEW
      });
    }
    
    if (can.docs.read) {
      items.push({
        path: `/caso/${caseId}/documentos`,
        label: "Documentos",
        icon: FileText,
        permission: PERMISSIONS.DOC_READ
      });
    }
    
    if (can.escritos.read) {
      items.push({
        path: `/caso/${caseId}/escritos`,
        label: "Escritos",
        icon: BookOpen,
        permission: PERMISSIONS.ESCRITO_READ
      });
    }
    
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
    
    if (can.chat) {
      items.push({
        path: `/caso/${caseId}/chat`,
        label: "Chat IA",
        icon: MessageSquare,
        permission: PERMISSIONS.CHAT_ACCESS
      });
    }
    
    return items;
  }, [caseId, can, isLoading]);

  return { navigationItems, isLoading };
} 