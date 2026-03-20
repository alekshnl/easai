import http from "http";
import { generateZaiAuthUrl, exchangeZaiAuthCode, fetchZaiProfile } from "@/lib/providers/zai/auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

const CALLBACK_PORT = 1456;
const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/auth/callback";
const TIMEOUT_MS = 5 * 60 * 1000;

let activeServer: http.Server | null = null;

function killActiveServer() {
  if (activeServer) {
    try {
      const s = activeServer as unknown as { closeAllConnections?: () => void };
      if (typeof s.closeAllConnections === "function") s.closeAllConnections();
      activeServer.close();
    } catch {
      // ignore
    }
    activeServer = null;
  }
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

      killActiveServer();

      try {
        const state = crypto.randomUUID();
        const url = generateZaiAuthUrl(state);

        await new Promise<void>((resolve, reject) => {
          const server = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url ?? "/", `http://${CALLBACK_HOST}:${CALLBACK_PORT}`);

            if (reqUrl.pathname !== CALLBACK_PATH) {
              res.writeHead(404);
              res.end("Not found");
              return;
            }

            const code = reqUrl.searchParams.get("code");
            const returnedState = reqUrl.searchParams.get("state");

            if (!code || returnedState !== state) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(htmlPage("Fout", "Ongeldige callback — state mismatch. Probeer opnieuw.", false));
              send(controller, { type: "error", error: "State mismatch in Z.AI OAuth callback" });
              cleanup();
              controller.close();
              return;
            }

            try {
              const { accessToken } = await exchangeZaiAuthCode(code);
              const profile = await fetchZaiProfile(accessToken);

              const now = Date.now();
              await db.insert(accounts).values({
                id: uuidv4(),
                name: profile.email,
                provider: "zai",
                authType: "oauth",
                accessToken,
                refreshToken: null,
                idToken: null,
                apiKey: null,
                planType: "coding-plan",
                tokenExpiresAt: null,
                createdAt: now,
                updatedAt: now,
              });

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(htmlPage("Verbonden!", `Z.AI account <strong>${profile.email}</strong> is succesvol toegevoegd. Je kunt dit tabblad sluiten.`, true));

              send(controller, { type: "done", email: profile.email, planType: "coding-plan" });
            } catch (err) {
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(htmlPage("Fout", `Z.AI authenticatie mislukt: ${String(err)}`, false));
              send(controller, { type: "error", error: String(err) });
            } finally {
              cleanup();
              controller.close();
            }
          });

          server.on("error", (err: NodeJS.ErrnoException) => {
            activeServer = null;
            reject(err);
          });

          server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
            activeServer = server;
            resolve();
          });
        });

        send(controller, { type: "url", url });

        timeoutId = setTimeout(() => {
          send(controller, { type: "error", error: "Timeout — Z.AI authenticatie duurde te lang" });
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
