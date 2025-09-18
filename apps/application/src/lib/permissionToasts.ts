import { toast } from "sonner";

/**
 * Utility for showing permission-related toast messages
 */
export const PermissionToasts = {
  /**
   * Show a generic permission denied toast
   */
  accessDenied: (action: string = "realizar esta acción") => {
    toast.error(`No tienes permisos para ${action}`, {
      description: "Contacta al administrador del caso para solicitar acceso.",
      duration: 4000,
    });
  },

  /**
   * Show permission denied for specific case actions
   */
  case: {
    view: () => PermissionToasts.accessDenied("ver este caso"),
    edit: () => PermissionToasts.accessDenied("editar este caso"),
    delete: () => PermissionToasts.accessDenied("eliminar este caso"),
    manage: () => PermissionToasts.accessDenied("administrar este caso"),
  },

  /**
   * Show permission denied for document actions
   */
  documents: {
    read: () => PermissionToasts.accessDenied("ver documentos"),
    write: () => PermissionToasts.accessDenied("crear o editar documentos"),
    delete: () => PermissionToasts.accessDenied("eliminar documentos"),
    upload: () => PermissionToasts.accessDenied("subir documentos"),
  },

  /**
   * Show permission denied for escrito actions
   */
  escritos: {
    read: () => PermissionToasts.accessDenied("ver escritos"),
    write: () => PermissionToasts.accessDenied("crear o editar escritos"),
    delete: () => PermissionToasts.accessDenied("eliminar escritos"),
    create: () => PermissionToasts.accessDenied("crear escritos"),
  },

  /**
   * Show permission denied for client actions
   */
  clients: {
    read: () => PermissionToasts.accessDenied("ver clientes"),
    write: () => PermissionToasts.accessDenied("crear o editar clientes"),
    delete: () => PermissionToasts.accessDenied("eliminar clientes"),
  },

  /**
   * Show permission denied for team actions
   */
  teams: {
    read: () => PermissionToasts.accessDenied("ver equipos"),
    write: () => PermissionToasts.accessDenied("administrar equipos"),
    managePermissions: () =>
      PermissionToasts.accessDenied("gestionar permisos de equipo"),
  },

  /**
   * Show permission denied for chat actions
   */
  chat: {
    access: () => PermissionToasts.accessDenied("acceder al chat de IA"),
  },

  /**
   * Show permission denied for permission management
   */
  permissions: {
    grant: () => PermissionToasts.accessDenied("otorgar permisos"),
    revoke: () => PermissionToasts.accessDenied("revocar permisos"),
    manage: () => PermissionToasts.accessDenied("gestionar permisos"),
  },
};

/**
 * Hook to check permissions and show toast if denied
 */
export const usePermissionCheck = () => {
  const checkPermission = (
    hasPermission: boolean,
    onDenied: () => void,
    action?: () => void,
  ) => {
    if (!hasPermission) {
      onDenied();
      return false;
    }

    if (action) {
      action();
    }

    return true;
  };

  return { checkPermission, toasts: PermissionToasts };
};
