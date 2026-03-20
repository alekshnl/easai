"use client";

import React, { useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Settings, Plus, ChevronDown, RefreshCw } from "lucide-react";
import { getModelsForProvider, MODELS } from "@/lib/models";
import type { Account } from "@/hooks/use-accounts";
import type { AccountUsage } from "@/hooks/use-account-usage";

interface TopbarProps {
  accounts: Account[];
  selectedAccountId: string | null;
  selectedModel: string | null;
  usageMap: Record<string, AccountUsage>;
  onAccountModelChange: (accountId: string, model: string) => void;
  onAddAccount: (provider: string) => void;
  onDeleteAccount: (id: string) => void;
  onLinkApiKey: (accountId: string) => void;
  onRenameAccount: (accountId: string, name: string) => void;
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
  open,
  onOpenChange,
  onAccountModelChange,
  onDeleteAccount,
  onRefetchUsage,
  onLinkApiKey,
  onRenameAccount,
}: {
  account: Account;
  isActive: boolean;
  selectedModel: string | null;
  usage: AccountUsage | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountModelChange: (accountId: string, model: string) => void;
  onDeleteAccount: (id: string) => void;
  onRefetchUsage: (accountId: string) => void;
  onLinkApiKey: (accountId: string) => void;
  onRenameAccount: (accountId: string, name: string) => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(account.name);
  const models = getModelsForProvider(account.provider);

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== account.name) {
      onRenameAccount(account.id, trimmed);
    }
    setRenameOpen(false);
  };

  const handleDelete = () => {
    onDeleteAccount(account.id);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        onMouseEnter={() => onOpenChange(true)}
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
        onMouseEnter={() => onOpenChange(true)}
        onMouseLeave={() => onOpenChange(false)}
      >
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel
              className="text-xs font-normal text-muted-foreground p-0 cursor-pointer hover:text-foreground transition-colors"
              onDoubleClick={() => { setRenameValue(account.name); setRenameOpen(true); }}
            >
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

          {models.map((model) => {
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
                  onOpenChange(false);
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
          onClick={() => setDeleteOpen(true)}
        >
          Verwijder account
        </DropdownMenuItem>

        {account.provider === "zai" && !account.apiKey && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-xs text-primary cursor-pointer"
              onClick={() => { onLinkApiKey(account.id); onOpenChange(false); }}
            >
              API key koppelen
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      <Dialog open={renameOpen} onOpenChange={(v) => { if (!v) setRenameOpen(false); }}>
        <DialogContent className="max-w-xs font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Naam wijzigen</DialogTitle>
          </DialogHeader>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="font-mono text-xs" onClick={() => setRenameOpen(false)}>Annuleren</Button>
            <Button size="sm" className="font-mono text-xs" onClick={handleRename}>Opslaan</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}>
        <DialogContent className="max-w-xs font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Account verwijderen</DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Weet je zeker dat je <strong>{account.name}</strong> wilt verwijderen? Dit kan niet ongedaan worden.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="font-mono text-xs" onClick={() => setDeleteOpen(false)}>Annuleren</Button>
            <Button size="sm" className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Verwijderen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}

function AddAccountDropdown({ onAddAccount }: { onAddAccount: (provider: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        onMouseEnter={() => setOpen(true)}
        className="flex items-center justify-center h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground/70 rounded-md transition-colors"
      >
        <Plus className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="font-mono"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/40">
            Account toevoegen
          </DropdownMenuLabel>
          <DropdownMenuItem
            className="gap-2 text-xs cursor-pointer"
            onClick={() => { onAddAccount("openai"); setOpen(false); }}
          >
            <span>OpenAI</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs cursor-pointer"
            onClick={() => { onAddAccount("zai"); setOpen(false); }}
          >
            <span>Z.AI Coding Plan</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
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
  onLinkApiKey,
  onRenameAccount,
}: TopbarProps) {
  const activeModel = selectedModel
    ? MODELS.find((m) => m.id === selectedModel)
    : null;

  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  const handleOpenChange = useCallback((accountId: string, open: boolean) => {
    setOpenAccountId(open ? accountId : null);
  }, []);

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
            open={openAccountId === account.id}
            onOpenChange={(open) => handleOpenChange(account.id, open)}
            onAccountModelChange={onAccountModelChange}
            onDeleteAccount={onDeleteAccount}
            onRefetchUsage={onRefetchAccountUsage}
            onLinkApiKey={onLinkApiKey}
            onRenameAccount={onRenameAccount}
          />
        ))}

        <AddAccountDropdown onAddAccount={(provider) => { setOpenAccountId(null); onAddAccount(provider); }} />
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
