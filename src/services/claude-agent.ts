import { query } from "@anthropic-ai/claude-code";
import { config, type PermissionMode } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ClaudeMessage } from "../converters/claude-to-openai.js";

export interface AgentOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string; // "opus", "sonnet", or "haiku"
  noToolExecution?: boolean; // Return tool calls without executing
}

function mapPermissionMode(mode: PermissionMode): string {
  switch (mode) {
    case "acceptEdits":
      return "acceptEdits";
    case "bypassPermissions":
      return "bypassPermissions";
    case "plan":
      return "plan";
    default:
      return "default";
  }
}

export async function* queryClaudeAgent(
  options: AgentOptions
): AsyncGenerator<ClaudeMessage, void, unknown> {
  logger.info("Starting Claude Agent query", {
    promptLength: options.prompt.length,
    hasSystemPrompt: !!options.systemPrompt,
    model: options.model || "default",
    allowedTools: config.allowedTools,
    permissionMode: config.permissionMode,
    maxTurns: config.maxTurns,
    workingDir: config.workingDir,
  });

  try {
    const queryOptions: Record<string, unknown> = {
      allowedTools: config.allowedTools,
      permissionMode: mapPermissionMode(config.permissionMode),
      maxTurns: options.noToolExecution ? 1 : config.maxTurns,
      cwd: config.workingDir,
    };

    if (options.systemPrompt) {
      queryOptions.systemPrompt = options.systemPrompt;
    }

    if (options.model) {
      queryOptions.model = options.model;
    }

    // If noToolExecution, deny all tool calls but still return them in response
    if (options.noToolExecution) {
      queryOptions.canUseTool = async (toolName: string, toolInput: unknown) => {
        logger.debug("Tool call intercepted (not executing)", { toolName, toolInput });
        return {
          behavior: "deny" as const,
          message: "Tool execution disabled - returning tool call to client",
        };
      };
    }

    const iterator = query({
      prompt: options.prompt,
      options: queryOptions,
    });

    for await (const message of iterator) {
      const claudeMsg = message as ClaudeMessage;

      // Verbose logging for all messages
      logger.info("Received Claude message", {
        type: claudeMsg.type,
        subtype: claudeMsg.subtype,
        hasMessage: !!claudeMsg.message,
        hasResult: !!claudeMsg.result,
      });

      // Log full message content for debugging
      if (claudeMsg.message?.content) {
        logger.info("Message content blocks", {
          blockCount: claudeMsg.message.content.length,
          blockTypes: claudeMsg.message.content.map(b => b.type),
        });

        for (let i = 0; i < claudeMsg.message.content.length; i++) {
          const block = claudeMsg.message.content[i];
          if (block.type === "text") {
            logger.info(`Content block ${i}: text`, {
              textLength: block.text?.length || 0,
              textPreview: block.text?.substring(0, 200),
            });
          } else if (block.type === "tool_use") {
            logger.info(`Content block ${i}: tool_use`, {
              toolName: block.name,
              toolId: block.id,
              toolInput: JSON.stringify(block.input),
            });
          } else {
            logger.info(`Content block ${i}: ${block.type}`, {
              block: JSON.stringify(block),
            });
          }
        }
      }

      // Log result messages
      if (claudeMsg.type === "result") {
        logger.info("Result message", {
          result: claudeMsg.result,
          durationMs: claudeMsg.duration_ms,
          costUsd: claudeMsg.total_cost_usd,
          usage: claudeMsg.usage,
        });
      }

      yield claudeMsg;
    }

    logger.info("Claude Agent query completed");
  } catch (error) {
    logger.error("Claude Agent query failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export function isAssistantMessage(message: ClaudeMessage): boolean {
  return message.type === "assistant" && !!message.message?.content;
}

export function isResultMessage(message: ClaudeMessage): boolean {
  return message.type === "result";
}

export function isSystemInitMessage(message: ClaudeMessage): boolean {
  return message.type === "system" && message.subtype === "init";
}
