# API Reference

CC-Express provides OpenAI-compatible API endpoints. This reference documents all available endpoints and their usage.

## Authentication

All endpoints except `/health` require Bearer token authentication:

```
Authorization: Bearer YOUR_API_SECRET
```

## Endpoints

### GET /health

Health check endpoint. No authentication required.

**Response:**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl http://localhost:28000/health
```

---

### GET /v1/models

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-opus-4-5",
      "object": "model",
      "created": 1704067200,
      "owned_by": "anthropic"
    },
    {
      "id": "claude-sonnet-4-5",
      "object": "model",
      "created": 1704067200,
      "owned_by": "anthropic"
    },
    {
      "id": "claude-haiku-4-5",
      "object": "model",
      "created": 1704067200,
      "owned_by": "anthropic"
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  http://localhost:28000/v1/models
```

**Model Aliases:**

| Model ID | Aliases |
|----------|---------|
| `claude-opus-4-5` | `opus`, `claude-opus` |
| `claude-sonnet-4-5` | `sonnet`, `claude-sonnet` |
| `claude-haiku-4-5` | `haiku`, `claude-haiku` |

---

### POST /v1/chat/completions

Create a chat completion. Compatible with OpenAI's Chat Completions API.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Model ID (see model aliases above) |
| `messages` | array | Yes | Array of message objects |
| `stream` | boolean | No | Enable streaming (default: false) |
| `tools` | array | No | Array of tool definitions |
| `temperature` | number | No | Sampling temperature (ignored, for compatibility) |
| `max_tokens` | number | No | Max tokens (ignored, for compatibility) |

**Message Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | `system`, `user`, `assistant`, or `tool` |
| `content` | string/array/null | Yes* | Message content |
| `tool_calls` | array | No | Tool calls (for assistant messages) |
| `tool_call_id` | string | No | Tool call ID (for tool messages) |

**Tool Object:**

```json
{
  "type": "function",
  "function": {
    "name": "tool_name",
    "description": "Tool description",
    "parameters": {
      "type": "object",
      "properties": {
        "param1": {"type": "string", "description": "..."}
      },
      "required": ["param1"]
    }
  }
}
```

#### Non-Streaming Response

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704067200,
  "model": "claude-sonnet-4-5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

#### Streaming Response

When `stream: true`, the response is sent as Server-Sent Events (SSE).

**Response Format:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"claude-sonnet-4-5","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"claude-sonnet-4-5","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704067200,"model":"claude-sonnet-4-5","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**Example:**
```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

#### Response with Tool Calls

When the model decides to use a tool:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704067200,
  "model": "claude-sonnet-4-5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"Tokyo\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {...}
}
```

---

## Error Responses

Errors follow OpenAI's error format:

```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "param": null,
    "code": "error_code"
  }
}
```

### Common Error Codes

| Status | Type | Description |
|--------|------|-------------|
| 400 | `invalid_request_error` | Invalid request body or parameters |
| 401 | `authentication_error` | Missing or invalid API key |
| 500 | `api_error` | Internal server error |

---

## Multi-Turn Conversation Example

```bash
# Turn 1: User asks a question
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "What is the weather in Tokyo?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string"}
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'

# Response includes tool_call
# Your client executes the tool

# Turn 2: Send tool result
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "What is the weather in Tokyo?"},
      {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\":\"Tokyo\"}"
            }
          }
        ]
      },
      {
        "role": "tool",
        "tool_call_id": "call_abc123",
        "content": "{\"temperature\": 22, \"condition\": \"sunny\"}"
      }
    ],
    "tools": [...]
  }'

# Final response with weather information
```

---

## SDK Compatibility

CC-Express is compatible with OpenAI SDKs:

### Python (openai)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:28000/v1",
    api_key="YOUR_API_SECRET"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

### TypeScript/JavaScript (openai)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:28000/v1',
  apiKey: 'YOUR_API_SECRET',
});

const response = await client.chat.completions.create({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
```

### Vercel AI SDK

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const openai = createOpenAI({
  baseURL: 'http://localhost:28000/v1',
  apiKey: 'YOUR_API_SECRET',
});

const { text } = await generateText({
  model: openai('claude-sonnet-4-5'),
  prompt: 'Hello!',
});
```
