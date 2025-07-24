# Chat HTTP Endpoints Documentation

This document describes the HTTP endpoints available for the chat functionality in the legal case management system.

## Base URL

All endpoints are prefixed with `/api/chat/`

## Authentication

All endpoints require authentication. The system uses Convex's built-in authentication system.

## Endpoints

### 1. Create Chat Session

**POST** `/api/chat/sessions`

Creates a new chat session, optionally linked to a specific case.

#### Request Body

```json
{
  "caseId": "optional_case_id",
  "title": "optional_session_title"
}
```

#### Response

**Success (201 Created)**
```json
{
  "success": true,
  "sessionId": "generated_session_id",
  "message": "Chat session created successfully"
}
```

**Error (400 Bad Request)**
```json
{
  "success": false,
  "error": "Error message"
}
```

#### Example

```bash
curl -X POST https://your-convex-app.convex.cloud/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "case_123",
    "title": "Contract Analysis Discussion"
  }'
```

### 2. Get Chat Sessions

**GET** `/api/chat/sessions`

Retrieves all active chat sessions for the authenticated user.

#### Query Parameters

- `userId` (optional): Filter sessions by user ID
- `caseId` (optional): Filter sessions by case ID

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "sessions": [
    {
      "_id": "session_id",
      "_creationTime": 1234567890,
      "caseId": "case_123",
      "userId": "user_456",
      "title": "Session Title",
      "isActive": true
    }
  ],
  "count": 1
}
```

#### Example

```bash
curl "https://your-convex-app.convex.cloud/api/chat/sessions?caseId=case_123"
```

### 3. Get Specific Chat Session

**GET** `/api/chat/sessions/{sessionId}`

Retrieves a specific chat session by ID.

#### Path Parameters

- `sessionId`: The ID of the chat session to retrieve

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "session": {
    "_id": "session_id",
    "_creationTime": 1234567890,
    "caseId": "case_123",
    "userId": "user_456",
    "title": "Session Title",
    "isActive": true
  }
}
```

**Error (404 Not Found)**
```json
{
  "success": false,
  "error": "Chat session not found"
}
```

#### Example

```bash
curl "https://your-convex-app.convex.cloud/api/chat/sessions/session_123"
```

### 4. Archive Chat Session

**DELETE** `/api/chat/sessions/{sessionId}`

Archives a chat session (soft delete).

#### Path Parameters

- `sessionId`: The ID of the chat session to archive

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "message": "Chat session archived successfully"
}
```

#### Example

```bash
curl -X DELETE "https://your-convex-app.convex.cloud/api/chat/sessions/session_123"
```

### 5. Add Chat Message

**POST** `/api/chat/messages`

Adds a new message to a chat session.

#### Request Body

```json
{
  "sessionId": "session_id",
  "content": "Message content",
  "role": "user|assistant|system|tool|extractor|validator",
  "messageType": "text|search_query|web_scrape|document_analysis|template_suggestion|legal_advice|extraction_result|validation_feedback|error",
  "metadata": "optional_metadata_json_string",
  "toolName": "optional_tool_name",
  "toolCallId": "optional_tool_call_id",
  "status": "success|error|pending"
}
```

#### Role Types

- `user`: Messages sent by the user
- `assistant`: AI-generated responses
- `system`: System messages
- `tool`: Messages from tools/extensions
- `extractor`: Messages from data extraction tools
- `validator`: Messages from validation tools

#### Message Types

- `text`: Regular text messages
- `search_query`: Search queries
- `web_scrape`: Web scraping results
- `document_analysis`: Document analysis results
- `template_suggestion`: Template suggestions
- `legal_advice`: Legal advice responses
- `extraction_result`: Data extraction results
- `validation_feedback`: Validation feedback
- `error`: Error messages

#### Response

**Success (201 Created)**
```json
{
  "success": true,
  "messageId": "generated_message_id",
  "message": "Chat message added successfully"
}
```

#### Example

```bash
curl -X POST https://your-convex-app.convex.cloud/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_123",
    "content": "Can you analyze this contract?",
    "role": "user",
    "messageType": "text"
  }'
```

### 6. Get Chat Messages

**GET** `/api/chat/messages`

Retrieves all messages from a specific chat session.

#### Query Parameters

- `sessionId` (required): The ID of the chat session

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "message_id",
      "_creationTime": 1234567890,
      "sessionId": "session_123",
      "content": "Message content",
      "role": "user",
      "messageType": "text",
      "metadata": "optional_metadata",
      "toolName": "optional_tool_name",
      "toolCallId": "optional_tool_call_id",
      "status": "success"
    }
  ],
  "count": 1
}
```

#### Example

```bash
curl "https://your-convex-app.convex.cloud/api/chat/messages?sessionId=session_123"
```

### 7. Update Chat Message Status

**PATCH** `/api/chat/messages/{messageId}`

Updates the status and optionally the content of a chat message.

#### Path Parameters

- `messageId`: The ID of the message to update

#### Request Body

```json
{
  "status": "success|error|pending",
  "content": "optional_updated_content"
}
```

#### Response

**Success (200 OK)**
```json
{
  "success": true,
  "message": "Chat message status updated successfully"
}
```

#### Example

```bash
curl -X PATCH "https://your-convex-app.convex.cloud/api/chat/messages/message_123" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "content": "Updated message content"
  }'
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

Common HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors, missing parameters)
- `404`: Not Found (resource doesn't exist)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)

## Rate Limiting

The endpoints are subject to Convex's standard rate limiting policies.

## Security Considerations

1. **Authentication**: All endpoints require valid authentication
2. **Authorization**: Users can only access their own chat sessions and messages
3. **Input Validation**: All inputs are validated using Convex's validation system
4. **Case Access**: When creating case-linked sessions, users must have read access to the case

## Usage Examples

### Complete Chat Flow

1. **Create a chat session:**
```bash
curl -X POST https://your-convex-app.convex.cloud/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Legal Research Session"}'
```

2. **Add a user message:**
```bash
curl -X POST https://your-convex-app.convex.cloud/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_id_from_step_1",
    "content": "What are the key clauses in this contract?",
    "role": "user",
    "messageType": "text"
  }'
```

3. **Get all messages in the session:**
```bash
curl "https://your-convex-app.convex.cloud/api/chat/messages?sessionId=session_id_from_step_1"
```

4. **Archive the session when done:**
```bash
curl -X DELETE "https://your-convex-app.convex.cloud/api/chat/sessions/session_id_from_step_1"
```

## Integration Notes

- All endpoints return JSON responses
- Use appropriate HTTP status codes for error handling
- Include proper authentication headers
- Handle rate limiting gracefully
- Validate responses before processing 