export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: "running" | "completed" | "error";
  error?: string;
}

export interface ToolContext {
  workspaceFolder: string;
  sessionId: string;
}
