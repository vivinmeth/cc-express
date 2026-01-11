import type { Response } from "express";
import type { OpenAIChatCompletionChunk } from "../types/openai.js";

export function setupSSE(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();
}

export function sendChunk(res: Response, chunk: OpenAIChatCompletionChunk): void {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

export function sendDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}

export function sendError(res: Response, message: string): void {
  const errorChunk = {
    error: {
      message,
      type: "internal_error",
      param: null,
      code: "stream_error",
    },
  };
  res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
}
