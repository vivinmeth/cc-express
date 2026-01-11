import "dotenv/config";

export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";

export interface Config {
  port: number;
  apiSecret: string;
  workingDir: string;
  allowedTools: string[];
  permissionMode: PermissionMode;
  maxTurns: number;
  noToolExecution: boolean; // Return tool calls without executing them
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function parsePermissionMode(value: string): PermissionMode {
  const validModes: PermissionMode[] = ["default", "acceptEdits", "bypassPermissions", "plan"];
  if (!validModes.includes(value as PermissionMode)) {
    throw new Error(`Invalid PERMISSION_MODE: ${value}. Must be one of: ${validModes.join(", ")}`);
  }
  return value as PermissionMode;
}

export function loadConfig(): Config {
  return {
    port: parseInt(getEnvOrDefault("PORT", "28000"), 10),
    apiSecret: getEnvOrThrow("API_SECRET"),
    workingDir: getEnvOrDefault("WORKING_DIR", process.cwd()),
    allowedTools: getEnvOrDefault("ALLOWED_TOOLS", "Read,Edit,Bash")
      .split(",")
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0),
    permissionMode: parsePermissionMode(getEnvOrDefault("PERMISSION_MODE", "acceptEdits")),
    maxTurns: parseInt(getEnvOrDefault("MAX_TURNS", "50"), 10),
    noToolExecution: getEnvOrDefault("NO_TOOL_EXECUTION", "true").toLowerCase() === "true",
  };
}

export const config = loadConfig();
