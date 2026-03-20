import { runWorkerAgent, type WorkerContext } from "../subagent";
import { executeTool } from "../executor";

export interface TaskParams {
  prompt: string;
}

export async function executeTask(
  args: TaskParams,
  context: {
    apiKey: string;
    model: string;
    provider: "openai" | "zai";
    workspaceFolder: string;
  },
): Promise<string> {
  if (!args.prompt || typeof args.prompt !== "string") {
    return "Error: prompt is required";
  }

  if (!context.apiKey) {
    return "Error: No API key available for worker";
  }

  if (!context.model) {
    return "Error: No model specified for worker";
  }

  const workerContext: WorkerContext = {
    apiKey: context.apiKey,
    model: context.model,
    provider: context.provider,
    workspaceFolder: context.workspaceFolder,
    executeToolFn: async (name, toolArgs, workspaceFolder, readFiles) => {
      return executeTool(name, toolArgs, workspaceFolder, readFiles);
    },
  };

  try {
    const result = await runWorkerAgent(args.prompt, workerContext);

    const truncatedPrompt =
      args.prompt.length > 100 ? args.prompt.slice(0, 100) + "..." : args.prompt;

    return `[Worker completed]
Task: ${truncatedPrompt}

${result}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return `Error: Worker failed - ${errorMessage}`;
  }
}
