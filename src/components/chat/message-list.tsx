"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { MessageBubble } from "./message-bubble";
import type { Message } from "@/hooks/use-chat";
import type { ToolCallDisplayData } from "./actions-panel";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
  activeToolCalls: ToolCallDisplayData[];
  error: string | null;
  mode: "plan" | "build";
}

export function MessageList({
  messages,
  streaming,
  streamingContent,
  activeToolCalls,
  error,
  mode,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      isNearBottomRef.current = checkNearBottom();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [checkNearBottom]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, activeToolCalls]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length]);

  const latestActiveAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== "assistant" || !msg.metadata) continue;
      try {
        const parsed = JSON.parse(msg.metadata) as { job?: { status?: string } };
        const status = parsed.job?.status;
        if (status === "pending" || status === "running") {
          return msg.id;
        }
      } catch {
        // ignore malformed metadata
      }
    }
    return null;
  }, [messages]);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="font-mono text-3xl font-light tracking-widest text-muted-foreground/30">
          easai
        </div>
        <p className="font-mono text-xs text-muted-foreground/40">
          start een gesprek
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="flex flex-col py-4">
        {messages.map((msg) => {
          const shouldInjectLiveActions =
            msg.id === latestActiveAssistantMessageId && activeToolCalls.length > 0;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              overrideToolCalls={shouldInjectLiveActions ? activeToolCalls : undefined}
            />
          );
        })}
        {error && (
          <div className="mx-4 my-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
