"use client";

import React, { useState, useCallback } from "react";
import { MessageList } from "./message-list";
import { PromptInput } from "./prompt-input";
import { useChat } from "@/hooks/use-chat";
import type { Account } from "@/hooks/use-accounts";
import type { Session } from "@/hooks/use-sessions";

interface ChatViewProps {
  session: Session | null;
  accounts: Account[];
  selectedAccountId: string | null;
  selectedModel: string | null;
  onAccountModelChange: (accountId: string, model: string) => void;
  onSessionUpdate?: () => void;
}

export function ChatView({
  session,
  accounts,
  selectedAccountId,
  selectedModel,
  onAccountModelChange,
  onSessionUpdate,
}: ChatViewProps) {
  const [prompt, setPrompt] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [mode, setMode] = useState<"plan" | "build">("build");

  const {
    messages,
    streaming,
    streamingContent,
    activeToolCalls,
    error,
    sendMessage,
  } = useChat(session?.id ?? null);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || !session || !selectedAccountId || !selectedModel) return;

    const content = prompt.trim();
    setPrompt("");

    await sendMessage(content, selectedAccountId, selectedModel, reasoningEffort, mode);
    onSessionUpdate?.();
  }, [
    prompt,
    session,
    selectedAccountId,
    selectedModel,
    reasoningEffort,
    mode,
    sendMessage,
    onSessionUpdate,
  ]);

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="font-mono text-4xl font-light tracking-widest text-muted-foreground/20">
          easai
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList
        messages={messages}
        streaming={streaming}
        streamingContent={streamingContent}
        activeToolCalls={activeToolCalls}
        error={error}
      />
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        onSubmit={handleSubmit}
        streaming={streaming}
        selectedAccountId={selectedAccountId}
        selectedModel={selectedModel}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={setReasoningEffort}
        mode={mode}
        onModeChange={setMode}
        accounts={accounts}
        onAccountChange={onAccountModelChange}
        disabled={!session}
      />
    </div>
  );
}
