"use client";

import { useState, useCallback, useRef } from "react";

export interface AccountUsage {
  primary: {
    usedPercent: number | null;
    resetAfterSeconds: number | null;
    resetAt: Date | null;
  };
  secondary: {
    usedPercent: number | null;
    resetAfterSeconds: number | null;
    resetAt: Date | null;
  };
  fetchedAt: number;
  error: string | null;
  refreshing: boolean;
}

const EMPTY_USAGE: AccountUsage = {
  primary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
  secondary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
  fetchedAt: 0,
  error: null,
  refreshing: false,
};

function parseResponse(data: Record<string, unknown>): Omit<AccountUsage, "refreshing"> {
  const primary = (data.primary || {}) as Record<string, unknown>;
  const secondary = (data.secondary || {}) as Record<string, unknown>;

  const primarySeconds = (primary.resetAfterSeconds as number) ?? null;
  const secondarySeconds = (secondary.resetAfterSeconds as number) ?? null;

  let primaryResetAt: Date | null = null;
  if (primarySeconds) {
    primaryResetAt = new Date(Date.now() + primarySeconds * 1000);
  } else if (typeof primary.resetAt === "string") {
    primaryResetAt = new Date(primary.resetAt);
  } else if (typeof primary.resetAt === "number") {
    primaryResetAt = new Date(primary.resetAt);
  } else if (primary.resetAt instanceof Date) {
    primaryResetAt = primary.resetAt;
  }

  let secondaryResetAt: Date | null = null;
  if (secondarySeconds) {
    secondaryResetAt = new Date(Date.now() + secondarySeconds * 1000);
  } else if (typeof secondary.resetAt === "string") {
    secondaryResetAt = new Date(secondary.resetAt);
  } else if (typeof secondary.resetAt === "number") {
    secondaryResetAt = new Date(secondary.resetAt);
  } else if (secondary.resetAt instanceof Date) {
    secondaryResetAt = secondary.resetAt;
  }

  return {
    primary: {
      usedPercent: (primary.usedPercent as number) ?? null,
      resetAfterSeconds: primarySeconds,
      resetAt: primaryResetAt,
    },
    secondary: {
      usedPercent: (secondary.usedPercent as number) ?? null,
      resetAfterSeconds: secondarySeconds,
      resetAt: secondaryResetAt,
    },
    fetchedAt: Date.now(),
    error: null,
  };
}

async function fetchUsage(accountId: string): Promise<AccountUsage> {
  try {
    const res = await fetch(`/api/usage?accountId=${accountId}`);
    if (res.ok) {
      const data = await res.json();
      return { ...parseResponse(data), refreshing: false };
    }
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    return { ...EMPTY_USAGE, error: err.error || `HTTP ${res.status}`, refreshing: false };
  } catch (err) {
    return { ...EMPTY_USAGE, error: String(err), refreshing: false };
  }
}

export function useAccountUsage(accountIds: string[]) {
  const [usageMap, setUsageMap] = useState<Record<string, AccountUsage>>({});

  const fetchAll = useCallback(async () => {
    const results: Record<string, AccountUsage> = {};
    await Promise.allSettled(
      accountIds.map(async (id) => {
        results[id] = { ...EMPTY_USAGE, refreshing: true };
        setUsageMap((prev) => ({ ...prev, [id]: { ...EMPTY_USAGE, refreshing: true } }));
        results[id] = await fetchUsage(id);
      })
    );
    setUsageMap((prev) => {
      const next = { ...prev };
      for (const [id, usage] of Object.entries(results)) {
        next[id] = usage;
      }
      return next;
    });
  }, [accountIds.join(",")]);

  const refetchAccount = useCallback(async (accountId: string) => {
    setUsageMap((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || EMPTY_USAGE), refreshing: true },
    }));
    const result = await fetchUsage(accountId);
    setUsageMap((prev) => ({ ...prev, [accountId]: result }));
  }, []);

  return { usageMap, fetchAll, refetchAccount };
}
