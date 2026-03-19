import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
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

    return NextResponse.json({
      primary: {
        usedPercent: primary?.used_percent ?? primary?.usedPercent ?? null,
        resetAfterSeconds: primary?.reset_after_seconds ?? primary?.resetAfterSeconds ?? null,
      },
      secondary: {
        usedPercent: secondary?.used_percent ?? secondary?.usedPercent ?? null,
        resetAfterSeconds: secondary?.reset_after_seconds ?? secondary?.resetAfterSeconds ?? null,
      },
      raw: data,
    });
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
