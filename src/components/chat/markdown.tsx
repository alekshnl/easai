"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownProps {
  text: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const raw = String(children).replace(/\n$/, "");
  const match = /language-([\w-]+)/.exec(className || "");
  const language = match?.[1] ?? "text";
  const isBlock = Boolean(match) || raw.includes("\n");

  if (!isBlock) {
    return <code>{children}</code>;
  }

  return (
    <div className="easai-code-block">
      <div className="easai-code-header">
        <span>{language}</span>
        <button
          type="button"
          className="easai-copy-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(raw);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Gekopieerd" : "Kopieer"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        className="easai-code-content"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: "12px 16px",
          background: "#0d1117",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
        }}
      >
        {raw}
      </SyntaxHighlighter>
    </div>
  );
}

export function Markdown({ text }: MarkdownProps) {
  return (
    <div className="easai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ className, children }) {
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
