import { db } from "@/lib/db";
import { jobs, jobEvents, messages } from "@/lib/db/schema";
import { eq, and, gt, inArray, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Job, NewJob, JobEvent } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/openai/client";

const SQLITE_BUSY_RETRY_COUNT = 8;
const SQLITE_BUSY_RETRY_DELAY_MS = 80;

function isSqliteBusyError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("SQLITE_BUSY") || err.message.includes("database is locked");
}

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < SQLITE_BUSY_RETRY_COUNT; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isSqliteBusyError(err) || i === SQLITE_BUSY_RETRY_COUNT - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, SQLITE_BUSY_RETRY_DELAY_MS * (i + 1)));
    }
  }
  throw lastError;
}

export async function enqueueJob(params: {
  sessionId: string;
  accountId: string;
  model: string;
  reasoningEffort: string;
  mode: string;
  userMessageId: string;
  assistantMessageId: string;
  historySnapshot: ChatMessage[];
}): Promise<Job> {
  const now = Date.now();
  const job: NewJob = {
    id: uuidv4(),
    sessionId: params.sessionId,
    accountId: params.accountId,
    model: params.model,
    reasoningEffort: params.reasoningEffort,
    mode: params.mode,
    status: "pending",
    userMessageId: params.userMessageId,
    assistantMessageId: params.assistantMessageId,
    historySnapshot: JSON.stringify(params.historySnapshot),
    queuedAt: now,
    updatedAt: now,
  };

  await withDbRetry(() => db.insert(jobs).values(job));

  await appendJobEvent({
    jobId: job.id!,
    sessionId: params.sessionId,
    messageId: params.assistantMessageId,
    type: "job_queued",
    payload: {},
  });

  return job as Job;
}

export async function claimPendingJob(): Promise<Job | null> {
  const now = Date.now();
  const result = await withDbRetry(() => db
    .update(jobs)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(
      and(
        eq(jobs.status, "pending"),
        sql`id IN (SELECT id FROM jobs WHERE status = 'pending' ORDER BY queued_at ASC LIMIT 1)`
      )
    )
    .returning());

  if (result.length === 0) return null;
  const job = result[0];

  await appendJobEvent({
    jobId: job.id,
    sessionId: job.sessionId,
    messageId: job.assistantMessageId,
    type: "job_started",
    payload: { startedAt: now },
  });

  return job;
}

export async function getJobById(jobId: string): Promise<Job | null> {
  const result = await withDbRetry(() => db.select().from(jobs).where(eq(jobs.id, jobId)));
  return result[0] || null;
}

export async function getJobsBySession(sessionId: string): Promise<Job[]> {
  return withDbRetry(() => db
    .select()
    .from(jobs)
    .where(eq(jobs.sessionId, sessionId))
    .orderBy(sql`queued_at DESC`));
}

export async function getActiveJobsBySession(sessionId: string): Promise<Job[]> {
  return withDbRetry(() => db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.sessionId, sessionId),
        inArray(jobs.status, ["pending", "running"])
      )
    )
    .orderBy(sql`queued_at ASC`));
}

export async function markJobCompleted(jobId: string): Promise<void> {
  const now = Date.now();
  await withDbRetry(() => db
    .update(jobs)
    .set({ status: "completed", finishedAt: now, updatedAt: now })
    .where(eq(jobs.id, jobId)));

  const job = await getJobById(jobId);
  if (job) {
    await appendJobEvent({
      jobId,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_completed",
      payload: { finishedAt: now },
    });
  }
}

export async function markJobFailed(jobId: string, error: string): Promise<void> {
  const now = Date.now();
  await withDbRetry(() => db
    .update(jobs)
    .set({ status: "failed", failedAt: now, error, updatedAt: now })
    .where(eq(jobs.id, jobId)));

  const job = await getJobById(jobId);
  if (job) {
    await appendJobEvent({
      jobId,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_failed",
      payload: { error, failedAt: now },
    });
  }
}

