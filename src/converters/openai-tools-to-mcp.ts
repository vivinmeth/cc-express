import { createSdkMcpServer, tool } from "@anthropic-ai/claude-code";
import { z } from "zod";
import type { OpenAITool } from "../types/openai.js";
import { logger } from "../utils/logger.js";

/**
 * Convert JSON Schema to Zod schema
 * This is a simplified converter that handles common cases
 */
function jsonSchemaToZod(schema: Record<string, unknown> | undefined): Record<string, z.ZodTypeAny> {
  if (!schema || !schema.properties) {
    return {};
  }

  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const required = (schema.required as string[]) || [];
  const zodShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    let zodType: z.ZodTypeAny;

    switch (propSchema.type) {
      case "string":
        zodType = z.string();
        if (propSchema.enum) {
          zodType = z.enum(propSchema.enum as [string, ...string[]]);
        }
        break;
      case "number":
      case "integer":
        zodType = z.number();
        break;
      case "boolean":
        zodType = z.boolean();
        break;
      case "array":
        zodType = z.array(z.any());
        break;
      case "object":
        zodType = z.record(z.string(), z.any());
        break;
      default:
        zodType = z.any();
    }

    // Add description if present
    if (propSchema.description) {
      zodType = zodType.describe(propSchema.description as string);
    }

    // Make optional if not required
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    zodShape[key] = zodType;
  }

  return zodShape;
}

/**
 * Convert OpenAI tools to MCP server configuration
 */
export function createMcpServerFromOpenAITools(tools: OpenAITool[]) {
  if (!tools || tools.length === 0) {
    return null;
  }

  logger.info("Converting OpenAI tools to MCP format", {
    toolCount: tools.length,
    toolNames: tools.map(t => t.function.name),
  });

  const mcpTools = tools.map(openaiTool => {
    const { name, description, parameters } = openaiTool.function;

    const zodSchema = jsonSchemaToZod(parameters);

    logger.debug("Converted tool to MCP", {
      name,
      description,
      parameterKeys: Object.keys(zodSchema),
    });

    return tool(
      name,
      description || `Tool: ${name}`,
      zodSchema,
      async (args) => {
        // This handler is called when Claude uses the tool
        // Since we're using canUseTool to deny execution, this shouldn't be called
        // But if it is, we return a message indicating the tool call was captured
        logger.info("Tool handler invoked (should not happen with deny)", {
          toolName: name,
          args,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "tool_call_captured",
                tool: name,
                arguments: args,
              }),
            },
          ],
        };
      }
    );
  });

  const mcpServer = createSdkMcpServer({
    name: "client-tools",
    version: "1.0.0",
    tools: mcpTools,
  });

  logger.info("Created MCP server with client tools", {
    serverName: "client-tools",
    toolCount: mcpTools.length,
  });

  return mcpServer;
}

/**
 * Get the list of tool names for allowedTools config
 */
export function getMcpToolNames(tools: OpenAITool[]): string[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  // MCP tools are prefixed with the server name pattern
  // Format: mcp__<server-name>__<tool-name>
  return tools.map(t => `mcp__client-tools__${t.function.name}`);
}
