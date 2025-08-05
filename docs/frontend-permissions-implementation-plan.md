# Frontend Permissions Implementation Plan

## Overview

This document outlines a comprehensive plan to fully utilize the backend permissions system in the frontend, ensuring that all UI components, navigation, and user interactions respect the granular permission system implemented in the backend.

## Current State Analysis

### ✅ What's Already Implemented
- Basic `useCasePermissions` hook with permission checking
- Team management permissions in `CaseTeamsPage` and `TeamCasesView`
- Team member permissions dialog with granular permission selection
- Backend permission validation in all API calls

### ❌ What's Missing
- Navigation menu permission-based visibility
- Page-level access control
- Component-level permission guards
- Permission-based UI state (disabled buttons, hidden sections)
- Permission-aware error handling
- User feedback for permission restrictions
- Loading states and proper async handling
- Centralized permission constants and types
- Granular read/write/delete permissions
- Query deduplication and performance optimization

## Key Gaps and Risks Addressed

### 1. Loading States and Flicker Prevention
**Issue**: `useQuery` is async, causing UI flicker when components immediately branch on permission booleans.
**Solution**: 
- Expose `isLoading` state in permission hooks
- Provide loading fallbacks and skeletons
- Gate rendering until permissions are confirmed
- Use `aria-disabled` for better accessibility during loading

### 2. Permission Evaluation Consistency
**Issue**: Permission checks scattered across components with string literals, risking typos and drift.
**Solution**:
- Centralized permission constants with TypeScript types
- Type-safe permission checking with `Permission` union type
- Single source of truth for permission logic
- Compile-time validation of permission names

### 3. Granular Permission Semantics
**Issue**: "documents" permission conflates read/write/delete operations.
**Solution**:
- Split into granular actions: `documents.read`, `documents.write`, `documents.delete`
- Clear separation of concerns for each operation
- Consistent permission naming across all features
- Derived capabilities for common permission combinations

### 4. "Full" Permission Override Logic
**Issue**: Ambiguous permission hierarchy and derived boolean logic.
**Solution**:
- Clear permission hierarchy with explicit override rules
- Server-provided capability matrix to avoid client-side logic
- Normalized permission evaluation with consistent semantics
- Explicit role-based permission mapping

### 5. SSR and Direct Route Protection
**Issue**: Client-side hiding is not security; need consistent 401/403 handling.
**Solution**:
- Permission error boundaries for consistent error handling
- Route-level permission guards where supported
- Proper HTTP semantics for permission errors
- Server-side validation remains primary security layer

### 6. Performance and Caching
**Issue**: Multiple identical permission queries and unnecessary re-renders.
**Solution**:
- Context provider to share permission state
- Single permission query per case
- Memoization of permission calculations
- Co-located permission state with case layout

### 7. Null CaseId Handling
**Issue**: Inconsistent handling of null caseId and undefined permissions.
**Solution**:
- Normalized return shape with default values
- Strict TypeScript types for permission objects
- Consistent "skip" query behavior
- Defensive programming for edge cases

### 8. Enhanced User Experience
**Issue**: Static access denied messages without context or recovery options.
**Solution**:
- Contextual error messages based on error type
- Action buttons for requesting access
- Contact information for case administrators
- Analytics tracking for permission issues

### 9. Tooltip Accessibility
**Issue**: Disabled buttons may not show tooltips due to pointer event restrictions.
**Solution**:
- Wrap disabled buttons in spans for tooltip triggers
- Use `aria-disabled` with custom styling
- Ensure tooltips work in all states (loading, disabled, enabled)
- Screen reader friendly permission feedback

### 10. Internationalization
**Issue**: Hardcoded Spanish strings scattered across components.
**Solution**:
- Extract all permission-related text to i18n resources
- Support for multiple languages
- Consistent terminology across the application
- Easy localization maintenance

### 11. Error Standardization
**Issue**: Brittle error detection based on string matching.
**Solution**:
- Typed error classes with error codes
- Standardized API error responses
- Consistent error handling patterns
- Analytics-friendly error tracking

### 12. Developer Experience
**Issue**: Permission strings as ad hoc literals throughout codebase.
**Solution**:
- `useCan(Permission)` hook alias for common checks
- `<Can permission={...}>` component for conditional rendering
- Permission map for deriving UI capabilities
- Comprehensive TypeScript support

