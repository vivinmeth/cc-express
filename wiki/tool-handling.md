# Tool Handling

CC-Express supports two modes of tool handling: server-side execution with Claude Code's built-in tools, and client-side execution with custom tools.

## Overview

| Mode | Tools | Execution | Use Case |
|------|-------|-----------|----------|
| **Server-side** | Claude Code built-in | On server | Agentic coding tasks |
| **Client-side** | Your custom tools | On client | Custom integrations |

## Server-Side Tool Execution

When the client does **not** provide tools in the request, CC-Express uses Claude Code's built-in tools.

### Configuration

```env
ALLOWED_TOOLS=Read,Edit,Bash,Glob,Grep
PERMISSION_MODE=acceptEdits
NO_TOOL_EXECUTION=false
```

### Built-in Tools

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Edit` | Edit existing files |
| `Write` | Create new files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `Task` | Spawn sub-agents |
| `WebFetch` | Fetch web content |
| `WebSearch` | Search the web |

### Example

```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "List files in the current directory"}
    ]
  }'
```

Claude will use `Bash` to run `ls` and return the results.

## Client-Side Tool Execution

When the client **provides tools** in the request, CC-Express:

1. Converts OpenAI tools to MCP (Model Context Protocol) format
2. Creates an SDK MCP server with your tools
3. **Disables** Claude Code's built-in tools
4. Returns tool calls without execution
5. Your client executes the tools and sends results back

### How It Works

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐
│  Client  │────▶│  CC-Express │────▶│ Claude Code │
└──────────┘     └─────────────┘     └─────────────┘
     │                  │                    │
     │ 1. Send request  │                    │
     │    with tools    │                    │
     │─────────────────▶│                    │
     │                  │ 2. Convert tools   │
     │                  │    to MCP format   │
     │                  │───────────────────▶│
     │                  │                    │
     │                  │ 3. Claude returns  │
     │                  │    tool_call       │
     │                  │◀───────────────────│
     │                  │                    │
     │ 4. Return tool   │                    │
     │    call to client│                    │
     │◀─────────────────│                    │
     │                  │                    │
     │ 5. Execute tool  │                    │
     │    locally       │                    │
     │                  │                    │
     │ 6. Send result   │                    │
     │    back          │                    │
     │─────────────────▶│───────────────────▶│
     │                  │                    │
```

### Configuration

```env
NO_TOOL_EXECUTION=true
MAX_TURNS=1
```

### Tool Definition Format

Tools follow OpenAI's function calling format:

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get the current weather for a location",
    "parameters": {
      "type": "object",
      "properties": {
        "location": {
          "type": "string",
          "description": "City name, e.g., 'Tokyo'"
        },
        "unit": {
          "type": "string",
          "enum": ["celsius", "fahrenheit"],
          "description": "Temperature unit"
        }
      },
      "required": ["location"]
    }
  }
}
```

### Supported Parameter Types

| JSON Schema Type | Description |
|------------------|-------------|
| `string` | Text values |
| `number` | Numeric values |
| `integer` | Integer values |
| `boolean` | True/false |
| `array` | Arrays |
| `object` | Nested objects |
| `enum` | String enums |

### Example: Complete Tool Call Flow

**Step 1: Initial Request with Tools**

```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "What is the weather in Tokyo and New York?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get weather for a city",
          "parameters": {
            "type": "object",
            "properties": {
              "city": {"type": "string"}
            },
            "required": ["city"]
          }
        }
      }
    ]
  }'
```

**Step 2: Response with Tool Calls**

```json
{
  "id": "chatcmpl-abc123",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_1",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"city\":\"Tokyo\"}"
          }
        },
        {
          "id": "call_2",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"city\":\"New York\"}"
          }
        }
      ]
    },
    "finish_reason": "tool_calls"
  }]
}
```

**Step 3: Client Executes Tools**

Your client code:
```javascript
const toolResults = await Promise.all(
  response.choices[0].message.tool_calls.map(async (call) => {
    const args = JSON.parse(call.function.arguments);
    const result = await getWeather(args.city); // Your implementation
    return {
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result)
    };
  })
);
```

**Step 4: Send Results Back**

```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "What is the weather in Tokyo and New York?"},
      {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {"id": "call_1", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"Tokyo\"}"}},
          {"id": "call_2", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\":\"New York\"}"}}
        ]
      },
      {"role": "tool", "tool_call_id": "call_1", "content": "{\"temp\": 22, \"condition\": \"sunny\"}"},
      {"role": "tool", "tool_call_id": "call_2", "content": "{\"temp\": 15, \"condition\": \"cloudy\"}"}
    ],
    "tools": [...]
  }'
```

**Step 5: Final Response**

```json
{
  "id": "chatcmpl-def456",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "The weather in Tokyo is 22°C and sunny. In New York, it's 15°C and cloudy."
    },
    "finish_reason": "stop"
  }]
}
```

## Parameter Name Transformation

CC-Express automatically transforms parameter names from `snake_case` to `camelCase` in tool call arguments:

| Claude Returns | Client Receives |
|----------------|-----------------|
| `file_path` | `filePath` |
| `user_id` | `userId` |
| `max_tokens` | `maxTokens` |

This ensures compatibility with JavaScript/TypeScript clients expecting camelCase.

## MCP Tool Naming

Internally, client tools are converted to MCP format with this naming pattern:

```
mcp__client-tools__<tool_name>
```

For example, `get_weather` becomes `mcp__client-tools__get_weather`.

This is handled automatically - you use the original tool name in your requests.

## Best Practices

1. **Provide clear descriptions**: Claude uses tool descriptions to decide when to use them

2. **Mark required parameters**: Always specify `required` in your schema

3. **Use specific types**: Prefer `integer` over `number` when appropriate

4. **Handle multiple tool calls**: Claude may call multiple tools in one response

5. **Include error handling**: Return error information in tool results when things fail

6. **Keep tools focused**: Each tool should do one thing well
