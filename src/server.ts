import express from "express";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/request-logger.js";
import { healthRouter } from "./routes/health.js";
import { modelsRouter } from "./routes/models.js";
import { chatCompletionsRouter } from "./routes/chat-completions.js";

export function createServer() {
  const app = express();

  // Parse JSON bodies
  app.use(express.json({ limit: "10mb" }));

  // Request logging
  app.use(requestLogger);

  // Authentication (skips /health)
  app.use(authMiddleware);

  // Routes
  app.use(healthRouter);

  // Mount at both /v1 and root for compatibility
  app.use("/v1", modelsRouter);
  app.use("/v1", chatCompletionsRouter);
  app.use(modelsRouter);
  app.use(chatCompletionsRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
