import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

function getGitBranch(workspaceFolder: string): string | null {
  try {
    const branch = execFileSync("git", ["-C", workspaceFolder, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return branch || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "list";
  const filePath = searchParams.get("path") || "";
  const query = searchParams.get("query") || "";
  const workspaceFolder = searchParams.get("workspace") || process.cwd();

  if (action === "list") {
    const targetPath = filePath
      ? path.join(workspaceFolder, filePath)
      : workspaceFolder;

    if (!targetPath.startsWith(workspaceFolder)) {
      return NextResponse.json(
        { error: "Path traversal not allowed" },
        { status: 403 }
      );
    }

    try {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const items = entries
        .filter(
          (e) =>
            !e.name.startsWith(".") &&
            e.name !== "node_modules" &&
            e.name !== ".git"
        )
        .map((entry) => ({
          name: entry.name,
          path: path.relative(
            workspaceFolder,
            path.join(targetPath, entry.name)
          ),
          isDirectory: entry.isDirectory(),
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory)
            return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return NextResponse.json({ items, workspaceFolder });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  if (action === "read") {
    const targetPath = path.join(workspaceFolder, filePath);

    if (!targetPath.startsWith(workspaceFolder)) {
      return NextResponse.json(
        { error: "Path traversal not allowed" },
        { status: 403 }
      );
    }

    try {
      const content = fs.readFileSync(targetPath, "utf-8");
      return NextResponse.json({ content, path: filePath });
    } catch (error) {
      return NextResponse.json({ error: String(error) }, { status: 500 });
    }
  }

  if (action === "search") {
    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const results: Array<{ path: string; line: number; content: string }> = [];

    function searchDir(dir: string) {
      if (results.length >= 100) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name.startsWith(".") ||
            entry.name === "node_modules" ||
            entry.name === ".git"
          )
            continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            searchDir(fullPath);
          } else {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              const lines = content.split("\n");
              lines.forEach((line, idx) => {
                if (
                  results.length < 100 &&
                  line.toLowerCase().includes(query.toLowerCase())
                ) {
                  results.push({
                    path: path.relative(workspaceFolder, fullPath),
                    line: idx + 1,
                    content: line.trim().slice(0, 200),
                  });
                }
              });
            } catch {
              // Skip binary/unreadable files
            }
          }
        }
      } catch {
        // Skip inaccessible dirs
      }
    }

    searchDir(workspaceFolder);
    return NextResponse.json({ results });
  }

  if (action === "branch") {
    return NextResponse.json({ branch: getGitBranch(workspaceFolder) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
