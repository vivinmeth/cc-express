# Installation Guide

This guide covers how to install and set up CC-Express on your local machine.

## Prerequisites

Before installing CC-Express, ensure you have:

1. **Node.js 24+**: Check with `node --version`
2. **pnpm**: Package manager (enabled via corepack)
3. **Claude Code CLI**: Installed and authenticated
4. **Anthropic API Key**: Or an active Claude Code session

### Installing Node.js

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 24
nvm install 24
nvm use 24
```

### Installing pnpm

```bash
# Enable corepack (built into Node.js)
corepack enable

# Prepare pnpm
corepack prepare pnpm@latest --activate
```

### Installing Claude Code CLI

Follow Anthropic's official documentation to install and authenticate Claude Code:

```bash
# Install Claude Code (example - check official docs)
npm install -g @anthropic-ai/claude-code

# Authenticate
claude auth login
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cc-express.git
cd cc-express
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your settings
nano .env  # or your preferred editor
```

At minimum, set these values:

```env
# Required: API authentication secret
API_SECRET=your-secure-random-string

# Optional: If not using mounted ~/.claude directory
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 4. Build the Project

```bash
pnpm build
```

### 5. Start the Server

```bash
# Production mode
pnpm start

# Or development mode (with hot reload)
pnpm dev
```

### 6. Verify Installation

```bash
# Health check
curl http://localhost:28000/health
# Expected: {"status":"ok"}

# List models (with auth)
curl -H "Authorization: Bearer YOUR_API_SECRET" \
  http://localhost:28000/v1/models
```

## Directory Structure After Installation

```
cc-express/
├── dist/              # Compiled JavaScript (after build)
├── node_modules/      # Dependencies
├── src/               # TypeScript source code
├── wiki/              # Documentation
├── .env               # Your configuration (not in git)
├── .env.example       # Configuration template
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

## Next Steps

- [Configuration Reference](./configuration.md) - Detailed configuration options
- [Docker Deployment](./docker.md) - Running with Docker
- [API Reference](./api-reference.md) - Using the API

## Troubleshooting Installation

### "Cannot find module" errors

```bash
# Clean install
rm -rf node_modules dist
pnpm install
pnpm build
```

### Claude Code authentication issues

```bash
# Re-authenticate
claude auth logout
claude auth login

# Verify authentication
claude --version
```

### Port already in use

```bash
# Change port in .env
PORT=28001

# Or find and kill the process using port 28000
lsof -i :28000
kill -9 <PID>
```

See [Troubleshooting](./troubleshooting.md) for more solutions.
