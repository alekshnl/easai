import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, messages, sessions } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { enqueueJob } from "@/lib/jobs/repository";
import type { ChatMessage } from "@/lib/openai/client";

function parseMessageMetadata(metadata: string | null | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    sessionId,
    content,
    accountId,
    model,
    reasoningEffort = "medium",
    mode = "build",
  } = body;

  if (!sessionId || !content || !accountId || !model) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const token = account.provider === "zai"
    ? account.apiKey || account.accessToken
    : account.accessToken || account.apiKey;

  if (!token) {
    return NextResponse.json({ error: "Account has no API key or access token" }, { status: 401 });
  }

  const now = Date.now();
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  await db.insert(messages).values({
    id: userMessageId,
    sessionId,
    role: "user",
    content,
    model: null,
    accountId,
    metadata: JSON.stringify({ mode }),
    createdAt: now,
    finishedAt: now,
  });

  await db.insert(messages).values({
    id: assistantMessageId,
    sessionId,
    role: "assistant",
    content: "",
    model,
    accountId,
    metadata: JSON.stringify({
      mode,
      job: {
        status: "pending",
      },
      toolCalls: [],
    }),
    createdAt: now,
    finishedAt: null,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  const snapshot: ChatMessage[] = history
    .filter((msg) => {
      if (msg.id === assistantMessageId) return false;
      if (msg.role !== "assistant") return true;
      if (!msg.finishedAt) return false;
      const metadata = parseMessageMetadata(msg.metadata);
      const job = (metadata.job as Record<string, unknown> | undefined) || undefined;
      const status = typeof job?.status === "string" ? job.status : null;
      if (status && ["pending", "running"].includes(status)) return false;
      return true;
    })
    .map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));

  const job = await enqueueJob({
    sessionId,
    accountId,
    model,
    reasoningEffort,
    mode,
    userMessageId,
    assistantMessageId,
    historySnapshot: snapshot,
  });

  await db
    .update(messages)
    .set({
      metadata: JSON.stringify({
        mode,
        job: {
          id: job.id,
          status: "pending",
          queuedAt: job.queuedAt,
        },
        toolCalls: [],
      }),
    })
    .where(eq(messages.id, assistantMessageId));

  await db
    .update(sessions)
    .set({
      accountId,
      model,
      reasoningEffort,
      updatedAt: now,
      messageCount: (session.messageCount || 0) + 2,
    })
    .where(eq(sessions.id, sessionId));

  if ((session.messageCount || 0) <= 1) {
    const title = content.slice(0, 60) + (content.length > 60 ? "..." : "");
    await db
      .update(sessions)
      .set({ title })
      .where(eq(sessions.id, sessionId));
  }

  return NextResponse.json({
    jobId: job.id,
    userMessageId,
    assistantMessageId,
    status: "queued",
  });
}
