# LangGraph Agent Integration Guide

This document explains how to integrate LangGraph agents with the legal case management system's chat functionality.

## Overview

LangGraph agents running in a separate repository can interact with the chat system using service token authentication. This approach bypasses the normal user authentication flow and allows agents to create sessions and messages on behalf of users.

## Authentication Method

### Service Token Authentication

Instead of using Clerk authentication (which requires user interaction), agents use a service token approach:

1. **Environment Variable**: Set `LANGGRAPH_SERVICE_TOKEN` in your Convex deployment
2. **Token Validation**: The agent functions validate this token before processing requests
3. **User Association**: Agents specify which user the session/message belongs to

## Setup

### 1. Configure Service Token

Add the service token to your Convex environment variables:

```bash
# In your Convex dashboard or .env.local
LANGGRAPH_SERVICE_TOKEN=your_secure_service_token_here
```

### 2. LangGraph Agent Configuration

In your LangGraph agent repository, configure the service token:

```python
# config.py or environment variables
LANGGRAPH_SERVICE_TOKEN = "your_secure_service_token_here"
CONVEX_BASE_URL = "https://your-app.convex.cloud"
```

## Available Endpoints

### Agent-Specific Endpoints

These endpoints are designed specifically for LangGraph agents and use service token authentication:

#### 1. Create Chat Session for Agent

**POST** `/api/chat/agent/sessions`

```json
{
  "serviceToken": "your_service_token",
  "userId": "user_id_in_convex",
  "caseId": "optional_case_id",
  "title": "optional_session_title"
}
```

#### 2. Add Chat Message for Agent

**POST** `/api/chat/agent/messages`

```json
{
  "serviceToken": "your_service_token",
  "sessionId": "session_id",
  "content": "Message content",
  "role": "assistant",
  "messageType": "legal_advice",
  "metadata": "optional_metadata",
  "toolName": "optional_tool_name",
  "toolCallId": "optional_tool_call_id",
  "status": "success"
}
```

#### 3. Update Message Status for Agent

**PATCH** `/api/chat/agent/messages/{messageId}`

```json
{
  "serviceToken": "your_service_token",
  "status": "success|error|pending",
  "content": "optional_updated_content"
}
```

## LangGraph Integration Examples

### Python Implementation

```python
import httpx
import os
from typing import Dict, Any

class ConvexChatClient:
    def __init__(self, base_url: str, service_token: str):
        self.base_url = base_url
        self.service_token = service_token
        self.client = httpx.AsyncClient()
    
    async def create_chat_session(self, user_id: str, case_id: str = None, title: str = None) -> str:
        """Create a new chat session for a user."""
        payload = {
            "serviceToken": self.service_token,
            "userId": user_id,
        }
        
        if case_id:
            payload["caseId"] = case_id
        if title:
            payload["title"] = title
            
        response = await self.client.post(
            f"{self.base_url}/api/chat/agent/sessions",
            json=payload
        )
        response.raise_for_status()
        
        data = response.json()
        return data["sessionId"]
    
    async def add_message(self, session_id: str, content: str, role: str = "assistant", 
                         message_type: str = "text", metadata: str = None) -> str:
        """Add a message to a chat session."""
        payload = {
            "serviceToken": self.service_token,
            "sessionId": session_id,
            "content": content,
            "role": role,
            "messageType": message_type,
        }
        
        if metadata:
            payload["metadata"] = metadata
            
        response = await self.client.post(
            f"{self.base_url}/api/chat/agent/messages",
            json=payload
        )
        response.raise_for_status()
        
        data = response.json()
        return data["messageId"]
    
    async def update_message_status(self, message_id: str, status: str, content: str = None):
        """Update the status of a message."""
        payload = {
            "serviceToken": self.service_token,
            "status": status,
        }
        
        if content:
            payload["content"] = content
            
        response = await self.client.patch(
            f"{self.base_url}/api/chat/agent/messages/{message_id}",
            json=payload
        )
        response.raise_for_status()

# Usage in LangGraph
async def legal_analysis_agent(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph agent that performs legal analysis and logs to chat."""
    
    # Initialize chat client
    chat_client = ConvexChatClient(
        base_url=os.getenv("CONVEX_BASE_URL"),
        service_token=os.getenv("LANGGRAPH_SERVICE_TOKEN")
    )
    
    # Get user and case info from state
    user_id = state["user_id"]
    case_id = state["case_id"]
    
    # Create chat session
    session_id = await chat_client.create_chat_session(
        user_id=user_id,
        case_id=case_id,
        title="AI Legal Analysis"
    )
    
    # Add initial message
    await chat_client.add_message(
        session_id=session_id,
        content="Starting legal analysis...",
        role="assistant",
        message_type="legal_advice"
    )
    
    # Perform analysis (your LangGraph logic here)
    analysis_result = await perform_legal_analysis(state["document"])
    
    # Add analysis result
    await chat_client.add_message(
        session_id=session_id,
        content=analysis_result,
        role="assistant",
        message_type="legal_advice",
        metadata=json.dumps({"confidence": 0.95, "sources": ["clause1", "clause2"]})
    )
    
    return state
```

