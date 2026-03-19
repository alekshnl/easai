import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const s of allSettings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }

  return NextResponse.json({ key, value });
}
