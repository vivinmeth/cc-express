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
      // Log incoming request
      logger.info("Incoming chat completion request", {
        model: req.body?.model,
        stream: req.body?.stream,
        messageCount: req.body?.messages?.length,
        hasTools: !!req.body?.tools,
        toolCount: req.body?.tools?.length,
      });

      const body = validateRequest(req.body);

      // Log validated request details
      logger.info("Validated request", {
        messageRoles: body.messages.map(m => m.role),
        messageLengths: body.messages.map(m =>
          typeof m.content === 'string' ? m.content.length :
          Array.isArray(m.content) ? m.content.length : 0
        ),
      });

      const claudePrompt = convertOpenAIToClaude(body);

      logger.info("Converted to Claude prompt", {
        promptLength: claudePrompt.prompt.length,
        promptPreview: claudePrompt.prompt.substring(0, 500),
        hasSystemPrompt: !!claudePrompt.systemPrompt,
        systemPromptLength: claudePrompt.systemPrompt?.length,
      });

      const requestedModel = body.model || "claude-sonnet-4-5";

      // Map to SDK model name (opus, sonnet, haiku)
      const sdkModel = MODEL_MAP[requestedModel] || "sonnet";

      logger.info("Model mapping", {
        requestedModel,
        sdkModel,
      });

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

  logger.info("Starting streaming request", {
    completionId,
    responseModel,
    sdkModel,
    noToolExecution: config.noToolExecution,
  });

  setupSSE(res);

  // Send initial chunk with role
  sendChunk(res, buildInitialChunk(completionId, responseModel));

  let hasToolCalls = false;
  let sentToolCallIds = new Set<string>();
  let messageCount = 0;

  try {
    const iterator = queryClaudeAgent({
      prompt: claudePrompt.prompt,
      systemPrompt: claudePrompt.systemPrompt,
      model: sdkModel,
      noToolExecution: config.noToolExecution,
    });

    for await (const message of iterator) {
      messageCount++;
      logger.info(`Processing streaming message ${messageCount}`, {
        messageType: message.type,
        isAssistant: isAssistantMessage(message),
      });

      if (isAssistantMessage(message)) {
        const { textContent, toolCalls } = extractContent(message);

        logger.info("Extracted content from assistant message", {
          textContentLength: textContent.length,
          textContentPreview: textContent.substring(0, 200),
          toolCallCount: toolCalls.length,
          toolCallNames: toolCalls.map(tc => tc.function.name),
        });

        // Send text content
        if (textContent) {
          logger.info("Sending text content chunk", { length: textContent.length });
          sendChunk(res, buildContentChunk(completionId, responseModel, textContent));
        }

        // Send tool calls
        if (toolCalls.length > 0) {
          hasToolCalls = true;

          // Filter to only new tool calls
          const newToolCalls = toolCalls.filter((tc) => !sentToolCallIds.has(tc.id));

          logger.info("Processing tool calls", {
            totalToolCalls: toolCalls.length,
            newToolCalls: newToolCalls.length,
            alreadySent: sentToolCallIds.size,
          });

          if (newToolCalls.length > 0) {
            for (const tc of newToolCalls) {
              logger.info("Sending tool call", {
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              });
            }
            sendChunk(res, buildToolCallChunk(completionId, responseModel, newToolCalls, true));
            newToolCalls.forEach((tc) => sentToolCallIds.add(tc.id));
          }
        }
      }
    }

    logger.info("Streaming complete", {
      completionId,
      messageCount,
      hasToolCalls,
      totalToolCallsSent: sentToolCallIds.size,
    });

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

  logger.info("Starting non-streaming request", {
    completionId,
    responseModel,
    sdkModel,
    noToolExecution: config.noToolExecution,
  });

  const collectedContent: string[] = [];
  const collectedToolCalls: OpenAIToolCall[] = [];
  let usage: OpenAIUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const seenToolCallIds = new Set<string>();
  let messageCount = 0;

  try {
    const iterator = queryClaudeAgent({
      prompt: claudePrompt.prompt,
      systemPrompt: claudePrompt.systemPrompt,
      model: sdkModel,
      noToolExecution: config.noToolExecution,
    });

    for await (const message of iterator) {
      messageCount++;
      logger.info(`Processing non-streaming message ${messageCount}`, {
        messageType: message.type,
        isAssistant: isAssistantMessage(message),
        isResult: isResultMessage(message),
      });

      if (isAssistantMessage(message)) {
        const { textContent, toolCalls } = extractContent(message);

        logger.info("Extracted content from assistant message", {
          textContentLength: textContent.length,
          textContentPreview: textContent.substring(0, 200),
          toolCallCount: toolCalls.length,
          toolCallNames: toolCalls.map(tc => tc.function.name),
        });

        if (textContent) {
          collectedContent.push(textContent);
          logger.info("Added text content to collection", { totalParts: collectedContent.length });
        }

        // Deduplicate tool calls
        for (const tc of toolCalls) {
          if (!seenToolCallIds.has(tc.id)) {
            logger.info("Adding new tool call", {
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
            collectedToolCalls.push(tc);
            seenToolCallIds.add(tc.id);
          } else {
            logger.info("Skipping duplicate tool call", { id: tc.id });
          }
        }
      }

      if (isResultMessage(message)) {
        usage = extractUsage(message);
        logger.info("Extracted usage from result message", { usage });
      }
    }

    const content = collectedContent.length > 0 ? collectedContent.join("\n\n") : null;

    logger.info("Building final completion response", {
      completionId,
      messageCount,
      contentLength: content?.length || 0,
      toolCallCount: collectedToolCalls.length,
      toolCallIds: collectedToolCalls.map(tc => tc.id),
      usage,
    });

    const completion = buildChatCompletion(
      completionId,
      responseModel,
      content,
      collectedToolCalls,
      usage
    );

    logger.info("Sending non-streaming response", {
      completionId,
      responsePreview: JSON.stringify(completion).substring(0, 500),
    });

    res.json(completion);
  } catch (error) {
    logger.error("Non-streaming request error", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
