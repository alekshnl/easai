const API_BASE_URL = "https://mcp.exa.ai";
const DEFAULT_NUM_RESULTS = 8;

interface McpSearchRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: {
      query: string;
      numResults?: number;
      livecrawl?: "fallback" | "preferred";
      type?: "auto" | "fast" | "deep";
      contextMaxCharacters?: number;
    };
  };
}

export async function executeWebSearch(
  args: { query: string; numResults?: number },
): Promise<string> {
  if (!args.query) return "Error: query is required";

  const searchRequest: McpSearchRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "web_search_exa",
      arguments: {
        query: args.query,
        type: "auto",
        numResults: args.numResults || DEFAULT_NUM_RESULTS,
        livecrawl: "fallback",
      },
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      body: JSON.stringify(searchRequest),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `Error: Search error (${response.status}): ${errorText}`;
    }

    const responseText = await response.text();
    const lines = responseText.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.substring(6));
          if (data.result?.content?.length > 0) {
            return data.result.content[0].text;
          }
        } catch {
          // skip malformed data
        }
      }
    }

    return "No search results found. Please try a different query.";
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return "Error: Search request timed out";
    }
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
