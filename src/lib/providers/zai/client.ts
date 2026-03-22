import { getModelById } from "@/lib/models";
import { TOOL_DEFINITIONS } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/executor";
import { getProviderInstruction } from "@/lib/db/provider-instructions";
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
  workerId?: string;
}

const ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions";

async function buildSystemMessage(
  workspaceFolder?: string,
  mode?: string,
  provider?: string,
  isFirstPrompt?: boolean
): Promise<string> {
  let system = "You are a helpful coding assistant. Be concise and direct.\n\n";
  system += "You have access to tools that let you interact with the local filesystem, run commands, and search the web. ";
  system += "Use them proactively when the user asks about files, code, or anything that requires accessing local data.\n\n";
  system += "When listing or reading files, prefer the specialized tools (list, read, glob, grep) over bash commands.\n";
  system += "When editing files, use the edit tool for targeted changes and write for creating new files.\n";
  system += "When you include code in responses, always use fenced markdown code blocks with an explicit language (for example ```ts or ```bash).\n";
  if (workspaceFolder) {
    system += `\nThe current workspace folder is: ${workspaceFolder}\n`;
  }
  system += "\n## Parallel Workers (task tool)\n";
  system += "You MUST use workers proactively for efficiency. When a task involves:\n";
  system += "- Multiple independent files or modules → Assign each to a different worker\n";
  system += "- Searching AND implementing → One worker searches, others implement\n";
  system += "- Complex multi-file changes → Parallelize across workers\n";
  system += "\nRules:\n";
  system += "- ALWAYS start multiple workers in a SINGLE message (multiple task tool calls)\n";
  system += "- Assign DIFFERENT files to each worker to avoid conflicts\n";
  system += "- Be specific in each worker's prompt: exact files, exact changes\n";
  system += "- Collect all results and summarize for the user\n";
  system += "- Example:3 workers = 3 task calls in one message, each with different files\n";
  if (mode === "plan") {
    system += "\n## Mode: Plan\n";
    system += "You are in PLAN mode. Do NOT write code, edit files, or execute commands.\n";
    system += "Instead, think through the problem and provide a detailed plan.\n";
    system += "Be thorough but concise. When the user switches to Build mode, you will execute the plan.\n";
  } else {
    system += "\n## Mode: Build\n";
    system += "You are in BUILD mode. Execute the task: write code, edit files, run commands as needed.\n";
    system += "Be proactive — use tools to explore the codebase, make changes, and verify your work.\n";
  }

  if (provider && mode) {
    try {
      const config = await getProviderInstruction(provider, mode);
      const shouldInclude = config?.repeatEveryPrompt || isFirstPrompt;

      if (shouldInclude && config?.instruction) {
        system += "\n\n## Custom Instructions\n";
        system += config.instruction;
      }
    } catch (error) {
      console.error("Error fetching provider instruction:", error);
    }
  }

  return system;
}

interface CollectedToolCall {
  id: string;
  name: string;
  arguments: string;
}

