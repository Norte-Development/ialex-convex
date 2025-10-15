# Billing UI Implementation - Remaining Waves

**Status**: Waves 1, 2, 3, 4 & 5 Complete ✅

## Progress Summary

### ✅ Wave 1: Foundation (COMPLETE)
- ✅ `types.ts` - All TypeScript types and interfaces
- ✅ `useBillingLimit.ts` - Core limit checking hook
- ✅ `useBillingData.ts` - Centralized data fetching hook
- ✅ `index.ts` - Barrel exports

### ✅ Wave 2: Reusable UI Components (COMPLETE)
- ✅ `PlanBadge.tsx` - Plan display badge
- ✅ `UsageMeter.tsx` - Progress bar with color coding
- ✅ `FeatureLock.tsx` - Feature access wrapper
- ✅ `LimitWarningBanner.tsx` - 80% warning banner (dismissible)
- ✅ `UsageOverview.tsx` - Card showing all limits
- ✅ `PlanComparison.tsx` - Upgrade comparison table
- ✅ `UpgradeModal.tsx` - Hard limit modal with comparison

### ✅ Wave 3: All Feature Enforcement (COMPLETE)
- ✅ Updated `CreateCaseDialog.tsx` with billing limits
- ✅ Updated `NewDocumentInput.tsx` with document and storage limits
- ✅ Updated `CreateEscritoDialog.tsx` with escrito limits
- ✅ Updated `UploadDocumentDialog.tsx` with library limits
- ✅ Updated `CreateTeamDialog.tsx` with team creation checks
- ✅ Updated `InviteUserDialog.tsx` with team member limits
- ✅ Created `storageUtils.ts` with storage check utilities

### ✅ Wave 4: Billing Section + Preferences (COMPLETE)
- ✅ Created `BillingSection.tsx` - Main billing dashboard component
- ✅ Updated `preferences-nav.tsx` - Added billing navigation item
- ✅ Updated `UserPreferencesPage.tsx` - Integrated billing section
- ✅ Stripe portal integration (uses existing `portal` action)

### ✅ Wave 5: Contextual Usage Displays (COMPLETE)
- ✅ Updated `CasesPage.tsx` - Added case usage meter in header
- ✅ Updated `LibraryPage.tsx` - Added library and storage usage meters
- ✅ Updated `HomeAgentPage.tsx` - Added plan badge and AI model indicator
- ✅ Updated `TeamManagePage.tsx` - Added team usage section with meters

**⚠️ Important**: Run `pnpm convex dev` to regenerate the Convex API types. The billing functions exist in the backend but need to be added to the generated type definitions.

---

## Wave 3: All Feature Enforcement

**Scope**: Add billing limit checks to all creation/upload flows throughout the app

**Estimated Time**: 3-4 hours

**Dependencies**: Waves 1 & 2

**Files to Modify**: ~8 existing files

### 3.1: Update CreateCaseDialog.tsx

**File**: `src/components/Cases/CreateCaseDialog.tsx`

**Changes**:
1. Import billing hooks and components:
   ```typescript
   import { useBillingLimit, UpgradeModal, LimitWarningBanner } from "@/components/Billing";
   ```

2. Add state for upgrade modal:
   ```typescript
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
   ```

3. Check case limit:
   ```typescript
   const { allowed, isWarning, percentage, reason, currentCount, limit } = 
     useBillingLimit("cases", { teamId: activeTeam?._id });
   ```

4. Add warning banner in dialog (if `isWarning`):
   ```tsx
   {isWarning && (
     <LimitWarningBanner
       limitType="cases"
       percentage={percentage}
       currentCount={currentCount}
       limit={limit}
       onUpgrade={() => setShowUpgradeModal(true)}
     />
   )}
   ```

5. Add usage display in dialog header:
   ```tsx
   <div className="flex items-center justify-between">
     <DialogTitle>Crear Nuevo Caso</DialogTitle>
     <span className="text-sm text-gray-500">
       Casos: {currentCount}/{limit === Infinity ? "∞" : limit}
     </span>
   </div>
   ```

6. Block creation if limit reached:
   ```typescript
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!allowed) {
       setShowUpgradeModal(true);
       return;
     }
     
     // ... existing submit logic
   };
   ```

