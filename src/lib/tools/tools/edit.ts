import fs from "fs";
import path from "path";

function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n");
}

function detectLineEnding(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function convertToLineEnding(text: string, ending: "\n" | "\r\n"): string {
  if (ending === "\n") return text;
  return text.replaceAll("\n", "\r\n");
}

function* simpleReplacer(content: string, find: string) {
  yield find;
}

function* lineTrimmedReplacer(content: string, find: string) {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      let startIdx = 0;
      for (let k = 0; k < i; k++) startIdx += originalLines[k].length + 1;
      let endIdx = startIdx;
      for (let k = 0; k < searchLines.length; k++) {
        endIdx += originalLines[i + k].length + (k < searchLines.length - 1 ? 1 : 0);
      }
      yield content.substring(startIdx, endIdx);
    }
  }
}

function* whitespaceNormalizedReplacer(content: string, find: string) {
  const normalize = (t: string) => t.replace(/\s+/g, " ").trim();
  const normalizedFind = normalize(find);
  const lines = content.split("\n");
  for (const line of lines) {
    if (normalize(line) === normalizedFind) yield line;
  }
  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length).join("\n");
      if (normalize(block) === normalizedFind) yield block;
    }
  }
}

function* indentationFlexibleReplacer(content: string, find: string) {
  const removeIndent = (text: string) => {
    const lines = text.split("\n");
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return text;
    const min = Math.min(...nonEmpty.map((l) => { const m = l.match(/^(\s*)/); return m ? m[1].length : 0; }));
    return lines.map((l) => (l.trim().length === 0 ? l : l.slice(min))).join("\n");
  };
  const normalized = removeIndent(find);
  const contentLines = content.split("\n");
  const findLines = find.split("\n");
  for (let i = 0; i <= contentLines.length - findLines.length; i++) {
    const block = contentLines.slice(i, i + findLines.length).join("\n");
    if (removeIndent(block) === normalized) yield block;
  }
}

function* multiOccurrenceReplacer(content: string, find: string) {
  let start = 0;
  while (true) {
    const idx = content.indexOf(find, start);
    if (idx === -1) break;
    yield find;
    start = idx + find.length;
  }
}

type Replacer = (content: string, find: string) => Generator<string, void, unknown>;

function replace(
  content: string, oldStr: string, newStr: string, replaceAll: boolean,
): string {
  if (oldStr === newStr) {
    return content;
  }

  const replacers: Replacer[] = [
    simpleReplacer,
    lineTrimmedReplacer,
    whitespaceNormalizedReplacer,
    indentationFlexibleReplacer,
  ];

  for (const replacer of replacers) {
    for (const search of replacer(content, oldStr)) {
      const idx = content.indexOf(search);
      if (idx === -1) continue;
      if (replaceAll) {
        return content.replaceAll(search, newStr);
      }
      const lastIdx = content.lastIndexOf(search);
      if (idx !== lastIdx) continue;
      return content.substring(0, idx) + newStr + content.substring(idx + search.length);
    }
  }

  return `__EDIT_NOT_FOUND__`;
}

export async function executeEdit(
  args: { filePath: string; oldString: string; newString: string; replaceAll?: boolean },
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

  if (!readFiles.has(filepath)) {
    return `Error: You must read the file first before editing it: ${filepath}`;
  }

  if (!fs.existsSync(filepath)) {
    return `Error: File not found: ${filepath}`;
  }

  const contentOld = fs.readFileSync(filepath, "utf-8");
  const ending = detectLineEnding(contentOld);
  const old = convertToLineEnding(normalizeLineEndings(args.oldString), ending);
  const next = convertToLineEnding(normalizeLineEndings(args.newString), ending);

  const result = replace(contentOld, old, next, args.replaceAll || false);

  if (result.startsWith("__EDIT_NOT_FOUND__")) {
    const exactMatch = contentOld.includes(old);
    if (!exactMatch) {
      return "Error: oldString not found in content. It must match exactly, including whitespace, indentation, and line endings.";
    }
    return "Error: Found multiple matches for oldString. Provide more surrounding lines to make the match unique.";
  }

  fs.writeFileSync(filepath, result, "utf-8");

  const relPath = path.relative(workspaceFolder, filepath);
  return `Edit applied successfully to ${relPath}.`;
}
