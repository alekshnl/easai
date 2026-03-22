"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save } from "lucide-react";
import { useProviderInstructions, ProviderInstructions } from "@/hooks/use-provider-instructions";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProviderModeSectionProps {
  provider: "openai" | "zai";
  mode: "plan" | "build";
  data: ProviderInstructions | null;
  originalData: ProviderInstructions | null;
  updateInstruction: (provider: string, mode: string, text: string) => void;
  updateRepeatEveryPrompt: (provider: string, mode: string, value: boolean) => void;
  saveInstruction: (provider: string, mode: string) => Promise<void>;
  resetInstruction: (provider: string, mode: string) => Promise<void>;
}

function ProviderModeSection({
  provider,
  mode,
  data,
  originalData,
  updateInstruction,
  updateRepeatEveryPrompt,
  saveInstruction,
  resetInstruction,
}: ProviderModeSectionProps) {
  const config = data?.[provider]?.[mode];
  const originalConfig = originalData?.[provider]?.[mode];
  const borderColor = mode === "plan" ? "border-amber-500" : "border-blue-500";
  const [isSaving, setIsSaving] = useState(false);

  const currentInstruction = config?.instruction || "";
  const originalInstruction = originalConfig?.instruction || "";
  const hasChanges = currentInstruction !== originalInstruction;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateInstruction(provider, mode, e.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveInstruction(provider, mode);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    await resetInstruction(provider, mode);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${provider}-${mode}-repeat`}
          checked={config?.repeatEveryPrompt ?? true}
          onCheckedChange={(checked: boolean) =>
            updateRepeatEveryPrompt(provider, mode, checked)
          }
        />
        <label
          htmlFor={`${provider}-${mode}-repeat`}
          className="text-[10px] font-mono text-muted-foreground"
        >
          Instructies bij elke prompt meesturen
        </label>
      </div>

      <div>
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40 mb-1">
          {mode === "plan" ? "Plan Mode" : "Build Mode"}
        </div>
        <Textarea
          value={config?.instruction || ""}
          onChange={handleChange}
          placeholder="Geen instructies"
          className={`min-h-[120px] text-[10px] font-mono ${borderColor}`}
        />
        <div className="flex items-center justify-between mt-1">
          {hasChanges ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[9px] font-mono text-primary hover:text-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className={`h-3 w-3 mr-1 ${isSaving ? "animate-pulse" : ""}`} />
              {isSaving ? "Opslaan..." : "Opslaan"}
            </Button>
          ) : (
            <div />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-2 text-[9px] font-mono text-destructive hover:text-destructive"
            onClick={handleReset}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data, originalData, isLoading, error, updateInstruction, updateRepeatEveryPrompt, saveInstruction, resetInstruction } =
    useProviderInstructions();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const unsavedChanges = useMemo(() => {
    if (!data || !originalData) return [];

    const changes: Array<{ provider: string; mode: string }> = [];

    if (data.openai.plan.instruction !== originalData.openai.plan.instruction) {
      changes.push({ provider: "OpenAI", mode: "Plan" });
    }
    if (data.openai.build.instruction !== originalData.openai.build.instruction) {
      changes.push({ provider: "OpenAI", mode: "Build" });
    }
    if (data.zai.plan.instruction !== originalData.zai.plan.instruction) {
      changes.push({ provider: "Z.AI", mode: "Plan" });
    }
    if (data.zai.build.instruction !== originalData.zai.build.instruction) {
      changes.push({ provider: "Z.AI", mode: "Build" });
    }

    return changes;
  }, [data, originalData]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && unsavedChanges.length > 0) {
      setShowConfirmDialog(true);
    } else {
      onOpenChange(newOpen);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onOpenChange(false);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[2800px] font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              Instellingen
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 flex items-center justify-center">
            <div className="text-xs text-muted-foreground">Laden...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[2800px] font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              Instellingen
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 flex items-center justify-center">
            <div className="text-xs text-destructive">{error}</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-1/2 font-mono max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              Instellingen
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Configureer easai
            </DialogDescription>
          </DialogHeader>

          <Separator />

          <Tabs defaultValue="general" className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="general" className="font-mono text-xs">
                General
              </TabsTrigger>
              <TabsTrigger value="provider-instructions" className="font-mono text-xs">
                Provider Instructions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto mt-2">
              <div className="py-6">
                <p className="font-mono text-xs text-muted-foreground/40 text-center">
                  Nog geen instellingen beschikbaar
                </p>
              </div>
            </TabsContent>

            <TabsContent
              value="provider-instructions"
              className="flex-1 min-h-0 overflow-y-auto mt-2"
            >
              <div className="h-full flex flex-col">
                <Tabs defaultValue="openai" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <TabsList className="w-full justify-start shrink-0">
                    <TabsTrigger value="openai" className="font-mono text-xs">
                      OpenAI
                    </TabsTrigger>
                    <TabsTrigger value="zai" className="font-mono text-xs">
                      Z.AI
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="openai" className="flex-1 min-h-0 overflow-y-auto">
                    <div className="py-6 space-y-4">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
                        OpenAI
                      </div>

                      <ProviderModeSection
                        provider="openai"
                        mode="plan"
                        data={data}
                        originalData={originalData}
                        updateInstruction={updateInstruction}
                        updateRepeatEveryPrompt={updateRepeatEveryPrompt}
                        saveInstruction={saveInstruction}
                        resetInstruction={resetInstruction}
                      />

                      <Separator className="my-3" />

                      <ProviderModeSection
                        provider="openai"
                        mode="build"
                        data={data}
                        originalData={originalData}
                        updateInstruction={updateInstruction}
                        updateRepeatEveryPrompt={updateRepeatEveryPrompt}
                        saveInstruction={saveInstruction}
                        resetInstruction={resetInstruction}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="zai" className="flex-1 min-h-0 overflow-y-auto">
                    <div className="py-6 space-y-4">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">
                        Z.AI
                      </div>

                      <ProviderModeSection
                        provider="zai"
                        mode="plan"
                        data={data}
                        originalData={originalData}
                        updateInstruction={updateInstruction}
                        updateRepeatEveryPrompt={updateRepeatEveryPrompt}
                        saveInstruction={saveInstruction}
                        resetInstruction={resetInstruction}
                      />

                      <Separator className="my-3" />

                      <ProviderModeSection
                        provider="zai"
                        mode="build"
                        data={data}
                        originalData={originalData}
                        updateInstruction={updateInstruction}
                        updateRepeatEveryPrompt={updateRepeatEveryPrompt}
                        saveInstruction={saveInstruction}
                        resetInstruction={resetInstruction}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="w-[500px] font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">
              Niet-opgeslagen wijzigingen
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              Weet je zeker dat je wilt sluiten zonder op te slaan?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="text-[10px] font-mono text-muted-foreground">
              De volgende velden hebben wijzigingen:
            </div>
            <ul className="mt-2 space-y-1">
              {unsavedChanges.map((change, index) => (
                <li key={index} className="text-[10px] font-mono text-primary">
                  • {change.provider} - {change.mode} Mode
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-xs"
              onClick={() => setShowConfirmDialog(false)}
            >
              Annuleren
            </Button>
            <Button
              variant="default"
              size="sm"
              className="font-mono text-xs"
              onClick={handleConfirmClose}
            >
              Sluiten zonder opslaan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
