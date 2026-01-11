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

      // Detailed logging for debugging
      logger.debug("Received Claude message", {
        type: claudeMsg.type,
        subtype: claudeMsg.subtype,
      });

      // Log tool calls in detail
      if (claudeMsg.type === "assistant" && claudeMsg.message?.content) {
        for (const block of claudeMsg.message.content) {
          if (block.type === "tool_use") {
            logger.info("Tool call detected", {
              toolName: block.name,
              toolId: block.id,
              toolInput: JSON.stringify(block.input),
            });
          }
        }
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
