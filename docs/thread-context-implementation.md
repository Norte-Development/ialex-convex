# ThreadContext Implementation

## Overview

The `ThreadContext` provides centralized state management for the chatbot thread ID and related functionality. This context handles thread creation, URL hash synchronization, and thread reset operations.

## Features

### Core Functionality

- **Thread ID Management**: Centralized state for the current chat thread ID
- **Hash Synchronization**: Automatically syncs thread ID with URL hash (`#chatbot-{threadId}`)
- **Thread Creation**: Handles creation of new chat threads
- **Thread Reset**: Provides functionality to reset and create new threads
- **Loading States**: Tracks reset operation state

### Context Interface

```typescript
interface ThreadContextType {
  threadId: string | undefined
  isResetting: boolean
  resetThread: () => Promise<void>
  setThreadId: (id: string | undefined) => void
}
```

## Implementation Details

### ThreadProvider Component

The `ThreadProvider` wraps the application and provides thread management functionality:

```typescript
export function ThreadProvider({ children }: { children: React.ReactNode })
```

**Key Features:**
- Initializes thread ID from URL hash on mount
- Listens for hash changes to update thread ID
- Provides thread creation and reset functionality
- Manages loading states during operations

### Hash Management

The context automatically synchronizes the thread ID with the URL hash:

- **Format**: `#chatbot-{threadId}`
- **Initialization**: Reads from hash on component mount
- **Updates**: Listens for `hashchange` events
- **Creation**: Updates hash when new threads are created

### Thread Operations

#### Creating New Threads
```typescript
const resetThread = useCallback(async () => {
  setIsResetting(true)
  try {
    const newId = await createThread({
      title: "Alex - Tu agente legal",
    })
    window.location.hash = `chatbot-${newId}`
    setThreadId(newId)
  } catch (error) {
    console.error("Failed to create new thread:", error)
  } finally {
    setIsResetting(false)
  }
}, [createThread])
```

#### Hash Change Handling
```typescript
useEffect(() => {
  function onHashChange() {
    setThreadId(getThreadIdFromHash())
  }
  window.addEventListener("hashchange", onHashChange)
  return () => window.removeEventListener("hashchange", onHashChange)
}, [])
```

## Usage

### Basic Usage

```typescript
import { useThread } from "@/context/ThreadContext"

function MyComponent() {
  const { threadId, resetThread, isResetting } = useThread()
  
  // Use threadId for API calls
  // Use resetThread to create new threads
  // Use isResetting for loading states
}
```

### Integration with SidebarChatbot

The `SidebarChatbot` component has been updated to use the ThreadContext:

```typescript
export default function SidebarChatbot({ ... }) {
  const { threadId, resetThread } = useThread()
  
  // Automatically create thread when sidebar opens
  useEffect(() => {
    if (!threadId && isOpen) {
      void resetThread()
    }
  }, [resetThread, threadId, isOpen])
}
```

### Integration with CaseThreadSelector

The `CaseThreadSelector` component has been updated to use the ThreadContext with Convex agent threads:

```typescript
export function AIAgentThreadSelector() {
  const { threadId, setThreadId } = useThread()
  
  // Get threads from Convex agent (not the old chat system)
  const threads = useQuery(api.agent.threads.listThreads, { 
    paginationOpts: { numItems: 50, cursor: null as any } 
  });

  return (
    <div className="flex flex-col">
      {threads?.page?.map((thread) => (
        <div
          key={thread._id}
          className={`${thread._id === threadId ? "bg-accent" : ""}`}
          onClick={() => setThreadId(thread._id)}
        >
          {thread.title || "Untitled Thread"}
        </div>
      ))}
    </div>
  )
}
```

### ChatContent Component

The `ChatContent` component now uses the context internally:

```typescript
function ChatContent() {
  const { threadId, resetThread } = useThread()
  
  // Early return if no thread ID
  if (!threadId) {
    return <div>Initializing chat...</div>
  }
  
  // Use threadId for messages and API calls
  const messages = useThreadMessages(
    api.agent.streaming.listMessages,
    { threadId },
    { initialNumItems: 10, stream: true },
  )
}
```

## Benefits

### Centralized State Management
- Single source of truth for thread ID
- Consistent state across all components
- Easier debugging and state tracking

### URL Synchronization
- Thread state persists across page refreshes
- Shareable chat URLs
- Browser back/forward navigation support

### Improved User Experience
- Automatic thread creation when needed
- Loading states for better feedback
- Seamless thread reset functionality

### Code Organization
- Separation of concerns
- Reusable thread management logic
- Cleaner component implementations

## Error Handling

The context includes error handling for thread creation:

```typescript
try {
  const newId = await createThread({
    title: "Alex - Tu agente legal",
  })
  // Success handling
} catch (error) {
  console.error("Failed to create new thread:", error)
  // Error handling
} finally {
  setIsResetting(false)
}
```

## Future Enhancements

Potential improvements for the ThreadContext:

1. **Thread History**: Store and manage multiple thread IDs
2. **Thread Metadata**: Include thread titles, creation dates, etc.
3. **Thread Sharing**: Enhanced sharing capabilities
4. **Offline Support**: Handle offline thread creation
5. **Thread Archiving**: Archive old threads instead of deletion

## Dependencies

- **Convex**: Uses `useMutation` for thread creation
- **React**: Uses React hooks and context API
- **Browser APIs**: Uses `window.location.hash` and event listeners 