const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30_000;

export async function executeWebFetch(
  args: { url: string; format?: string; timeout?: number },
): Promise<string> {
  if (!args.url.startsWith("http://") && !args.url.startsWith("https://")) {
    return "Error: URL must start with http:// or https://";
  }

  const timeout = Math.min((args.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, 120_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(args.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: args.format === "html"
          ? "text/html;q=1.0, */*;q=0.8"
          : args.format === "text"
            ? "text/plain;q=1.0, text/html;q=0.8, */*;q=0.1"
            : "text/html;q=0.8, text/plain;q=0.9, */*;q=0.5",
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      return `Error: Request failed with status code: ${response.status}`;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return "Error: Response too large (exceeds 5MB limit)";
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      return "Error: Response too large (exceeds 5MB limit)";
    }

    const contentType = response.headers.get("content-type") || "";
    const text = new TextDecoder().decode(arrayBuffer);

    if (args.format === "html") {
      return text;
    }

    if (args.format === "text" || !args.format || args.format === "markdown") {
      if (contentType.includes("text/html")) {
        return htmlToText(text);
      }
      return text;
    }

    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return "Error: Request timed out";
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}
