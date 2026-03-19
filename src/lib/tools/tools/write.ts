import fs from "fs";
import path from "path";

export async function executeWrite(
  args: { content: string; filePath: string },
  workspaceFolder: string,
  readFiles: Set<string>,
): Promise<string> {
  let filepath = args.filePath;
  if (!path.isAbsolute(filepath)) {
    filepath = path.resolve(workspaceFolder, filepath);
  }

  if (!filepath.startsWith(workspaceFolder)) {
    return "Error: Path traversal not allowed.";
  }

  const exists = fs.existsSync(filepath);

  if (exists && !readFiles.has(filepath)) {
    return `Error: You must read the file first before writing to it: ${filepath}`;
  }

  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, args.content, "utf-8");

  return `Successfully wrote ${exists ? "to" : "new"} file: ${path.relative(workspaceFolder, filepath)}`;
}
