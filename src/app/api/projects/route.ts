import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, sessions, messages } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const allProjects = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updatedAt));
  return NextResponse.json(allProjects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const now = Date.now();

  const project = {
    id: uuidv4(),
    name: body.name || "New Project",
    workspaceFolder: body.workspaceFolder ?? "",
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(projects).values(project);
  return NextResponse.json(project);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db
    .update(projects)
    .set({ ...updates, updatedAt: Date.now() })
    .where(eq(projects.id, id));

  const [updated] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const projectSessions = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.projectId, id));

  for (const s of projectSessions) {
    await db.delete(messages).where(eq(messages.sessionId, s.id));
  }

  await db.delete(sessions).where(eq(sessions.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
