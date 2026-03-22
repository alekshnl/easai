"use client";

import React, { useMemo } from "react";
import { Markdown } from "./markdown";
import { cn } from "@/lib/utils";
import { ActionsPanel, type ToolCallDisplayData } from "./actions-panel";
import type { Message } from "@/hooks/use-chat";

interface MessageBubbleProps {
  message: Message;
  overrideToolCalls?: ToolCallDisplayData[];
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
      arguments: String(tc.arguments || ""),
      result: tc.result ? String(tc.result) : undefined,
      status: (tc.status === "running" || tc.status === "error" ? tc.status : "completed") as "running" | "completed" | "error",
      workerId: tc.workerId ? String(tc.workerId) : "Main",
    }));
  } catch {
    return [];
  }
}

function parseJobStatus(metadata: string | null | undefined): string | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    const status = parsed?.job?.status;
    return typeof status === "string" ? status : null;
  } catch {
    return null;
  }
}

export function MessageBubble({ message, overrideToolCalls }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const persistedToolCalls = useMemo(() => parsePersistedToolCalls(message.metadata), [message.metadata]);
  const toolCalls = overrideToolCalls && overrideToolCalls.length > 0 ? overrideToolCalls : persistedToolCalls;
  const jobStatus = useMemo(() => parseJobStatus(message.metadata), [message.metadata]);
  const hasActions = toolCalls.length > 0;
  
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
          "flex gap-4 min-w-0",
          hasActions ? "w-full" : "max-w-[85%]"
        )}
      >
        {isUser ? (
          <div className="rounded-lg bg-primary/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-foreground">
            {message.content}
          </div>
        ) : (
          <>
            <div className={cn(
              "min-w-0",
              hasActions ? "w-2/3" : "max-w-[85%]"
            )}>
              <div className="max-w-none font-mono text-xs leading-relaxed text-foreground">
                <Markdown text={message.content} />
              </div>
              {!isUser && message.model && (
                <div className="mt-1 text-[9px] text-muted-foreground/50 font-mono">
                  {message.model}
                  {jobStatus && (
                    <span className="ml-2">[{jobStatus}]</span>
                  )}
                </div>
              )}
            </div>

            {hasActions && (
              <div className="w-1/3 shrink-0 self-start">
                <div className="sticky top-2">
                  <ActionsPanel toolCalls={toolCalls} />
                </div>
              </div>
            )}
          </>
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
  const hasActions = activeToolCalls.length > 0;
  
  return (
    <div className="group flex w-full gap-3 px-4 py-3">
      <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full animate-pulse", accentColor)} />

      <div className={cn(
        "flex gap-4 min-w-0",
        hasActions ? "w-full" : "max-w-[85%]"
      )}>
        <div className={cn(
          "min-w-0",
          hasActions ? "w-2/3" : "max-w-[85%]"
        )}>
          <div className="max-w-none font-mono text-xs leading-relaxed text-foreground">
            {content ? (
              <Markdown text={content} />
            ) : !hasActions ? (
              <span className="animate-pulse text-muted-foreground">▋</span>
            ) : null}
          </div>
        </div>

        {hasActions && (
          <div className="w-1/3 shrink-0 self-start">
            <div className="sticky top-2">
              <ActionsPanel toolCalls={activeToolCalls} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
