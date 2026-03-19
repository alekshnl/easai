import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      provider: accounts.provider,
      authType: accounts.authType,
      planType: accounts.planType,
      createdAt: accounts.createdAt,
    })
    .from(accounts);

  return NextResponse.json(allAccounts);
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await db.delete(accounts).where(eq(accounts.id, id));
  return NextResponse.json({ success: true });
}
