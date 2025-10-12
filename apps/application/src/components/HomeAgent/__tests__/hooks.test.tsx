/**
 * Hooks Tests
 *
 * Tests for useHomeThreads hook using a real component.
 */

import { useState } from "react";
import { useHomeThreads } from "../hooks/useHomeThreads";
import type { UseHomeThreadsReturn } from "../hooks/useHomeThreads";

/**
 * Test Component that uses the hook
 */
export function TestUseHomeThreads({ threadId }: { threadId?: string }) {
  const hook = useHomeThreads({ threadId });

  // Expose hook data via data attributes for testing
  return (
    <div data-testid="hook-test">
      <div
        data-hook-state={JSON.stringify({
          threadsCount: hook.threads.length,
          threadsLoading: hook.threadsLoading,
          hasMoreThreads: hook.hasMoreThreads,
          currentThreadId: hook.currentThread?._id,
          currentThreadLoading: hook.currentThreadLoading,
          messagesCount: hook.messages.length,
          messagesLoading: hook.messagesLoading,
          isLoading: hook.isLoading,
        })}
      />

      <HookDisplay hook={hook} />
    </div>
  );
}

/**
 * Display component for hook data
 */
function HookDisplay({ hook }: { hook: UseHomeThreadsReturn }) {
  const [testLog, setTestLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setTestLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  const testCreateThread = async () => {
    try {
      addLog("🔄 Starting new conversation...");
      await hook.startNewConversation();
      addLog(`✅ New conversation ready (thread will be created on first message)`);
    } catch (error) {
      addLog(`❌ Error starting conversation: ${error}`);
    }
  };

  const testSendMessage = async () => {
    try {
      if (!hook.currentThread) {
        addLog("❌ No current thread selected");
        return;
      }
      addLog("🔄 Sending message...");
      const result = await hook.sendMessage(
        "Te estoy probando a que tenes acceso",
      );
      addLog(`✅ Message sent. Workflow: ${result.workflowId}`);
    } catch (error) {
      addLog(`❌ Error sending message: ${error}`);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      {/* Loading States */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm">Loading States</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Threads Loading: {hook.threadsLoading ? "🔄" : "✅"}</div>
          <div>Messages Loading: {hook.messagesLoading ? "🔄" : "✅"}</div>
          <div>
            Current Thread Loading: {hook.currentThreadLoading ? "🔄" : "✅"}
          </div>
          <div>Overall Loading: {hook.isLoading ? "🔄" : "✅"}</div>
        </div>
      </div>

      {/* Thread List */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm">
          Thread List ({hook.threads.length})
          {hook.hasMoreThreads && " - Has More"}
        </h3>
        <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
          {hook.threads.length === 0 ? (
            <div className="text-muted-foreground">No threads</div>
          ) : (
            hook.threads.slice(0, 5).map((thread) => (
              <div key={thread._id} className="p-2 bg-muted rounded">
                <div className="font-mono">{thread._id}</div>
                <div>{thread.title || "Sin título"}</div>
                <div className="text-muted-foreground">
                  {thread.status} - {thread.messageCount || 0} msgs
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Current Thread */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm">Current Thread</h3>
        {hook.currentThread ? (
          <div className="p-2 bg-accent rounded text-xs space-y-1">
            <div className="font-mono">{hook.currentThread._id}</div>
            <div>{hook.currentThread.title || "Sin título"}</div>
            <div className="text-muted-foreground">
              Status: {hook.currentThread.status}
            </div>
            <div className="text-muted-foreground">
              Messages: {hook.currentThread.messageCount || 0}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground text-xs">
            No thread selected
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm">Messages ({hook.messages.length})</h3>
        <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
          {hook.messages.length === 0 ? (
            <div className="text-muted-foreground">No messages</div>
          ) : (
            hook.messages.slice(0, 5).map((msg) => (
              <div key={msg._id || msg.id} className="p-2 bg-muted rounded">
                <div className="font-bold">{msg.role}</div>
                <div className="truncate">{msg.text || "..."}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm">Actions</h3>
        <div className="flex gap-2">
          <button
            onClick={testCreateThread}
            className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
          >
            Create Thread
          </button>
          <button
            onClick={testSendMessage}
            disabled={!hook.currentThread}
            className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs disabled:opacity-50"
          >
            Send Message
          </button>
        </div>
      </div>

      {/* Test Log */}
      {testLog.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-bold text-sm">Test Log</h3>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono bg-black text-green-400 p-2 rounded">
            {testLog.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Validation tests for hook behavior
 */
export function validateHookBehavior(hook: UseHomeThreadsReturn): string[] {
  const errors: string[] = [];

  // Test 1: Hook returns all required properties
  const requiredProps = [
    "threads",
    "threadsLoading",
    "hasMoreThreads",
    "startNewConversation",
    "currentThread",
    "currentThreadLoading",
    "messages",
    "messagesLoading",
    "sendMessage",
    "isLoading",
  ];

  requiredProps.forEach((prop) => {
    if (!(prop in hook)) {
      errors.push(`Missing required property: ${prop}`);
    }
  });

  // Test 2: Arrays are always arrays (never undefined)
  if (!Array.isArray(hook.threads)) {
    errors.push("threads should be an array");
  }
  if (!Array.isArray(hook.messages)) {
    errors.push("messages should be an array");
  }

  // Test 3: Booleans are always booleans
  if (typeof hook.threadsLoading !== "boolean") {
    errors.push("threadsLoading should be a boolean");
  }
  if (typeof hook.messagesLoading !== "boolean") {
    errors.push("messagesLoading should be a boolean");
  }
  if (typeof hook.isLoading !== "boolean") {
    errors.push("isLoading should be a boolean");
  }

  // Test 4: Functions are callable
  if (typeof hook.startNewConversation !== "function") {
    errors.push("startNewConversation should be a function");
  }
  if (typeof hook.sendMessage !== "function") {
    errors.push("sendMessage should be a function");
  }

  // Test 5: currentThread is null or object
  if (hook.currentThread !== null && typeof hook.currentThread !== "object") {
    errors.push("currentThread should be null or an object");
  }

  return errors;
}

/**
 * Console-based test runner
 */
export function runHookValidation(hook: UseHomeThreadsReturn) {
  console.log("🧪 Running Hook Validation Tests...\n");

  const errors = validateHookBehavior(hook);

  if (errors.length === 0) {
    console.log("✅ All hook validation tests passed!");
    console.log("\n📊 Hook State:");
    console.log("  - Threads:", hook.threads.length);
    console.log("  - Current Thread:", hook.currentThread?._id || "none");
    console.log("  - Messages:", hook.messages.length);
    console.log("  - Loading:", hook.isLoading);
    return true;
  } else {
    console.error("❌ Hook validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    return false;
  }
}
