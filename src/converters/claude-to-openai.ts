import type {
  OpenAIChatCompletion,
  OpenAIChatCompletionChunk,
  OpenAIResponseMessage,
  OpenAIToolCall,
  OpenAIUsage,
  OpenAIDelta,
} from "../types/openai.js";
import { generateToolCallId } from "../utils/id-generator.js";
import { logger } from "../utils/logger.js";

export interface ClaudeContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
}

export interface ClaudeMessage {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: ClaudeContentBlock[];
  };
  result?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface ConvertedContent {
  textContent: string;
  toolCalls: OpenAIToolCall[];
}

export function extractContent(message: ClaudeMessage): ConvertedContent {
  const textParts: string[] = [];
  const toolCalls: OpenAIToolCall[] = [];

  if (!message.message?.content) {
    return { textContent: "", toolCalls: [] };
  }

  for (const block of message.message.content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "tool_use" && block.name) {
      // Log raw tool call for debugging
      logger.info("Converting tool call to OpenAI format", {
        rawBlock: JSON.stringify(block),
        toolName: block.name,
        toolId: block.id,
        toolInput: block.input,
      });

      // Convert Claude tool use to OpenAI tool call format
      const toolCall: OpenAIToolCall = {
        id: block.id || generateToolCallId(),
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      };

      logger.info("Converted tool call", {
        convertedToolCall: JSON.stringify(toolCall),
      });

      toolCalls.push(toolCall);
    }
  }

  return {
    textContent: textParts.join("\n"),
    toolCalls,
  };
}

export function extractUsage(message: ClaudeMessage): OpenAIUsage {
  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;

  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

export function buildChatCompletion(
  id: string,
  model: string,
  content: string | null,
  toolCalls: OpenAIToolCall[],
  usage: OpenAIUsage
): OpenAIChatCompletion {
  const message: OpenAIResponseMessage = {
    role: "assistant",
    content,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
      },
    ],
    usage,
  };
}

export function buildInitialChunk(id: string, model: string): OpenAIChatCompletionChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null,
      },
    ],
  };
}

export function buildContentChunk(
  id: string,
  model: string,
  content: string
): OpenAIChatCompletionChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  };
}

export function buildToolCallChunk(
  id: string,
  model: string,
  toolCalls: OpenAIToolCall[],
  isInitial: boolean
): OpenAIChatCompletionChunk {
  const delta: OpenAIDelta = {
    tool_calls: toolCalls.map((tc, index) => ({
      index,
      ...(isInitial
        ? {
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }
        : {
            function: {
              arguments: tc.function.arguments,
            },
          }),
    })),
  };

  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: null,
      },
    ],
  };
}

export function buildFinalChunk(
  id: string,
  model: string,
  hasToolCalls: boolean
): OpenAIChatCompletionChunk {
  return {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: hasToolCalls ? "tool_calls" : "stop",
      },
    ],
  };
}
