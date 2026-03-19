import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { messages, sessions, accounts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { streamChat, type ChatMessage, type ReasoningEffort, type ToolCallRecord } from "@/lib/openai/client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    sessionId,
    content,
    accountId,
    model,
    reasoningEffort = "medium",
  } = body;

  if (!sessionId || !content || !accountId || !model) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account || !account.accessToken) {
    return new Response(
      JSON.stringify({ error: "Account not found or no access token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  const workspaceFolder = session?.workspaceFolder || process.cwd();

  const now = Date.now();

  const userMessageId = uuidv4();
  await db.insert(messages).values({
    id: userMessageId,
    sessionId,
    role: "user",
    content,
    model: null,
    accountId,
    createdAt: now,
    finishedAt: null,
  });

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt));

  const chatMessages: ChatMessage[] = history.map((msg) => ({
    role: msg.role as "user" | "assistant" | "system",
    content: msg.content,
  }));

  await db
    .update(sessions)
    .set({ accountId, model, reasoningEffort, updatedAt: now })
    .where(eq(sessions.id, sessionId));

  const assistantMessageId = uuidv4();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullContent = "";
      const toolCalls: ToolCallRecord[] = [];

      try {
        for await (const event of streamChat(
          account.accessToken!,
          chatMessages,
          model,
          reasoningEffort as ReasoningEffort,
          workspaceFolder,
        )) {
          if (event.type === "text_delta" && event.content) {
            fullContent += event.content;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "delta", content: event.content })}\n\n`
              )
            );
          } else if (event.type === "tool_call_start") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_call_start",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  toolArguments: event.toolArguments,
                })}\n\n`
              )
            );
          } else if (event.type === "tool_result") {
            toolCalls.push({
              id: event.toolCallId || "",
              name: event.toolName || "",
              arguments: "",
              result: event.toolResult || "",
            });
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_result",
                  toolCallId: event.toolCallId,
                  toolName: event.toolName,
                  toolResult: event.toolResult,
                })}\n\n`
              )
            );
          } else if (event.type === "error") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", error: event.error })}\n\n`
              )
            );
            break;
          } else if (event.type === "done") {
            const finishedAt = Date.now();

            const metadata: Record<string, unknown> = {};
            if (toolCalls.length > 0) {
              metadata.toolCalls = toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.name,
                result: tc.result?.slice(0, 500),
              }));
            }

            await db.insert(messages).values({
              id: assistantMessageId,
              sessionId,
              role: "assistant",
              content: fullContent || "(no response)",
              model,
              accountId,
              createdAt: finishedAt,
              finishedAt,
              metadata: JSON.stringify(metadata),
            });

            await db
              .update(sessions)
              .set({ messageCount: history.length + 1, updatedAt: finishedAt })
              .where(eq(sessions.id, sessionId));

            if (history.length <= 1) {
              const title =
                content.slice(0, 60) + (content.length > 60 ? "..." : "");
              await db
                .update(sessions)
                .set({ title })
                .where(eq(sessions.id, sessionId));
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  messageId: assistantMessageId,
                })}\n\n`
              )
            );
            break;
          }
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
