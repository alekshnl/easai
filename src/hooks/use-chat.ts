"use client";

import { useState, useEffect, useCallback } from "react";
import type { ToolCallDisplayData } from "@/components/chat/tool-call-display";

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  accountId: string | null;
  createdAt: number;
  finishedAt: number | null;
  metadata?: string | null;
}

export interface PersistedToolCall {
  id: string;
  name: string;
  result?: string;
}

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallDisplayData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchMessages();
    setStreamingContent("");
    setActiveToolCalls([]);
    setError(null);
  }, [fetchMessages]);

  const sendMessage = useCallback(
    async (
      content: string,
      accountId: string,
      model: string,
      reasoningEffort: string = "medium",
      mode: string = "build",
    ) => {
      if (!sessionId || streaming) return;

      setError(null);
      setStreaming(true);
      setStreamingContent("");
      setActiveToolCalls([]);

      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        model: null,
        accountId,
        createdAt: Date.now(),
        finishedAt: null,
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            content,
            accountId,
            model,
            reasoningEffort,
            mode,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Chat request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        const currentToolCalls: ToolCallDisplayData[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            try {
              const event = JSON.parse(data);
              if (event.type === "delta") {
                setStreamingContent((prev) => prev + event.content);
              } else if (event.type === "tool_call_start") {
                const tc: ToolCallDisplayData = {
                  id: event.toolCallId || `tc-${Date.now()}-${Math.random()}`,
                  name: event.toolName || "unknown",
                  arguments: event.toolArguments || "{}",
                  status: "running",
                };
                currentToolCalls.push(tc);
                setActiveToolCalls([...currentToolCalls]);
              } else if (event.type === "tool_result") {
                const tcId = event.toolCallId;
                const idx = currentToolCalls.findIndex((tc) => tc.id === tcId);
                if (idx >= 0) {
                  currentToolCalls[idx] = {
                    ...currentToolCalls[idx],
                    result: event.toolResult,
                    status: event.toolResult?.startsWith("Error:") ? "error" : "completed",
                  };
                  setActiveToolCalls([...currentToolCalls]);
                }
              } else if (event.type === "error") {
                setError(event.error);
                setStreaming(false);
                setActiveToolCalls([]);
                return;
              } else if (event.type === "done") {
                setStreamingContent("");
                setStreaming(false);
                setActiveToolCalls([]);
                await fetchMessages();
                return;
              }
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStreaming(false);
        setStreamingContent("");
        setActiveToolCalls([]);
        await fetchMessages();
      }
    },
    [sessionId, streaming, fetchMessages]
  );

  return {
    messages,
    loading,
    streaming,
    streamingContent,
    activeToolCalls,
    error,
    sendMessage,
    fetchMessages,
  };
}
