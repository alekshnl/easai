"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ZaiApiKeyDialogProps {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
  onDone: () => void;
}

export function ZaiApiKeyDialog({ open, accountId, onClose, onDone }: ZaiApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLinking = !!accountId;

  const handleSubmit = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const url = isLinking ? `/api/accounts/${accountId}/api-key` : "/api/accounts/zai";
      const method = isLinking ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Mislukt");
        return;
      }

      onDone();
    } catch {
      setError("Netwerkfout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setApiKey(""); setError(null); } }}>
      <DialogContent className="max-w-sm font-mono">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold">
            Z.AI API key
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground leading-relaxed">
            {isLinking
              ? "Plak je Z.AI API key om deze te koppelen aan je account."
              : "Plak je Z.AI API key om een account toe te voegen."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Plak API key..."
            className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />

          {error && (
            <div className="text-[11px] text-destructive/70">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => { onClose(); setApiKey(""); setError(null); }}
              disabled={loading}
            >
              Annuleren
            </Button>
            <Button
              size="sm"
              className="font-mono text-xs"
              onClick={handleSubmit}
              disabled={loading || !apiKey.trim()}
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              {isLinking ? "Koppelen" : "Toevoegen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
