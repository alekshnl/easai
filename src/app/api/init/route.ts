import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db";

export async function POST() {
  try {
    await initializeDatabase();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database initialization error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
