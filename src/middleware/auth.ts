import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health endpoint
  if (req.path === "/health") {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn("Missing Authorization header", { path: req.path });
    res.status(401).json({
      error: {
        message: "Missing Authorization header",
        type: "invalid_request_error",
        param: null,
        code: "missing_authorization",
      },
    });
    return;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    logger.warn("Invalid Authorization header format", { path: req.path });
    res.status(401).json({
      error: {
        message: "Invalid Authorization header format. Expected 'Bearer <token>'",
        type: "invalid_request_error",
        param: null,
        code: "invalid_authorization_format",
      },
    });
    return;
  }

  const token = parts[1];

  // Timing-safe comparison
  if (!timingSafeEqual(token, config.apiSecret)) {
    logger.warn("Invalid API key", { path: req.path });
    res.status(401).json({
      error: {
        message: "Invalid API key",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    });
    return;
  }

  next();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
