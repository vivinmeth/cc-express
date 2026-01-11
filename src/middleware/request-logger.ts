import type { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? "warn" : "info";

    logger[level](`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
}
