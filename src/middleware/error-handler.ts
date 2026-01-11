import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(400, "invalid_request_error", message);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Invalid or missing API key") {
    super(401, "invalid_api_key", message);
    this.name = "AuthenticationError";
  }
}

export class ClaudeAgentError extends APIError {
  constructor(message: string) {
    super(500, "internal_error", message);
    this.name = "ClaudeAgentError";
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof APIError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        type: err.code,
        param: null,
        code: err.code,
      },
    });
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: {
        message: "Invalid JSON in request body",
        type: "invalid_request_error",
        param: null,
        code: "invalid_json",
      },
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    error: {
      message: "An internal error occurred",
      type: "internal_error",
      param: null,
      code: "internal_error",
    },
  });
}
