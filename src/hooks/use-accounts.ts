"use client";

import { useState, useEffect, useCallback } from "react";

export interface Account {
  id: string;
  name: string;
  provider: string;
  authType: string;
  planType: string | null;
  apiKey: string | null;
  createdAt: number;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const deleteAccount = useCallback(
    async (id: string) => {
      await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchAccounts();
    },
    [fetchAccounts]
  );

  const startOAuth = useCallback(
    (
      provider: string = "openai",
      onUrl?: (url: string) => void,
      onDone?: (email: string, planType: string) => void,
      onError?: (error: string) => void
    ) => {
      const endpoint = provider === "zai" ? "/api/auth/zai/start" : "/api/auth/start";
      const evtSource = new EventSource(endpoint);

      evtSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === "url") {
            // Open the OAuth URL in a new tab
            window.open(event.url, "_blank", "noopener");
            onUrl?.(event.url);
          } else if (event.type === "done") {
            evtSource.close();
            fetchAccounts();
            onDone?.(event.email, event.planType);
          } else if (event.type === "error") {
            evtSource.close();
            onError?.(event.error);
          }
        } catch {
          // skip malformed events
        }
      };

      evtSource.onerror = () => {
        evtSource.close();
        onError?.("Verbinding met auth server verbroken");
      };

      return () => evtSource.close();
    },
    [fetchAccounts]
  );

  return { accounts, loading, fetchAccounts, deleteAccount, startOAuth };
}
