import fs from "fs";
import path from "path";

const IGNORE_PATTERNS = [
  "node_modules", "__pycache__", ".git", "dist", "build", "target",
  "vendor", "bin", "obj", ".idea", ".vscode", ".zig-cache", "zig-out",
  ".coverage", "coverage", "tmp", "temp", ".cache", "cache", "logs",
  ".venv", "venv", "env", ".next", ".turbo",
];

const LIMIT = 100;

export async function executeList(
  args: { path?: string; ignore?: string[] },
  workspaceFolder: string,
): Promise<string> {
  const searchPath = path.resolve(workspaceFolder, args.path || ".");
  const ignoreSet = new Set([...IGNORE_PATTERNS, ...(args.ignore || [])]);

  if (!searchPath.startsWith(workspaceFolder)) {
    return "Error: Path traversal not allowed.";
  }

  const stat = fs.statSync(searchPath);
  if (!stat.isDirectory()) {
    return `Error: ${searchPath} is not a directory.`;
  }

  const files: string[] = [];

  function walk(dir: string, prefix: string) {
    if (files.length >= LIMIT) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const entry of sorted) {
        if (files.length >= LIMIT) break;
        if (ignoreSet.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          files.push(relative + "/");
          walk(full, relative);
        } else {
          files.push(relative);
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  walk(searchPath, "");
  const truncated = files.length >= LIMIT;

  let output = searchPath + "/\n";
  for (const f of files) {
    output += f + "\n";
  }
  if (truncated) {
    output += `\n(Showing first ${LIMIT} entries)`;
  }

  return output;
}
