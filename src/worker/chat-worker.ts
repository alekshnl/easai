import { initializeDatabase } from "@/lib/db";
import {
  claimPendingJob,
  getRunningJobsWithCancelRequested,
} from "@/lib/jobs/repository";
import { markStaleRunningJobsFailed, runJob } from "@/lib/jobs/runner";

const MAX_PARALLEL_JOBS = Number.parseInt(process.env.EASAI_MAX_PARALLEL_JOBS || "1", 10);
const QUEUE_POLL_MS = Number.parseInt(process.env.EASAI_QUEUE_POLL_MS || "300", 10);

const runningControllers = new Map<string, AbortController>();

async function claimJobsUntilLimit() {
  while (runningControllers.size < MAX_PARALLEL_JOBS) {
    const job = await claimPendingJob();
    if (!job) return;

    const controller = new AbortController();
    runningControllers.set(job.id, controller);

    void runJob(job, controller.signal)
      .catch((err) => {
        console.error(`[worker] job ${job.id} failed:`, err);
      })
      .finally(() => {
        runningControllers.delete(job.id);
      });
  }
}

async function applyCancelRequests() {
  const runningToCancel = await getRunningJobsWithCancelRequested();
  for (const job of runningToCancel) {
    const controller = runningControllers.get(job.id);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
  }
}

async function loop() {
  while (true) {
    try {
      await applyCancelRequests();
      await claimJobsUntilLimit();
    } catch (err) {
      console.error("[worker] loop error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_MS));
  }
}

async function main() {
  await initializeDatabase();
  await markStaleRunningJobsFailed();
  console.log(`[worker] started chat worker (parallel=${MAX_PARALLEL_JOBS})`);
  await loop();
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
