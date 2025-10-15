<!-- 99ea3cca-4d20-4c70-99c3-e4dd51b660a0 0c7ac43c-4cd6-42da-95c8-542f0d75539e -->
# Billing Frontend Implementation Plan

## 1. Create Reusable Billing Components

### 1.1 Create Billing Component Folder Structure

Create `src/components/Billing/` with the following structure:

```
components/Billing/
├── UsageMeter.tsx           # Visual usage indicator (progress bar)
├── FeatureLock.tsx          # Wrapper to lock features based on plan
├── LimitWarningBanner.tsx   # Soft warning at 80% usage
├── UpgradeModal.tsx         # Modal prompting upgrade when limit hit
├── PlanBadge.tsx            # Display current plan with icon
├── BillingSection.tsx       # Main billing preferences section
├── UsageOverview.tsx        # Overview card showing all limits
├── PlanComparison.tsx       # Comparison table for upgrade
├── useBillingLimit.ts       # Hook for checking limits
├── useBillingData.ts        # Hook for fetching billing data
├── types.ts                 # Shared TypeScript types
└── index.ts                 # Barrel exports
```

### 1.2 Implement Core Hook: `useBillingLimit.ts`

```typescript
// Returns: { allowed: boolean, reason?: string, isWarning: boolean, percentage: number }
// Checks current usage against limits with 80% warning threshold
export const useBillingLimit = (
  limitType: "cases" | "documentsPerCase" | "escritosPerCase" | "libraryDocuments" | "storage",
  context?: { teamId?: Id<"teams">; currentCount?: number }
)
```

Uses `api.billing.features.hasFeatureAccess` and `api.billing.features.getUsageLimits`

### 1.3 Implement Data Hook: `useBillingData.ts`

```typescript
// Centralized hook that fetches all billing-related data
export const useBillingData = (context?: { teamId?: Id<"teams"> }) => {
  const user = useQuery(api.functions.users.getCurrentUser, {})
  const plan = useQuery(api.billing.features.getUserPlan, { userId: user?._id })
  const usage = useQuery(api.billing.features.getUsageLimits, { 
    entityId: context?.teamId || user?._id 
  })
  // Returns consolidated billing state
}
```

### 1.4 Create `UsageMeter.tsx`

Props: `{ used: number, limit: number, label: string, showPercentage?: boolean }`

- Progress bar visualization
- Color coding: green (<80%), yellow (80-99%), red (100%)
- Display "Ilimitado" for Infinity limits

### 1.5 Create `FeatureLock.tsx`

Props: `{ feature: FeatureName, children: ReactNode, fallback?: ReactNode, teamId?: Id<"teams"> }`

- Wraps children with feature access check
- Shows fallback or upgrade prompt when locked
- Used to conditionally render features

### 1.6 Create `LimitWarningBanner.tsx`

Props: `{ limitType: string, percentage: number, onUpgrade: () => void }`

- Non-blocking banner at top of relevant pages
- Shows at 80% threshold
- Dismissible with local storage

### 1.7 Create `UpgradeModal.tsx`

Props: `{ open: boolean, onOpenChange: (open: boolean) => void, reason: string, currentPlan: PlanType }`

- Shows when hard limit reached
- Displays benefit comparison
- Links to Stripe checkout

### 1.8 Create `PlanBadge.tsx`

Props: `{ plan: PlanType, size?: "sm" | "md" | "lg" }`

- Visual badge with plan name
- Color coded by tier (Free: gray, Premium Individual: blue, Premium Team: purple)

## 2. Update Existing Components with Limit Enforcement

### 2.1 Update `CreateCaseDialog.tsx`

Location: `src/components/Cases/CreateCaseDialog.tsx`

Before dialog opens, check limit:

```typescript
const { allowed, reason, isWarning, percentage } = useBillingLimit("cases", { teamId })

// Show warning banner in dialog if isWarning
// Block creation if !allowed, show UpgradeModal
```

Add usage display: "Casos: X/Y" in dialog header

### 2.2 Update `NewDocumentInput.tsx` and `CaseLayout.tsx` (document upload)

Location: `src/components/Cases/NewDocumentInput.tsx`, `src/components/Cases/CaseLayout.tsx`

Before upload, check:

```typescript
const { allowed } = useBillingLimit("documentsPerCase", { currentCount })
// Count current documents in case
// Block upload if !allowed
```

### 2.3 Update Escrito Creation

Location: Find escrito creation component in `src/pages/CaseOpen/EscritosPage.tsx`

Add limit check before creating new escrito:

```typescript
const { allowed } = useBillingLimit("escritosPerCase", { currentCount })
```

### 2.4 Update `UploadDocumentDialog.tsx` (Library)

Location: `src/components/Library/UploadDocumentDialog.tsx`

Check library document limit:

```typescript
const { allowed } = useBillingLimit("libraryDocuments", { teamId: activeScope.teamId })
```

### 2.5 Update `CreateTeamDialog.tsx`

Location: `src/components/Teams/CreateTeamDialog.tsx`

Check team creation feature:

```typescript
const canCreateTeam = useQuery(api.billing.features.hasFeatureAccess, {
  userId: user?._id,
  feature: "create_team"
})
// Disable button if !canCreateTeam.allowed
```

### 2.6 Add AI Model Badge to Chat Interface

Location: Find AI chat component (likely in `src/pages/home/HomeAgentPage.tsx`)

Display model badge:

```typescript
<PlanBadge plan={plan} />
<Badge>{model === "gpt-5" ? "✨ GPT-5" : "GPT-4o"}</Badge>
```

## 3. Create Billing Section in Preferences

