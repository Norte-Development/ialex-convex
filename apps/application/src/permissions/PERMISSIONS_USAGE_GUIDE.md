# Guía de Uso del Sistema de Permisos Jerárquico

## Resumen

El sistema de permisos ha migrado de un modelo granular (array de permisos individuales) a un modelo jerárquico simplificado con 3 niveles: **basic < advanced < admin**.

## Estructura de Niveles

```typescript
const ACCESS_LEVELS = {
  BASIC: "basic", // Puede ver
  ADVANCED: "advanced", // Puede ver + editar
  ADMIN: "admin", // Puede ver + editar + eliminar + gestionar
} as const;
```

### Jerarquía de Permisos

- **BASIC**: Solo lectura (ver casos, documentos, etc.)
- **ADVANCED**: BASIC + escritura (editar casos, crear documentos, etc.)
- **ADMIN**: ADVANCED + administración (eliminar, gestionar equipos, etc.)

## Hook Principal: `useCasePermissions`

### Importación

```typescript
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { ACCESS_LEVELS, PERMISSIONS } from "@/permissions/types";
```

### Uso Básico

```typescript
function MiComponente({ caseId }) {
  const {
    hasAccessLevel,    // Nueva función jerárquica
    hasPermission,     // Función legacy (compatible)
    can,              // Objeto de capacidades
    accessLevel,      // Nivel actual del usuario
    hasAccess,        // Booleano: tiene algún acceso
    source,           // "user" | "team" | null
    isLoading         // Estado de carga
  } = useCasePermissions(caseId);

  if (isLoading) return <div>Cargando...</div>;
  if (!hasAccess) return <div>Sin acceso</div>;

  return (
    <div>
      <p>Tu nivel: {accessLevel}</p>
      {/* Usar las funciones según necesidad */}
    </div>
  );
}
```

## Contexto: `CasePermissionsProvider`

### Configuración

```typescript
import { CasePermissionsProvider, usePermissions } from "@/context/CasePermissionsContext";

function App() {
  return (
    <CasePermissionsProvider caseId={caseId}>
      <MisComponentes />
    </CasePermissionsProvider>
  );
}

function MisComponentes() {
  const permissions = usePermissions(); // Mismo API que useCasePermissions
  // ...
}
```

## Métodos de Verificación de Permisos

### 1. Sistema Jerárquico (Recomendado)

```typescript
// Verificar nivel mínimo requerido
if (hasAccessLevel(ACCESS_LEVELS.BASIC)) {
  // Usuario tiene BASIC, ADVANCED o ADMIN
}

if (hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
  // Usuario tiene ADVANCED o ADMIN (no BASIC)
}

if (hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
  // Usuario tiene solo ADMIN
}
```

### 2. Objeto de Capacidades (Granular)

```typescript
// Verificaciones específicas por funcionalidad
if (can.viewCase) {
  // Puede ver el caso
}

if (can.editCase) {
  // Puede editar el caso
}

if (can.deleteCase) {
  // Puede eliminar el caso
}

// Capacidades por módulo
if (can.docs.write) {
  // Puede crear/editar documentos
}

if (can.escritos.delete) {
  // Puede eliminar escritos
}

if (can.teams.write) {
  // Puede gestionar equipos (solo admin)
}
```

### 3. Sistema Legacy (Compatibilidad)

```typescript
// Para código existente durante la migración
if (hasPermission(PERMISSIONS.CASE_VIEW)) {
  // Funciona igual que antes
}

if (hasPermission(PERMISSIONS.CASE_EDIT)) {
  // Compatible con sistema anterior
}
```

## Objeto `can` - Capacidades Disponibles

### Casos

- `can.viewCase` - Ver casos
- `can.editCase` - Editar casos
- `can.deleteCase` - Eliminar casos
- `can.manageCase` - Gestión completa

### Documentos

- `can.docs.read` - Leer documentos
- `can.docs.write` - Crear/editar documentos
- `can.docs.delete` - Eliminar documentos

### Escritos

- `can.escritos.read` - Leer escritos
- `can.escritos.write` - Crear/editar escritos
- `can.escritos.delete` - Eliminar escritos

### Clientes

- `can.clients.read` - Ver clientes
- `can.clients.write` - Editar clientes
- `can.clients.delete` - Eliminar clientes

### Equipos

- `can.teams.read` - Ver equipos
- `can.teams.write` - Gestionar equipos (solo admin)

### Otros

- `can.chat` - Acceso al chat
- `can.permissions.grant` - Otorgar permisos (solo admin)
- `can.permissions.revoke` - Revocar permisos (solo admin)

## Ejemplos de Uso Práctico

### Botones Condicionales

```typescript
function CaseActions() {
  const { hasAccessLevel, can } = useCasePermissions(caseId);

  return (
    <div>
      {can.viewCase && (
        <Button>Ver Detalles</Button>
      )}

      {can.editCase && (
        <Button>Editar Caso</Button>
      )}

      {hasAccessLevel(ACCESS_LEVELS.ADMIN) && (
        <Button variant="destructive">Eliminar Caso</Button>
      )}
    </div>
  );
}
```

### Menús y Navegación

