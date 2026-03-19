import type { HighlightResult } from "highlight.js";

type HljsApi = {
  highlight: (code: string, options: { language: string; ignoreIllegals: boolean }) => HighlightResult;
  highlightAuto: (code: string) => HighlightResult;
};

let hljs: HljsApi | null = null;

function loadHljs(): HljsApi | null {
  if (hljs) return hljs;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hljs = require("highlight.js") as unknown as HljsApi;
    return hljs;
  } catch {
    return null;
  }
}

export function highlightCode(code: string, lang: string): string {
  const h = loadHljs();
  if (!h) {
    return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  try {
    return h.highlight(code, { language: lang, ignoreIllegals: true }).value;
  } catch {
    try {
      return h.highlightAuto(code).value;
    } catch {
      return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }
}