### 3.1 Update `preferences-nav.tsx`

Location: `src/components/preferences-nav.tsx`

Add new nav item:

```typescript
{ id: "billing", label: "Facturación", icon: CreditCard }
```

### 3.2 Create `BillingSection.tsx`

Location: `src/components/Billing/BillingSection.tsx`

Structure:

- Current plan display with PlanBadge
- Usage overview with all UsageMeters:
  - Cases (X/Y or Ilimitado)
  - Documents per case
  - Escritos per case
  - Library documents
  - Storage (GB with visual meter)
  - AI messages this month
- Upgrade/Downgrade CTA buttons
- Link to Stripe billing portal (using `api.billing.subscriptions.portal`)
- Payment history section

### 3.3 Create `billing-section.tsx` wrapper component

Location: `src/components/billing-section.tsx`

Similar to other section components (GeneralSection, NotificationsSection), handles:

- Data fetching via `useBillingData`
- Layout and organization
- Integrates BillingSection.tsx components

### 3.4 Update `UserPreferencesPage.tsx`

Location: `src/pages/UserPreferencesPage.tsx`

Add billing section rendering:

```typescript
{activeSection === "billing" && (
  <BillingSection />
)}
```

## 4. Add Storage Limit Enforcement

### 4.1 Create Storage Check Utility

Before any file upload (cases, library), check:

```typescript
const { allowed } = useBillingLimit("storage", { 
  additionalBytes: file.size 
})
```

Show file size and remaining storage before upload

### 4.2 Display Storage Meter

Add to billing section and show warning when >80% full

Format: "X.XX GB / YY GB usado"

## 5. Add Team Member Limit Enforcement

### 5.1 Update Team Member Invite

Location: Find team member invite component (likely in `src/pages/TeamManagePage.tsx`)

Before showing invite dialog:

```typescript
const memberCheck = useQuery(api.billing.features.canAddTeamMember, { teamId })
// Disable invite if !memberCheck.allowed
// Show: "Miembros: X/Y" with upgrade prompt
```

## 6. Contextual Limit Display

### 6.1 Cases Page

Location: `src/pages/CasesPage.tsx`

Add to header:

```typescript
<div className="flex items-center gap-2">
  <h1>Casos</h1>
  <UsageMeter used={usage.casesCount} limit={planLimits.cases} label="casos" />
</div>
```

### 6.2 Library Page

Location: `src/pages/LibraryPage.tsx`

Add library document count with meter

### 6.3 Team Settings

Show team member count with limit

## 7. Types and Utilities

### 7.1 Create `types.ts`

Location: `src/components/Billing/types.ts`

```typescript
export type PlanType = "free" | "premium_individual" | "premium_team"
export type LimitType = "cases" | "documentsPerCase" | "escritosPerCase" | "libraryDocuments" | "storage"
export type FeatureName = "create_case" | "upload_document" | "ai_message" | "create_escrito" | "create_team" | "gpt5_access" | "team_library"

export interface BillingLimitResult {
  allowed: boolean
  reason?: string
  isWarning: boolean
  percentage: number
}

export interface UsageLimits {
  casesCount: number
  documentsCount: number
  aiMessagesThisMonth: number
  escritosCount: number
  libraryDocumentsCount: number
  storageUsedBytes: number
}
```

## 8. User Feedback & UX

### 8.1 Toast Notifications

When limit reached, show toast with upgrade link:

```typescript
toast.error("Límite alcanzado", {
  description: reason,
  action: { label: "Actualizar Plan", onClick: () => openUpgradeModal() }
})
```

### 8.2 Progressive Disclosure

- Don't overwhelm: show limits only where relevant
- Context-sensitive: team limits on team pages, personal on personal pages
- Warning progression: info → warning → error

## 9. Testing Checklist

- Free user cannot create cases beyond limit
- Premium user sees "Ilimitado" for unlimited features
- Team member limits enforced correctly
- Storage limit checked before uploads
- AI model displayed correctly (automatic, no selection)
- Billing section shows all usage meters
- Stripe portal link works
- Upgrade modal appears on hard limits
- Warning banners at 80% threshold
- Context switches properly (personal vs team)

## Implementation Order

1. Create hooks and utilities (useBillingLimit, useBillingData, types)
2. Create reusable components (UsageMeter, FeatureLock, PlanBadge)
3. Create warning/modal components (LimitWarningBanner, UpgradeModal)
4. Update existing components with limit checks (CreateCaseDialog, document uploads, etc.)
5. Create billing section for preferences
6. Add contextual limit displays to pages
7. Test end-to-end flows

### To-dos

- [ ] Create Billing component folder structure with all component files
- [ ] Implement useBillingLimit and useBillingData hooks with TypeScript types
- [ ] Create UsageMeter, FeatureLock, PlanBadge, LimitWarningBanner, and UpgradeModal components
- [ ] Add limit enforcement to CreateCaseDialog with usage display and warnings
- [ ] Add limit checks to document upload in NewDocumentInput and CaseLayout
- [ ] Add limit enforcement to escrito creation flows
- [ ] Add library document limit checks to UploadDocumentDialog
- [ ] Add team creation feature lock to CreateTeamDialog
- [ ] Add AI model badge to chat interface showing GPT-4o or GPT-5
- [ ] Create comprehensive BillingSection component with usage overview, plan display, and Stripe portal link
- [ ] Add billing section to preferences navigation and UserPreferencesPage
- [ ] Implement storage limit checks before all file uploads with size display
- [ ] Add team member limit enforcement to invite flows
- [ ] Add usage meters to CasesPage, LibraryPage, and team settings pages