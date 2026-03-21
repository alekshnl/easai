import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SERVER_CACHE_TTL_MS = 5 * 60 * 1000;
type UsageResponseBody = {
  primary: { usedPercent: number | null; resetAfterSeconds?: number | null; resetAt?: string | null };
  secondary: { usedPercent: number | null; resetAfterSeconds?: number | null; resetAt?: string | null };
  raw?: unknown;
};
const usageCache = new Map<string, { fetchedAt: number; data: UsageResponseBody }>();

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const forceRefresh = searchParams.get("force") === "1";

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const cached = usageCache.get(accountId);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < SERVER_CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (account.provider === "zai") {
    const token = account.accessToken || account.apiKey;
    if (!token) {
      return NextResponse.json({ error: "No access token" }, { status: 401 });
    }

    try {
      const usageRes = await fetch("https://api.z.ai/api/monitor/usage/quota/limit", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });
      const text = await usageRes.text();

      if (!text.startsWith("{")) {
        return NextResponse.json({
          primary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
          secondary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
        });
      }

      const usageData = JSON.parse(text);

      if (usageData.code !== undefined && usageData.code !== 200) {
        const message = usageData.msg || `Z.AI error code ${usageData.code}`;
        if (usageData.code === 401 || usageData.code === 1001) {
          return NextResponse.json({ error: "Auth error" }, { status: 401 });
        }
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const limits = Array.isArray(usageData.data?.limits) ? usageData.data.limits : [];
      const windows: Record<string, { usedPercent: number | null; resetAt: string | null }> = {};

      for (const w of limits) {
        const type = String(w.type || "").toUpperCase();
        const unit = Number(w.unit);
        let label = "";
        if (type === "TOKENS_LIMIT" && unit === 3) label = "primary";
        else if (type === "TOKENS_LIMIT" && unit === 6) label = "secondary";
        if (!label) continue;

        let used = Number(w.percentage);
        if (!Number.isFinite(used)) {
          const current = Number(w.currentValue);
          const max = Number(w.usage);
          used = Number.isFinite(current) && Number.isFinite(max) && max > 0
            ? (current / max) * 100
            : 0;
        }

        windows[label] = {
          usedPercent: Number.isFinite(used) ? used : null,
          resetAt: w.nextResetTime || w.resetAt || w.reset_at || null,
        };
      }

      const payload: UsageResponseBody = {
        primary: { usedPercent: windows.primary?.usedPercent ?? null, resetAfterSeconds: null, resetAt: windows.primary?.resetAt ?? null },
        secondary: { usedPercent: windows.secondary?.usedPercent ?? null, resetAfterSeconds: null, resetAt: windows.secondary?.resetAt ?? null },
      };
      usageCache.set(accountId, { fetchedAt: Date.now(), data: payload });
      return NextResponse.json(payload);
    } catch (err) {
      return NextResponse.json(
        { error: `Z.AI fetch failed: ${String(err)}` },
        { status: 502 }
      );
    }
  }

  const token = account.accessToken || account.apiKey;
  if (!token) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  let chatgptAccountId = "";

  if (account.idToken) {
    const payload = decodeJwtPayload(account.idToken);
    chatgptAccountId = (payload?.["https://api.openai.com/auth.chatgpt_account_id"] as string) || "";
  }

  if (!chatgptAccountId && account.accessToken) {
    const payload = decodeJwtPayload(account.accessToken);
    chatgptAccountId = (payload?.["https://api.openai.com/auth.chatgpt_account_id"] as string) || "";
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal",
  };

  if (chatgptAccountId) {
    headers["ChatGPT-Account-Id"] = chatgptAccountId;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: "Token expired" }, { status: 401 });
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        return NextResponse.json(
          { error: "Rate limited", retryAfter: retryAfter ? parseInt(retryAfter) : null },
          { status: 429 }
        );
      }
      const text = await response.text();
      return NextResponse.json(
        { error: `Upstream error (${response.status}): ${text.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    const primary = data?.rate_limit?.primary_window || data?.rate_limit?.primaryWindow;
    const secondary = data?.rate_limit?.secondary_window || data?.rate_limit?.secondaryWindow;

    const payload: UsageResponseBody = {
      primary: {
        usedPercent: primary?.used_percent ?? primary?.usedPercent ?? null,
        resetAfterSeconds: primary?.reset_after_seconds ?? primary?.resetAfterSeconds ?? null,
      },
      secondary: {
        usedPercent: secondary?.used_percent ?? secondary?.usedPercent ?? null,
        resetAfterSeconds: secondary?.reset_after_seconds ?? secondary?.resetAfterSeconds ?? null,
      },
      raw: data,
    };
    usageCache.set(accountId, { fetchedAt: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Timeout" }, { status: 504 });
    }
    return NextResponse.json(
      { error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