## Implementation Plan

### Phase 1: Enhanced Permission Hooks & Utilities

#### 1.1 Permission Constants and Types
```typescript
// src/permissions/types.ts
export const PERMISSIONS = {
  // Case-level permissions
  CASE_VIEW: "case.view",
  CASE_EDIT: "case.edit",
  CASE_DELETE: "case.delete",
  
  // Document permissions
  DOC_READ: "documents.read",
  DOC_WRITE: "documents.write", 
  DOC_DELETE: "documents.delete",
  
  // Escrito permissions
  ESCRITO_READ: "escritos.read",
  ESCRITO_WRITE: "escritos.write",
  ESCRITO_DELETE: "escritos.delete",
  
  // Client permissions
  CLIENT_READ: "clients.read",
  CLIENT_WRITE: "clients.write",
  CLIENT_DELETE: "clients.delete",
  
  // Team permissions
  TEAM_READ: "teams.read",
  TEAM_WRITE: "teams.write",
  
  // Chat permissions
  CHAT_ACCESS: "chat.access",
  
  // Full access
  FULL: "full",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export type UserCasePermissions = {
  hasAccess: boolean;
  permissions: Permission[];
  accessLevel: "none" | "read" | "write" | "full";
  source: "owner" | "team" | "direct" | "none";
  isLoading: boolean;
};
```

#### 1.2 Enhanced `useCasePermissions` Hook with Loading States
```typescript
// src/hooks/useCasePermissions.ts
import { PERMISSIONS, type Permission, type UserCasePermissions } from "@/permissions/types";

export function useCasePermissions(caseId: Id<"cases"> | null) {
  const { data, isLoading } = useQuery(
    api.functions.permissions.getUserCasePermissions,
    caseId ? { caseId } : "skip"
  );

  // Normalize return shape to prevent undefined access
  const normalized: UserCasePermissions = {
    hasAccess: Boolean(data?.hasAccess),
    permissions: (data?.permissions as Permission[]) ?? [],
    accessLevel: (data?.accessLevel as UserCasePermissions["accessLevel"]) ?? "none",
    source: (data?.source as UserCasePermissions["source"]) ?? "none",
    isLoading,
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!normalized.hasAccess || normalized.isLoading) return false;
    return (
      normalized.permissions.includes(PERMISSIONS.FULL) ||
      normalized.permissions.includes(permission)
    );
  };

  // Granular capability object for better semantics
  const can = {
    // Case capabilities
    viewCase: hasPermission(PERMISSIONS.CASE_VIEW),
    editCase: hasPermission(PERMISSIONS.CASE_EDIT) || hasPermission(PERMISSIONS.FULL),
    deleteCase: hasPermission(PERMISSIONS.CASE_DELETE) || hasPermission(PERMISSIONS.FULL),
    
    // Document capabilities
    docs: {
      read: hasPermission(PERMISSIONS.DOC_READ),
      write: hasPermission(PERMISSIONS.DOC_WRITE),
      delete: hasPermission(PERMISSIONS.DOC_DELETE),
    },
    
    // Escrito capabilities
    escritos: {
      read: hasPermission(PERMISSIONS.ESCRITO_READ),
      write: hasPermission(PERMISSIONS.ESCRITO_WRITE),
      delete: hasPermission(PERMISSIONS.ESCRITO_DELETE),
    },
    
    // Client capabilities
    clients: {
      read: hasPermission(PERMISSIONS.CLIENT_READ),
      write: hasPermission(PERMISSIONS.CLIENT_WRITE),
      delete: hasPermission(PERMISSIONS.CLIENT_DELETE),
    },
    
    // Team capabilities
    teams: {
      read: hasPermission(PERMISSIONS.TEAM_READ),
      write: hasPermission(PERMISSIONS.TEAM_WRITE),
    },
    
    // Chat capability
    chat: hasPermission(PERMISSIONS.CHAT_ACCESS),
  };

  return { 
    ...normalized, 
    hasPermission, 
    can,
    // Backward compatibility aliases
    canView: can.viewCase,
    canAccessDocuments: can.docs.read,
    canAccessEscritos: can.escritos.read,
    canManageClients: can.clients.write,
    canAccessChat: can.chat,
    canManageTeams: can.teams.write,
    canDoEverything: hasPermission(PERMISSIONS.FULL),
  };
}
```

