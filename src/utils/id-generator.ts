import { nanoid } from "nanoid";

export function generateCompletionId(): string {
  return `chatcmpl-${nanoid(24)}`;
}

export function generateToolCallId(): string {
  return `call_${nanoid(24)}`;
}
