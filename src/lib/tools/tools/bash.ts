import { exec } from "child_process";
import path from "path";

const DEFAULT_TIMEOUT = 120_000;
const MAX_OUTPUT_LENGTH = 100_000;

export async function executeBash(
  args: { command: string; timeout?: number; workdir?: string; description?: string },
  workspaceFolder: string,
  signal?: AbortSignal,
): Promise<string> {
  const cwd = args.workdir
    ? (path.isAbsolute(args.workdir) ? args.workdir : path.resolve(workspaceFolder, args.workdir))
    : workspaceFolder;

  if (!cwd.startsWith(workspaceFolder) && !cwd.startsWith(path.dirname(workspaceFolder))) {
    return "Error: Path traversal not allowed.";
  }

  if (!args.command || typeof args.command !== "string") {
    return "Error: command is required.";
  }

  const timeout = args.timeout ?? DEFAULT_TIMEOUT;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve("Error: Aborted");
      return;
    }

    const proc = exec(args.command, {
      cwd,
      timeout,
      maxBuffer: MAX_OUTPUT_LENGTH * 2,
      shell: "/bin/bash",
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;
      if (code !== null && code !== 0) {
        output += `\nProcess exited with code ${code}`;
      }
      if (output.length > MAX_OUTPUT_LENGTH) {
        output = output.slice(0, MAX_OUTPUT_LENGTH) + `\n\n(Output truncated at ${MAX_OUTPUT_LENGTH} chars)`;
      }
      if (!output.trim()) output = "(no output)";
      resolve(output);
    });

    signal?.addEventListener("abort", () => {
      try {
        proc.kill("SIGTERM");
        setTimeout(() => proc.kill("SIGKILL"), 500);
      } catch {
        // ignore
      }
    }, { once: true });

    proc.on("error", (err) => {
      resolve(`Error: ${err.message}`);
    });
  });
}
