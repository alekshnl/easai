import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { apiKey } = await request.json();

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return NextResponse.json({ error: "Ongeldige API key" }, { status: 400 });
  }

  try {
    await db
      .update(accounts)
      .set({ apiKey: apiKey.trim(), updatedAt: Date.now() })
      .where(eq(accounts.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Opslaan mislukt: ${String(err)}` },
      { status: 500 }
    );
  }
}
