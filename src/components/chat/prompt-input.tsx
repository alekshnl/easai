"use client";

import React, { useRef, useEffect, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { QuickActions } from "./quick-actions";
import { ArrowUp, ChevronDown, Loader2, Lightbulb, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/hooks/use-accounts";
import { OPENAI_MODELS } from "@/lib/openai/models";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  streaming: boolean;
  selectedAccountId: string | null;
  selectedModel: string | null;
  reasoningEffort: string;
  onReasoningEffortChange: (effort: string) => void;
  mode: "plan" | "build";
  onModeChange: (mode: "plan" | "build") => void;
  accounts: Account[];
  onAccountChange: (accountId: string, model: string) => void;
  disabled?: boolean;
}

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

export function PromptInput({
  value,
  onChange,
  onSubmit,
  streaming,
  selectedAccountId,
  selectedModel,
  reasoningEffort,
  onReasoningEffortChange,
  mode,
  onModeChange,
  accounts,
  onAccountChange,
  disabled,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !streaming && !disabled) {
        onSubmit();
      }
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedModelDef = OPENAI_MODELS.find((m) => m.id === selectedModel);

  const selectorLabel =
    selectedAccount && selectedModelDef
      ? `${selectedModelDef.name}`
      : "Selecteer model";

  return (
    <div className="flex flex-col gap-2 border-t border-border/40 bg-background/80 px-4 pb-4 pt-3 backdrop-blur-sm">
      {/* Quick actions */}
      <QuickActions onAction={(prompt) => onChange(prompt)} disabled={streaming || disabled} />

      {/* Input area */}
      <div className="relative flex items-end gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 shadow-sm focus-within:border-border focus-within:shadow-md transition-all">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stel een vraag of geef een opdracht... (Enter om te verzenden, Shift+Enter voor nieuwe regel)"
          className="min-h-[40px] max-h-[240px] flex-1 resize-none border-0 bg-transparent p-0 font-mono text-sm shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
          disabled={streaming || disabled}
          rows={1}
        />

        <Button
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg transition-all",
            value.trim() && !streaming && !disabled
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          onClick={onSubmit}
          disabled={!value.trim() || streaming || disabled}
        >
          {streaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Bottom bar: model selector + reasoning effort */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: mode toggle + model selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onModeChange(mode === "plan" ? "build" : "plan")}
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
              mode === "plan"
                ? "bg-amber-500/10 text-amber-500 font-medium"
                : "bg-primary/10 text-primary font-medium"
            )}
          >
            {mode === "plan" ? (
              <><Lightbulb className="h-3 w-3" /> Plan</>
            ) : (
              <><Hammer className="h-3 w-3" /> Build</>
            )}
          </button>

          <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-6 items-center gap-1 rounded px-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {selectorLabel}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            {accounts.length === 0 ? (
              <div className="px-3 py-2 font-mono text-xs text-muted-foreground">
                Geen accounts — voeg een account toe in de sidebar
              </div>
            ) : (
              accounts.map((account) => (
                <DropdownMenuGroup key={account.id}>
                  <DropdownMenuLabel className="font-mono text-xs text-muted-foreground">
                    {account.name}
                  </DropdownMenuLabel>
                  {OPENAI_MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      className="font-mono text-xs"
                      onClick={() => onAccountChange(account.id, model.id)}
                    >
                      <span
                        className={cn(
                          "mr-2 h-1.5 w-1.5 rounded-full",
                          selectedAccountId === account.id &&
                            selectedModel === model.id
                            ? "bg-primary"
                            : "bg-transparent"
                        )}
                      />
                      {model.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </DropdownMenuGroup>
              ))
            )}
          </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Reasoning effort */}
        <div className="flex items-center gap-1">
          {REASONING_EFFORTS.map((effort) => (
            <button
              key={effort}
              onClick={() => onReasoningEffortChange(effort)}
              className={cn(
                "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
                reasoningEffort === effort
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {effort}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
