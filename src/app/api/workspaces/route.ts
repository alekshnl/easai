import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const baseDir = path.resolve(process.cwd(), "..");

  if (!fs.existsSync(baseDir)) {
    return NextResponse.json({ folders: [] });
  }

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ folders, basePath: baseDir });
  } catch {
    return NextResponse.json({ folders: [], basePath: baseDir });
  }
}
