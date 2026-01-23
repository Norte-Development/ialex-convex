import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Bell, Check, Clock, Info, Loader2, PlusCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function NotificationsDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPjnNotification, setSelectedPjnNotification] = useState<any | null>(null);
  const [isCreateCaseDialogOpen, setIsCreateCaseDialogOpen] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  
  // Queries
  const notifications = useQuery(api.notifications.listForCurrentUser, { 
    limit: 20,
    // We fetch all recent ones to show read status, or we could fetch unreadOnly: false
  });
  
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  
  // Mutations
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsReadForCurrentUser);
  const createCase = useMutation(api.functions.cases.createCase);

  const extractFreFromPjnNotification = (notification: any): string | null => {
    if (notification.source !== "PJN-Portal" || notification.kind !== "pjn_notification") {
      return null;
    }

    // Current PJN notifications use the format:
    // "Nueva notificación PJN - {FRE}"
    const parts = typeof notification.title === "string"
      ? notification.title.split(" - ")
      : [];

    if (parts.length < 2) {
      return null;
    }

    const candidate = parts[parts.length - 1]?.trim();
    return candidate && candidate.length > 0 ? candidate : null;
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read if needed
    if (!notification.readAt) {
      await markAsRead({ notificationId: notification._id });
    }

    // Special handling for PJN notifications that are not yet linked to a case.
    // If we have a FRE but no caseId/linkTarget, offer to create a new case from this expediente.
    if (
      notification.kind === "pjn_notification" &&
      notification.source === "PJN-Portal" &&
      !notification.caseId &&
      !notification.linkTarget
    ) {
      const fre = extractFreFromPjnNotification(notification);
      if (fre) {
        setIsOpen(false);
        setSelectedPjnNotification({ ...notification, fre });
        setIsCreateCaseDialogOpen(true);
        return;
      }
    }

    // Navigate if target exists
    if (notification.linkTarget) {
      setIsOpen(false);
      navigate(notification.linkTarget);
    }
  };

  const handleCreateCaseFromPjnNotification = async () => {
    if (!selectedPjnNotification) {
      return;
    }

    const fre: string | undefined = selectedPjnNotification.fre;
    if (!fre) {
      setIsCreateCaseDialogOpen(false);
      setSelectedPjnNotification(null);
      return;
    }

    setIsCreatingCase(true);
    try {
      const baseTitle: string | undefined =
        typeof selectedPjnNotification.bodyPreview === "string" &&
        selectedPjnNotification.bodyPreview.trim().length > 0
          ? selectedPjnNotification.bodyPreview.trim()
          : typeof selectedPjnNotification.title === "string"
          ? selectedPjnNotification.title
          : undefined;

      const title = baseTitle ?? `Caso PJN ${fre}`;

      const caseId = await createCase({
        title,
        description:
          typeof selectedPjnNotification.bodyPreview === "string"
            ? selectedPjnNotification.bodyPreview
            : undefined,
        expedientNumber: undefined,
        assignedLawyer: undefined,
        priority: "medium",
        category: undefined,
        estimatedHours: undefined,
        fre,
        teamId: undefined,
      });

      setIsCreateCaseDialogOpen(false);
      setSelectedPjnNotification(null);
      setIsOpen(false);
      navigate(`/caso/${caseId}`);
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  const getIconForKind = (kind: string) => {
    switch (kind) {
      case "pjn_notification":
        return <Bell className="h-4 w-4 text-amber-600" />;
      case "document_processed":
        return <Check className="h-4 w-4 text-emerald-600" />;
      case "team_invitation":
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount !== undefined && unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full border-2 border-white"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <span className="font-semibold text-sm">Notificaciones</span>
          {unreadCount !== undefined && unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleMarkAllRead}
            >
              Marcar todo como leído
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {notifications === undefined ? (
            // Loading state
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900">Sin notificaciones</p>
              <p className="text-xs text-slate-500 mt-1">
                Te avisaremos cuando haya novedades importantes.
              </p>
            </div>
          ) : (
            // List
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    "relative flex gap-3 p-4 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0",
                    !notification.readAt && "bg-blue-50/40 hover:bg-blue-50/70"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm mt-0.5",
                    !notification.readAt && "border-blue-200 bg-blue-50 text-blue-600"
                  )}>
                    {getIconForKind(notification.kind)}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-sm font-medium leading-none truncate pr-2",
                        !notification.readAt ? "text-slate-900" : "text-slate-700"
                      )}>
                        {notification.title}
                      </p>
                      {!notification.readAt && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {notification.bodyPreview}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </span>
                      {notification.source === "PJN-Portal" && (
                        <>
                          <span className="mx-1">•</span>
                          <span className="text-amber-600 font-medium bg-amber-50 px-1 rounded">PJN</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator className="my-0" />
        <div className="p-2 bg-slate-50/50">
          <Button 
            variant="ghost" 
            className="w-full text-xs h-8 text-slate-600 hover:text-slate-900"
            onClick={() => {
              setIsOpen(false);
              navigate("/settings?section=notifications");
            }}
          >
            Ver configuración
          </Button>
        </div>
      </DropdownMenuContent>
      <Dialog
        open={isCreateCaseDialogOpen && !!selectedPjnNotification}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateCaseDialogOpen(false);
            setSelectedPjnNotification(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] border-slate-200">
          <DialogHeader className="gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-1">
              <PlusCircle className="h-6 w-6 text-blue-600" />
            </div>
            <DialogTitle className="text-xl">Crear caso desde notificación</DialogTitle>
            <DialogDescription className="text-slate-500 leading-relaxed">
              Esta notificación pertenece a un expediente que aún no está registrado en tu cuenta de iAlex.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Número de Expediente</span>
              <span className="font-mono text-sm font-semibold text-blue-700 bg-blue-50/50 px-2.5 py-1.5 rounded w-fit border border-blue-100 shadow-sm">
                {selectedPjnNotification?.fre}
              </span>
            </div>
            
            {selectedPjnNotification?.bodyPreview && (
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle detectado</span>
                <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-blue-200 pl-3">
                  "{selectedPjnNotification.bodyPreview}"
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="ghost"
              className="text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => {
                setIsCreateCaseDialogOpen(false);
                setSelectedPjnNotification(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCaseFromPjnNotification} 
              disabled={isCreatingCase}
              className="bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              {isCreatingCase ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando caso...
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Crear caso y ver detalles
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}

