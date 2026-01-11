# Configuration Reference

CC-Express is configured through environment variables. You can set these in a `.env` file or pass them directly to the process.

## Environment Variables

### Server Configuration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `28000` | No | HTTP server port |

### Authentication

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `API_SECRET` | - | **Yes** | Bearer token for API authentication. Clients must include `Authorization: Bearer <API_SECRET>` header |
| `ANTHROPIC_API_KEY` | - | No* | Anthropic API key. Required if not mounting `~/.claude` directory |

*Either `ANTHROPIC_API_KEY` or a mounted `~/.claude` directory with valid session is required.

### Claude Agent Configuration

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `WORKING_DIR` | `/workspace` | No | Working directory for Claude agent operations |
| `ALLOWED_TOOLS` | `Read,Edit,Bash` | No | Comma-separated list of Claude Code tools to allow (when not using client tools) |
| `PERMISSION_MODE` | `acceptEdits` | No | How Claude handles permissions for tool use |
| `MAX_TURNS` | `50` | No | Maximum agentic turns per request |
| `NO_TOOL_EXECUTION` | `true` | No | When `true`, returns tool calls without execution |

## Permission Modes

The `PERMISSION_MODE` setting controls how Claude handles tool permissions:

| Mode | Description |
|------|-------------|
| `default` | Ask for permission on each tool use |
| `acceptEdits` | Automatically accept file edits, ask for others |
| `bypassPermissions` | Skip all permission prompts (use with caution) |
| `plan` | Plan-only mode, no execution |

## Allowed Tools

When `NO_TOOL_EXECUTION=false` and no client tools are provided, these Claude Code built-in tools can be enabled:

- `Read` - Read file contents
- `Edit` - Edit files
- `Write` - Write new files
- `Bash` - Execute shell commands
- `Glob` - Find files by pattern
- `Grep` - Search file contents
- `Task` - Spawn sub-agents
- And more...

Example:
```env
ALLOWED_TOOLS=Read,Edit,Bash,Glob,Grep
```

## Example Configurations

### Minimal Configuration

```env
API_SECRET=my-secret-key-12345
```

### Development Configuration

```env
PORT=28000
API_SECRET=dev-secret-key
WORKING_DIR=./workspace
ALLOWED_TOOLS=Read,Edit,Bash,Glob,Grep
PERMISSION_MODE=acceptEdits
MAX_TURNS=50
NO_TOOL_EXECUTION=true
```

### Production with API Key

```env
PORT=28000
API_SECRET=production-secret-use-long-random-string
ANTHROPIC_API_KEY=sk-ant-...
WORKING_DIR=/workspace
ALLOWED_TOOLS=Read,Edit,Bash
PERMISSION_MODE=acceptEdits
MAX_TURNS=100
NO_TOOL_EXECUTION=true
```

### Client-Side Tool Execution

When clients provide their own tools, CC-Express:
1. Ignores `ALLOWED_TOOLS` setting
2. Converts client tools to MCP format
3. Disables Claude Code's built-in tools
4. Returns tool calls without execution

```env
# This configuration prioritizes client tools
NO_TOOL_EXECUTION=true
MAX_TURNS=1  # Single turn when using client tools
```

## Docker Environment

When using Docker, set environment variables in `docker-compose.yml` or `.env`:

```yaml
# docker-compose.yml
services:
  cc-express:
    environment:
      - PORT=28000
      - API_SECRET=${API_SECRET}
      - WORKING_DIR=/workspace
      - NO_TOOL_EXECUTION=true
```

```env
# .env (loaded by docker compose)
API_SECRET=your-secret-here
ANTHROPIC_API_KEY=sk-ant-...
```

## Security Recommendations

1. **API_SECRET**: Use a long, random string (32+ characters)
   ```bash
   # Generate a secure secret
   openssl rand -base64 32
   ```

2. **ANTHROPIC_API_KEY**: Never commit to version control

3. **PERMISSION_MODE**: Avoid `bypassPermissions` in production

4. **WORKING_DIR**: Limit to specific directories, not root

5. **Network**: Run behind a reverse proxy with HTTPS in production

## Validating Configuration

The server validates configuration on startup. Missing required values will cause startup failure with descriptive error messages.

```bash
# Test configuration
pnpm start

# Expected output on success:
# {"level":"info","message":"Server started","port":28000,...}
```
