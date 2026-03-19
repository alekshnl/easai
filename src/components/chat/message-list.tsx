"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { MessageBubble, StreamingBubble } from "./message-bubble";
import type { Message } from "@/hooks/use-chat";
import type { ToolCallDisplayData } from "./tool-call-display";

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
  streamingContent: string;
  activeToolCalls: ToolCallDisplayData[];
  error: string | null;
}

export function MessageList({
  messages,
  streaming,
  streamingContent,
  activeToolCalls,
  error,
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
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && (
          <StreamingBubble
            content={streamingContent}
            activeToolCalls={activeToolCalls}
          />
        )}
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
