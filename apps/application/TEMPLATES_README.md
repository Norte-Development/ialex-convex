# Templates (Modelos) System

This document explains how the templates system works in iAlex.

## Overview

Templates (modelos) are reusable legal document templates that can be used to quickly create new escritos. Templates can be stored in two formats:

- **HTML**: Human-readable format, easier to author and edit
- **TipTap JSON**: Exact editor structure for high fidelity reproduction

## Database Schema

Templates are stored in the `modelos` table with the following fields:

- `name`: Template name/title
- `description`: Optional description
- `category`: Legal category (e.g., "Derecho Civil", "Derecho Mercantil")
- `content_type`: Either "html" or "json"
- `content`: The template content as a string
- `isPublic`: Whether the template is public (accessible to all) or private
- `createdBy`: User ID or "system" for system templates
- `tags`: Optional array of tags for categorization
- `usageCount`: Number of times the template has been used
- `isActive`: Whether the template is active

## API Functions

### Creating Templates

```typescript
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

const createTemplate = useMutation(api.functions.createModelo);

// Create an HTML template
const templateId = await createTemplate({
  name: "Mi Plantilla",
  description: "Descripción de la plantilla",
  category: "Derecho Civil",
  content_type: "html",
  content: "<h1>Título</h1><p>Contenido...</p>",
  isPublic: true,
  tags: ["demanda", "civil"]
});

// Create a JSON template
const jsonTemplateId = await createTemplate({
  name: "Plantilla JSON",
  category: "Derecho Procesal",
  content_type: "json",
  content: JSON.stringify({
    type: "doc",
    content: [...]
  }),
  isPublic: false
});
```

### Querying Templates

```typescript
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

// Get first page of all accessible templates (20 items)
const firstPage = useQuery(api.functions.templates.getModelos, {
  paginationOpts: { numItems: 20, cursor: null }
});

// Get next page using cursor
const nextPage = useQuery(api.functions.templates.getModelos, {
  paginationOpts: { 
    numItems: 20, 
    cursor: firstPage?.continueCursor || null 
  }
});

// Filter by category with pagination
const civilTemplates = useQuery(api.functions.templates.getModelos, {
  paginationOpts: { numItems: 15, cursor: null },
  category: "Derecho Civil"
});

// Filter by content type with pagination
const htmlTemplates = useQuery(api.functions.templates.getModelos, {
  paginationOpts: { numItems: 10, cursor: null },
  content_type: "html"
});

// Get only public templates with pagination
const publicTemplates = useQuery(api.functions.templates.getModelos, {
  paginationOpts: { numItems: 25, cursor: null },
  isPublic: true
});

// Get a specific template
const template = useQuery(api.functions.templates.getModelo, {
  modeloId: "template_id_here"
});
```

### Pagination Response Structure

The `getModelos` query returns a paginated response with the following structure:

```typescript
{
  page: Template[],           // Array of template documents
  isDone: boolean,           // Whether this is the last page
  continueCursor: string | null  // Cursor for the next page (null if isDone is true)
}
```

### Pagination Best Practices

1. **Page Size**: Use reasonable page sizes (10-50 items) for optimal performance
2. **Cursor Management**: Always check `isDone` before attempting to load more pages
3. **State Management**: Store the current cursor in your component state for navigation
4. **Loading States**: Show loading indicators while fetching new pages
5. **Error Handling**: Handle cases where pagination fails gracefully

```typescript
// Example React component with pagination
function TemplateList() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  
  const { data, isLoading } = useQuery(api.functions.templates.getModelos, {
    paginationOpts: { numItems: 20, cursor }
  });
  
  useEffect(() => {
    if (data) {
      if (cursor === null) {
        // First page
        setTemplates(data.page);
      } else {
        // Append to existing templates
        setTemplates(prev => [...prev, ...data.page]);
      }
    }
  }, [data, cursor]);
  
  const loadMore = () => {
    if (data && !data.isDone) {
      setCursor(data.continueCursor);
    }
  };
  
  return (
    <div>
      {templates.map(template => (
        <TemplateCard key={template._id} template={template} />
      ))}
      {data && !data.isDone && (
        <button onClick={loadMore} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Using Templates

When a user wants to create a new escrito from a template:

1. Retrieve the template using `getModelo`
2. If `content_type` is "html", convert to TipTap JSON using `parseHtmlToTiptapJson`
3. If `content_type` is "json", use directly
4. Create a new ProseMirror document with the content
5. Create the escrito with the new `prosemirrorId`
6. Increment the template usage count

```typescript
// Increment usage after applying a template
await incrementUsage({
  modeloId: templateId
});
```

## Seeding Sample Templates

The database includes a seed script with 7 common legal templates. To populate your database:

```bash
# Run the seed script
npx convex run functions:seedTemplates
```

This will create the following templates:

1. **Demanda Civil** (HTML) - Standard civil claim template
2. **Contestación de Demanda** (HTML) - Response to civil claim
3. **Recurso de Apelación** (JSON) - Appeal template
4. **Demanda de Divorcio** (HTML) - Divorce petition
5. **Carta Documento** (HTML) - Formal notification letter
6. **Contrato de Compraventa** (HTML) - Sale contract
7. **Alegatos** (JSON) - Final arguments template

All seed templates are:
- Public (accessible to all users)
- Created by "system"
- Tagged appropriately
- Set to active

## Template Categories

Common categories include:

- **Derecho Civil**: General civil law documents
- **Derecho de Familia**: Family law documents
- **Derecho Comercial**: Commercial law documents
- **Derecho Procesal**: Procedural documents
- **Derecho Penal**: Criminal law documents
- **Derecho Laboral**: Labor law documents

## Access Control

- **Public templates**: Accessible to all users
- **Private templates**: Only accessible to the creator
- **System templates**: Created by the system, accessible to all

Users can only increment usage counts for templates they can access.

## Future Enhancements

Planned features for the templates system:

1. **Template Application Flow**: Create escritos directly from templates
2. **Preview System**: Read-only TipTap preview of templates
3. **Template Versioning**: Track changes to templates over time
4. **Variable Substitution**: Support for placeholders in templates
5. **Template Sharing**: Share templates between team members
6. **Usage Analytics**: Track which templates are most popular

## Technical Notes

### HTML to TipTap Conversion

HTML templates are converted using the `@tiptap/html` package with the same extensions as the editor:

- StarterKit (without horizontal rule)
- TextStyle
- InlineChange, BlockChange, LineBreakChange
- TextAlign
- Underline

This ensures consistent rendering between HTML input and TipTap output.

### Storage Considerations

- Templates are stored as strings in the database
- Maximum size: 1MB per template (Convex limit)
- For larger templates, consider storing in `_storage` and keeping a reference

### TypeScript Types

Use the generated types for type safety:

```typescript
import { Id } from "@/convex/_generated/dataModel";

type ModeloId = Id<"modelos">;
type ContentType = "html" | "json";
```

