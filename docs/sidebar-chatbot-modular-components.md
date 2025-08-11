# Sidebar Chatbot - Modular Components

## Overview

The SidebarChatbot has been refactored into modular components for better maintainability, reusability, and testability. The main component now composes smaller, focused components that each handle specific functionality.

## Component Structure

### Main Component
- **`SidebarChatbot.tsx`** - Main container component that orchestrates all other components and handles resize logic

### Modular Components

#### 1. `ToggleButton.tsx`
- **Purpose**: Floating button to open the chatbot sidebar
- **Props**: 
  - `onToggle: () => void` - Function to toggle sidebar visibility
- **Features**: 
  - Fixed positioning at bottom-right
  - Hover animations and scaling effects

#### 2. `ResizeHandle.tsx`
- **Purpose**: Handle for resizing the sidebar width
- **Props**: 
  - `onMouseDown: (e: React.MouseEvent) => void` - Mouse down handler for resize initiation
- **Features**: 
  - Visual grip indicator on hover
  - Cursor change for resize feedback

#### 3. `SidebarHeader.tsx`
- **Purpose**: Header section with title and close button
- **Props**: 
  - `onToggle: () => void` - Function to close the sidebar
- **Features**: 
  - Branding with icon and title
  - Close button with hover effects

#### 4. `ChatContent.tsx`
- **Purpose**: Main chat area containing messages and input
- **Features**: 
  - Message history display
  - Thread management
  - Message sending and streaming
  - Empty state handling
- **Dependencies**: 
  - Uses ThreadContext and CaseContext
  - Integrates with Convex agent streaming

#### 5. `ChatInput.tsx`
- **Purpose**: Input form for sending messages
- **Props**: 
  - `onSendMessage: (message: string) => void` - Callback for sending messages
  - `isStreaming: boolean` - Whether a message is currently streaming
  - `onAbortStream: () => void` - Callback to abort current stream
- **Features**: 
  - Form submission handling
  - Send/stop button state management
  - Input validation

#### 6. `SidebarMessage.tsx`
- **Purpose**: Individual message rendering with enhanced markdown support
- **Props**: 
  - `message: UIMessage` - Message object from Convex agent
- **Features**: 
  - **ReactMarkdown integration** for rich text rendering
  - Support for different message types (text, tool calls, files, etc.)
  - Custom styling for code blocks, lists, and other markdown elements
  - Role-based styling (user vs assistant messages)
  - Streaming status indicators

#### 7. `ToolCallDisplay.tsx`
- **Purpose**: Display for AI tool invocations (already existed)
- **Features**: Shows tool execution status and results

### Types File
- **`types.ts`** - Centralized type definitions for all component props

### Index File
- **`index.ts`** - Barrel export for easy imports

## ReactMarkdown Integration

The `SidebarMessage` component now uses ReactMarkdown for enhanced text rendering:

### Features Added:
- **Rich text formatting**: Bold, italic, headers, lists
- **Code syntax highlighting**: Inline code and code blocks
- **Custom styling**: Adapts to user/assistant message themes
- **Blockquotes**: For emphasis and citations
- **Proper spacing**: Consistent margins and padding

### Custom Components:
- **Paragraphs**: Proper spacing between paragraphs
- **Lists**: Styled ordered and unordered lists
- **Code blocks**: Syntax-highlighted with proper background
- **Blockquotes**: Left border and italic styling
- **Headers**: Various sizes with proper hierarchy

## Usage Examples

### Basic Usage
```tsx
import { SidebarChatbot } from "@/components/Agent"

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)
  const [width, setWidth] = useState(350)

  return (
    <SidebarChatbot
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      width={width}
      onWidthChange={setWidth}
      onResizeStart={() => {}}
      onResizeEnd={() => {}}
    />
  )
}
```

### Individual Component Usage
```tsx
import { ChatInput, SidebarMessage } from "@/components/Agent"

// Use ChatInput separately
<ChatInput
  onSendMessage={handleSend}
  isStreaming={false}
  onAbortStream={handleAbort}
/>

// Use SidebarMessage separately
<SidebarMessage message={messageObject} />
```

## Benefits of Modular Structure

### 1. **Maintainability**
- Each component has a single responsibility
- Easier to debug and modify specific functionality
- Clear separation of concerns

### 2. **Reusability**
- Components can be used independently
- Easy to create variations or alternatives
- Testable in isolation

### 3. **Performance**
- Components can be optimized individually
- Better tree-shaking and code splitting opportunities
- Reduced re-renders through focused state management

### 4. **Developer Experience**
- Clearer file organization
- Easier to understand component hierarchy
- Better TypeScript support with focused interfaces

## File Structure
```
src/components/Agent/
├── index.ts                 # Barrel exports
├── types.ts                 # Shared type definitions
├── SidebarChatbot.tsx      # Main container component
├── ToggleButton.tsx        # Floating toggle button
├── ResizeHandle.tsx        # Sidebar resize handle
├── SidebarHeader.tsx       # Header with title and close
├── ChatContent.tsx         # Main chat area
├── ChatInput.tsx           # Message input form
├── SidebarMessage.tsx      # Individual message rendering
└── ToolCallDisplay.tsx     # Tool invocation display
```

## Migration Notes

The refactoring maintains the same external API, so existing usage of `SidebarChatbot` should continue to work without changes. The main improvements are internal organization and the addition of ReactMarkdown for better message rendering.

## Future Enhancements

- **Message virtualization** for better performance with long conversations
- **Keyboard shortcuts** for common actions
- **Message reactions** and interactions
- **Custom themes** and styling options
- **Message search** and filtering capabilities 