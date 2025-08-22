# Application Setup

This application uses shadcn/ui components. All UI components are located in `src/components/ui/`.

## Adding shadcn Components

To add new shadcn components, use one of these methods:

### From the application directory:
```bash
cd apps/application
npx shadcn@latest add [component-name]
```

### From the project root (using npm scripts):
```bash
# Add a component
npm run ui:add [component-name]

# Interactive shadcn CLI
npm run ui
```

### Important Notes:

- The `components.json` file is configured to use this application's directory structure
- All components will be installed in `apps/application/src/components/ui/`
- The path aliases (`@/components/ui`) resolve to `apps/application/src/components/ui/`
- Components are automatically available to import using `@/components/ui/[component]`

## Example Usage:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
```
