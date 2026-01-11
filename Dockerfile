# Build stage
FROM node:22-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user with home directory
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -h /home/nodejs

# Create working directory for Claude agent and .claude config dir
RUN mkdir -p /workspace && chown nodejs:nodejs /workspace && \
    mkdir -p /home/nodejs/.claude && chown -R nodejs:nodejs /home/nodejs

# Set HOME for nodejs user
ENV HOME=/home/nodejs

USER nodejs

# Expose port
EXPOSE 28000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:28000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
