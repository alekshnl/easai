import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  exchangeForApiKey,
  parseIdToken,
  type OAuthState,
} from "@/lib/openai/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_params", origin));
  }

  const stateCookie = request.cookies.get("oauth_state");
  if (!stateCookie) {
    return NextResponse.redirect(new URL("/?error=missing_state", origin));
  }

  let oauthState: OAuthState;
  try {
    oauthState = JSON.parse(stateCookie.value);
  } catch {
    return NextResponse.redirect(new URL("/?error=invalid_state", origin));
  }

  if (oauthState.state !== state) {
    return NextResponse.redirect(new URL("/?error=state_mismatch", origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      oauthState.codeVerifier,
      oauthState.redirectUri
    );

    let apiKey: string | null = null;
    try {
      apiKey = await exchangeForApiKey(tokens.idToken);
    } catch {
      // API key exchange optional; use access_token directly
    }

    const claims = parseIdToken(tokens.idToken);
    const authClaims =
      (claims["https://api.openai.com/auth"] as Record<string, unknown>) || {};
    const planType = (authClaims.chatgpt_plan_type as string) || "unknown";
    const email = (claims.email as string) || "OpenAI Account";

    const now = Date.now();

    await db.insert(accounts).values({
      id: uuidv4(),
      name: email,
      provider: "openai",
      authType: "oauth",
      accessToken: apiKey || tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      planType,
      tokenExpiresAt: tokens.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const response = NextResponse.redirect(new URL("/", origin));
    response.cookies.delete("oauth_state");
    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/?error=auth_failed&message=${encodeURIComponent(String(error))}`,
        origin
      )
    );
  }
}