export async function requestCancelJob(jobId: string): Promise<boolean> {
  const now = Date.now();
  const result = await withDbRetry(() => db
    .update(jobs)
    .set({ cancelRequestedAt: now, updatedAt: now })
    .where(
      and(
        eq(jobs.id, jobId),
        inArray(jobs.status, ["pending", "running"])
      )
    )
    .returning());

  if (result.length > 0) {
    const job = result[0];
    await appendJobEvent({
      jobId,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_cancel_requested",
      payload: { cancelRequestedAt: now },
    });
    return true;
  }
  return false;
}

export async function markJobCancelled(jobId: string): Promise<void> {
  const now = Date.now();
  await withDbRetry(() => db
    .update(jobs)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(jobs.id, jobId)));

  const job = await getJobById(jobId);
  if (job) {
    await appendJobEvent({
      jobId,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_cancelled",
      payload: { cancelledAt: now },
    });
  }
}

export async function cancelPendingJobs(sessionId: string): Promise<number> {
  const now = Date.now();
  const result = await withDbRetry(() => db
    .update(jobs)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(
      and(
        eq(jobs.sessionId, sessionId),
        eq(jobs.status, "pending")
      )
    )
    .returning());

  for (const job of result) {
    await appendJobEvent({
      jobId: job.id,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_cancelled",
      payload: { cancelledAt: now },
    });
  }

  return result.length;
}

export async function requestCancelRunningJobs(sessionId: string): Promise<number> {
  const now = Date.now();
  const result = await withDbRetry(() => db
    .update(jobs)
    .set({ cancelRequestedAt: now, updatedAt: now })
    .where(
      and(
        eq(jobs.sessionId, sessionId),
        eq(jobs.status, "running")
      )
    )
    .returning());

  for (const job of result) {
    await appendJobEvent({
      jobId: job.id,
      sessionId: job.sessionId,
      messageId: job.assistantMessageId,
      type: "job_cancel_requested",
      payload: { cancelRequestedAt: now },
    });
  }

  return result.length;
}

export async function getStaleRunningJobs(): Promise<Job[]> {
  return withDbRetry(() => db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "running")));
}

export async function getRunningJobsWithCancelRequested(): Promise<Job[]> {
  return withDbRetry(() => db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "running"),
        sql`${jobs.cancelRequestedAt} IS NOT NULL`
      )
    ));
}

export async function appendJobEvent(params: {
  jobId: string;
  sessionId: string;
  messageId: string;
  type: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const now = Date.now();
  const result = await withDbRetry(() => db
    .insert(jobEvents)
    .values({
      jobId: params.jobId,
      sessionId: params.sessionId,
      messageId: params.messageId,
      type: params.type,
      payload: JSON.stringify(params.payload),
      createdAt: now,
    })
    .returning({ id: jobEvents.id }));

  return result[0].id;
}

export async function getJobEvents(sessionId: string, afterId: number = 0): Promise<JobEvent[]> {
  return withDbRetry(() => db
    .select()
    .from(jobEvents)
    .where(
      and(
        eq(jobEvents.sessionId, sessionId),
        gt(jobEvents.id, afterId)
      )
    )
    .orderBy(sql`id ASC`)
    .limit(1000));
}

export async function getLatestEventId(sessionId: string): Promise<number> {
  const result = await withDbRetry(() => db
    .select({ id: jobEvents.id })
    .from(jobEvents)
    .where(eq(jobEvents.sessionId, sessionId))
    .orderBy(sql`id DESC`)
    .limit(1));

  return result[0]?.id || 0;
}

export async function updateAssistantMessageContent(
  messageId: string,
  content: string,
  metadata: Record<string, unknown>,
  finishedAt: number | null = null,
): Promise<void> {
  const update: {
    content: string;
    metadata: string;
    finishedAt?: number | null;
  } = {
    content,
    metadata: JSON.stringify(metadata),
  };

  if (finishedAt !== null) {
    update.finishedAt = finishedAt;
  }

  await withDbRetry(() => db
    .update(messages)
    .set(update)
    .where(eq(messages.id, messageId)));
}

export const completeJob = markJobCompleted;
export const failJob = markJobFailed;

export function parseHistorySnapshot(snapshot: string): ChatMessage[] {
  try {
    return JSON.parse(snapshot);
  } catch {
    return [];
  }
}
