import type { OpenAIMessage, OpenAIChatRequest, OpenAIContentPart } from "../types/openai.js";

export interface ClaudePrompt {
  prompt: string;
  systemPrompt?: string;
}

// Extract text content from message (handles string or array)
function getTextContent(content: string | OpenAIContentPart[] | null): string {
  if (content === null) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  // Array of content parts - extract text parts
  return content
    .filter((part): part is OpenAIContentPart & { type: "text"; text: string } =>
      part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join("\n");
}

export function convertOpenAIToClaude(request: OpenAIChatRequest): ClaudePrompt {
  const { messages } = request;

  if (!messages || messages.length === 0) {
    throw new Error("Messages array is required and cannot be empty");
  }

  // Extract system message if present
  let systemPrompt: string | undefined;
  const conversationMessages: OpenAIMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      // Concatenate multiple system messages if present
      const content = getTextContent(message.content);
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${content}`
        : content;
    } else {
      conversationMessages.push(message);
    }
  }

  // If only one user message, use it directly as the prompt
  if (conversationMessages.length === 1 && conversationMessages[0].role === "user") {
    return {
      prompt: getTextContent(conversationMessages[0].content),
      systemPrompt,
    };
  }

  // Format multi-turn conversation
  const formattedConversation = formatConversation(conversationMessages);

  return {
    prompt: formattedConversation,
    systemPrompt,
  };
}

function formatConversation(messages: OpenAIMessage[]): string {
  if (messages.length === 0) {
    return "";
  }

  // If there's only one message, return it directly
  if (messages.length === 1) {
    return getTextContent(messages[0].content);
  }

  // Find the last user message to use as the current request
  const lastUserIndex = findLastIndex(messages, (m) => m.role === "user");

  if (lastUserIndex === -1) {
    // No user message found, format all as history
    return messages
      .map((m) => formatMessage(m))
      .join("\n\n");
  }

  const history = messages.slice(0, lastUserIndex);
  const currentRequest = messages[lastUserIndex];
  const afterCurrent = messages.slice(lastUserIndex + 1);

  const parts: string[] = [];

  if (history.length > 0) {
    parts.push("Previous conversation:");
    parts.push(history.map((m) => formatMessage(m)).join("\n\n"));
    parts.push("");
  }

  if (afterCurrent.length > 0) {
    // Include any messages after the last user message (like tool results)
    parts.push(afterCurrent.map((m) => formatMessage(m)).join("\n\n"));
    parts.push("");
  }

  parts.push("Current request:");
  parts.push(getTextContent(currentRequest.content));

  return parts.join("\n");
}

function formatMessage(message: OpenAIMessage): string {
  const roleLabel = getRoleLabel(message.role);
  let content = getTextContent(message.content);

  // Include tool calls in the formatted message
  if (message.tool_calls && message.tool_calls.length > 0) {
    const toolCallsStr = message.tool_calls
      .map((tc) => `[Tool Call: ${tc.function.name}(${tc.function.arguments})]`)
      .join("\n");
    content = content ? `${content}\n${toolCallsStr}` : toolCallsStr;
  }

  // Include tool call ID for tool responses
  if (message.role === "tool" && message.tool_call_id) {
    return `Tool Result (${message.tool_call_id}): ${content}`;
  }

  return `${roleLabel}: ${content}`;
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "user":
      return "User";
    case "assistant":
      return "Assistant";
    case "tool":
      return "Tool";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) {
      return i;
    }
  }
  return -1;
}