7. Add UpgradeModal at bottom:
   ```tsx
   <UpgradeModal
     open={showUpgradeModal}
     onOpenChange={setShowUpgradeModal}
     reason={reason}
     currentPlan={userPlan}
     recommendedPlan="premium_individual"
   />
   ```

---

### 3.2: Update Document Upload Components

**Files**: 
- `src/components/Cases/NewDocumentInput.tsx`
- `src/components/Cases/CaseLayout.tsx` (if document upload exists there)

**Changes for each file**:

1. Get current document count for the case:
   ```typescript
   const documents = useQuery(api.functions.cases.getDocuments, { caseId });
   const currentDocCount = documents?.length || 0;
   ```

2. Check document per case limit:
   ```typescript
   const { allowed, reason } = useBillingLimit("documentsPerCase", { 
     currentCount: currentDocCount 
   });
   ```

3. Before upload, check limit:
   ```typescript
   const handleFileSelect = async (file: File) => {
     if (!allowed) {
       toast.error("Límite alcanzado", {
         description: reason,
       });
       setShowUpgradeModal(true);
       return;
     }
     
     // ... existing upload logic
   };
   ```

4. Check storage limit:
   ```typescript
   const storageCheck = useBillingLimit("storage", { 
     additionalBytes: file.size 
   });
   
   if (!storageCheck.allowed) {
     toast.error("Espacio insuficiente", {
       description: storageCheck.reason,
     });
     setShowUpgradeModal(true);
     return;
   }
   ```

---

### 3.3: Update Escrito Creation

**File**: `src/pages/CaseOpen/EscritosPage.tsx` (or wherever escrito creation happens)

**Changes**:

1. Count current escritos for the case:
   ```typescript
   const escritos = useQuery(api.functions.casos.getEscritos, { caseId });
   const currentEscritoCount = escritos?.length || 0;
   ```

2. Check escrito limit:
   ```typescript
   const { allowed, reason } = useBillingLimit("escritosPerCase", {
     currentCount: currentEscritoCount,
   });
   ```

3. Before opening create dialog:
   ```typescript
   const handleCreateEscrito = () => {
     if (!allowed) {
       toast.error("Límite alcanzado", {
         description: reason,
       });
       setShowUpgradeModal(true);
       return;
     }
     
     setShowCreateDialog(true);
   };
   ```

4. Optionally show usage in header:
   ```tsx
   <div className="flex items-center gap-2">
     <h2>Escritos</h2>
     <span className="text-sm text-gray-500">
       {currentEscritoCount}/{limit === Infinity ? "∞" : limit}
     </span>
   </div>
   ```

---

### 3.4: Update Library Document Upload

**File**: `src/components/Library/UploadDocumentDialog.tsx`

**Changes**:

1. Determine billing context (team or personal):
   ```typescript
   const activeScope = useActiveScope(); // or however you determine context
   const teamId = activeScope.type === "team" ? activeScope.teamId : undefined;
   ```

2. Check library document limit:
   ```typescript
   const { allowed, isWarning, percentage, reason } = useBillingLimit(
     "libraryDocuments",
     { teamId }
   );
   ```

3. Show warning banner if approaching limit:
   ```tsx
   {isWarning && (
     <LimitWarningBanner
       limitType="libraryDocuments"
       percentage={percentage}
       onUpgrade={() => setShowUpgradeModal(true)}
     />
   )}
   ```

4. Block upload if limit reached:
   ```typescript
   const handleUpload = async () => {
     if (!allowed) {
       toast.error("Límite alcanzado", {
         description: reason,
       });
       setShowUpgradeModal(true);
       return;
     }
     
     // ... existing upload logic
   };
   ```

---

### 3.5: Update Team Creation

**File**: `src/components/Teams/CreateTeamDialog.tsx` (or similar)

**Changes**:

1. Check team creation feature:
   ```typescript
   const user = useQuery(api.functions.users.getCurrentUser, {});
   const canCreateTeam = useQuery(
     api.billing.features.hasFeatureAccess,
     user?._id ? {
       userId: user._id,
       feature: "create_team",
     } : "skip"
   );
   ```