```typescript
function CaseMenu() {
  const { can, accessLevel } = usePermissions();

  const menuItems = [
    { label: "Ver", show: can.viewCase, path: "/case/view" },
    { label: "Editar", show: can.editCase, path: "/case/edit" },
    { label: "Documentos", show: can.docs.read, path: "/case/docs" },
    { label: "Configuración", show: accessLevel === ACCESS_LEVELS.ADMIN, path: "/case/settings" }
  ];

  return (
    <nav>
      {menuItems.filter(item => item.show).map(item => (
        <Link key={item.path} to={item.path}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

### Formularios

```typescript
function DocumentForm() {
  const { can, hasAccessLevel } = useCasePermissions(caseId);

  if (!can.docs.read) {
    return <div>Sin acceso a documentos</div>;
  }

  return (
    <form>
      <input
        type="text"
        disabled={!can.docs.write}
        placeholder={can.docs.write ? "Editar documento" : "Solo lectura"}
      />

      {hasAccessLevel(ACCESS_LEVELS.ADMIN) && (
        <Button type="button" variant="destructive">
          Eliminar Documento
        </Button>
      )}

      {can.docs.write && (
        <Button type="submit">Guardar</Button>
      )}
    </form>
  );
}
```

## Migración desde Sistema Anterior

### Mapeo de Permisos Legacy

El sistema anterior → nuevo sistema:

```typescript
// ANTES (sistema granular)
if (permissions.includes("CASE_VIEW")) {
}
if (permissions.includes("CASE_EDIT")) {
}
if (permissions.includes("CASE_DELETE")) {
}

// AHORA (sistema jerárquico)
if (can.viewCase) {
} // o hasAccessLevel(ACCESS_LEVELS.BASIC)
if (can.editCase) {
} // o hasAccessLevel(ACCESS_LEVELS.ADVANCED)
if (can.deleteCase) {
} // o hasAccessLevel(ACCESS_LEVELS.ADMIN)

// MIGRACIÓN TEMPORAL (compatible)
if (hasPermission(PERMISSIONS.CASE_VIEW)) {
} // Funciona igual
if (hasPermission(PERMISSIONS.CASE_EDIT)) {
} // Funciona igual
if (hasPermission(PERMISSIONS.CASE_DELETE)) {
} // Funciona igual
```

### Estrategia de Migración

1. **Fase 1**: Usar `hasPermission()` legacy en componentes existentes
2. **Fase 2**: Migrar gradualmente a `can.XXX` o `hasAccessLevel()`
3. **Fase 3**: Eliminar funciones legacy cuando todo esté migrado

## Patrones Recomendados

### ✅ Buenas Prácticas

```typescript
// Usar capacidades específicas cuando sea posible
if (can.editCase) {
  /* ... */
}

// Usar niveles para verificaciones múltiples
if (hasAccessLevel(ACCESS_LEVELS.ADVANCED)) {
  // Sé que puede ver Y editar
}

// Combinar verificaciones cuando sea necesario
if (can.docs.write && hasAccessLevel(ACCESS_LEVELS.ADMIN)) {
  // Lógica específica
}
```

### ❌ Anti-patrones

```typescript
// No usar verificaciones redundantes
if (hasAccessLevel(ACCESS_LEVELS.BASIC) && can.viewCase) {
  // can.viewCase ya implica BASIC o superior
}

// No mezclar sistemas sin necesidad
if (hasPermission(PERMISSIONS.CASE_VIEW) && can.viewCase) {
  // Ambos hacen lo mismo, usar solo uno
}
```

## Debugging y Desarrollo

### Ver Estado Actual

```typescript
function DebugPermissions() {
  const permissions = useCasePermissions(caseId);

  console.log("Estado de permisos:", {
    accessLevel: permissions.accessLevel,
    source: permissions.source,
    hasAccess: permissions.hasAccess,
    capabilities: permissions.can,
  });

  return null;
}
```

### Testing

```typescript
// En tests, mockear el hook
jest.mock("@/hooks/useCasePermissions", () => ({
  useCasePermissions: () => ({
    hasAccessLevel: jest.fn(() => true),
    can: {
      viewCase: true,
      editCase: false,
      deleteCase: false,
    },
    accessLevel: "basic",
  }),
}));
```

---

## Resumen de APIs

| Función                 | Uso                            | Ejemplo                                  |
| ----------------------- | ------------------------------ | ---------------------------------------- |
| `hasAccessLevel(level)` | Verificar nivel jerárquico     | `hasAccessLevel(ACCESS_LEVELS.ADVANCED)` |
| `can.XXX`               | Verificar capacidad específica | `can.editCase`, `can.docs.write`         |
| `hasPermission(perm)`   | Legacy compatibility           | `hasPermission(PERMISSIONS.CASE_VIEW)`   |
| `accessLevel`           | Nivel actual del usuario       | `"basic"`, `"advanced"`, `"admin"`       |
| `hasAccess`             | Tiene algún acceso             | `true/false`                             |
| `source`                | Fuente del acceso              | `"user"`, `"team"`, `null`               |

Esta guía debería cubrir todos los casos de uso. ¡El sistema está listo para la migración!
