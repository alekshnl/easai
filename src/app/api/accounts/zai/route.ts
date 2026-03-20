import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return NextResponse.json({ error: "Ongeldige API key" }, { status: 400 });
  }

  const trimmed = apiKey.trim();
  const suffix = trimmed.length > 8 ? trimmed.slice(-6) : trimmed;

  try {
    const now = Date.now();
    await db.insert(accounts).values({
      id: uuidv4(),
      name: `Z.AI (...${suffix})`,
      provider: "zai",
      authType: "api_key",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      apiKey: trimmed,
      planType: "coding-plan",
      tokenExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, name: `Z.AI (...${suffix})` });
  } catch (err) {
    return NextResponse.json(
      { error: `Account opslaan mislukt: ${String(err)}` },
      { status: 500 }
    );
  }
}