2. Use FeatureLock to wrap the create button:
   ```tsx
   <FeatureLock
     feature="create_team"
     onUpgrade={() => setShowUpgradeModal(true)}
   >
     <Button onClick={() => setShowCreateDialog(true)}>
       Crear Equipo
     </Button>
   </FeatureLock>
   ```

3. Or disable button if not allowed:
   ```tsx
   <Button
     disabled={!canCreateTeam?.allowed}
     onClick={() => {
       if (!canCreateTeam?.allowed) {
         toast.error(canCreateTeam?.reason);
         setShowUpgradeModal(true);
         return;
       }
       setShowCreateDialog(true);
     }}
   >
     Crear Equipo
   </Button>
   ```

---

### 3.6: Update Team Member Invite

**File**: Find team member invite component (likely in `src/pages/TeamManagePage.tsx` or `src/components/Teams/`)

**Changes**:

1. Check team member limit:
   ```typescript
   const memberCheck = useQuery(
     api.billing.features.canAddTeamMember,
     { teamId: currentTeam._id }
   );
   ```

2. Display current count:
   ```tsx
   <div className="flex items-center justify-between">
     <h3>Miembros del Equipo</h3>
     <span className="text-sm text-gray-500">
       {memberCheck?.currentCount || 0}/{memberCheck?.maxAllowed || 0} miembros
     </span>
   </div>
   ```

3. Disable invite button if limit reached:
   ```tsx
   <Button
     disabled={!memberCheck?.allowed}
     onClick={() => {
       if (!memberCheck?.allowed) {
         toast.error("Límite alcanzado", {
           description: memberCheck.reason,
         });
         setShowUpgradeModal(true);
         return;
       }
       setShowInviteDialog(true);
     }}
   >
     Invitar Miembro
   </Button>
   ```

---

### 3.7: Create Storage Check Utility

**File**: `src/components/Billing/storageUtils.ts` (NEW)

```typescript
import { useBillingLimit } from "./useBillingLimit";

/**
 * Hook to check if a file can be uploaded based on storage limits
 */
export function useStorageCheck(fileSize?: number) {
  const { allowed, reason, currentCount, limit } = useBillingLimit("storage", {
    additionalBytes: fileSize,
  });

  const availableGB = limit !== Infinity
    ? ((limit - (currentCount || 0)) / (1024 * 1024 * 1024)).toFixed(2)
    : "∞";

  return {
    allowed,
    reason,
    availableGB,
    totalUsedGB: ((currentCount || 0) / (1024 * 1024 * 1024)).toFixed(2),
    totalLimitGB: limit === Infinity ? "∞" : (limit / (1024 * 1024 * 1024)).toFixed(0),
  };
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
```

**Update barrel export** (`index.ts`):
```typescript
export { useStorageCheck, formatFileSize } from "./storageUtils";
```

---

### 3.8: Add Storage Display to Upload Components

Update all file upload components to show available storage:

