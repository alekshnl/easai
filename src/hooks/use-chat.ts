"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ToolCallDisplayData } from "@/components/chat/actions-panel";

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

interface JobRow {
  id: string;
  sessionId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  queuedAt: number;
  cancelRequestedAt: number | null;
}

function parseToolCallsFromMessages(messages: Message[]): ToolCallDisplayData[] {
  const calls: ToolCallDisplayData[] = [];
  for (const msg of messages) {
    if (!msg.metadata) continue;
    try {
      const metadata = JSON.parse(msg.metadata);
      if (!Array.isArray(metadata.toolCalls)) continue;
      for (const tc of metadata.toolCalls) {
        calls.push({
          id: String(tc.id || ""),
          name: String(tc.name || "unknown"),
          arguments: String(tc.arguments || ""),
          result: typeof tc.result === "string" ? tc.result : undefined,
          status: (tc.status === "running" || tc.status === "error") ? tc.status : "completed",
          workerId: tc.workerId ? String(tc.workerId) : "Main",
        });
      }
    } catch {
      // ignore malformed metadata
    }
  }
  return calls;
}

function getCursorKey(sessionId: string) {
  return `easai:lastEventId:${sessionId}`;
}

export function useChat(sessionId: string | null, onComplete?: () => void) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCallDisplayData[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const fetchJobs = useCallback(async () => {
    if (!sessionId) {
      setJobs([]);
      return;
    }
    const res = await fetch(`/api/jobs?sessionId=${sessionId}`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs(Array.isArray(data.jobs) ? data.jobs : []);
  }, [sessionId]);

  const scheduleRefresh = useCallback((quick = true) => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchMessages();
      void fetchJobs();
    }, quick ? 80 : 300);
  }, [fetchMessages, fetchJobs]);

  const applyToolCallStart = useCallback((payload: Record<string, unknown>) => {
    const tc: ToolCallDisplayData = {
      id: String(payload.toolCallId || `tc-${Date.now()}`),
      name: String(payload.toolName || "unknown"),
      arguments: String(payload.toolArguments || ""),
      status: "running",
      workerId: String(payload.workerId || "Main"),
    };
    setLiveToolCalls((prev) => [...prev.filter((x) => x.id !== tc.id), tc]);
  }, []);

  const applyToolResult = useCallback((payload: Record<string, unknown>) => {
    const tcId = String(payload.toolCallId || "");
    const result = String(payload.toolResult || "");
    setLiveToolCalls((prev) => {
      const exists = prev.some((tc) => tc.id === tcId);
      if (!exists) {
        return [
          ...prev,
          {
            id: tcId,
            name: String(payload.toolName || "unknown"),
            arguments: "",
            result,
            status: result.startsWith("Error:") ? "error" : "completed",
            workerId: String(payload.workerId || "Main"),
          },
        ];
      }
      return prev.map((tc) =>
        tc.id === tcId
          ? {
              ...tc,
              result,
              status: result.startsWith("Error:") ? "error" : "completed",
            }
          : tc,
      );
    });
  }, []);

  const openEventStream = useCallback(() => {
    if (!sessionId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const after = Number.parseInt(localStorage.getItem(getCursorKey(sessionId)) || "0", 10) || 0;
    const es = new EventSource(`/api/jobs/stream?sessionId=${encodeURIComponent(sessionId)}&after=${after}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        const evtId = typeof evt.id === "number" ? evt.id : null;
        if (evtId !== null) {
          localStorage.setItem(getCursorKey(sessionId), String(evtId));
        }

        if (evt.type === "heartbeat") return;

        const payload = (evt.payload || {}) as Record<string, unknown>;

        if (evt.type === "output_delta") {
          const delta = String(payload.delta || "");
          setStreamingContent((prev) => (prev + delta).slice(-8000));
          scheduleRefresh(true);
          return;
        }

        if (evt.type === "tool_call_start") {
          applyToolCallStart(payload);
          scheduleRefresh(true);
          return;
        }

        if (evt.type === "tool_result") {
          applyToolResult(payload);
          scheduleRefresh(true);
          return;
        }

        if (["job_completed", "job_failed", "job_cancelled"].includes(evt.type)) {
          setStreamingContent("");
          setLiveToolCalls([]);
          scheduleRefresh(false);
          onComplete?.();
          return;
        }

        scheduleRefresh(true);
      } catch {
        // ignore malformed event
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      if (!fallbackPollRef.current) {
        fallbackPollRef.current = setInterval(() => {
          void fetchMessages();
          void fetchJobs();
        }, 1000);
      }
      setTimeout(() => {
        if (!sessionId) return;
        if (fallbackPollRef.current) {
          clearInterval(fallbackPollRef.current);
          fallbackPollRef.current = null;
        }
        openEventStream();
      }, 1500);
    };
  }, [sessionId, fetchMessages, fetchJobs, onComplete, scheduleRefresh, applyToolCallStart, applyToolResult]);

  useEffect(() => {
    setStreamingContent("");
    setLiveToolCalls([]);
    setError(null);

    if (!sessionId) {
      setMessages([]);
      setJobs([]);
      return;
    }

    void fetchMessages();
    void fetchJobs();
    openEventStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackPollRef.current) {
        clearInterval(fallbackPollRef.current);
        fallbackPollRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [sessionId, fetchMessages, fetchJobs, openEventStream]);

  const sendMessage = useCallback(
    async (
      content: string,
      accountId: string,
      model: string,
      reasoningEffort: string = "medium",
      mode: string = "build",
    ) => {
      if (!sessionId) return;

      setError(null);

      const tempUserMsg: Message = {
        id: `temp-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        model: null,
        accountId,
        createdAt: Date.now(),
        finishedAt: Date.now(),
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

        await fetchMessages();
        await fetchJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        await fetchMessages();
        await fetchJobs();
      }
    },
    [sessionId, fetchMessages, fetchJobs],
  );

  const cancelStreaming = useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setStreamingContent("");
      setLiveToolCalls([]);
      await fetchJobs();
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, fetchJobs, fetchMessages]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status === "pending" || job.status === "running"),
    [jobs],
  );

  const streaming = activeJobs.length > 0;
  const persistedToolCalls = useMemo(() => parseToolCallsFromMessages(messages), [messages]);
  const activeToolCalls = liveToolCalls.length > 0
    ? liveToolCalls
    : persistedToolCalls.filter((tc) => tc.status === "running");

  return {
    messages,
    loading,
    streaming,
    streamingContent,
    activeToolCalls,
    error,
    sendMessage,
    cancelStreaming,
    fetchMessages,
    activeJobsCount: activeJobs.length,
  };
}
