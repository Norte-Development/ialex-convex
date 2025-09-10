import {
  CasePermissionsProvider,
  usePermissions,
} from "./CasePermissionsContext";
import { ACCESS_LEVELS, PERMISSIONS } from "@/permissions/types";
import { Id } from "../../convex/_generated/dataModel";

// Ejemplo de componente que usa el contexto actualizado
function CaseActionsExample() {
  const {
    hasAccessLevel,
    hasPermission, // Legacy
    can, // El objeto de capacidades
    accessLevel,
    isLoading,
  } = usePermissions();

  if (isLoading) return <div>Cargando permisos...</div>;

  return (
    <div className="space-y-4">
      <h3>Nivel de Acceso: {accessLevel || "Sin acceso"}</h3>

      {/* Usando el nuevo sistema jerárquico */}
      <div className="space-y-2">
        <h4>Acciones Disponibles (Nuevo Sistema):</h4>

        {hasAccessLevel(ACCESS_LEVELS.BASIC) && (
          <button>👁️ Ver caso (Básico)</button>
        )}

        {hasAccessLevel(ACCESS_LEVELS.ADVANCED) && (
          <button>✏️ Editar caso (Avanzado)</button>
        )}

        {hasAccessLevel(ACCESS_LEVELS.ADMIN) && (
          <button>🗑️ Eliminar caso (Admin)</button>
        )}
      </div>

      {/* Usando el objeto can para capacidades */}
      <div className="space-y-2">
        <h4>Capacidades Específicas:</h4>

        {can.viewCase && <span className="badge">Puede ver casos</span>}

        {can.editCase && <span className="badge">Puede editar casos</span>}

        {can.deleteCase && <span className="badge">Puede eliminar casos</span>}

        {can.docs.write && (
          <span className="badge">Puede escribir documentos</span>
        )}
      </div>

      {/* Compatibilidad con sistema legacy */}
      <div className="space-y-2">
        <h4>Verificaciones Legacy (Compatibilidad):</h4>

        {hasPermission(PERMISSIONS.CASE_VIEW) && (
          <span className="text-green-600">✓ Legacy: CASE_VIEW</span>
        )}

        {hasPermission(PERMISSIONS.CASE_EDIT) && (
          <span className="text-green-600">✓ Legacy: CASE_EDIT</span>
        )}

        {hasPermission(PERMISSIONS.CASE_DELETE) && (
          <span className="text-green-600">✓ Legacy: CASE_DELETE</span>
        )}
      </div>
    </div>
  );
}

// Ejemplo de uso completo
export function PermissionsContextExample() {
  const caseId: Id<"cases"> = "j972p4gw97nq5sq9jc5pjp1skd7q78tx" as Id<"cases">;

  return (
    <CasePermissionsProvider caseId={caseId}>
      <div className="p-6">
        <h2>Ejemplo del Contexto de Permisos Actualizado</h2>
        <CaseActionsExample />
      </div>
    </CasePermissionsProvider>
  );
}

export default PermissionsContextExample;
