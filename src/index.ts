import { config } from "./config.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

const server = createServer();

server.listen(config.port, () => {
  logger.info(`Server started`, {
    port: config.port,
    workingDir: config.workingDir,
    allowedTools: config.allowedTools,
    permissionMode: config.permissionMode,
    maxTurns: config.maxTurns,
  });
  logger.info(`Health check: http://localhost:${config.port}/health`);
  logger.info(`OpenAI-compatible API: http://localhost:${config.port}/v1/chat/completions`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});
