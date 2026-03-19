import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "target",
  "vendor", "__pycache__", ".venv", "venv", "env", "coverage", ".cache",
  ".idea", ".vscode",
]);

const LIMIT = 100;

function matchGlob(pattern: string, name: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`).test(name);
}

export async function executeGlob(
  args: { pattern: string; path?: string },
  workspaceFolder: string,
): Promise<string> {
  const searchDir = args.path
    ? (path.isAbsolute(args.path) ? args.path : path.resolve(workspaceFolder, args.path))
    : workspaceFolder;

  if (!searchDir.startsWith(workspaceFolder)) {
    return "Error: Path traversal not allowed.";
  }

  if (!fs.existsSync(searchDir) || !fs.statSync(searchDir).isDirectory()) {
    return `Error: Not a directory: ${searchDir}`;
  }

  const results: Array<{ path: string; mtime: number }> = [];

  function walk(dir: string) {
    if (results.length >= LIMIT) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= LIMIT) break;
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const relative = path.relative(searchDir, full);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          if (matchGlob(args.pattern, relative) || matchGlob(args.pattern, entry.name)) {
            try {
              const stat = fs.statSync(full);
              results.push({ path: path.resolve(full), mtime: stat.mtimeMs });
            } catch {
              // skip
            }
          }
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  walk(searchDir);
  results.sort((a, b) => b.mtime - a.mtime);

  if (results.length === 0) return "No files found";

  let output = "";
  for (const r of results) {
    output += r.path + "\n";
  }
  if (results.length >= LIMIT) {
    output += `\n(Results truncated: showing first ${LIMIT} results)`;
  }

  return output;
}
