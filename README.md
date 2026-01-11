# CC-Express

An Express server that exposes OpenAI-compatible API endpoints wrapping the Claude Code SDK (`@anthropic-ai/claude-code`). This allows you to use Claude Code's agentic capabilities through standard OpenAI API clients.

> **WARNING: Personal Use Only**
>
> This project is intended for **personal use only** with your own Claude Code runtime on your personal machine. Hosting this as a service for other users is **strictly prohibited** and may result in Anthropic blocking your account. Use at your own risk.

## Features

- OpenAI-compatible `/v1/chat/completions` endpoint (streaming and non-streaming)
- OpenAI-compatible `/v1/models` endpoint
- Support for client-provided tools via MCP (Model Context Protocol)
- Tool call interception - returns tool calls to client without execution
- Bearer token authentication
- Docker support with health checks

## Quick Start

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- pnpm
- Claude Code CLI installed and authenticated (`claude` command working)
- Valid Anthropic API key or Claude Code session

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cc-express.git
cd cc-express

# Install dependencies
corepack enable
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# At minimum, set API_SECRET
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `28000` | Server port |
| `API_SECRET` | *required* | Bearer token for API authentication |
| `ANTHROPIC_API_KEY` | - | Anthropic API key (or mount `~/.claude`) |
| `WORKING_DIR` | `/workspace` | Claude agent working directory |
| `ALLOWED_TOOLS` | `Read,Edit,Bash` | Comma-separated list of allowed Claude Code tools |
| `PERMISSION_MODE` | `acceptEdits` | Permission mode: `default`, `acceptEdits`, `bypassPermissions`, `plan` |
| `MAX_TURNS` | `50` | Maximum agentic turns per request |
| `NO_TOOL_EXECUTION` | `true` | Return tool calls without executing (recommended) |

### Running Locally

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

### Running with Docker

```bash
# Build and run
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## API Usage

### Models Endpoint

```bash
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  http://localhost:28000/v1/models
```

Available models:
- `claude-opus-4-5` (or `opus`, `claude-opus`)
- `claude-sonnet-4-5` (or `sonnet`, `claude-sonnet`)
- `claude-haiku-4-5` (or `haiku`, `claude-haiku`)

### Chat Completions (Non-Streaming)

```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Chat Completions (Streaming)

```bash
curl -X POST http://localhost:28000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

### With Custom Tools

When you provide tools in the request, CC-Express will:
1. Convert them to MCP format
2. Disable Claude Code's built-in tools
3. Return tool calls to your client without execution
4. Your client handles tool execution and sends results back

```bash
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
          "description": "Get current weather for a location",
          "parameters": {
            "type": "object",
            "properties": {
              "location": {"type": "string", "description": "City name"}
            },
            "required": ["location"]
          }
        }
      }
    ]
  }'
```

## Architecture

```
cc-express/
├── src/
│   ├── index.ts                 # Entry point
│   ├── server.ts                # Express setup
│   ├── config.ts                # Environment configuration
│   ├── middleware/
│   │   ├── auth.ts              # Bearer token validation
│   │   ├── error-handler.ts     # OpenAI-format error responses
│   │   └── request-logger.ts    # Winston request logging
│   ├── routes/
│   │   ├── health.ts            # GET /health
│   │   ├── models.ts            # GET /v1/models
│   │   └── chat-completions.ts  # POST /v1/chat/completions
│   ├── services/
│   │   ├── claude-agent.ts      # Claude Code SDK wrapper
│   │   └── streaming.ts         # SSE utilities
│   ├── converters/
│   │   ├── openai-to-claude.ts  # Request conversion
│   │   ├── claude-to-openai.ts  # Response conversion
│   │   └── openai-tools-to-mcp.ts # Tool conversion
│   ├── types/
│   │   └── openai.ts            # OpenAI API types
│   └── utils/
│       ├── logger.ts            # Winston setup
│       └── id-generator.ts      # ID generation
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## How Tool Handling Works

### Without Client Tools (Default)
- Uses Claude Code's built-in tools (Read, Edit, Bash, etc.)
- Tools execute on the server's workspace
- Controlled by `ALLOWED_TOOLS` and `PERMISSION_MODE`

### With Client Tools
- Client's tools are converted to MCP format
- Built-in Claude Code tools are disabled
- `canUseTool` callback denies execution
- Tool calls are returned to the client
- Client executes tools and sends results back in subsequent messages

This allows you to:
- Run Claude Code on a server
- Have your client application handle tool execution locally
- Keep sensitive operations on the client side

## Important Notices

### Personal Use Only

This software is provided for **personal use only**. You must:

1. Run this on your own machine with your own Claude Code session
2. Use your own Anthropic API credentials
3. NOT host this as a service for other users
4. NOT share your instance with others
5. NOT use this for commercial hosting purposes

Violating these terms may result in Anthropic blocking your account.

### No Warranty

This software is provided "AS IS" without warranty of any kind. The authors are not responsible for:

- Any damages arising from use of this software
- Account suspension or termination by Anthropic
- Data loss or security breaches
- Any other issues that may arise

### Compliance

You are responsible for ensuring your use complies with:

- [Anthropic's Terms of Service](https://www.anthropic.com/terms)
- [Anthropic's Usage Policy](https://www.anthropic.com/usage-policy)
- All applicable laws and regulations

## Documentation

See the [wiki/](./wiki/) folder for detailed documentation:

- [Installation Guide](./wiki/installation.md)
- [Configuration Reference](./wiki/configuration.md)
- [API Reference](./wiki/api-reference.md)
- [Tool Handling](./wiki/tool-handling.md)
- [Docker Deployment](./wiki/docker.md)
- [Troubleshooting](./wiki/troubleshooting.md)

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please read the documentation and ensure your changes align with the project's goals.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Anthropic. Claude, Claude Code, and related trademarks are property of Anthropic, PBC.
