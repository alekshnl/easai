"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OAuthWaitDialogProps {
  open: boolean;
  onCancel: () => void;
}

export function OAuthWaitDialog({ open, onCancel }: OAuthWaitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm font-mono">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            Wachten op authenticatie
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground leading-relaxed">
            Er is een nieuw tabblad geopend met de OpenAI inlogpagina.
            <br /><br />
            Log in met je OpenAI account en geef toestemming. Dit venster sluit automatisch.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs"
            onClick={onCancel}
          >
            Annuleren
          </Button>
        </div>
      </DialogContent>
    </Dialog>

  );
}
