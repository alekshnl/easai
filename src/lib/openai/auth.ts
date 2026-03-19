import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const OPENAI_AUTH_ISSUER = "https://auth.openai.com";
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_SCOPES = "openid profile email offline_access api.connectors.read api.connectors.invoke";

export interface OAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt?: number;
}

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sha256(str: string): Buffer {
  return crypto.createHash("sha256").update(str).digest();
}

// The Codex CLI OAuth flow requires the redirect URI to be on port 1455
// with the exact path /auth/callback, and requires specific extra params.
export const CODEX_REDIRECT_PORT = 1455;
export const CODEX_REDIRECT_URI = `http://localhost:${CODEX_REDIRECT_PORT}/auth/callback`;

export function generateAuthUrl(redirectUri: string): { url: string; state: OAuthState } {
  const state = base64URLEncode(crypto.randomBytes(32));
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: OPENAI_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: OPENAI_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state: state,
    originator: "codex_cli_rs",
  });

  return {
    url: `${OPENAI_AUTH_ISSUER}/oauth/authorize?${params.toString()}`,
    state: { state, codeVerifier, redirectUri },
  };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const response = await fetch(`${OPENAI_AUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: OPENAI_CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export async function exchangeForApiKey(idToken: string): Promise<string> {
  const response = await fetch(`${OPENAI_AUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      client_id: OPENAI_CLIENT_ID,
      requested_token: "openai-api-key",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API key exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function refreshTokens(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch(`${OPENAI_AUTH_ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: OPENAI_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    idToken: data.id_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export function parseIdToken(idToken: string): Record<string, unknown> {
  try {
    const payload = idToken.split(".")[1];
    const decoded = Buffer.from(payload, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}