async function* streamZaiResponse(
  token: string,
  messages: Array<Record<string, unknown>>,
  model: string,
  tools: ToolDefinition[],
  systemMessage: string,
  signal?: AbortSignal,
): AsyncGenerator<{ type: "text_delta" | "tool_call"; content?: string; toolCall?: CollectedToolCall }> {
  const modelDef = getModelById(model);
  const apiModel = modelDef?.apiModel || model;

  const body: Record<string, unknown> = {
    model: apiModel,
    messages,
    stream: true,
    thinking: { type: "enabled", clear_thinking: false },
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const response = await fetch(ZAI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Z.AI API error (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallArgs = new Map<string, string>();
  const toolCallNames = new Map<string, string>();

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
        for (const [id, name] of toolCallNames) {
          const args = toolCallArgs.get(id) || "";
          yield { type: "tool_call", toolCall: { id, name, arguments: args } };
        }
        return;
      }

      try {
        const event = JSON.parse(data);
        const delta = event.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          yield { type: "text_delta", content: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const tcId = tc.id;
            if (tcId) {
              if (!toolCallNames.has(tcId)) {
                toolCallNames.set(tcId, tc.function?.name || "unknown");
                toolCallArgs.set(tcId, "");
              }
            }
            if (tc.function?.arguments) {
              const targetId = tcId || (tc.index !== undefined ? [...toolCallArgs.keys()][tc.index] : null);
              if (targetId) {
                const existing = toolCallArgs.get(targetId) || "";
                toolCallArgs.set(targetId, existing + tc.function.arguments);
              }
            }
          }
        }

        if (event.choices?.[0]?.finish_reason === "tool_calls" || event.choices?.[0]?.finish_reason === "stop") {
          for (const [id, name] of toolCallNames) {
            const args = toolCallArgs.get(id) || "";
            yield { type: "tool_call", toolCall: { id, name, arguments: args } };
          }
          return;
        }
      } catch {
        // skip malformed events
      }
    }
  }

  for (const [id, name] of toolCallNames) {
    const args = toolCallArgs.get(id) || "";
    yield { type: "tool_call", toolCall: { id, name, arguments: args } };
  }
}

export async function* streamChatZai(
  token: string,
  messages: ChatMessage[],
  modelId: string,
  _reasoningEffort: string,
  workspaceFolder?: string,
  mode?: string,
  provider?: string,
  isFirstPrompt?: boolean,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const modelDef = getModelById(modelId);
  if (!modelDef) {
    yield { type: "error", error: `Onbekend model: ${modelId}` };
    return;
  }

  const tools = TOOL_DEFINITIONS;
  const systemMessage = await buildSystemMessage(workspaceFolder, mode, provider, isFirstPrompt);

  const apiMessages: Array<Record<string, unknown>> = [
    { role: "system", content: systemMessage },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const readFiles = new Set<string>();
  const toolCallRecords: ToolCallRecord[] = [];
  const maxIterations = 20;

  try {
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const toolCalls: CollectedToolCall[] = [];

      for await (const event of streamZaiResponse(token, apiMessages, modelId, tools, systemMessage, signal)) {
        if (event.type === "text_delta") {
          yield { type: "text_delta", content: event.content };
        } else if (event.type === "tool_call" && event.toolCall) {
          toolCalls.push(event.toolCall);
        }
      }

      if (toolCalls.length === 0) {
        yield { type: "done" };
        return;
      }

      for (const tc of toolCalls) {
        yield {
          type: "tool_call_start",
          toolCallId: tc.id,
          toolName: tc.name,
          toolArguments: tc.arguments,
        };
      }

      const pending = new Map<number, Promise<{ tc: CollectedToolCall; resultText: string }>>();

      for (const [index, tc] of toolCalls.entries()) {
        const promise = (async () => {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.arguments);
          } catch {
            parsedArgs = {};
          }

          const result = await executeTool(
            tc.name,
            parsedArgs,
            workspaceFolder || process.cwd(),
            readFiles,
            { apiKey: token, model: modelId, provider: "zai" },
            signal,
          );

          const resultText = result.error ? `Error: ${result.error}` : result.output;
          return { tc, resultText };
        })();

        pending.set(index, promise);
      }

      while (pending.size > 0) {
        const raced = await Promise.race(
          Array.from(pending.entries()).map(([index, promise]) =>
            promise
              .then((value) => ({ index, value }))
              .catch((err) => ({
                index,
                value: {
                  tc: toolCalls[index],
                  resultText: `Error: ${err instanceof Error ? err.message : String(err)}`,
                },
              }))
          )
        );

        pending.delete(raced.index);

        const { tc, resultText } = raced.value;
        toolCallRecords.push({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          result: resultText,
        });

        yield {
          type: "tool_result",
          toolCallId: tc.id,
          toolName: tc.name,
          toolResult: resultText,
        };

        apiMessages.push({
          role: "assistant",
          tool_calls: [
            {
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            },
          ],
          content: null,
        });

        apiMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultText,
        });
      }
    }

    yield { type: "error", error: "Max tool call iterations reached" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    yield {
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
