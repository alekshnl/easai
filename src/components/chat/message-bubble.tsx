"use client";

import React, { useMemo } from "react";
import { Markdown } from "./markdown";
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
  const messageMode = useMemo(() => {
    if (!message.metadata) return "build";
    try {
      const parsed = JSON.parse(message.metadata);
      return parsed.mode || "build";
    } catch {
      return "build";
    }
  }, [message.metadata]);
  const accentColor = messageMode === "plan" ? "bg-amber-500/60" : "bg-blue-500/60";

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
          isUser ? "bg-primary/60" : accentColor
        )}
      />

      <div
        className={cn(
          "max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start"
        )}
      >
        {isUser ? (
          <div className="rounded-lg bg-primary/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-foreground">
            {message.content}
          </div>
        ) : (
          <div className="max-w-none font-mono text-xs leading-relaxed text-foreground">
            <Markdown text={message.content} />
            {toolCalls.length > 0 && <ToolCallList toolCalls={toolCalls} />}
          </div>
        )}

        {!isUser && message.model && (
          <div className="mt-1 text-[9px] text-muted-foreground/50 font-mono">
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
  mode: "plan" | "build";
}

export function StreamingBubble({ content, activeToolCalls, mode }: StreamingBubbleProps) {
  const accentColor = mode === "plan" ? "bg-amber-500/60" : "bg-blue-500/60";
  
  return (
    <div className="group flex w-full gap-3 px-4 py-3">
      <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full animate-pulse", accentColor)} />

      <div className="max-w-[85%] min-w-0">
        <div className="max-w-none font-mono text-xs leading-relaxed text-foreground">
          {content ? (
            <Markdown text={content} />
          ) : activeToolCalls.length > 0 ? null : (
            <span className="animate-pulse text-muted-foreground">▋</span>
          )}
          {activeToolCalls.length > 0 && <ToolCallList toolCalls={activeToolCalls} />}
        </div>
      </div>
    </div>
  );
}
