import { Router, type Request, type Response, type NextFunction } from "express";
import { convertOpenAIToClaude } from "../converters/openai-to-claude.js";
import {
  extractContent,
  extractUsage,
  buildChatCompletion,
  buildInitialChunk,
  buildContentChunk,
  buildToolCallChunk,
  buildFinalChunk,
  type ClaudeMessage,
} from "../converters/claude-to-openai.js";
import { queryClaudeAgent, isAssistantMessage, isResultMessage } from "../services/claude-agent.js";
import { setupSSE, sendChunk, sendDone, sendError } from "../services/streaming.js";
import { generateCompletionId } from "../utils/id-generator.js";
import { ValidationError } from "../middleware/error-handler.js";
import { logger } from "../utils/logger.js";
import { config } from "../config.js";
import { MODEL_MAP } from "./models.js";
import type { OpenAIChatRequest, OpenAIToolCall, OpenAIUsage } from "../types/openai.js";

export const chatCompletionsRouter = Router();

chatCompletionsRouter.post(
  "/chat/completions",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = validateRequest(req.body);
      const claudePrompt = convertOpenAIToClaude(body);
      const requestedModel = body.model || "claude-sonnet-4-5";

      // Map to SDK model name (opus, sonnet, haiku)
      const sdkModel = MODEL_MAP[requestedModel] || "sonnet";

      if (body.stream) {
        await handleStreamingRequest(res, claudePrompt, requestedModel, sdkModel);
      } else {
        await handleNonStreamingRequest(res, claudePrompt, requestedModel, sdkModel);
      }
    } catch (error) {
      next(error);
    }
  }
);

function validateRequest(body: unknown): OpenAIChatRequest {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be an object");
  }

  const { messages, model } = body as Record<string, unknown>;

  if (!Array.isArray(messages)) {
    throw new ValidationError("messages must be an array");
  }

  if (messages.length === 0) {
    throw new ValidationError("messages array cannot be empty");
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as Record<string, unknown>;

    if (!msg || typeof msg !== "object") {
      throw new ValidationError(`messages[${i}] must be an object`);
    }

    if (!msg.role || !["system", "user", "assistant", "tool"].includes(msg.role as string)) {
      throw new ValidationError(
        `messages[${i}].role must be one of: system, user, assistant, tool`
      );
    }

    // Content can be string, null, or array (for multimodal)
    if (msg.content !== null && typeof msg.content !== "string" && !Array.isArray(msg.content)) {
      throw new ValidationError(`messages[${i}].content must be a string, array, or null`);
    }
  }

  return body as OpenAIChatRequest;
}

async function handleStreamingRequest(
  res: Response,
  claudePrompt: { prompt: string; systemPrompt?: string },
  responseModel: string,
  sdkModel: string
): Promise<void> {
  const completionId = generateCompletionId();

  setupSSE(res);

  // Send initial chunk with role
  sendChunk(res, buildInitialChunk(completionId, responseModel));

  let hasToolCalls = false;
  let sentToolCallIds = new Set<string>();

  try {
    const iterator = queryClaudeAgent({
      prompt: claudePrompt.prompt,
      systemPrompt: claudePrompt.systemPrompt,
      model: sdkModel,
      noToolExecution: config.noToolExecution,
    });

    for await (const message of iterator) {
      if (isAssistantMessage(message)) {
        const { textContent, toolCalls } = extractContent(message);

        // Send text content
        if (textContent) {
          sendChunk(res, buildContentChunk(completionId, responseModel, textContent));
        }

        // Send tool calls
        if (toolCalls.length > 0) {
          hasToolCalls = true;

          // Filter to only new tool calls
          const newToolCalls = toolCalls.filter((tc) => !sentToolCallIds.has(tc.id));

          if (newToolCalls.length > 0) {
            sendChunk(res, buildToolCallChunk(completionId, responseModel, newToolCalls, true));
            newToolCalls.forEach((tc) => sentToolCallIds.add(tc.id));
          }
        }
      }
    }

    // Send final chunk
    sendChunk(res, buildFinalChunk(completionId, responseModel, hasToolCalls));
    sendDone(res);
  } catch (error) {
    logger.error("Streaming error", {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, error instanceof Error ? error.message : "Stream error");
    sendDone(res);
  } finally {
    res.end();
  }
}

async function handleNonStreamingRequest(
  res: Response,
  claudePrompt: { prompt: string; systemPrompt?: string },
  responseModel: string,
  sdkModel: string
): Promise<void> {
  const completionId = generateCompletionId();

  const collectedContent: string[] = [];
  const collectedToolCalls: OpenAIToolCall[] = [];
  let usage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const seenToolCallIds = new Set<string>();

  try {
    const iterator = queryClaudeAgent({
      prompt: claudePrompt.prompt,
      systemPrompt: claudePrompt.systemPrompt,
      model: sdkModel,
      noToolExecution: config.noToolExecution,
    });

    for await (const message of iterator) {
      if (isAssistantMessage(message)) {
        const { textContent, toolCalls } = extractContent(message);

        if (textContent) {
          collectedContent.push(textContent);
        }

        // Deduplicate tool calls
        for (const tc of toolCalls) {
          if (!seenToolCallIds.has(tc.id)) {
            collectedToolCalls.push(tc);
            seenToolCallIds.add(tc.id);
          }
        }
      }

      if (isResultMessage(message)) {
        usage = extractUsage(message);
      }
    }

    const content = collectedContent.length > 0 ? collectedContent.join("\n\n") : null;

    const completion = buildChatCompletion(
      completionId,
      responseModel,
      content,
      collectedToolCalls,
      usage
    );

    res.json(completion);
  } catch (error) {
    logger.error("Non-streaming request error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
