import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, messages, projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const allSessions = projectId
    ? await db
        .select()
        .from(sessions)
        .where(eq(sessions.projectId, projectId))
        .orderBy(desc(sessions.updatedAt))
    : await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.updatedAt));

  return NextResponse.json(allSessions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const now = Date.now();

  let workspaceFolder = body.workspaceFolder ?? null;

  if (body.projectId) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, body.projectId));
    if (project) {
      workspaceFolder = project.workspaceFolder;
    }
  }

  const session = {
    id: uuidv4(),
    title: body.title || "New Chat",
    projectId: body.projectId ?? null,
    accountId: body.accountId ?? null,
    model: body.model ?? null,
    reasoningEffort: body.reasoningEffort ?? "medium",
    workspaceFolder,
    archived: 0,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(sessions).values(session);
  return NextResponse.json(session);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db
    .update(sessions)
    .set({ ...updates, updatedAt: Date.now() })
    .where(eq(sessions.id, id));

  const [updated] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(messages).where(eq(messages.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
  return NextResponse.json({ success: true });
}
