# Workflow Streaming Implementation Guide

This document outlines the learnings from implementing a streaming agent workflow using Convex Workflows and the @convex-dev/agent library.

## Overview

We successfully implemented a workflow-based agent system that:
- Creates threads for conversation management
- Saves user messages
- Streams AI responses in real-time (word-by-word)
- Handles errors gracefully
- Provides a reactive UI with automatic updates

## Key Components

### 1. Workflow Definition (`convex/agent/workflow.ts`)

```typescript
import { WorkflowManager } from "@convex-dev/workflow";
import { createThread, saveMessage } from "@convex-dev/agent";
import { agent } from "./agent";

const workflow = new WorkflowManager(components.workflow);

export const legalAgentWorkflow = workflow.define({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    prompt: v.string(),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  },
  handler: async (step, args): Promise<void> => {
    const contextBundle = await step.runMutation(
      internal.agent.workflow.gatherContextForWorkflow,
      {
        userId: args.userId,
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
      },
    );

    const userMessage = await saveMessage(step, components.agent, {
      threadId: args.threadId,
      prompt: args.prompt,
    });

    await step.runAction(
      internal.agent.workflow.streamWithContextAction,
      {
        threadId: args.threadId,
        promptMessageId: userMessage.messageId,
        contextBundle,
      },
      { retry: true },
    );
  },
});
```

### 2. Streaming Action

```typescript
export const streamWithContextAction = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    contextBundle: vContextBundle,
  },
  returns: v.null(),
  handler: async (ctx, { threadId, promptMessageId, contextBundle }) => {
    const contextString = ContextService.formatContextForAgent(contextBundle);

    const schema = buildServerSchema();
    const nodeSpecs: Array<string> = [];
    (schema.spec.nodes as any).forEach((nodeSpec: any, nodeName: string) => {
      const attrs = nodeSpec && nodeSpec.attrs ? Object.keys(nodeSpec.attrs) : [];
      nodeSpecs.push(
        `${nodeName}${attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""}`,
      );
    });
    const markSpecs: Array<string> = [];
    (schema.spec.marks as any).forEach((markSpec: any, markName: string) => {
      const attrs = markSpec && markSpec.attrs ? Object.keys(markSpec.attrs) : [];
      markSpecs.push(
        `${markName}${attrs.length ? ` {attrs: ${attrs.join(", ")}}` : ""}`,
      );
    });
    const schemaSummary = `ProseMirror Schema Summary\n- Nodes: ${nodeSpecs.join(", ")}\n- Marks: ${markSpecs.join(", ")}`;

    const systemMessage = `Sos el asistente legal IALEX. Aquí está el contexto actual:

      ${contextString}

      ---
      ${schemaSummary}
      ---

      Instrucciones:
      ${prompt}
    `;

    const { thread } = await agent.continueThread(ctx, { threadId });

    try {
      await thread.streamText(
        {
          system: systemMessage,
          promptMessageId,
          providerOptions: {
            openai: {
              reasoningEffort: "low",
              reasoningSummary: "auto",
            },
          },
          experimental_repairToolCall: async (...args: any[]) => {
            console.log("Tool call repair triggered:", args);
            return null;
          },
          onError: (error) => {
            if ((error as any)?.name === "AbortError" || (error as any)?.message?.includes("aborted")) {
              console.log("Stream was aborted by user");
              return;
            }
            console.error("Error streaming text", error);
            return;
          },
        },
        {
          saveStreamDeltas: {
            chunking: "word",
            throttleMs: 100,
          },
          contextOptions: {
            searchOtherThreads: true,
          },
        },
      );
    } catch (error) {
      if ((error as any)?.name === "AbortError" || (error as any)?.message?.includes("aborted")) {
        console.log("Stream was aborted by user (caught in try-catch)");
        return null;
      }
      console.error("Uncaught error in streamText:", error);
      throw error;
    }

    return null;
  },
});
```

### 3. Mutation to Start Workflow

```typescript
export const initiateWorkflowStreaming = mutation({
  args: {
    prompt: v.string(),
    threadId: v.optional(v.string()),
    caseId: v.optional(v.id("cases")),
    currentPage: v.optional(v.string()),
    currentView: v.optional(v.string()),
    selectedItems: v.optional(v.array(v.string())),
    cursorPosition: v.optional(v.number()),
    searchQuery: v.optional(v.string()),
    currentEscritoId: v.optional(v.id("escritos")),
  },
  returns: v.object({
    workflowId: v.string(),
    threadId: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserFromAuth(ctx);

    let threadId = args.threadId;
    if (!threadId) {
      threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: "Legal Agent Conversation",
      });
    } else {
      await authorizeThreadAccess(ctx, threadId);
    }

    const workflowId = await workflow.start(
      ctx,
      internal.agent.workflow.legalAgentWorkflow,
      {
        userId: user._id,
        threadId,
        prompt: args.prompt,
        caseId: args.caseId,
        currentPage: args.currentPage,
        currentView: args.currentView,
        selectedItems: args.selectedItems,
        cursorPosition: args.cursorPosition,
        searchQuery: args.searchQuery,
        currentEscritoId: args.currentEscritoId,
      },
    );

    return { workflowId, threadId };
  },
});
```

### 4. Frontend Component

