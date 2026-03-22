import { NextRequest, NextResponse } from "next/server";
import {
  getAllProviderInstructions,
  updateProviderInstruction,
  resetProviderInstruction,
  resetAllProviderInstructions,
} from "@/lib/db/provider-instructions";

export async function GET() {
  try {
    const instructions = await getAllProviderInstructions();
    return NextResponse.json(instructions);
  } catch (error) {
    console.error("Error fetching provider instructions:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider instructions" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, mode, instruction, repeatEveryPrompt } = body;

    if (!provider || !mode || instruction === undefined || repeatEveryPrompt === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: provider, mode, instruction, repeatEveryPrompt" },
        { status: 400 }
      );
    }

    if (
      typeof provider !== "string" ||
      typeof mode !== "string" ||
      typeof instruction !== "string" ||
      typeof repeatEveryPrompt !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      );
    }

    await updateProviderInstruction(provider, mode, instruction, repeatEveryPrompt);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating provider instruction:", error);
    return NextResponse.json(
      { error: "Failed to update provider instruction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const mode = searchParams.get("mode");
    const resetAll = searchParams.get("resetAll");

    if (resetAll === "true") {
      await resetAllProviderInstructions();
      return NextResponse.json({ success: true });
    }

    if (!provider || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: provider, mode (or resetAll=true)" },
        { status: 400 }
      );
    }

    await resetProviderInstruction(provider, mode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting provider instruction:", error);
    return NextResponse.json(
      { error: "Failed to delete provider instruction" },
      { status: 500 }
    );
  }
}
