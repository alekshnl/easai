import { NextRequest, NextResponse } from "next/server";
import { generateAuthUrl, CODEX_REDIRECT_URI } from "@/lib/openai/auth";

export async function GET(_request: NextRequest) {
  const { url, state } = generateAuthUrl(CODEX_REDIRECT_URI);

  const response = NextResponse.json({ url });
  response.cookies.set("oauth_state", JSON.stringify(state), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