### Node.js Implementation

```javascript
class ConvexChatClient {
  constructor(baseUrl, serviceToken) {
    this.baseUrl = baseUrl;
    this.serviceToken = serviceToken;
  }

  async createChatSession(userId, caseId = null, title = null) {
    const payload = {
      serviceToken: this.serviceToken,
      userId,
    };

    if (caseId) payload.caseId = caseId;
    if (title) payload.title = title;

    const response = await fetch(`${this.baseUrl}/api/chat/agent/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.sessionId;
  }

  async addMessage(sessionId, content, role = 'assistant', messageType = 'text', metadata = null) {
    const payload = {
      serviceToken: this.serviceToken,
      sessionId,
      content,
      role,
      messageType,
    };

    if (metadata) payload.metadata = metadata;

    const response = await fetch(`${this.baseUrl}/api/chat/agent/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.messageId;
  }

  async updateMessageStatus(messageId, status, content = null) {
    const payload = {
      serviceToken: this.serviceToken,
      status,
    };

    if (content) payload.content = content;

    const response = await fetch(`${this.baseUrl}/api/chat/agent/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }
}

// Usage
const chatClient = new ConvexChatClient(
  process.env.CONVEX_BASE_URL,
  process.env.LANGGRAPH_SERVICE_TOKEN
);
```

## Security Considerations

### 1. Service Token Security

- **Generate a strong token**: Use a cryptographically secure random string
- **Environment variables**: Store tokens in environment variables, never in code
- **Rotation**: Regularly rotate service tokens
- **Scope**: Limit what agents can do (they can only create/update messages)

### 2. User Validation

- Agents must provide a valid `userId` that exists in the database
- The system verifies the user exists before creating sessions
- Agents cannot access other users' data

### 3. Rate Limiting

- Monitor agent usage to prevent abuse
- Implement rate limiting if needed
- Log all agent interactions for audit purposes

## Error Handling

### Common Errors

```json
{
  "success": false,
  "error": "Invalid service token"
}
```

```json
{
  "success": false,
  "error": "User not found"
}
```

```json
{
  "success": false,
  "error": "Chat session not found"
}
```

### Error Handling in LangGraph

```python
async def safe_chat_operation(operation_func, *args, **kwargs):
    """Wrapper for safe chat operations with error handling."""
    try:
        return await operation_func(*args, **kwargs)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 400:
            error_data = e.response.json()
            logger.error(f"Chat operation failed: {error_data['error']}")
            # Handle specific errors
            if "Invalid service token" in error_data['error']:
                raise ValueError("Authentication failed")
            elif "User not found" in error_data['error']:
                raise ValueError("Invalid user ID")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat operation: {e}")
        raise
```

## Best Practices

### 1. Session Management

- Create sessions at the beginning of agent workflows
- Use descriptive titles for easy identification
- Archive sessions when workflows complete

### 2. Message Organization

- Use appropriate `messageType` for different kinds of content
- Include metadata for additional context
- Use `toolName` and `toolCallId` for tracking tool usage

### 3. Status Updates

- Update message status for long-running operations
- Use `pending` → `success`/`error` flow
- Provide meaningful error messages

### 4. Monitoring

- Log all agent interactions
- Monitor for unusual patterns
- Set up alerts for authentication failures

## Testing

### Test Service Token

```bash
curl -X POST https://your-app.convex.cloud/api/chat/agent/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "serviceToken": "your_test_token",
    "userId": "test_user_id",
    "title": "Test Session"
  }'
```

### Test Message Creation

```bash
curl -X POST https://your-app.convex.cloud/api/chat/agent/messages \
  -H "Content-Type: application/json" \
  -d '{
    "serviceToken": "your_test_token",
    "sessionId": "session_id",
    "content": "Test message",
    "role": "assistant",
    "messageType": "text"
  }'
```

## Troubleshooting

### Common Issues

1. **"Invalid service token"**: Check environment variable configuration
2. **"User not found"**: Verify the user ID exists in the database
3. **"Chat session not found"**: Ensure the session ID is correct
4. **Network errors**: Check connectivity to Convex deployment

### Debug Mode

Enable debug logging in your agent:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

This will help identify issues with HTTP requests and responses. 