#### 1.3 Case Permissions Context Provider
```typescript
// src/contexts/CasePermissionsContext.tsx
import { createContext, useContext } from "react";
import { useCasePermissions } from "@/hooks/useCasePermissions";
import { Id } from "../../convex/_generated/dataModel";

const CasePermissionsContext = createContext<ReturnType<typeof useCasePermissions> | null>(null);

export function CasePermissionsProvider({ 
  caseId, 
  children 
}: { 
  caseId: Id<"cases"> | null; 
  children: React.ReactNode; 
}) {
  const value = useCasePermissions(caseId);
  
  return (
    <CasePermissionsContext.Provider value={value}>
      {children}
    </CasePermissionsContext.Provider>
  );
}

export function useCasePerms() {
  const ctx = useContext(CasePermissionsContext);
  if (!ctx) {
    throw new Error("useCasePerms must be used within CasePermissionsProvider");
  }
  return ctx;
}
```

#### 1.4 Permission Guard Components with Loading States
```typescript
// src/components/Permissions/PermissionGuard.tsx
import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePerms } from "@/contexts/CasePermissionsContext";

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: Permission;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

export function PermissionGuard({ 
  children, 
  permission, 
  fallback = null,
  loadingFallback = <div className="animate-pulse bg-gray-200 h-4 w-20 rounded" />
}: PermissionGuardProps) {
  const { hasPermission, isLoading } = useCasePerms();
  
  if (isLoading) {
    return loadingFallback;
  }
  
  if (!hasPermission(permission)) {
    return fallback;
  }
  
  return <>{children}</>;
}

// src/components/Permissions/PermissionButton.tsx
import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { Button, ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PermissionButtonProps extends Omit<ButtonProps, 'disabled'> {
  permission: Permission;
  disabledMessage?: string;
  loadingMessage?: string;
}

export function PermissionButton({ 
  permission, 
  disabledMessage = "No tienes permisos para esta acción",
  loadingMessage = "Cargando permisos...",
  children,
  ...props 
}: PermissionButtonProps) {
  const { hasPermission, isLoading } = useCasePerms();
  const allowed = hasPermission(permission);

  const buttonContent = (
    <Button 
      {...props} 
      aria-disabled={!allowed || props.disabled || isLoading}
      className={`${!allowed || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${props.className || ''}`}
    >
      {children}
    </Button>
  );

  // Show loading state
  if (isLoading) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">{buttonContent}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{loadingMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show disabled state with tooltip
  if (!allowed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full">{buttonContent}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal enabled state
  return buttonContent;
}

// src/components/Permissions/Can.tsx
import { PERMISSIONS, type Permission } from "@/permissions/types";
import { useCasePerms } from "@/contexts/CasePermissionsContext";

interface CanProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { hasPermission, isLoading } = useCasePerms();
  
  if (isLoading || !hasPermission(permission)) {
    return fallback;
  }
  
  return <>{children}</>;
}
```

#### 1.5 Permission-Aware Navigation Hook with Granular Permissions
```typescript
// src/hooks/usePermissionAwareNavigation.ts
import { useMemo } from "react";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { Home, FileText, BookOpen, Users, Shield, MessageSquare } from "lucide-react";

export function usePermissionAwareNavigation(caseId: Id<"cases"> | null) {
  const { can, isLoading } = useCasePerms();

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
```

### Phase 2: Navigation & Layout Updates

#### 2.1 Permission-Aware Case Sidebar
```typescript
// src/components/Cases/CaseSideBar.tsx
import { useCase } from "@/context/CaseContext";
import { usePermissionAwareNavigation } from "@/hooks/usePermissionAwareNavigation";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { PermissionButton } from "@/components/Permissions/PermissionButton";
import { Plus } from "lucide-react";

export default function CaseSidebar() {
  const { currentCase } = useCase();
  const { navigationItems, isLoading } = usePermissionAwareNavigation(currentCase?._id || null);
  const { can } = useCasePerms();

  if (isLoading) {
    return (
      <div className="h-full bg-white border-r border-gray-200 flex flex-col">
        <div className="flex-1 p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 h-10 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Navigation Menu */}
      <div className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Permission-based Quick Actions */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <PermissionButton
          permission={PERMISSIONS.DOC_WRITE}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {/* Open document upload */}}
        >
          <Plus className="h-4 w-4 mr-2" />
          Subir Documento
        </PermissionButton>
        
        <PermissionButton
          permission={PERMISSIONS.ESCRITO_WRITE}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {/* Open escrito creation */}}
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear Escrito
        </PermissionButton>
      </div>
    </div>
  );
}
```

#### 2.2 Permission-Aware Case Layout with Provider
```typescript
// src/components/Cases/CaseLayout.tsx
import { useCase } from "@/context/CaseContext";
import { CasePermissionsProvider } from "@/contexts/CasePermissionsContext";
import { AccessDeniedPage } from "@/components/Permissions/AccessDeniedPage";

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { currentCase } = useCase();
  const caseId = currentCase?._id || null;

  return (
    <CasePermissionsProvider caseId={caseId}>
      <InnerLayout>{children}</InnerLayout>
    </CasePermissionsProvider>
  );
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { hasAccess, isLoading } = useCasePerms();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDeniedPage />;
  }

  return (
    <div className="relative h-full w-full">
      <CaseSidebar />
      <main className="bg-[#f7f7f7] pt-14 h-[calc(100vh-56px)] overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

### Phase 3: Page-Level Permission Implementation

#### 3.1 Case Detail Page with Granular Permissions
```typescript
// src/pages/CaseOpen/CaseDetailPage.tsx
import { useCase } from "@/context/CaseContext";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { PermissionButton } from "@/components/Permissions/PermissionButton";
import { Can } from "@/components/Permissions/Can";
import { Edit, Users, Shield, FileText, BookOpen, MessageSquare } from "lucide-react";

export default function CaseDetailPage() {
  const { currentCase } = useCase();
  const { can } = useCasePerms();

  return (
    <CaseLayout>
      <div className="space-y-6 p-6">
        {/* Case Header with Edit Permissions */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {currentCase?.title}
            </h1>
            <p className="text-gray-600">{currentCase?.description}</p>
          </div>
          
          <PermissionButton
            permission={PERMISSIONS.CASE_EDIT}
            variant="outline"
            size="sm"
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar Caso
          </PermissionButton>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Can permission={PERMISSIONS.CLIENT_READ}>
            <QuickActionCard
              title="Gestionar Clientes"
              description="Ver y editar clientes del caso"
              icon={Users}
              link={`/caso/${currentCase?._id}/clientes`}
            />
          </Can>
          
          <Can permission={PERMISSIONS.TEAM_READ}>
            <QuickActionCard
              title="Gestionar Equipos"
              description="Configurar acceso de equipos"
              icon={Shield}
              link={`/caso/${currentCase?._id}/equipos`}
            />
          </Can>
          
          <Can permission={PERMISSIONS.DOC_READ}>
            <QuickActionCard
              title="Documentos"
              description="Ver y gestionar documentos"
              icon={FileText}
              link={`/caso/${currentCase?._id}/documentos`}
            />
          </Can>
          
          <Can permission={PERMISSIONS.ESCRITO_READ}>
            <QuickActionCard
              title="Escritos"
              description="Crear y editar escritos legales"
              icon={BookOpen}
              link={`/caso/${currentCase?._id}/escritos`}
            />
          </Can>
          
          <Can permission={PERMISSIONS.CHAT_ACCESS}>
            <QuickActionCard
              title="Chat IA"
              description="Asistente de inteligencia artificial"
              icon={MessageSquare}
              link={`/caso/${currentCase?._id}/chat`}
            />
          </Can>
        </div>
      </div>
    </CaseLayout>
  );
}
```

#### 3.2 Documents Page with Granular Permissions
```typescript
// src/pages/CaseOpen/CaseDocumentPage.tsx
import { useCase } from "@/context/CaseContext";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { PermissionButton } from "@/components/Permissions/PermissionButton";
import { Can } from "@/components/Permissions/Can";
import { Upload } from "lucide-react";

export default function CaseDocumentPage() {
  const { currentCase } = useCase();
  const { can } = useCasePerms();

  return (
    <CaseLayout>
      <div className="p-6 space-y-6">
        {/* Header with Upload Button */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Documentos</h1>
          
          <PermissionButton
            permission={PERMISSIONS.DOC_WRITE}
            onClick={() => {/* Open upload dialog */}}
          >
            <Upload className="h-4 w-4 mr-2" />
            Subir Documento
          </PermissionButton>
        </div>

        {/* Documents List */}
        <Can permission={PERMISSIONS.DOC_READ}>
          <DocumentsList 
            caseId={currentCase?._id} 
            canDelete={can.docs.delete}
          />
        </Can>
      </div>
    </CaseLayout>
  );
}
```

#### 3.3 Escritos Page with Granular Permissions
```typescript
// src/pages/CaseOpen/EscritosPage.tsx
import { useCase } from "@/context/CaseContext";
import { useCasePerms } from "@/contexts/CasePermissionsContext";
import { PERMISSIONS } from "@/permissions/types";
import { PermissionButton } from "@/components/Permissions/PermissionButton";
import { Can } from "@/components/Permissions/Can";
import { Plus } from "lucide-react";

export default function EscritosPage() {
  const { currentCase } = useCase();
  const { can } = useCasePerms();

  return (
    <CaseLayout>
      <div className="p-6 space-y-6">
        {/* Header with Create Button */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Escritos</h1>
          
          <PermissionButton
            permission={PERMISSIONS.ESCRITO_WRITE}
            onClick={() => {/* Open creation dialog */}}
          >
            <Plus className="h-4 w-4 mr-2" />
            Crear Escrito
          </PermissionButton>
        </div>

        {/* Escritos List */}
        <Can permission={PERMISSIONS.ESCRITO_READ}>
          <EscritosList 
            caseId={currentCase?._id}
            canEdit={can.escritos.write}
            canDelete={can.escritos.delete}
          />
        </Can>
      </div>
    </CaseLayout>
  );
}
```

### Phase 4: Component-Level Permission Guards

#### 4.1 Permission-Aware Document Components
```typescript
// src/components/Documents/DocumentCard.tsx
interface DocumentCardProps {
  document: Document;
  caseId: Id<"cases">;
}

export function DocumentCard({ document, caseId }: DocumentCardProps) {
  const { canAccessDocuments } = useCasePermissions(caseId);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{document.title}</h3>
          <p className="text-sm text-gray-600">{document.description}</p>
        </div>
        
        <div className="flex gap-2">
          <PermissionButton
            permission="documents"
            caseId={caseId}
            variant="ghost"
            size="sm"
            onClick={() => {/* View document */}}
          >
            <Eye className="h-4 w-4" />
          </PermissionButton>
          
          <PermissionButton
            permission="documents"
            caseId={caseId}
            variant="ghost"
            size="sm"
            onClick={() => {/* Download document */}}
          >
            <Download className="h-4 w-4" />
          </PermissionButton>
          
          <PermissionButton
            permission="documents"
            caseId={caseId}
            variant="ghost"
            size="sm"
            onClick={() => {/* Delete document */}}
          >
            <Trash className="h-4 w-4" />
          </PermissionButton>
        </div>
      </div>
    </Card>
  );
}
```

#### 4.2 Permission-Aware Escrito Components
```typescript
// src/components/Escritos/EscritoCard.tsx
interface EscritoCardProps {
  escrito: Escrito;
  caseId: Id<"cases">;
}

export function EscritoCard({ escrito, caseId }: EscritoCardProps) {
  const { canAccessEscritos } = useCasePermissions(caseId);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{escrito.title}</h3>
          <p className="text-sm text-gray-600">
            Estado: {escrito.status === "terminado" ? "Terminado" : "Borrador"}
          </p>
        </div>
        
        <div className="flex gap-2">
          <PermissionButton
            permission="escritos"
            caseId={caseId}
            variant="ghost"
            size="sm"
            onClick={() => {/* Edit escrito */}}
          >
            <Edit className="h-4 w-4" />
          </PermissionButton>
          
          <PermissionButton
            permission="escritos"
            caseId={caseId}
            variant="ghost"
            size="sm"
            onClick={() => {/* Delete escrito */}}
          >
            <Trash className="h-4 w-4" />
          </PermissionButton>
        </div>
      </div>
    </Card>
  );
}
```

### Phase 5: Error Handling & User Feedback

#### 5.1 Standardized Error Handling
```typescript
// src/types/errors.ts
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, any>;
}

export class PermissionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 403
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

// src/utils/apiClient.ts
export function handleApiError(error: any): never {
  if (error?.code === "FORBIDDEN" || error?.status === 403) {
    throw new PermissionError("FORBIDDEN", "No tienes permisos para esta acción", 403);
  }
  
  if (error?.code === "UNAUTHORIZED" || error?.status === 401) {
    throw new PermissionError("UNAUTHORIZED", "Debes iniciar sesión", 401);
  }
  
  throw error;
}
```

#### 5.2 Permission Error Boundary with Typed Errors
```typescript
// src/components/Permissions/PermissionErrorBoundary.tsx
import { Component } from "react";
import { PermissionError } from "@/types/errors";
import { AccessDeniedPage } from "./AccessDeniedPage";

interface State {
  hasError: boolean;
  error?: PermissionError;
}

export class PermissionErrorBoundary extends Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State | null {
    if (error instanceof PermissionError) {
      return { hasError: true, error };
    }
    
    // Fallback for string-based error detection
    if (error.message.includes("Unauthorized") || error.message.includes("No access")) {
      return { hasError: true, error: new PermissionError("FORBIDDEN", error.message) };
    }
    
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for analytics
    console.error("Permission error caught:", error, errorInfo);
    
    // Send to analytics service
    if (error instanceof PermissionError) {
      // analytics.track('permission_error', { code: error.code, status: error.status });
    }
  }

  render() {
    if (this.state.hasError) {
      return <AccessDeniedPage error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

#### 5.3 Enhanced Access Denied Page
```typescript
// src/components/Permissions/AccessDeniedPage.tsx
import { Shield, ArrowLeft, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionError } from "@/types/errors";

interface AccessDeniedPageProps {
  error?: PermissionError;
  caseId?: string;
  onRequestAccess?: () => void;
}

export function AccessDeniedPage({ 
  error, 
  caseId, 
  onRequestAccess 
}: AccessDeniedPageProps) {
  const getErrorMessage = () => {
    if (error?.code === "UNAUTHORIZED") {
      return "Debes iniciar sesión para acceder a este recurso.";
    }
    
    if (error?.code === "FORBIDDEN") {
      return "No tienes los permisos necesarios para acceder a este recurso.";
    }
    
    return "No tienes los permisos necesarios para acceder a este recurso.";
  };

  const getActionButtons = () => {
    const buttons = [];
    
    buttons.push(
      <Button key="back" variant="outline" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Volver
      </Button>
    );
    
    if (onRequestAccess) {
      buttons.push(
        <Button key="request" onClick={onRequestAccess}>
          <Mail className="h-4 w-4 mr-2" />
          Solicitar Acceso
        </Button>
      );
    }
    
    return buttons;
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center max-w-md">
        <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Acceso Denegado
        </h2>
        <p className="text-gray-600 mb-6">
          {getErrorMessage()}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {getActionButtons()}
        </div>
        
        {caseId && (
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <Users className="h-4 w-4 inline mr-1" />
              Contacta al administrador del caso para solicitar acceso.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Phase 6: Advanced Permission Features

#### 6.1 Permission Status Indicator
```typescript
// src/components/Permissions/PermissionStatusIndicator.tsx
export function PermissionStatusIndicator({ caseId }: { caseId: Id<"cases"> }) {
  const { accessLevel, accessSource, permissions } = useCasePermissions(caseId);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Badge variant={accessLevel === "full" ? "default" : "secondary"}>
        {accessLevel === "full" ? "Acceso Completo" : "Solo Lectura"}
      </Badge>
      <span>•</span>
      <span>Via: {accessSource}</span>
      {permissions.length > 0 && (
        <>
          <span>•</span>
          <span>Permisos: {permissions.join(", ")}</span>
        </>
      )}
    </div>
  );
}
```

#### 6.2 Permission Debug Panel (Development)
```typescript
// src/components/Permissions/PermissionDebugPanel.tsx
export function PermissionDebugPanel({ caseId }: { caseId: Id<"cases"> }) {
  const permissions = useCasePermissions(caseId);
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Shield className="h-4 w-4 mr-2" />
        Debug Permissions
      </Button>
      
      {isOpen && (
        <Card className="absolute bottom-full right-0 mb-2 w-80 p-4">
          <h3 className="font-medium mb-2">Permission Debug Info</h3>
          <pre className="text-xs bg-gray-100 p-2 rounded">
            {JSON.stringify(permissions, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
```

## Implementation Priority

### Critical Priority (Phase 1)
1. **Permission constants and types** - Centralize permission definitions
2. **Enhanced permission hooks with loading states** - Prevent UI flicker
3. **Case permissions context provider** - Avoid duplicate queries
4. **Permission guard components with loading handling** - Consistent UX

### High Priority (Phase 2)
1. **Navigation permission guards** - Hide inaccessible routes
2. **Permission-aware case layout with provider** - Centralized permission management
3. **Standardized error handling** - Type-safe error boundaries
4. **Enhanced access denied page** - Better user experience

### Medium Priority (Phase 3-4)
1. **Page-level permission implementation** - Granular access control
2. **Component-level permission guards** - Fine-grained UI control
3. **Permission status indicators** - User awareness of access level
4. **Analytics and monitoring** - Track permission usage

### Low Priority (Phase 5-6)
1. **Advanced permission features** - Debug tools and development helpers
2. **Performance optimizations** - Caching and memoization
3. **Internationalization** - Multi-language support
4. **Permission analytics dashboard** - Usage insights

## Testing Strategy

### Unit Tests
- **Permission hook logic** - Test loading states, permission evaluation, and memoization
- **Permission guard components** - Test conditional rendering and loading fallbacks
- **Navigation filtering** - Test permission-based route visibility
- **Error boundary behavior** - Test error detection and recovery
- **Tooltip behavior on disabled buttons** - Test accessibility and UX

### Integration Tests
- **Page access control** - Test complete page-level permission flows
- **Component permission behavior** - Test permission-aware component interactions
- **Error handling** - Test error boundary integration and user feedback
- **Context provider** - Test permission state sharing across components
- **Loading state transitions** - Test smooth UX during permission loading

### User Acceptance Tests
- **End-to-end permission flows** - Test complete user journeys with different permission levels
- **User experience with restricted access** - Test graceful degradation and helpful messaging
- **Permission management workflows** - Test granting/revoking permissions
- **Direct URL access** - Test handling of direct navigation to restricted routes
- **Concurrent permission consumers** - Test multiple components using permissions simultaneously

### Performance Tests
- **Query deduplication** - Verify single permission query per case
- **Memoization effectiveness** - Test permission calculation caching
- **Loading state performance** - Test smooth transitions without flicker
- **Memory usage** - Test no memory leaks in permission context

## Migration Strategy

1. **Gradual Rollout**: Implement permissions page by page with feature flags
2. **Backward Compatibility**: Maintain existing permission checks during transition
3. **Performance Monitoring**: Track loading times and query efficiency
4. **User Training**: Provide documentation and tooltips for new permission system
5. **Feedback Collection**: Gather user feedback on permission UX and accessibility
6. **A/B Testing**: Test different permission UI patterns for optimal UX

## Success Metrics

### Security & Compliance
- **Zero unauthorized access incidents** - No security breaches
- **Permission audit trail** - Complete logging of permission changes
- **Access control effectiveness** - Proper enforcement of granular permissions

### User Experience
- **Minimal friction for authorized users** - Smooth workflows without permission barriers
- **Clear feedback for restricted actions** - Helpful tooltips and error messages
- **Loading state satisfaction** - No UI flicker or confusing states
- **Accessibility compliance** - Screen reader friendly permission controls

### Performance
- **No significant impact on page load times** - Efficient permission queries
- **Query deduplication success** - Single permission query per case
- **Smooth loading transitions** - No permission-related performance regressions

### Adoption & Usage
- **High usage of permission management features** - Active permission administration
- **Reduced support tickets** - Fewer access-related support requests
- **User satisfaction scores** - Positive feedback on permission system
- **Permission analytics insights** - Understanding of permission usage patterns

### Technical Quality
- **Type safety** - Zero permission-related TypeScript errors
- **Test coverage** - Comprehensive testing of permission logic
- **Code maintainability** - Clean, reusable permission components
- **Developer experience** - Easy to use permission primitives 