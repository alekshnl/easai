import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "target",
  "vendor", "__pycache__", ".venv", "venv", "env", "coverage", ".cache",
]);

const LIMIT = 100;
const MAX_LINE_LENGTH = 2000;

const INCLUDE_EXTENSIONS: Record<string, string[]> = {
  "*.js": [".js", ".mjs", ".cjs"],
  "*.ts": [".ts", ".mts", ".cts"],
  "*.tsx": [".tsx"],
  "*.jsx": [".jsx"],
  "*.py": [".py"],
  "*.rb": [".rb"],
  "*.go": [".go"],
  "*.rs": [".rs"],
  "*.java": [".java"],
  "*.css": [".css", ".scss", ".sass", ".less"],
  "*.html": [".html", ".htm"],
  "*.json": [".json"],
  "*.md": [".md", ".mdx"],
  "*.yaml": [".yaml", ".yml"],
  "*.toml": [".toml"],
  "*.sql": [".sql"],
  "*.sh": [".sh", ".bash", ".zsh"],
};

function shouldInclude(filepath: string, includePattern?: string): boolean {
  if (!includePattern) return true;
  const exts = INCLUDE_EXTENSIONS[includePattern.toLowerCase()];
  if (exts) {
    const ext = path.extname(filepath).toLowerCase();
    return exts.includes(ext);
  }
  // Simple glob-style include
  const pattern = includePattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(pattern, "i").test(filepath);
}

function isTextFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  const binaryExts = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".zip", ".tar", ".gz", ".7z", ".rar",
    ".exe", ".dll", ".so", ".dylib",
    ".wasm", ".pyc", ".class", ".jar",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".pdf", ".mp3", ".mp4", ".avi", ".mov",
  ]);
  if (binaryExts.has(ext)) return false;
  return true;
}

export async function executeGrep(
  args: { pattern: string; path?: string; include?: string },
  workspaceFolder: string,
): Promise<string> {
  if (!args.pattern) return "Error: pattern is required";

  const searchDir = args.path
    ? (path.isAbsolute(args.path) ? args.path : path.resolve(workspaceFolder, args.path))
    : workspaceFolder;

  if (!searchDir.startsWith(workspaceFolder)) {
    return "Error: Path traversal not allowed.";
  }

  let regex: RegExp;
  try {
    regex = new RegExp(args.pattern, "i");
  } catch (e) {
    return `Error: Invalid regex pattern: ${e}`;
  }

  const matches: Array<{ filePath: string; modTime: number; lineNum: number; lineText: string }> = [];

  function walk(dir: string) {
    if (matches.length >= LIMIT) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= LIMIT) break;
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (isTextFile(full) && shouldInclude(full, args.include)) {
          try {
            const stat = fs.statSync(full);
            const content = fs.readFileSync(full, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  filePath: full,
                  modTime: stat.mtimeMs,
                  lineNum: i + 1,
                  lineText: lines[i].trim().slice(0, MAX_LINE_LENGTH),
                });
                if (matches.length >= LIMIT) break;
              }
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip inaccessible dirs
    }
  }

  walk(searchDir);
  matches.sort((a, b) => b.modTime - a.modTime);

  if (matches.length === 0) return "No files found";

  const truncated = matches.length >= LIMIT;
  const display = truncated ? matches.slice(0, LIMIT) : matches;

  let output = `Found ${matches.length} match${matches.length > 1 ? "es" : ""}${truncated ? ` (showing first ${LIMIT})` : ""}\n\n`;

  let currentFile = "";
  for (const match of display) {
    if (currentFile !== match.filePath) {
      if (currentFile !== "") output += "\n";
      currentFile = match.filePath;
      output += match.filePath + ":\n";
    }
    output += `  Line ${match.lineNum}: ${match.lineText}\n`;
  }

  if (truncated) {
    output += `\n(Results truncated: showing ${LIMIT} of ${matches.length} matches)`;
  }

  return output;
}
