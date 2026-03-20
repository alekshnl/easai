import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ZAI_USAGE_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
const ZAI_BILLING_URL = "https://api.z.ai/api/biz/subscription/list";

async function fetchZaiUsage(token: string) {
  const res = await fetch(ZAI_USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const text = await res.text();
  const data = JSON.parse(text);

  if (data.code !== undefined && data.code !== 200) {
    const message = data.msg || `Z.AI error code ${data.code}`;
    if (data.code === 401 || data.code === 1001) {
      return { error: "Auth error", status: 401 };
    }
    return { error: message, status: 502 };
  }

  const limits = Array.isArray(data.data?.limits) ? data.data.limits : [];
  const windows: Array<{
    label: string;
    usedPercent: number;
    resetAt: string | null;
  }> = [];

  for (const w of limits) {
    const type = String(w.type || "").toUpperCase();
    const unit = Number(w.unit);

    let label = "";
    if (type === "TOKENS_LIMIT" && unit === 3) label = "5-hour window";
    else if (type === "TOKENS_LIMIT" && unit === 6) label = "Weekly window";
    if (!label) continue;

    let used = Number(w.percentage);
    if (!Number.isFinite(used)) {
      const current = Number(w.currentValue);
      const max = Number(w.usage);
      used = Number.isFinite(current) && Number.isFinite(max) && max > 0
        ? (current / max) * 100
        : 0;
    }

    windows.push({
      label,
      usedPercent: Number.isFinite(used) ? used : 0,
      resetAt: w.nextResetTime || w.resetAt || w.reset_at || null,
    });
  }

  return { windows };
}

async function fetchZaiBilling(token: string) {
  const res = await fetch(ZAI_BILLING_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  const data = await res.json();
  if (data.code !== undefined && data.code !== 200) return null;

  const subs = Array.isArray(data.data) ? data.data : [];
  const active = subs.find((s: Record<string, unknown>) => s.inCurrentPeriod);
  if (!active) return null;

  return {
    nextRenewTime: active.nextRenewTime || null,
    currentRenewTime: active.currentRenewTime || null,
    productName: active.productName || null,
    autoRenew: active.autoRenew ?? false,
  };
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account || !account.accessToken) {
    return NextResponse.json({ error: "Account not found or no token" }, { status: 401 });
  }

  try {
    const usageResult = await fetchZaiUsage(account.accessToken);
    if ("error" in usageResult) {
      return NextResponse.json(
        { error: usageResult.error },
        { status: usageResult.status || 502 }
      );
    }

    const billing = await fetchZaiBilling(account.accessToken);

    const primary = usageResult.windows.find((w) => w.label === "5-hour window");
    const secondary = usageResult.windows.find((w) => w.label === "Weekly window");

    return NextResponse.json({
      primary: {
        usedPercent: primary?.usedPercent ?? null,
        resetAt: primary?.resetAt ? new Date(primary.resetAt).toISOString() : null,
      },
      secondary: {
        usedPercent: secondary?.usedPercent ?? null,
        resetAt: secondary?.resetAt ? new Date(secondary.resetAt).toISOString() : null,
      },
      billing,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch Z.AI usage: ${String(err)}` },
      { status: 502 }
    );
  }
}
