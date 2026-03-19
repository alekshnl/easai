"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-mono">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold">
            Instellingen
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Configureer easai
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="py-6">
          <p className="font-mono text-xs text-muted-foreground/40 text-center">
            Nog geen instellingen beschikbaar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
