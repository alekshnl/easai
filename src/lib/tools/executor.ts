import path from "path";
import { executeList } from "./tools/list";
import { executeRead } from "./tools/read";
import { executeWrite } from "./tools/write";
import { executeEdit } from "./tools/edit";
import { executeBash } from "./tools/bash";
import { executeGlob } from "./tools/glob";
import { executeGrep } from "./tools/grep";
import { executeWebFetch } from "./tools/webfetch";
import { executeWebSearch } from "./tools/websearch";
import { executeTodowrite } from "./tools/todowrite";
import { executeTask } from "./tools/task";

const MAX_RESULT_LENGTH = 100_000;

export interface ToolExecuteResult {
  output: string;
  error?: string;
}

export interface WorkerToolContext {
  apiKey?: string;
  model?: string;
  provider?: "openai" | "zai";
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceFolder: string,
  readFiles: Set<string>,
  workerContext?: WorkerToolContext,
  signal?: AbortSignal,
): Promise<ToolExecuteResult> {
  if (signal?.aborted) {
    return { output: "", error: "Aborted" };
  }

  try {
    let output: string;

    switch (name) {
      case "list":
        output = await executeList(
          { path: args.path as string | undefined, ignore: args.ignore as string[] | undefined },
          workspaceFolder,
        );
        break;

      case "read":
        output = await executeRead(
          { filePath: args.filePath as string | undefined, offset: args.offset as number | undefined, limit: args.limit as number | undefined },
          workspaceFolder,
        );
        if (!output.startsWith("Error:")) {
          const filePath = (args.filePath as string) || ".";
          const resolved = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(workspaceFolder, filePath);
          readFiles.add(resolved);
        }
        break;

      case "write":
        output = await executeWrite(
          { content: args.content as string, filePath: args.filePath as string },
          workspaceFolder,
          readFiles,
        );
        break;

      case "edit":
        output = await executeEdit(
          { filePath: args.filePath as string, oldString: args.oldString as string, newString: args.newString as string, replaceAll: args.replaceAll as boolean | undefined },
          workspaceFolder,
          readFiles,
        );
        break;

      case "bash":
        output = await executeBash(
          { command: args.command as string, timeout: args.timeout as number | undefined, workdir: args.workdir as string | undefined, description: args.description as string | undefined },
          workspaceFolder,
          signal,
        );
        break;

      case "glob":
        output = await executeGlob(
          { pattern: args.pattern as string, path: args.path as string | undefined },
          workspaceFolder,
        );
        break;

      case "grep":
        output = await executeGrep(
          { pattern: args.pattern as string, path: args.path as string | undefined, include: args.include as string | undefined },
          workspaceFolder,
        );
        break;

      case "webfetch":
        output = await executeWebFetch(
          { url: args.url as string, format: args.format as string | undefined, timeout: args.timeout as number | undefined },
        );
        break;

      case "websearch":
        output = await executeWebSearch(
          { query: args.query as string, numResults: args.numResults as number | undefined },
        );
        break;

      case "todowrite":
        output = await executeTodowrite(
          { todos: args.todos as Array<{ content: string; status: string; priority?: string }> },
        );
        break;

      case "task":
        if (!workerContext?.apiKey || !workerContext?.model || !workerContext?.provider) {
          output = "Error: Task tool requires API key, model, and provider context";
          break;
        }
        output = await executeTask(
          { prompt: args.prompt as string },
          {
            apiKey: workerContext.apiKey,
            model: workerContext.model,
            provider: workerContext.provider,
            workspaceFolder,
          },
          signal,
        );
        break;

      default:
        output = `Error: Unknown tool: ${name}`;
        break;
    }

    if (output.length > MAX_RESULT_LENGTH) {
      output = output.slice(0, MAX_RESULT_LENGTH) + `\n\n(Output truncated at ${MAX_RESULT_LENGTH} chars)`;
    }

    return { output };
  } catch (err) {
    return {
      output: "",
      error: `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