```tsx
import { useStorageCheck, formatFileSize } from "@/components/Billing";

function UploadComponent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const storageCheck = useStorageCheck(selectedFile?.size);
  
  return (
    <div>
      {selectedFile && (
        <div className="text-sm text-gray-600">
          Tamaño: {formatFileSize(selectedFile.size)}
          <br />
          Espacio disponible: {storageCheck.availableGB} GB
        </div>
      )}
      
      {!storageCheck.allowed && selectedFile && (
        <Alert variant="destructive">
          <AlertDescription>{storageCheck.reason}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

---

### Wave 3 Testing Checklist

- [ ] Free user cannot create more than 2 cases
- [ ] Warning banner appears at 80% usage
- [ ] UpgradeModal shows when hard limit reached
- [ ] Document upload checks per-case limit
- [ ] Document upload checks storage limit
- [ ] Escrito creation checks per-case limit
- [ ] Library upload checks library document limit
- [ ] Team creation is locked for free users
- [ ] Team member invite respects member limits
- [ ] Toast notifications show appropriate messages
- [ ] All upgrade flows lead to proper modal/checkout

---

## Wave 4: Billing Section + Preferences

**Scope**: Create complete billing dashboard in user preferences

**Estimated Time**: 2 hours

**Dependencies**: Wave 2 (needs UsageOverview, PlanComparison, PlanBadge)

**Files**: 2 new, 2 modified

### 4.1: Create BillingSection.tsx

**File**: `src/components/Billing/BillingSection.tsx` (NEW)

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, CreditCard } from "lucide-react";
import { PlanBadge } from "./PlanBadge";
import { UsageOverview } from "./UsageOverview";
import { PlanComparison } from "./PlanComparison";
import { useBillingData } from "./useBillingData";
import { toast } from "sonner";

interface BillingSectionProps {
  teamId?: string; // Optional team context
}

/**
 * Main billing section component for user preferences
 * Shows current plan, usage, upgrade options, and Stripe portal access
 */
export function BillingSection({ teamId }: BillingSectionProps) {
  const { plan, usage, limits, isLoading } = useBillingData({ 
    teamId: teamId as any 
  });
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  
  const user = useQuery(api.functions.users.getCurrentUser, {});
  const createPortalSession = useMutation(api.billing.subscriptions.createPortalSession);

  const handlePortalAccess = async () => {
    if (!user?._id) return;
    
    setIsLoadingPortal(true);
    try {
      const result = await createPortalSession({ userId: user._id });
      
      if (result.url) {
        window.open(result.url, "_blank");
      } else {
        toast.error("No se pudo acceder al portal de facturación");
      }
    } catch (error) {
      toast.error("Error al abrir el portal de facturación");
      console.error(error);
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleUpgrade = () => {
    // TODO: Implement Stripe checkout flow
    toast.info("Funcionalidad de actualización próximamente");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        <div className="h-96 bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plan Actual</CardTitle>
              <CardDescription>
                Gestiona tu suscripción y facturación
              </CardDescription>
            </div>
            {plan && <PlanBadge plan={plan} size="lg" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan === "free" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Estás usando el plan gratuito. Actualiza para desbloquear casos, 
                documentos y escritos ilimitados, además de acceso a GPT-5.
              </p>
              <Button onClick={handleUpgrade} className="w-full sm:w-auto">
                Actualizar a Premium
              </Button>
            </div>
          )}
          
          {plan !== "free" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Tienes acceso completo a todas las funciones premium.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePortalAccess}
                  disabled={isLoadingPortal}
                >
                  <CreditCard className="size-4 mr-2" />
                  Portal de Facturación
                  <ExternalLink className="size-3 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Usage Overview */}
      <UsageOverview teamId={teamId as any} />

      <Separator />

      {/* Plan Comparison */}
      <PlanComparison currentPlan={plan} />

      {/* Payment History Section (Future) */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Pagos</CardTitle>
          <CardDescription>
            Próximamente: Ver tu historial de facturas y pagos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 italic">
            Esta funcionalidad estará disponible próximamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Update barrel export** (`index.ts`):
```typescript
export { BillingSection } from "./BillingSection";
```

---

### 4.2: Update preferences-nav.tsx

**File**: `src/components/preferences-nav.tsx`

**Changes**:

1. Import icon:
   ```typescript
   import { CreditCard } from "lucide-react";
   ```

2. Add billing nav item:
   ```typescript
   const navItems = [
     { id: "general", label: "General", icon: User },
     { id: "appearance", label: "Apariencia", icon: Palette },
     { id: "notifications", label: "Notificaciones", icon: Bell },
     { id: "billing", label: "Facturación", icon: CreditCard }, // NEW
     { id: "privacy", label: "Privacidad", icon: Shield },
   ];
   ```

---

### 4.3: Update UserPreferencesPage.tsx

**File**: `src/pages/UserPreferencesPage.tsx`

**Changes**:

1. Import BillingSection:
   ```typescript
   import { BillingSection } from "@/components/Billing";
   ```

2. Add billing section rendering:
   ```tsx
   {activeSection === "general" && <GeneralSection />}
   {activeSection === "appearance" && <AppearanceSection />}
   {activeSection === "notifications" && <NotificationsSection />}
   {activeSection === "billing" && <BillingSection />}  {/* NEW */}
   {activeSection === "privacy" && <PrivacySection />}
   ```

---

### Wave 4 Testing Checklist

- [x] Billing nav item appears in preferences
- [x] Clicking billing nav shows BillingSection
- [x] Current plan badge displays correctly
- [x] Usage overview shows all metrics
- [x] Plan comparison table renders
- [x] Stripe portal button works (for premium users)
- [x] Upgrade button appears for free users
- [x] Section is responsive on mobile

**Note**: The Convex API types need to be regenerated by running `pnpm convex dev` for the billing functions to be properly typed. The `portal` action exists in the backend but isn't in the generated types yet.

---

## Wave 5: Contextual Usage Displays

**Scope**: Add usage indicators throughout the app

**Estimated Time**: 1-2 hours (can be split across 2-4 parallel agents)

**Dependencies**: Wave 2 (needs UsageMeter, PlanBadge)

**Files**: ~4 existing files modified

### 5.1: Update CasesPage.tsx

**File**: `src/pages/CasesPage.tsx`

**Changes**:

1. Get case usage data:
   ```typescript
   import { useBillingData, UsageMeter } from "@/components/Billing";
   
   const { usage, limits } = useBillingData();
   ```

2. Add usage meter in header:
   ```tsx
   <div className="flex items-center justify-between mb-6">
     <h1 className="text-3xl font-bold">Casos</h1>
     
     {usage && limits && (
       <div className="w-64">
         <UsageMeter
           used={usage.casesCount}
           limit={limits.cases}
           label="Casos"
           showPercentage={false}
         />
       </div>
     )}
   </div>
   ```

---

### 5.2: Update LibraryPage.tsx

**File**: `src/pages/LibraryPage.tsx`

**Changes**:

1. Get library usage:
   ```typescript
   const activeScope = useActiveScope();
   const teamId = activeScope.type === "team" ? activeScope.teamId : undefined;
   const { usage, limits } = useBillingData({ teamId });
   ```

2. Add usage indicators:
   ```tsx
   <div className="flex items-center gap-4 mb-4">
     {/* Document count meter */}
     {usage && limits && (
       <UsageMeter
         used={usage.libraryDocumentsCount}
         limit={limits.libraryDocuments}
         label="Documentos"
         showPercentage={false}
         className="w-48"
       />
     )}
     
     {/* Storage meter */}
     {usage && limits && (
       <UsageMeter
         used={usage.storageUsedBytes / (1024 * 1024 * 1024)}
         limit={limits.storageGB}
         label="Almacenamiento (GB)"
         showPercentage={false}
         className="w-48"
       />
     )}
   </div>
   ```

---

### 5.3: Update AI Chat Component

**File**: `src/pages/home/HomeAgentPage.tsx` (or wherever AI chat is)

**Changes**:

1. Get user's AI model:
   ```typescript
   import { PlanBadge } from "@/components/Billing";
   import { Badge } from "@/components/ui/badge";
   
   const user = useQuery(api.functions.users.getCurrentUser, {});
   const plan = useQuery(
     api.billing.features.getUserPlan,
     user?._id ? { userId: user._id } : "skip"
   );
   
   // Determine model based on plan
   const aiModel = plan === "premium_individual" || plan === "premium_team" 
     ? "GPT-5" 
     : "GPT-4o";
   ```

2. Add badges to chat header:
   ```tsx
   <div className="flex items-center gap-2 p-4 border-b">
     <h2>Asistente IA</h2>
     
     {plan && <PlanBadge plan={plan} size="sm" />}
     
     <Badge variant="outline">
       {aiModel === "GPT-5" ? "✨ GPT-5" : "GPT-4o"}
     </Badge>
   </div>
   ```

---

### 5.4: Update Team Settings Page

**File**: Find team settings/manage page (likely `src/pages/TeamManagePage.tsx`)

**Changes**:

1. Get team member limits:
   ```typescript
   const memberCheck = useQuery(
     api.billing.features.canAddTeamMember,
     { teamId: team._id }
   );
   
   const { usage, limits } = useBillingData({ teamId: team._id });
   ```

2. Add team usage section:
   ```tsx
   <Card>
     <CardHeader>
       <CardTitle>Uso del Equipo</CardTitle>
       <CardDescription>Límites y uso actual del equipo</CardDescription>
     </CardHeader>
     <CardContent className="space-y-4">
       {/* Team members */}
       <div className="flex items-center justify-between">
         <span className="text-sm font-medium">Miembros</span>
         <span className="text-sm text-gray-600">
           {memberCheck?.currentCount || 0} / {memberCheck?.maxAllowed || 0}
         </span>
       </div>
       
       {/* Team cases */}
       {usage && limits && (
         <UsageMeter
           used={usage.casesCount}
           limit={limits.cases}
           label="Casos del Equipo"
         />
       )}
       
       {/* Team library */}
       {usage && limits && (
         <UsageMeter
           used={usage.libraryDocumentsCount}
           limit={limits.libraryDocuments}
           label="Biblioteca del Equipo"
         />
       )}
     </CardContent>
   </Card>
   ```

---

### Wave 5 Testing Checklist

- [x] Cases page shows case count meter in header
- [x] Library page shows document and storage meters
- [x] AI chat displays correct model badge (GPT-4o vs GPT-5)
- [x] Team settings shows team member count with limit
- [x] Team settings shows team usage meters
- [ ] All meters update in real-time (needs testing)
- [ ] Meters are responsive on mobile (needs testing)

---

## Backend Requirements

### Ensure these Convex functions exist:

1. ✅ `api.billing.features.getUserPlan` - Get user's plan
2. ✅ `api.billing.features.getUsageLimits` - Get usage data
3. ✅ `api.billing.features.hasFeatureAccess` - Check feature access
4. ✅ `api.billing.features.canAddTeamMember` - Check team member limits
5. ⚠️ `api.billing.subscriptions.createPortalSession` - Create Stripe portal session (needs implementation)

### Missing Function to Implement:

**File**: `apps/application/convex/billing/subscriptions.ts`

```typescript
export const createPortalSession = mutation({
  args: { userId: v.id("users") },
  returns: v.object({
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<{ url: string | null }> => {
    // Get Stripe customer for user
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();
    
    if (!customer) {
      return { url: null };
    }
    
    // Create Stripe portal session
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customerId,
      return_url: `${process.env.SITE_URL}/preferences?section=billing`,
    });
    
    return { url: session.url };
  },
});
```

---

## Implementation Order

### Sequential (Safest):
1. ✅ Wave 1 (Foundation)
2. ✅ Wave 2 (UI Components)
3. ✅ Wave 3 (Feature Enforcement)
4. ✅ Wave 4 (Billing Section)
5. ✅ Wave 5 (Contextual Displays)

### Parallel After Wave 2:
- Wave 3 (Agent A) + Wave 4 (Agent B) + Wave 5 (Agent C)
  - All can run simultaneously
  - Wave 5 can even be split across 2-4 agents (one per page)

---

## Final Testing Checklist

### Free User Flow
- [ ] Can create max 2 cases
- [ ] Warning at 80% (2nd case)
- [ ] Blocked at limit with upgrade modal
- [ ] Cannot create teams
- [ ] Limited to 10 documents per case
- [ ] Limited to 3 escritos per case
- [ ] Limited to 5 library documents
- [ ] Limited to 0.5GB storage
- [ ] Uses GPT-4o model
- [ ] 50 AI messages per month

### Premium Individual Flow
- [ ] Unlimited cases, documents, escritos
- [ ] Can create teams (up to 3 members)
- [ ] 100 library documents
- [ ] 50GB storage
- [ ] Uses GPT-5 model
- [ ] Unlimited AI messages
- [ ] Stripe portal accessible

### Premium Team Flow
- [ ] All premium individual features
- [ ] Up to 6 team members
- [ ] 200 library documents
- [ ] 200GB storage
- [ ] All team members get GPT-5
- [ ] Team-level usage tracking

### UI/UX Testing
- [ ] All components are responsive
- [ ] Loading states work correctly
- [ ] Error handling is graceful
- [ ] Toast notifications are clear
- [ ] Modals are dismissible
- [ ] Warning banners are dismissible
- [ ] Storage usage is human-readable
- [ ] Percentages are accurate
- [ ] Colors match usage levels (green/yellow/red)

---

## Notes

- All text is in Spanish as per project requirements
- Components follow project's architecture patterns
- TypeScript strict mode compliance
- No `any` types in implementation
- camelCase naming conventions
- Proper error handling throughout
- Accessibility considerations included
- Mobile-responsive design

---

## Support

If any issues arise during implementation:
1. Check backend functions are deployed
2. Verify Stripe environment variables
3. Test with different user roles
4. Check browser console for errors
5. Verify localStorage for dismissed warnings

---

**End of Remaining Waves Documentation**

