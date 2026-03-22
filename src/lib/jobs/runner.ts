import { db } from "@/lib/db";
import { accounts, jobs, sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  appendJobEvent,
  getJobById,
  markJobCancelled,
  markJobCompleted,
  markJobFailed,
  parseHistorySnapshot,
  updateAssistantMessageContent,
} from "@/lib/jobs/repository";
import {
  streamChat,
  type ReasoningEffort,
  type ToolCallRecord,
} from "@/lib/openai/client";
import { streamChatZai } from "@/lib/providers/zai/client";
import type { Job } from "@/lib/db/schema";

const DELTA_FLUSH_MS = 150;

function classifyToolStatus(result: string): "completed" | "error" {
  return result.startsWith("Error:") ? "error" : "completed";
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

export async function runJob(job: Job, signal: AbortSignal): Promise<void> {
  let fullContent = "";
  let deltaBuffer = "";
  let lastFlushAt = Date.now();
  const toolCalls: ToolCallRecord[] = [];
  const workerIds = new Map<string, string>();
  let workerCounter = 0;

  const buildToolCallMetadata = (
    terminalFallback: "completed" | "cancelled" | "error" | null = null,
  ) =>
    toolCalls.map((tc) => {
      const status = tc.result
        ? classifyToolStatus(tc.result)
        : (terminalFallback || "running");
      return {
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
        result: tc.result?.slice(0, 500),
        status,
        workerId: tc.workerId || "Main",
      };
    });

  const flushDelta = async (force = false) => {
    if (!deltaBuffer) return;
    const now = Date.now();
    if (!force && now - lastFlushAt < DELTA_FLUSH_MS) return;

    fullContent += deltaBuffer;

    const metadata: Record<string, unknown> = {
      mode: job.mode,
      job: {
        id: job.id,
        status: "running",
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
      },
      toolCalls: buildToolCallMetadata(),
    };

    await updateAssistantMessageContent(job.assistantMessageId, fullContent, metadata);
    await appendJobEvent({
      jobId: job.id,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "output_delta",
      payload: { delta: deltaBuffer },
    });

    deltaBuffer = "";
    lastFlushAt = now;
  };

  const getWorkerLetter = (n: number): string => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (n < 26) return letters[n];
    const first = Math.floor(n / 26) - 1;
    const second = n % 26;
    return `${letters[first]}${letters[second]}`;
  };

  const assignWorkerId = (toolCallId: string, toolName: string): string => {
    if (toolName === "task") {
      const workerId = getWorkerLetter(workerCounter);
      workerCounter += 1;
      workerIds.set(toolCallId, workerId);
      return workerId;
    }
    workerIds.set(toolCallId, "Main");
    return "Main";
  };

  const ensureNotCancelled = async () => {
    if (!signal.aborted) {
      const current = await getJobById(job.id);
      if (current?.cancelRequestedAt) {
        throw new DOMException("Job cancelled", "AbortError");
      }
      return;
    }
    throw new DOMException("Job cancelled", "AbortError");
  };

  try {
    const history = parseHistorySnapshot(job.historySnapshot);

    const [session] = await db
      .select({ workspaceFolder: sessions.workspaceFolder })
      .from(sessions)
      .where(eq(sessions.id, job.sessionId));

    const workspaceFolder = session?.workspaceFolder || process.cwd();

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, job.accountId));

    if (!account) {
      throw new Error("Account not found");
    }

    const token = account.provider === "zai"
      ? account.apiKey || account.accessToken
      : account.accessToken || account.apiKey;

    if (!token) {
      throw new Error("Account has no API token");
    }

    await updateAssistantMessageContent(
      job.assistantMessageId,
      fullContent,
      {
        mode: job.mode,
        job: {
          id: job.id,
          status: "running",
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
        },
        toolCalls: buildToolCallMetadata(),
      },
    );

    const stream = account.provider === "zai"
      ? streamChatZai(
          token,
          history,
          job.model,
          job.reasoningEffort,
          workspaceFolder,
          job.mode,
          signal,
        )
      : streamChat(
          token,
          history,
          job.model,
          job.reasoningEffort as ReasoningEffort,
          workspaceFolder,
          job.mode,
          signal,
        );

    for await (const event of stream) {
      await ensureNotCancelled();

      if (event.type === "text_delta" && event.content) {
        deltaBuffer += event.content;
        await flushDelta();
        continue;
      }

      if (event.type === "tool_call_start") {
        const toolCallId = event.toolCallId || `tool-${Date.now()}`;
        const workerId = assignWorkerId(toolCallId, event.toolName || "unknown");
        toolCalls.push({
          id: toolCallId,
          name: event.toolName || "unknown",
          arguments: event.toolArguments || "{}",
          result: "",
          workerId,
        });

        await appendJobEvent({
          jobId: job.id,
          sessionId: job.sessionId,
          messageId: job.assistantMessageId,
          type: "tool_call_start",
          payload: {
            toolCallId,
            toolName: event.toolName,
            toolArguments: event.toolArguments,
            workerId,
          },
        });

        await updateAssistantMessageContent(
          job.assistantMessageId,
          fullContent,
          {
            mode: job.mode,
            job: {
              id: job.id,
              status: "running",
              queuedAt: job.queuedAt,
              startedAt: job.startedAt,
            },
            toolCalls: buildToolCallMetadata(),
          },
        );
        continue;
      }

      if (event.type === "tool_result") {
        const toolCallId = event.toolCallId || "";
        const result = event.toolResult || "";
        const idx = toolCalls.findIndex((tc) => tc.id === toolCallId);
        if (idx >= 0) {
          toolCalls[idx] = {
            ...toolCalls[idx],
            result,
          };
        }

        await appendJobEvent({
          jobId: job.id,
          sessionId: job.sessionId,
          messageId: job.assistantMessageId,
          type: "tool_result",
          payload: {
            toolCallId,
            toolName: event.toolName,
            toolResult: result.slice(0, 4000),
            workerId: workerIds.get(toolCallId) || "Main",
          },
        });

        await updateAssistantMessageContent(
          job.assistantMessageId,
          fullContent,
          {
            mode: job.mode,
            job: {
              id: job.id,
              status: "running",
              queuedAt: job.queuedAt,
              startedAt: job.startedAt,
            },
            toolCalls: buildToolCallMetadata(),
          },
        );
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.error || "Unknown stream error");
      }

      if (event.type === "done") {
        await flushDelta(true);
        const finishedAt = Date.now();

        await markJobCompleted(job.id);
        await updateAssistantMessageContent(
          job.assistantMessageId,
          fullContent || "(no response)",
          {
            mode: job.mode,
            job: {
              id: job.id,
              status: "completed",
              queuedAt: job.queuedAt,
              startedAt: job.startedAt,
              finishedAt,
            },
            toolCalls: toolCalls.map((tc) => ({
              ...tc,
            }))
              .map((tc) => ({
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
                result: tc.result?.slice(0, 500),
                status: tc.result ? classifyToolStatus(tc.result) : "completed",
                workerId: tc.workerId || "Main",
              })),
          },
          finishedAt,
        );
        return;
      }
    }
  } catch (err) {
    await flushDelta(true);

    if (isAbortError(err)) {
      const cancelledAt = Date.now();
      await markJobCancelled(job.id);
      await updateAssistantMessageContent(
        job.assistantMessageId,
        fullContent,
        {
          mode: job.mode,
          job: {
            id: job.id,
            status: "cancelled",
            queuedAt: job.queuedAt,
            startedAt: job.startedAt,
            cancelledAt,
          },
          toolCalls: buildToolCallMetadata("cancelled"),
        },
        cancelledAt,
      );
      return;
    }

    const errorMessage = err instanceof Error ? err.message : String(err);
    const failedAt = Date.now();
    await markJobFailed(job.id, errorMessage);
    await updateAssistantMessageContent(
      job.assistantMessageId,
      fullContent,
      {
        mode: job.mode,
        job: {
          id: job.id,
          status: "failed",
          error: errorMessage,
          queuedAt: job.queuedAt,
          startedAt: job.startedAt,
          failedAt,
        },
        toolCalls: buildToolCallMetadata("error"),
      },
      failedAt,
    );
  }
}

export async function markStaleRunningJobsFailed(): Promise<void> {
  const runningJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "running"));

  for (const job of runningJobs) {
    await markJobFailed(job.id, "Worker restarted while job was running");
  }
}
