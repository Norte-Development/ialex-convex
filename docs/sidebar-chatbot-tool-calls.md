# Sidebar Chatbot Tool Call Rendering

## Overview

The SidebarChatbot component has been updated to follow AI SDK UI patterns for rendering tool calls and their states. This provides users with transparent visibility into tool execution states following the standard `tool-{toolName}` pattern with proper state handling.

## Features

### Tool Call Display
- **Visual Indicators**: Tool calls are displayed with appropriate icons and loading animations
- **Parameter Visibility**: Users can expand to see the parameters passed to each tool
- **Tool Identification**: Each tool call shows a user-friendly name and unique identifier
- **Spanish Localization**: All UI text is in Spanish to match the application's locale

### Tool Result Display
- **Result Formatting**: Different result types (strings, objects, arrays) are handled appropriately
- **Error Handling**: Failed tool calls are displayed with error styling
- **Collapsible Details**: Large results can be expanded/collapsed for better UX
- **Visual Distinction**: Results are color-coded (green for success, red for errors)

## Message Structure

The component follows AI SDK UI patterns where messages have `parts` arrays with different types:

### Supported Part Types
- `text`: Regular text content
- `tool-{toolName}`: Tool calls with states (input-available, output-available, output-error)
- `reasoning`: AI reasoning display
- `source`: Source citations
- `file`: File attachments with image rendering support

### Tool States
- `call`: Tool is being executed (shows loading state with args)
- `result`: Tool completed successfully (shows results with args)
- `error`: Tool failed (shows error message with args)

### Message Roles
- `user`: User messages (right-aligned, blue)
- `assistant`: AI messages with potential tool calls (left-aligned, gray)
- `system`: System messages (default styling)

## Tool Configuration

### Currently Supported Tools
1. **Search Legislation** (`searchLegislation`)
   - Icon: Search
   - Name: "Búsqueda de Legislación"
   - Results: "Resultados de Legislación"

2. **Search Documents** (`searchDocuments`)
   - Icon: FileText  
   - Name: "Búsqueda de Documentos"
   - Results: "Resultados de Documentos"

### Adding New Tools
To add support for a new tool:

1. Update `getToolIcon()` function with appropriate icon
2. Update `getToolDisplayName()` function with Spanish name
3. Handle specific result formatting if needed

```typescript
const getToolIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'searchlegislation':
      return <Search className="w-4 h-4" />
    case 'searchdocuments':
      return <FileText className="w-4 h-4" />
    case 'yournewTool':
      return <YourIcon className="w-4 h-4" />
    default:
      return <Code className="w-4 h-4" />
  }
}
```

## Component Architecture

### Main Components
- `SidebarMessage`: Main message rendering component
- `ToolCallDisplay`: Renders tool invocations with loading state
- `ToolResultDisplay`: Renders tool results with success/error states

### State Management
- `isExpanded`: Controls parameter/result detail visibility
- Uses message streaming status for real-time updates
- Handles optimistic updates via Convex mutations

## Styling

### Tool Call Styling
- Border: `border-blue-200`
- Background: `bg-blue-50`
- Text: `text-blue-800`
- Loading animation with `Loader2` icon

### Tool Result Styling
- Success: `border-green-200 bg-green-50 text-green-800`
- Error: `border-red-200 bg-red-50 text-red-800`
- Expandable details with white background

### Layout
- Max width: 85% of container
- Space between elements: `space-y-2`
- Responsive design with proper mobile handling

## Error Handling

### TypeScript Compatibility
- Uses `(part as any)` casting for dynamic property access
- Provides fallback values for missing properties
- Graceful degradation when tool data is malformed

### Visual Error States
- Red color scheme for failed tool calls
- Error badges for quick identification
- Detailed error information in expandable sections

## Integration with Convex Agent

### Message Flow
1. User sends message
2. Agent processes with potential tool calls
3. Tool parts appear with `call` state (loading with args)
4. Tool parts update to `result` state (success with results) or `error` state (failure)
5. Agent continues with final response text

### Tool Part Structure
```json
{
  "state": "result",
  "toolCallId": "call_McYHruinM4suA2pbuVMDNGQ3",
  "toolName": "searchLegislation", 
  "args": {
    "category": "ley",
    "jurisdiccion": "nacional",
    "query": "ley del aborto"
  },
  "result": "la ley del aborto es legal",
  "step": 0
}
```

### Streaming Support
- Real-time tool call visibility
- Progressive result loading
- Abort functionality for long-running tools

## Future Enhancements

### Planned Features
- File attachment rendering
- Step-by-step process visualization
- Tool call history and replay
- Custom tool result formatters
- Enhanced mobile experience

### Performance Optimizations
- Virtual scrolling for long conversations
- Result caching for repeated tool calls
- Lazy loading of detailed results

## Usage Example

```typescript
// Tool calls are automatically rendered when the agent uses tools
const agent = new Agent(components.agent, {
  name: "Legal Assistant Agent",
  chat: openai.chat("gpt-4o-mini"),
  tools: {
    searchLegislation: searchLegislationTool,
    searchDocuments: searchDocumentsTool
  }
});

// The SidebarChatbot will automatically display:
// 1. Tool invocation with loading state
// 2. Tool result when complete
// 3. Agent's final response incorporating the results
```

## Maintenance

### Regular Updates
- Keep tool icon mappings current
- Update Spanish translations as needed
- Monitor for new part types in Convex Agent updates
- Test tool call rendering with different result formats

### Debugging
- Check browser console for tool call errors
- Verify message parts structure in development
- Use React DevTools to inspect component state
- Monitor network requests for tool call timing 