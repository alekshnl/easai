/**
 * OAuth flow initiator using SSE.
 *
 * Flow:
 * 1. Client calls GET /api/auth/start (gets an SSE stream)
 * 2. Server spawns a temporary HTTP listener on port 1455
 * 3. Server sends { type: "url", url: "..." } to client
 * 4. Client opens the URL in a new tab
 * 5. OpenAI redirects to localhost:1455/auth/callback?code=...
 * 6. Server exchanges code for tokens, saves account, sends { type: "done" }
 * 7. Client refreshes account list
 */

import http from "http";
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  parseIdToken,
  CODEX_REDIRECT_URI,
} from "@/lib/openai/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

const CALLBACK_PORT = 1455;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 min

// Module-level singleton so we never try to bind the port twice
// across hot-reloads or concurrent requests.
let activeServer: http.Server | null = null;

function killActiveServer() {
  if (activeServer) {
    try {
      // closeAllConnections() is available in Node 18.2+
      if (typeof (activeServer as unknown as { closeAllConnections?: () => void }).closeAllConnections === "function") {
        (activeServer as unknown as { closeAllConnections: () => void }).closeAllConnections();
      }
      activeServer.close();
    } catch {
      // ignore
    }
    activeServer = null;
  }
}

export async function GET() {
  const encoder = new TextEncoder();

  function send(controller: ReadableStreamDefaultController, data: object) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  const stream = new ReadableStream({
    async start(controller) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      function cleanup() {
        if (timeoutId) clearTimeout(timeoutId);
        killActiveServer();
      }

      // Kill any leftover server from a previous attempt before starting
      killActiveServer();

      try {
        // Generate OAuth URL + PKCE state
        const { url, state } = generateAuthUrl(CODEX_REDIRECT_URI);

        // Start local callback server on port 1455
        await new Promise<void>((resolveServer, rejectServer) => {
          const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(
              req.url ?? "/",
              `http://localhost:${CALLBACK_PORT}`
            );

            if (reqUrl.pathname !== "/auth/callback") {
              res.writeHead(404);
              res.end("Not found");
              return;
            }

            const code = reqUrl.searchParams.get("code");
            const returnedState = reqUrl.searchParams.get("state");

            if (!code || returnedState !== state.state) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(
                htmlPage(
                  "Fout",
                  "Ongeldige callback — state mismatch. Probeer opnieuw.",
                  false
                )
              );
              send(controller, {
                type: "error",
                error: "State mismatch in OAuth callback",
              });
              cleanup();
              controller.close();
              return;
            }

            try {
              const tokens = await exchangeCodeForTokens(
                code,
                state.codeVerifier,
                CODEX_REDIRECT_URI
              );

              const claims = parseIdToken(tokens.idToken);
              const authClaims =
                (claims[
                  "https://api.openai.com/auth"
                ] as Record<string, unknown>) || {};
              const planType =
                (authClaims.chatgpt_plan_type as string) || "unknown";
              const email =
                (claims.email as string) || "OpenAI Account";

              // The access_token JWT is what chatgpt.com/backend-api/codex expects.
              // We store it as accessToken so the chat client can use it directly.
              const now = Date.now();
              await db.insert(accounts).values({
                id: uuidv4(),
                name: email,
                provider: "openai",
                authType: "oauth",
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                idToken: tokens.idToken,
                planType,
                tokenExpiresAt: tokens.expiresAt ?? null,
                createdAt: now,
                updatedAt: now,
              });

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(
                htmlPage(
                  "Verbonden!",
                  `Account <strong>${email}</strong> (${planType}) is succesvol toegevoegd. Je kunt dit tabblad sluiten.`,
                  true
                )
              );

              send(controller, { type: "done", email, planType });
            } catch (err) {
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(
                htmlPage(
                  "Fout",
                  `Authenticatie mislukt: ${String(err)}`,
                  false
                )
              );
              send(controller, { type: "error", error: String(err) });
            } finally {
              cleanup();
              controller.close();
            }
          });

          server.on("error", (err: NodeJS.ErrnoException) => {
            activeServer = null;
            rejectServer(err);
          });

          server.listen(CALLBACK_PORT, "localhost", () => {
            activeServer = server;
            resolveServer();
          });
        });

        // Send the auth URL to the client
        send(controller, { type: "url", url });

        // Timeout guard
        timeoutId = setTimeout(() => {
          send(controller, {
            type: "error",
            error: "Timeout — authenticatie duurde te lang",
          });
          cleanup();
          controller.close();
        }, TIMEOUT_MS);
      } catch (err) {
        send(controller, { type: "error", error: String(err) });
        cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function htmlPage(title: string, message: string, success: boolean): string {
  const color = success ? "#22c55e" : "#ef4444";
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <title>${title} — easai</title>
  <style>
    body { font-family: "Geist Mono", ui-monospace, monospace; background: #0a0a0a; color: #ededed; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 2rem 2.5rem; max-width: 420px; text-align: center; }
    h1 { font-size: 1.1rem; margin: 0 0 1rem; color: ${color}; }
    p { font-size: 0.8rem; color: #888; line-height: 1.6; margin: 0; }
    strong { color: #ededed; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
