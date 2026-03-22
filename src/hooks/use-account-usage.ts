"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const CLIENT_USAGE_CACHE = new Map<string, AccountUsage>();

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

export interface FetchAllUsageOptions {
  force?: boolean;
  resetTimer?: boolean;
}

const EMPTY_USAGE: AccountUsage = {
  primary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
  secondary: { usedPercent: null, resetAfterSeconds: null, resetAt: null },
  fetchedAt: 0,
  error: null,
  refreshing: false,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const inFlightRequests = new Map<string, Promise<AccountUsage>>();

function getRequestKey(accountId: string, force = false) {
  return `${accountId}:${force ? "force" : "default"}`;
}

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

async function fetchUsage(accountId: string, options?: { force?: boolean }): Promise<AccountUsage> {
  const searchParams = new URLSearchParams({ accountId });
  if (options?.force) {
    searchParams.set("force", "1");
  }

  try {
    const res = await fetch(`/api/usage?${searchParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const result = { ...parseResponse(data), refreshing: false };
      CLIENT_USAGE_CACHE.set(accountId, result);
      return result;
    }
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    const fallback = CLIENT_USAGE_CACHE.get(accountId);
    if (fallback) {
      return { ...fallback, error: err.error || `HTTP ${res.status}`, refreshing: false };
    }
    return { ...EMPTY_USAGE, error: err.error || `HTTP ${res.status}`, refreshing: false };
  } catch (err) {
    const fallback = CLIENT_USAGE_CACHE.get(accountId);
    if (fallback) {
      return { ...fallback, error: String(err), refreshing: false };
    }
    return { ...EMPTY_USAGE, error: String(err), refreshing: false };
  }
}

export function useAccountUsage(accountIds: string[]) {
  const [usageMap, setUsageMap] = useState<Record<string, AccountUsage>>(() => {
    const initial: Record<string, AccountUsage> = {};
    for (const accountId of accountIds) {
      const cached = CLIENT_USAGE_CACHE.get(accountId);
      if (cached) {
        initial[accountId] = cached;
      }
    }
    return initial;
  });
  const usageMapRef = useRef<Record<string, AccountUsage>>({});
  const accountIdsRef = useRef<string[]>(accountIds);
  const [refreshCycleStartAt, setRefreshCycleStartAt] = useState<number | null>(() => (accountIds.length > 0 ? Date.now() : null));

  useEffect(() => {
    usageMapRef.current = usageMap;
  }, [usageMap]);

  useEffect(() => {
    accountIdsRef.current = accountIds;
  }, [accountIds.join(",")]);

  useEffect(() => {
    if (accountIds.length === 0) {
      setRefreshCycleStartAt(null);
    } else if (refreshCycleStartAt === null) {
      setRefreshCycleStartAt(Date.now());
    }
  }, [accountIds.join(","), refreshCycleStartAt]);

  const refetchAccount = useCallback(async (accountId: string, options?: { force?: boolean }) => {
    const current = usageMapRef.current[accountId] || CLIENT_USAGE_CACHE.get(accountId);
    const force = options?.force === true;
    const isFresh = !!current && Date.now() - current.fetchedAt < CACHE_TTL_MS;
    if (!force && isFresh) {
      if (usageMapRef.current[accountId] !== current) {
        setUsageMap((prev) => ({ ...prev, [accountId]: current }));
      }
      return current;
    }

    const inFlightKey = getRequestKey(accountId, force);
    const existingRequest = inFlightRequests.get(inFlightKey);
    if (existingRequest) {
      if (usageMapRef.current[accountId] !== current && current) {
        setUsageMap((prev) => ({ ...prev, [accountId]: current }));
      }
      return existingRequest;
    }

    setUsageMap((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || current || EMPTY_USAGE), refreshing: true },
    }));

    const request = fetchUsage(accountId, options)
      .then((result) => {
        setUsageMap((prev) => ({ ...prev, [accountId]: result }));
        return result;
      })
      .finally(() => {
        inFlightRequests.delete(inFlightKey);
      });

    inFlightRequests.set(inFlightKey, request);
    return request;
  }, []);

  const accountIdsKey = accountIds.join(",");
  const fetchAll = useCallback(async (options?: FetchAllUsageOptions) => {
    if (options?.resetTimer) {
      setRefreshCycleStartAt(Date.now());
    }
    await Promise.allSettled(accountIdsRef.current.map((id) => refetchAccount(id, options)));
  }, [accountIdsKey, refetchAccount]);

  useEffect(() => {
    setUsageMap((prev) => {
      const next: Record<string, AccountUsage> = {};
      for (const accountId of accountIds) {
        const usage = prev[accountId] || CLIENT_USAGE_CACHE.get(accountId);
        if (usage) {
          next[accountId] = usage;
        }
      }
      if (Object.keys(next).length !== Object.keys(prev).length || 
          Object.keys(next).some(k => !prev[k])) {
        return next;
      }
      return prev;
    });

    for (const cachedId of CLIENT_USAGE_CACHE.keys()) {
      if (!accountIds.includes(cachedId)) {
        CLIENT_USAGE_CACHE.delete(cachedId);
      }
    }
  }, [accountIds.join(",")]);

  useEffect(() => {
    if (accountIds.length === 0) {
      return;
    }

    void fetchAll();
    setRefreshCycleStartAt(Date.now());

    return undefined;
  }, [accountIdsKey, fetchAll]);

  useEffect(() => {
    if (accountIds.length === 0 || refreshCycleStartAt === null) {
      return;
    }

    const elapsed = Date.now() - refreshCycleStartAt;
    const delay = Math.max(0, CACHE_TTL_MS - elapsed);

    const timeout = setTimeout(() => {
      void fetchAll({ resetTimer: true });
    }, delay);

    return () => clearTimeout(timeout);
  }, [accountIdsKey, fetchAll, refreshCycleStartAt]);

  return { usageMap, fetchAll, refetchAccount, refreshCycleStartAt };
}
