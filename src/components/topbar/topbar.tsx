"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings, Plus, ChevronDown, RefreshCw } from "lucide-react";
import { OPENAI_MODELS } from "@/lib/openai/models";
import type { Account } from "@/hooks/use-accounts";
import type { AccountUsage } from "@/hooks/use-account-usage";

interface TopbarProps {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedModel: string | null;
  usageMap: Record<string, AccountUsage>;
  onAccountModelChange: (accountId: string, model: string) => void;
  onAddAccount: () => void;
  onDeleteAccount: (id: string) => void;
  onOpenSettings: () => void;
  onFetchAllUsage: () => void;
  onRefetchAccountUsage: (accountId: string) => void;
}

function formatResetTime(date: Date | null): string {
  if (!date) return "";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "nu";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}u ${remainingMinutes}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}u`;
}

function UsageBar({ percent, label, resetAt }: { percent: number | null; label: string; resetAt: Date | null }) {
  const pct = percent ?? 0;
  const color =
    pct >= 80 ? "bg-destructive/70" : pct >= 50 ? "bg-amber-500/70" : "bg-emerald-500/70";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground/60">
          {percent !== null ? `${Math.round(pct)}%` : "–"}
          {resetAt && (
            <span className="ml-1.5">reset {formatResetTime(resetAt)}</span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function AccountDropdown({
  account,
  isActive,
  selectedModel,
  usage,
  onAccountModelChange,
  onDeleteAccount,
  onRefetchUsage,
}: {
  account: Account;
  isActive: boolean;
  selectedModel: string | null;
  usage: AccountUsage | undefined;
  onAccountModelChange: (accountId: string, model: string) => void;
  onDeleteAccount: (id: string) => void;
  onRefetchUsage: (accountId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        onMouseEnter={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors",
          isActive
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"
        )}
      >
        <div className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          isActive ? "bg-primary" : "bg-muted-foreground/30"
        )} />
        <span className="truncate max-w-[200px]">{account.name}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 font-mono"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground p-0">
              {account.name}
            </DropdownMenuLabel>
            <button
              onClick={() => onRefetchUsage(account.id)}
              className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
              title="Usage vernieuwen"
            >
              <RefreshCw className={cn("h-3 w-3", usage?.refreshing && "animate-spin")} />
            </button>
          </div>

          <div className="px-2 py-2 space-y-3">
            {usage?.error ? (
              <div className="text-[11px] text-destructive/70">
                {usage.error}
              </div>
            ) : usage?.fetchedAt ? (
              <>
                <UsageBar
                  label="5-hour window"
                  percent={usage.primary.usedPercent}
                  resetAt={usage.primary.resetAt}
                />
                <UsageBar
                  label="Weekly window"
                  percent={usage.secondary.usedPercent}
                  resetAt={usage.secondary.resetAt}
                />
              </>
            ) : (
              <div className="text-[11px] text-muted-foreground/50">
                Nog niet opgehaald
              </div>
            )}
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
            Model
          </DropdownMenuLabel>

          {OPENAI_MODELS.map((model) => {
            const isSelected = isActive && selectedModel === model.id;
            return (
              <DropdownMenuItem
                key={model.id}
                className={cn(
                  "gap-2 text-xs cursor-pointer",
                  isSelected && "bg-sidebar-accent"
                )}
                onClick={() => {
                  onAccountModelChange(account.id, model.id);
                  setOpen(false);
                }}
              >
                <div className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  isSelected ? "bg-primary" : "border border-muted-foreground/30"
                )} />
                <span>{model.name}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 text-xs text-destructive/70 cursor-pointer"
          onClick={() => onDeleteAccount(account.id)}
        >
          Verwijder account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({
  accounts,
  selectedAccountId,
  selectedModel,
  usageMap,
  onAccountModelChange,
  onAddAccount,
  onDeleteAccount,
  onOpenSettings,
  onFetchAllUsage,
  onRefetchAccountUsage,
}: TopbarProps) {
  const activeModel = selectedModel
    ? OPENAI_MODELS.find((m) => m.id === selectedModel)
    : null;

  return (
    <div className="flex items-center justify-between border-b border-border/30 px-3 py-1.5">
      <div className="flex items-center gap-1">
        {accounts.map((account) => (
          <AccountDropdown
            key={account.id}
            account={account}
            isActive={account.id === selectedAccountId}
            selectedModel={selectedModel}
            usage={usageMap[account.id]}
            onAccountModelChange={onAccountModelChange}
            onDeleteAccount={onDeleteAccount}
            onRefetchUsage={onRefetchAccountUsage}
          />
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground/70"
          onClick={onAddAccount}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {activeModel && selectedAccountId && (
          <span className="font-mono text-[11px] text-muted-foreground/50">
            {activeModel.name}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground/70"
          onClick={onOpenSettings}
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
