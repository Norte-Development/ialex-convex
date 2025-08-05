# TeamCasesList Component

## Overview

The `TeamCasesList` component displays a list of cases that a specific team has access to. This component was created to solve the issue where `TeamCasesView` was being used outside of a case context, which caused errors due to its dependency on the `useCase` hook.

## Purpose

- **Context Independence**: Unlike `TeamCasesView`, this component doesn't require a case context and can be used anywhere in the application
- **Team Cases Display**: Shows all cases accessible by a specific team with their access levels and status
- **Reusable**: Can be used in team management pages, dashboards, or any other location where team case access needs to be displayed

## Props

```typescript
interface TeamCasesListProps {
  teamId: Id<"teams">;
}
```

- `teamId`: The ID of the team whose accessible cases should be displayed

## Features

### Case Display
- Shows case title, description, and metadata
- Displays access level badges (Full Access / Read Only)
- Shows case status with color-coded badges
- Includes creation date and start date information
- Displays case tags (limited to 3 with overflow indicator)

### Loading State
- Shows skeleton loading cards while data is being fetched
- Provides visual feedback during the loading process

### Empty State
- Displays a helpful message when the team has no accessible cases
- Includes an icon and descriptive text

### Navigation
- Case titles are clickable links that navigate to the case detail page
- Uses React Router for navigation

## Usage

```tsx
import TeamCasesList from "@/components/Cases/TeamCasesList";

// In a component
<TeamCasesList teamId={teamId} />
```

## Data Source

The component uses the `api.functions.teams.getCasesAccessibleByTeam` query to fetch cases accessible by the specified team.

## Styling

- Uses Tailwind CSS for styling
- Consistent with the application's design system
- Responsive design that works on different screen sizes
- Hover effects for better user interaction

## Differences from TeamCasesView

| Feature | TeamCasesList | TeamCasesView |
|---------|---------------|---------------|
| Context Requirement | None | Requires CaseProvider |
| Use Case | Team management, dashboards | Inside case pages |
| Functionality | Shows cases accessible by team | Shows team members with permissions (in case context) |
| Dependencies | Minimal | Uses useCase, useCasePermissions |

## Related Components

- `TeamCasesView`: Used within case contexts to show team member permissions
- `TeamMemberPermissionsDialog`: Dialog for managing team member permissions (used by TeamCasesView)

## Implementation Notes

This component was extracted from the `TeamCasesView` component to provide a context-independent way to display team cases. It maintains the same visual design and functionality for the cases display portion while removing the case context dependencies. 