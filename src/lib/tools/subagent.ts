import path from "path";
import { TOOL_DEFINITIONS } from "./definitions";
import type { ToolDefinition } from "./types";

interface CollectedToolCall {
  id: string;
  name: string;
  arguments: string;
}

const WORKER_SYSTEM_PROMPT = `You are a worker agent executing a specific task autonomously.

You have full access to all tools: glob, grep, list, read, write, edit, bash, webfetch, websearch, todowrite.

Rules:
- Focus ONLY on your assigned task - do not deviate
- Execute the task completely and report what you changed/created/found
- Be concise in your final report
- Do NOT ask clarifying questions - make reasonable decisions based on available information
- If you encounter errors, try to resolve them or report what blocked you

When done, provide a clear summary of:
1. What files you modified/created (with brief descriptions)
2. What you found (if it was a search task)
3. Any issues encountered`;

const MAX_WORKER_ITERATIONS = 15;
const WORKER_TIMEOUT_MS = 60_000;

function isChatGptToken(token: string): boolean {
  return !token.startsWith("sk-") && token.split(".").length === 3;
}

async function* streamWorkerResponseOpenAI(
  apiKey: string,
  messages: Array<Record<string, unknown>>,
  model: string,
  tools: ToolDefinition[],
): AsyncGenerator<{ type: "text_delta" | "tool_call"; content?: string; toolCall?: CollectedToolCall }> {
  const useChatGptEndpoint = isChatGptToken(apiKey);
  const baseUrl = useChatGptEndpoint
    ? "https://chatgpt.com/backend-api/codex"
    : "https://api.openai.com/v1";
  const endpoint = `${baseUrl}/responses`;

  const body: Record<string, unknown> = {
    model,
    instructions: WORKER_SYSTEM_PROMPT,
    input: messages,
    stream: true,
    store: false,
    tools: tools.map((t) => ({
      type: "function",
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  };

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
    throw new Error(`Worker API error (${response.status}): ${errorText}`);
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
      if (data === "[DONE]") return;

      try {
        const event = JSON.parse(data);

        if (event.type === "response.output_text.delta") {
          yield { type: "text_delta", content: event.delta || "" };
        } else if (event.type === "response.content_part.delta") {
          if (event.delta?.text) {
            yield { type: "text_delta", content: event.delta.text };
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
            yield { type: "tool_call", toolCall: { id: callId!, name, arguments: args } };
          }
        } else if (event.type === "response.completed" || event.type === "response.done") {
          return;
        } else if (event.type === "error") {
          throw new Error(event.message || "Worker API error");
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("API error")) throw err;
      }
    }
  }
}

async function* streamWorkerResponseZai(
  token: string,
  messages: Array<Record<string, unknown>>,
  model: string,
  tools: ToolDefinition[],
): AsyncGenerator<{ type: "text_delta" | "tool_call"; content?: string; toolCall?: CollectedToolCall }> {
  const endpoint = "https://api.z.ai/api/coding/paas/v4/chat/completions";

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: WORKER_SYSTEM_PROMPT },
      ...messages,
    ],
    stream: true,
    thinking: { type: "enabled", clear_thinking: false },
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Worker Z.AI API error (${response.status}): ${errorText}`);
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

export interface WorkerContext {
  apiKey: string;
  model: string;
  provider: "openai" | "zai";
  workspaceFolder: string;
  signal?: AbortSignal;
  executeToolFn: (
    name: string,
    args: Record<string, unknown>,
    workspaceFolder: string,
    readFiles: Set<string>,
  ) => Promise<{ output: string; error?: string }>;
}

export async function runWorkerAgent(
  prompt: string,
  context: WorkerContext,
): Promise<string> {
  const { apiKey, model, provider, workspaceFolder, executeToolFn, signal } = context;

  const tools = TOOL_DEFINITIONS;
  const readFiles = new Set<string>();

  const input: Array<Record<string, unknown>> = [
    { role: "user", content: prompt },
  ];

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error("Worker timeout exceeded")), WORKER_TIMEOUT_MS);
  });

  const workerPromise = async (): Promise<string> => {
    let finalContent = "";

    for (let iteration = 0; iteration < MAX_WORKER_ITERATIONS; iteration++) {
      if (signal?.aborted) {
        throw new DOMException("Worker cancelled", "AbortError");
      }

      const toolCalls: CollectedToolCall[] = [];
      let iterationContent = "";

      const streamGenerator =
        provider === "openai"
          ? streamWorkerResponseOpenAI(apiKey, input, model, tools)
          : streamWorkerResponseZai(apiKey, input, model, tools);

      for await (const event of streamGenerator) {
        if (event.type === "text_delta" && event.content) {
          iterationContent += event.content;
          finalContent = iterationContent;
        } else if (event.type === "tool_call" && event.toolCall) {
          toolCalls.push(event.toolCall);
        }
      }

      if (toolCalls.length === 0) {
        return finalContent || "(Worker completed without output)";
      }

      for (const tc of toolCalls) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.arguments);
        } catch {
          parsedArgs = {};
        }

        if (tc.name === "task") {
          input.push({
            type: "function_call",
            id: `fc_${tc.id.replace("call_", "")}`,
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          });
          input.push({
            type: "function_call_output",
            call_id: tc.id,
            output: "Error: Workers cannot spawn nested workers",
          });
          continue;
        }

        const result = await executeToolFn(tc.name, parsedArgs, workspaceFolder, readFiles);
        const resultText = result.error ? `Error: ${result.error}` : result.output;

        if (provider === "openai") {
          input.push({
            type: "function_call",
            id: `fc_${tc.id.replace("call_", "")}`,
            call_id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          });
          input.push({
            type: "function_call_output",
            call_id: tc.id,
            output: resultText,
          });
        } else {
          input.push({
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
          input.push({
            role: "tool",
            tool_call_id: tc.id,
            content: resultText,
          });
        }
      }
    }

    return finalContent || "(Worker reached max iterations)";
  };

  try {
    return await Promise.race([workerPromise(), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error) {
      return `Worker error: ${error.message}`;
    }
    return "Worker error: Unknown error";
  }
}
