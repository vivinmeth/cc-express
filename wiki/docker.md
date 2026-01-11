# Docker Deployment

CC-Express includes Docker support for easy deployment and isolation.

## Quick Start

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- Claude Code authentication (API key or `~/.claude` directory)

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
API_SECRET=your-secure-secret-key

# Claude authentication (choose one)
ANTHROPIC_API_KEY=sk-ant-...  # Option 1: API key

# Or mount ~/.claude directory (see docker-compose.yml)

# Optional
PORT=28000
WORKING_DIR=/workspace
ALLOWED_TOOLS=Read,Edit,Bash
PERMISSION_MODE=acceptEdits
MAX_TURNS=50
NO_TOOL_EXECUTION=true
```

### docker-compose.yml

```yaml
services:
  cc-express:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cc-express
    restart: unless-stopped
    user: root  # Required for Claude Code
    ports:
      - "${PORT:-28000}:28000"
    environment:
      - HOME=/root
      - NODE_ENV=production
      - PORT=28000
      - API_SECRET=${API_SECRET}
      - WORKING_DIR=/workspace
      - ALLOWED_TOOLS=${ALLOWED_TOOLS:-Read,Edit,Bash}
      - PERMISSION_MODE=${PERMISSION_MODE:-acceptEdits}
      - MAX_TURNS=${MAX_TURNS:-50}
      - NO_TOOL_EXECUTION=${NO_TOOL_EXECUTION:-true}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
    volumes:
      # Mount workspace for file operations
      - ${WORKING_DIR:-./workspace}:/workspace
      # Mount Claude Code authentication
      - ${HOME}/.claude:/root/.claude
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:28000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Volume Mounts

### Workspace Mount

The workspace mount allows Claude to read/write files:

```yaml
volumes:
  - ./my-project:/workspace
```

This mounts `./my-project` on your host to `/workspace` in the container.

### Claude Authentication Mount

For CLI-based authentication (instead of API key):

```yaml
volumes:
  - ${HOME}/.claude:/root/.claude:ro
```

This mounts your local Claude Code session as read-only.

## Building the Image

### Using Docker Compose

```bash
docker compose build
```

### Using Docker Directly

```bash
docker build -t cc-express .
```

### Multi-Stage Build

The Dockerfile uses a multi-stage build:

1. **Builder stage**: Installs dependencies and compiles TypeScript
2. **Production stage**: Minimal image with only runtime files

```dockerfile
# Stage 1: Build
FROM node:24-alpine AS builder
# Install and build...

# Stage 2: Production
FROM node:24-alpine
# Copy only what's needed...
```

## Running the Container

### With Docker Compose (Recommended)

```bash
# Start in background
docker compose up -d

# View logs
docker compose logs -f cc-express

# Restart
docker compose restart

# Stop and remove
docker compose down
```

### With Docker Directly

```bash
docker run -d \
  --name cc-express \
  -p 28000:28000 \
  -e API_SECRET=your-secret \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v ./workspace:/workspace \
  -v ~/.claude:/root/.claude:ro \
  cc-express
```

## Health Checks

The container includes a health check:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' cc-express

# Manual health check
curl http://localhost:28000/health
```

Health check configuration:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start period**: 10 seconds

## Logs

### View Logs

```bash
# Follow logs
docker compose logs -f

# Last 100 lines
docker compose logs --tail=100

# Since timestamp
docker compose logs --since="2025-01-01T00:00:00"
```

### Log Configuration

Logs are limited to prevent disk issues:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"   # Max 10MB per file
    max-file: "3"      # Keep 3 rotated files
```

## Networking

### Expose on Different Port

```env
PORT=8080
```

```yaml
ports:
  - "8080:8080"
environment:
  - PORT=8080
```

### Internal Network Only

Remove port mapping for internal-only access:

```yaml
# ports:
#   - "28000:28000"
expose:
  - "28000"
```

### Behind Reverse Proxy

Example with Traefik:

```yaml
services:
  cc-express:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.cc-express.rule=Host(`api.example.com`)"
      - "traefik.http.routers.cc-express.tls=true"
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs cc-express

# Common issues:
# - Missing API_SECRET
# - Invalid ANTHROPIC_API_KEY
# - Port already in use
```

### Permission Errors

The container runs as root for Claude Code compatibility:

```yaml
user: root
environment:
  - HOME=/root
```

If you see permission errors on mounted volumes:

```bash
# Fix ownership on host
sudo chown -R $(id -u):$(id -g) ./workspace
```

### Claude Authentication Fails

1. Verify `~/.claude` exists and contains valid session
2. Check mount is correct: `-v ~/.claude:/root/.claude`
3. Or use `ANTHROPIC_API_KEY` instead

### Out of Memory

Increase container memory limit:

```yaml
services:
  cc-express:
    deploy:
      resources:
        limits:
          memory: 2G
```

## Production Recommendations

1. **Use secrets management** for `API_SECRET` and `ANTHROPIC_API_KEY`

2. **Enable HTTPS** via reverse proxy (nginx, Traefik, Caddy)

3. **Set resource limits**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

4. **Use named volumes** for persistent data:
   ```yaml
   volumes:
     workspace:
   ```

5. **Monitor with Docker stats**:
   ```bash
   docker stats cc-express
   ```

6. **Backup volumes** regularly

7. **Update regularly**:
   ```bash
   git pull
   docker compose up -d --build
   ```
