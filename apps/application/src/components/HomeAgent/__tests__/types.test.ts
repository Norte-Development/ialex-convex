/**
 * Type Validation Tests
 * 
 * Tests to ensure all types are correctly defined and compatible.
 */

import type { HomeMessage, MessageRole, MessagePart, TextPart, ToolCallPart, ToolResultPart } from "../types/message-types";
import type { HomeThread, HomeThreadListItem, CreateThreadParams, UpdateThreadParams } from "../types/thread-types";
import type { ChatInterfaceProps, MessageDisplayProps, ChatInputProps } from "../types/ui-types";

/**
 * Test 1: Message Types
 */
export function testMessageTypes() {
  console.log("🧪 Testing Message Types...");

  // Valid message roles
  const roles: MessageRole[] = ["user", "assistant", "system"];
  console.log("✅ MessageRole types:", roles);

  // Valid text part
  const textPart: TextPart = {
    type: "text",
    text: "Hola, ¿cómo estás?",
  };
  console.log("✅ TextPart:", textPart);

  // Valid tool call part
  const toolCallPart: ToolCallPart = {
    type: "tool-call",
    toolCallId: "call_123",
    toolName: "searchDocuments",
    args: { query: "test" },
  };
  console.log("✅ ToolCallPart:", toolCallPart);

  // Valid tool result part
  const toolResultPart: ToolResultPart = {
    type: "tool-result",
    toolCallId: "call_123",
    toolName: "searchDocuments",
    result: { documents: [] },
    isError: false,
  };
  console.log("✅ ToolResultPart:", toolResultPart);

  // Valid message
  const message: HomeMessage = {
    _id: "msg_123",
    id: "msg_123",
    _creationTime: Date.now(),
    threadId: "thread_123",
    role: "user",
    text: "Hola",
    parts: [textPart],
    status: "success",
  };
  console.log("✅ HomeMessage:", message);

  console.log("✅ All message types are valid!\n");
}

/**
 * Test 2: Thread Types
 */
export function testThreadTypes() {
  console.log("🧪 Testing Thread Types...");

  // Valid thread
  const thread: HomeThread = {
    _id: "thread_123",
    _creationTime: Date.now(),
    userId: "user_123",
    title: "Mi conversación",
    summary: "Resumen de la conversación",
    status: "active",
    lastMessageAt: Date.now(),
    messageCount: 5,
  };
  console.log("✅ HomeThread:", thread);

  // Valid thread list item
  const threadListItem: HomeThreadListItem = {
    ...thread,
    preview: "Último mensaje...",
    hasUnread: false,
  };
  console.log("✅ HomeThreadListItem:", threadListItem);

  // Valid create params
  const createParams: CreateThreadParams = {
    title: "Nueva conversación",
    initialMessage: "Hola",
  };
  console.log("✅ CreateThreadParams:", createParams);

  // Valid update params
  const updateParams: UpdateThreadParams = {
    threadId: "thread_123",
    title: "Título actualizado",
    isArchived: false,
  };
  console.log("✅ UpdateThreadParams:", updateParams);

  console.log("✅ All thread types are valid!\n");
}

/**
 * Test 3: UI Component Props Types
 */
export function testUITypes() {
  console.log("🧪 Testing UI Component Props Types...");

  // Mock data
  const mockMessage: HomeMessage = {
    _id: "msg_1",
    role: "user",
    text: "Test",
    parts: [],
  };

  const mockThread: HomeThread = {
    _id: "thread_1",
    _creationTime: Date.now(),
    status: "active",
  };

  // ChatInterfaceProps
  const chatProps: ChatInterfaceProps = {
    threadId: "thread_123",
    messages: [mockMessage],
    onSendMessage: (content: string) => console.log("Send:", content),
    isLoading: false,
    isStreaming: false,
  };
  console.log("✅ ChatInterfaceProps:", Object.keys(chatProps));

  // MessageDisplayProps
  const messageProps: MessageDisplayProps = {
    message: mockMessage,
    isStreaming: false,
  };
  console.log("✅ MessageDisplayProps:", Object.keys(messageProps));

  // ChatInputProps
  const inputProps: ChatInputProps = {
    onSend: (content: string) => console.log("Send:", content),
    isDisabled: false,
    placeholder: "Escribe...",
  };
  console.log("✅ ChatInputProps:", Object.keys(inputProps));

  console.log("✅ All UI props types are valid!\n");
}

/**
 * Test 4: Type Compatibility
 */
export function testTypeCompatibility() {
  console.log("🧪 Testing Type Compatibility...");

  // Test that MessagePart union works correctly
  const parts: MessagePart[] = [
    { type: "text", text: "Hello" },
    { type: "tool-call", toolCallId: "1", toolName: "test", args: {} },
    { type: "tool-result", toolCallId: "1", toolName: "test", result: {} },
  ];
  console.log("✅ MessagePart union works:", parts.length, "parts");

  // Test that optional fields work
  const minimalMessage: HomeMessage = {
    role: "user",
    text: "Test",
  };
  console.log("✅ Minimal message (optional fields):", minimalMessage);

  const minimalThread: HomeThread = {
    _id: "thread_1",
    _creationTime: Date.now(),
    status: "active",
  };
  console.log("✅ Minimal thread (optional fields):", minimalThread);

  console.log("✅ All type compatibility tests passed!\n");
}

/**
 * Run all type tests
 */
export function runAllTypeTests() {
  console.log("🚀 Starting Type Validation Tests\n");
  console.log("=".repeat(50) + "\n");

  try {
    testMessageTypes();
    testThreadTypes();
    testUITypes();
    testTypeCompatibility();

    console.log("=".repeat(50));
    console.log("✅ ALL TYPE TESTS PASSED!");
    console.log("=".repeat(50) + "\n");
    
    return true;
  } catch (error) {
    console.error("❌ TYPE TESTS FAILED:", error);
    return false;
  }
}

// Auto-run if executed directly
if (typeof window !== "undefined") {
  console.log("📝 Type tests loaded. Run runAllTypeTests() to execute.");
}