```typescript
import { useThreadMessages } from "@convex-dev/agent/react";

export function WorkflowTest() {
  const [threadId, setThreadId] = useState<string | null>(null);
  
  // CRITICAL: stream: true enables real-time streaming
  const messages = useThreadMessages(
    api.agent.streaming.listMessages,
    threadId ? { threadId } : "skip",
    { initialNumItems: 10, stream: true },  // ← stream: true is essential!
  );
  
  const startWorkflow = useMutation(api.agent.workflow.initiateWorkflowStreaming);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { threadId } = await startWorkflow({ prompt: content });
    setThreadId(threadId);
  };

  return (
    <div>
      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <textarea value={content} onChange={...} />
        <button type="submit">Submit</button>
      </form>

      {/* Messages display */}
      <div>
        {messages.results.map((message) => (
          <div key={message._id}>
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Critical Learnings

### 1. **Always `await` workflow steps**
```typescript
// ❌ Wrong - workflow completes before agent responds
const response = step.runAction(internal.agent.action, {})

// ✅ Correct - workflow waits for agent
await step.runAction(internal.agent.action, { threadId, promptMessageId, userId })
```

### 2. **Pass required parameters to actions**
```typescript
// ❌ Wrong - action doesn't know where to save response
await step.runAction(internal.agent.action, {})

// ✅ Correct - pass threadId, promptMessageId, userId
await step.runAction(internal.agent.action, { 
  threadId, 
  promptMessageId: userMessage.messageId, 
  userId 
})
```

### 3. **Use the correct agent method**
```typescript
// ❌ Wrong - doesn't save to thread
agent.asTextAction({})

// ❌ Wrong - agent doesn't have streamText directly
await agent.streamText(ctx, { threadId, userId }, { promptMessageId })

// ✅ Correct - get thread, then stream
const { thread } = await agent.continueThread(ctx, { threadId });
await thread.streamText({ promptMessageId }, { saveStreamDeltas: {...} })
```

### 4. **Enable streaming in frontend**
```typescript
// ❌ Wrong - won't receive streaming updates
const messages = useThreadMessages(
  api.agent.streaming.listMessages,
  { threadId },
  { initialNumItems: 10 }
);

// ✅ Correct - enables real-time streaming
const messages = useThreadMessages(
  api.agent.streaming.listMessages,
  { threadId },
  { initialNumItems: 10, stream: true }  // ← Essential!
);
```

### 5. **Use `internalAction` for workflow actions**
```typescript
// ❌ Wrong - creates public API endpoint
export const legalAgentAction = action({...})

// ✅ Correct - internal only, callable by workflow
export const legalAgentAction = internalAction({...})
```

## Streaming Configuration Options

### Backend Streaming Options
```typescript
{
  saveStreamDeltas: {
    chunking: "word",        // Options: "word", "sentence", "none"
    throttleMs: 100,         // Milliseconds between updates
  },
  contextOptions: {
    searchOtherThreads: true,  // Enable cross-thread context search
  },
}
```

### Frontend Hook Options
```typescript
{
  initialNumItems: 10,    // Number of messages to load initially
  stream: true,           // Enable real-time streaming updates
}
```

## Error Handling Pattern

Always handle AbortError gracefully (occurs when users cancel streams):

```typescript
try {
  await thread.streamText({
    promptMessageId,
    onError: (error) => {
      if ((error as any)?.name === 'AbortError' || 
          (error as any)?.message?.includes('aborted')) {
        console.log("Stream was aborted by user");
        return;
      }
      console.error("Error streaming text", error);
      return;
    },
  }, {...});
} catch (error) {
  if ((error as any)?.name === 'AbortError' || 
      (error as any)?.message?.includes('aborted')) {
    console.log("Stream was aborted by user (caught in try-catch)");
    return null;
  }
  console.error("Uncaught error in streamText:", error);
  throw error;
}
```

## Architecture Flow

```
User Input
    ↓
startWorkflow (mutation)
    ↓
1. createThread()
2. workflow.start()
    ↓
legalAgentWorkflow (workflow handler)
    ↓
1. saveMessage() - saves user message
2. step.runAction() - calls streaming action
    ↓
legalAgentAction (internal action)
    ↓
1. agent.continueThread() - get thread object
2. thread.streamText() - stream response
    ↓
Frontend (useThreadMessages with stream: true)
    ↓
Real-time UI updates (word-by-word)
```

## Benefits of This Pattern

1. **Durability**: Workflows survive server failures and retry each step
2. **Real-time UX**: Users see responses appearing word-by-word
3. **Separation of Concerns**: Clear boundaries between workflow orchestration and agent execution
4. **Error Recovery**: Built-in retry logic and graceful error handling
5. **Reactive UI**: Automatic updates through Convex subscriptions

## Common Pitfalls to Avoid

1. ❌ Forgetting to `await` workflow steps
2. ❌ Not passing `promptMessageId` to actions
3. ❌ Using `agent.asTextAction()` instead of `thread.streamText()`
4. ❌ Forgetting `stream: true` in frontend hook
5. ❌ Using `action` instead of `internalAction` for workflow actions
6. ❌ Not handling AbortError gracefully

## Testing the Implementation

1. Navigate to `/workflow-test` in your application
2. Enter a legal question or prompt
3. Submit the form
4. Observe the agent's response streaming word-by-word in real-time
5. Check console logs for workflow execution steps
6. Verify thread creation and message saving in Convex dashboard

## Related Files

- **Workflow**: `apps/application/convex/agent/workflow.ts`
- **Frontend Component**: `apps/application/src/components/Agent/WorkflowTest.tsx`
- **Test Page**: `apps/application/src/pages/WorkflowTestPage.tsx`
- **Route Configuration**: `apps/application/src/App.tsx`
- **Existing Streaming Example**: `apps/application/convex/agent/streaming.ts`

## Future Enhancements

Consider adding:
- Custom system prompts for different workflow types
- Context enrichment (case data, documents, etc.)
- Multi-step workflows with multiple agent calls
- Progress indicators for long-running workflows
- Workflow cancellation support
- Follow-up message handling
- Thread history and resumption

