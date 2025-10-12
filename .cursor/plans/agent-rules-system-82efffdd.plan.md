<!-- 82efffdd-91bd-457c-a791-538f71f736ef 54e6c0e0-e645-451a-8ca2-4ea22580206f -->
# Agent Rules System Implementation

## Overview

Add simple, Cursor-style rules for AI agents that can be configured at two levels:

- **User-level rules**: Personal preferences that apply to all agent interactions for that user
- **Case-level rules**: Specific guidelines for a particular case

Both types of rules are merged and always applied when they exist.

## Database Schema Changes

### Add `agentRules` table to `convex/schema.ts`

```typescript
agentRules: defineTable({
  name: v.string(),              // Title/name of the rule
  content: v.string(),           // The actual rule text (like Cursor rules)
  scope: v.union(
    v.literal("user"),
    v.literal("case")
  ),
  userId: v.optional(v.id("users")),    // For user-level rules
  caseId: v.optional(v.id("cases")),    // For case-level rules
  isActive: v.boolean(),
  createdBy: v.id("users"),
  order: v.optional(v.number()),        // For ordering multiple rules
})
  .index("by_user_and_active", ["userId", "isActive"])
  .index("by_case_and_active", ["caseId", "isActive"])
  .index("by_scope", ["scope"])
  .index("by_created_by", ["createdBy"])
```

## Backend Functions

### Create `convex/functions/agentRules.ts` with CRUD operations:

- `createRule` - mutation to create a new rule (user or case level)
- `updateRule` - mutation to update an existing rule
- `deleteRule` - mutation to delete a rule
- `getUserRules` - query to get all rules for a user
- `getCaseRules` - query to get all rules for a case
- `toggleRuleActive` - mutation to activate/deactivate a rule

### Update `convex/context/contextService.ts`:

- Add `getUserRules()` private method to fetch active user-level rules
- Add `getCaseRules()` private method to fetch active case-level rules
- Update `gatherAutoContext()` to call both rule-fetching methods and merge results
- Update `formatContextForAgent()` to properly format and include rules in the system prompt

## Frontend - User Preferences

### Create rules management components:

Create `src/components/UserSettings/AgentRules/` folder with:

- `AgentRulesSection.tsx` - Main container for user rules management
- `RuleCard.tsx` - Display individual rule with edit/delete/toggle actions
- `RuleForm.tsx` - Form for creating/editing a rule
- `index.ts` - Barrel exports

### Integrate into user settings:

- Find existing user preferences/settings page
- Add new "Agent Rules" section/tab
- Wire up Convex queries and mutations

## Frontend - Case Settings

### Create case rules components:

Create `src/components/CaseSettings/AgentRules/` folder with similar structure:

- `CaseAgentRules.tsx` - Main container for case rules
- Can reuse `RuleCard` and `RuleForm` components with appropriate props

### Integrate into case settings:

- Find existing case settings/preferences modal or page
- Add new "Agent Rules" section
- Wire up Convex queries and mutations for case-specific rules

## Agent Integration

### Verify context flow:

- Ensure rules from `ContextService` are properly passed through the workflow
- Update agent prompt formatting if needed to clearly delineate rules section
- Test that both user and case rules appear in agent context

## Key Implementation Notes

1. **Simple text format**: Rules are just strings, like Cursor rules (no complex structured fields)
2. **Always applied**: When rules exist, they're automatically included in agent context
3. **Merged**: Both user and case rules apply together when a case context exists
4. **Ordered**: Multiple rules can be ordered using the `order` field
5. **Toggle-able**: Rules can be temporarily disabled without deletion via `isActive` flag

### To-dos

- [ ] Add agentRules table to database schema with proper indexes
- [ ] Create convex/functions/agentRules.ts with all CRUD operations
- [ ] Update ContextService to fetch and include user and case rules
- [ ] Create user settings AgentRules components (folder structure with RuleCard, RuleForm, etc.)
- [ ] Integrate AgentRules section into existing user preferences/settings page
- [ ] Create case settings AgentRules components and integrate into case settings
- [ ] Test that rules properly appear in agent context and affect responses