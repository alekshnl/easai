"use client";

import { useState, useEffect, useCallback } from "react";

export interface Session {
  id: string;
  title: string;
  projectId: string | null;
  accountId: string | null;
  model: string | null;
  reasoningEffort: string | null;
  workspaceFolder: string | null;
  archived: number | null;
  messageCount: number | null;
  createdAt: number;
  updatedAt: number;
}

export function useSessions(projectId: string | null = null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async (pid?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (pid) params.set("projectId", pid);
      const res = await fetch(`/api/sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(projectId);
  }, [fetchSessions, projectId]);

  const createSession = useCallback(
    async (opts?: {
      title?: string;
      projectId?: string;
      accountId?: string;
      model?: string;
      workspaceFolder?: string;
    }) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      if (res.ok) {
        const session = await res.json();
        await fetchSessions(opts?.projectId ?? projectId);
        return session as Session;
      }
      return null;
    },
    [fetchSessions, projectId]
  );

  const updateSession = useCallback(
    async (id: string, updates: Partial<Session>) => {
      const res = await fetch("/api/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        await fetchSessions(projectId);
        return (await res.json()) as Session;
      }
      return null;
    },
    [fetchSessions, projectId]
  );

  const archiveSession = useCallback(
    async (id: string) => {
      return updateSession(id, { archived: 1 });
    },
    [updateSession]
  );

  const unarchiveSession = useCallback(
    async (id: string) => {
      return updateSession(id, { archived: 0 });
    },
    [updateSession]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchSessions(projectId);
    },
    [fetchSessions, projectId]
  );

  const active = sessions.filter((s) => !s.archived);
  const archived = sessions.filter((s) => s.archived);

  return {
    sessions,
    active,
    archived,
    loading,
    fetchSessions,
    createSession,
    updateSession,
    archiveSession,
    unarchiveSession,
    deleteSession,
  };
}
