import fs from "fs";
import path from "path";

const DEFAULT_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

const BINARY_EXTENSIONS = new Set([
  ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class", ".jar", ".war",
  ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".bin", ".dat",
  ".obj", ".o", ".a", ".lib", ".wasm", ".pyc", ".pyo",
]);

function isBinary(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  try {
    const buf = Buffer.from(fs.readFileSync(filepath).subarray(0, 4096));
    let nonPrintable = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0) return true;
      if (buf[i] < 9 || (buf[i] > 13 && buf[i] < 32)) nonPrintable++;
    }
    return buf.length > 0 && nonPrintable / buf.length > 0.3;
  } catch {
    return false;
  }
}

export async function executeRead(
  args: { filePath?: string; offset?: number; limit?: number },
  workspaceFolder: string,
): Promise<string> {
  const offset = args.offset ?? 1;
  const limit = args.limit ?? DEFAULT_LIMIT;

  if (offset < 1) return "Error: offset must be >= 1";

  let filepath = args.filePath || ".";
  if (!path.isAbsolute(filepath)) {
    filepath = path.resolve(workspaceFolder, filepath);
  }

  if (!filepath.startsWith(workspaceFolder)) {
    return "Error: Path traversal not allowed.";
  }

  if (!fs.existsSync(filepath)) {
    return `Error: File not found: ${filepath}`;
  }

  const stat = fs.statSync(filepath);

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filepath, { withFileTypes: true });
    const sorted = entries
      .map((e) => e.name + (e.isDirectory() ? "/" : ""))
      .sort((a, b) => a.localeCompare(b));

    let output = `<path>${filepath}</path>\n<type>directory</type>\n<entries>\n`;
    output += sorted.join("\n");
    output += `\n(${sorted.length} entries)\n</entries>`;
    return output;
  }

  if (isBinary(filepath)) {
    return `Error: Cannot read binary file: ${filepath}`;
  }

  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const start = offset - 1;
  const end = start + limit;
  const sliced = lines.slice(start, end);
  const hasMore = end < lines.length;

  const numbered = sliced.map((line, i) => {
    const num = i + offset;
    const truncated = line.length > MAX_LINE_LENGTH
      ? line.substring(0, MAX_LINE_LENGTH) + `... (line truncated to ${MAX_LINE_LENGTH} chars)`
      : line;
    return `${num}: ${truncated}`;
  });

  let output = `<path>${filepath}</path>\n<type>file</type>\n<content>\n`;
  output += numbered.join("\n");

  if (hasMore) {
    output += `\n\n(Showing lines ${offset}-${offset + sliced.length - 1} of ${lines.length}. Use offset=${offset + sliced.length} to continue.)`;
  } else {
    output += `\n\n(End of file - total ${lines.length} lines)`;
  }
  output += "\n</content>";

  return output;
}
