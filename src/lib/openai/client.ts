import { getModelById } from "./models";
import { TOOL_DEFINITIONS } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/executor";
import type { ToolDefinition } from "@/lib/tools/types";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamEvent {
  type:
    | "text_delta"
    | "text_done"
    | "tool_call_start"
    | "tool_call_done"
    | "tool_result"
    | "error"
    | "done";
  content?: string;
  error?: string;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: string;
  toolResult?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: string;
  result: string;
}

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

const CHATGPT_BASE_URL = "https://chatgpt.com/backend-api/codex";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

function isChatGptToken(token: string): boolean {
  return !token.startsWith("sk-") && token.split(".").length === 3;
}

function buildInstructions(workspaceFolder?: string, mode?: string): string {
  let instructions = "You are a helpful coding assistant. Be concise and direct.\n\n";
  instructions += "You have access to tools that let you interact with the local filesystem, run commands, and search the web. ";
  instructions += "Use them proactively when the user asks about files, code, or anything that requires accessing local data.\n\n";
  instructions += "When listing or reading files, prefer the specialized tools (list, read, glob, grep) over bash commands.\n";
  instructions += "When editing files, use the edit tool for targeted changes and write for creating new files.\n";
  instructions += "When you include code in responses, always use fenced markdown code blocks with an explicit language (for example ```ts or ```bash).\n";
  if (workspaceFolder) {
    instructions += `\nThe current workspace folder is: ${workspaceFolder}\n`;
  }
  if (mode === "plan") {
    instructions += "\n## Mode: Plan\n";
    instructions += "You are in PLAN mode. Do NOT write code, edit files, or execute commands.\n";
    instructions += "Instead, think through the problem and provide a detailed plan with:\n";
    instructions += "- What files need to be created or modified\n";
    instructions += "- What changes need to be made in each file\n";
    instructions += "- The order of operations\n";
    instructions += "- Any potential risks or edge cases\n";
    instructions += "Be thorough but concise. When the user switches to Build mode, you will execute the plan.\n";
  } else {
    instructions += "\n## Mode: Build\n";
    instructions += "You are in BUILD mode. Execute the task: write code, edit files, run commands as needed.\n";
    instructions += "Be proactive — use tools to explore the codebase, make changes, and verify your work.\n";
  }
  return instructions;
}

interface CollectedToolCall {
  callId: string;
  name: string;
  arguments: string;
}

async function streamResponse(
  apiKey: string,
  input: Array<Record<string, unknown>>,
  model: string,
  tools: ToolDefinition[],
  reasoningEffort: ReasoningEffort,
  instructions: string,
): Promise<{ textDeltas: string[]; toolCalls: CollectedToolCall[]; done: boolean }> {
  const useChatGptEndpoint = isChatGptToken(apiKey);
  const baseUrl = useChatGptEndpoint ? CHATGPT_BASE_URL : OPENAI_BASE_URL;
  const endpoint = `${baseUrl}/responses`;

  const modelDef = getModelById(model);
  const body: Record<string, unknown> = {
    model: modelDef?.apiModel || model,
    instructions,
    input,
    stream: true,
    store: false,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  if (modelDef?.supportsReasoning) {
    body.reasoning = {
      effort: reasoningEffort === "xhigh" ? "high" : reasoningEffort,
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const textDeltas: string[] = [];
  const toolCalls: CollectedToolCall[] = [];
  const toolCallArgs = new Map<string, string>();
  const toolCallNames = new Map<string, string>();
  let responseDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        responseDone = true;
        break;
      }

      try {
        const event = JSON.parse(data);

        if (event.type === "response.output_text.delta") {
          textDeltas.push(event.delta || "");
        } else if (event.type === "response.content_part.delta") {
          if (event.delta?.text) {
            textDeltas.push(event.delta.text);
          }
        } else if (event.type === "response.output_item.added") {
          if (event.item?.type === "function_call") {
            const callId = event.item.call_id || event.item.id;
            toolCallNames.set(callId, event.item.name);
            toolCallArgs.set(callId, "");
          }
        } else if (event.type === "response.function_call_arguments.delta") {
          const callId = event.item_id || event.call_id;
          if (callId) {
            const existing = toolCallArgs.get(callId) || "";
            toolCallArgs.set(callId, existing + (event.delta || ""));
          }
        } else if (event.type === "response.output_item.done") {
          if (event.item?.type === "function_call") {
            const callId = event.item.call_id || event.item.id;
            const name = event.item.name || toolCallNames.get(callId) || "";
            const args = event.item.arguments || toolCallArgs.get(callId) || "";
            toolCalls.push({ callId: callId!, name, arguments: args });
          }
        } else if (
          event.type === "response.completed" ||
          event.type === "response.done"
        ) {
          responseDone = true;
        } else if (event.type === "error") {
          throw new Error(event.message || "Unknown API error");
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("API error")) throw err;
      }
    }

    if (responseDone) break;
  }

  return { textDeltas, toolCalls, done: responseDone };
}

export async function* streamChat(
  apiKey: string,
  messages: ChatMessage[],
  modelId: string,
  reasoningEffort: ReasoningEffort = "medium",
  workspaceFolder?: string,
  mode?: string,
): AsyncGenerator<StreamEvent> {
  const modelDef = getModelById(modelId);
  if (!modelDef) {
    yield { type: "error", error: `Onbekend model: ${modelId}` };
    return;
  }

  const tools = TOOL_DEFINITIONS;
  const instructions = buildInstructions(workspaceFolder, mode);

  const input: Array<Record<string, unknown>> = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const readFiles = new Set<string>();
  const toolCallRecords: ToolCallRecord[] = [];
  const maxIterations = 20;

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const { textDeltas, toolCalls, done } = await streamResponse(
        apiKey,
        input,
        modelId,
        tools,
        reasoningEffort,
        instructions,
      );

      for (const delta of textDeltas) {
        yield { type: "text_delta", content: delta };
      }

      if (done && toolCalls.length === 0) {
        yield { type: "done" };
        return;
      }

      if (toolCalls.length === 0) {
        yield { type: "done" };
        return;
      }

      for (const tc of toolCalls) {
        yield {
          type: "tool_call_start",
          toolCallId: tc.callId,
          toolName: tc.name,
          toolArguments: tc.arguments,
        };

        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments);
        } catch {
          parsedArgs = {};
        }

        const result = await executeTool(tc.name, parsedArgs, workspaceFolder || process.cwd(), readFiles);

        const resultText = result.error
          ? `Error: ${result.error}`
          : result.output;

        toolCallRecords.push({
          id: tc.callId,
          name: tc.name,
          arguments: tc.arguments,
          result: resultText,
        });

        yield {
          type: "tool_result",
          toolCallId: tc.callId,
          toolName: tc.name,
          toolResult: resultText,
        };

        input.push({
          type: "function_call",
          id: `fc_${tc.callId.replace("call_", "")}`,
          call_id: tc.callId,
          name: tc.name,
          arguments: tc.arguments,
        });

        input.push({
          type: "function_call_output",
          call_id: tc.callId,
          output: resultText,
        });
      }
    }

    yield { type: "error", error: "Max tool call iterations reached" };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
