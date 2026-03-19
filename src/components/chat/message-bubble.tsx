"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { ToolCallList, type ToolCallDisplayData } from "./tool-call-display";
import type { Message } from "@/hooks/use-chat";

interface MessageBubbleProps {
  message: Message;
}

function parsePersistedToolCalls(metadata: string | null | undefined): ToolCallDisplayData[] {
  if (!metadata) return [];
  try {
    const parsed = JSON.parse(metadata);
    const calls = parsed.toolCalls;
    if (!Array.isArray(calls)) return [];
    return calls.map((tc: Record<string, unknown>) => ({
      id: String(tc.id || ""),
      name: String(tc.name || "unknown"),
      arguments: "",
      result: tc.result ? String(tc.result) : undefined,
      status: "completed" as const,
    }));
  } catch {
    return [];
  }
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const toolCalls = useMemo(() => parsePersistedToolCalls(message.metadata), [message.metadata]);

  return (
    <div
      className={cn(
        "group flex w-full gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "mt-1 h-2 w-2 shrink-0 rounded-full",
          isUser ? "bg-primary/60" : "bg-muted-foreground/40"
        )}
      />

      <div
        className={cn(
          "max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start"
        )}
      >
        {isUser ? (
          <div className="rounded-lg bg-primary/10 px-4 py-2.5 font-mono text-sm leading-relaxed text-foreground">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}
          </div>
        )}

        {!isUser && message.model && (
          <div className="mt-1 text-[10px] text-muted-foreground/50 font-mono">
            {message.model}
          </div>
        )}
      </div>
    </div>
  );
}

interface StreamingBubbleProps {
  content: string;
  activeToolCalls: ToolCallDisplayData[];
}

export function StreamingBubble({ content, activeToolCalls }: StreamingBubbleProps) {
  return (
    <div className="group flex w-full gap-3 px-4 py-3">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40 animate-pulse" />

      <div className="max-w-[85%] min-w-0">
        <div className="prose prose-sm dark:prose-invert max-w-none font-mono text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0">
          {content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : activeToolCalls.length > 0 ? null : (
            <span className="animate-pulse text-muted-foreground">▋</span>
          )}
          {activeToolCalls.length > 0 && <ToolCallList toolCalls={activeToolCalls} />}
        </div>
      </div>
    </div>
  );
}
