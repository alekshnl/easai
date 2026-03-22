import { NextRequest, NextResponse } from "next/server";
import {
  getJobsBySession,
  getLatestEventId,
  cancelPendingJobs,
  requestCancelRunningJobs,
} from "@/lib/jobs/repository";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const [jobs, latestEventId] = await Promise.all([
    getJobsBySession(sessionId),
    getLatestEventId(sessionId),
  ]);

  return NextResponse.json({ jobs, latestEventId });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const sessionId = body?.sessionId as string | undefined;

  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const [pendingCancelled, runningCancelRequested] = await Promise.all([
    cancelPendingJobs(sessionId),
    requestCancelRunningJobs(sessionId),
  ]);

  return NextResponse.json({
    pendingCancelled,
    runningCancelRequested,
    totalAffected: pendingCancelled + runningCancelRequested,
  });
}
