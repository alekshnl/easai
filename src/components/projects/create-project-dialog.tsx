"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Plus, ChevronDown, Check } from "lucide-react";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, workspaceFolder: string) => void;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [workspaceFolder, setWorkspaceFolder] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [basePath, setBasePath] = useState("");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setWorkspaceFolder("");
      return;
    }
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setFolders(data.folders || []);
        setBasePath(data.basePath || "");
      })
      .catch(console.error);
  }, [open]);

  const displayName = workspaceFolder
    ? workspaceFolder.replace(/^.*[\/\\]/, "")
    : "Selecteer werkmap";

  const handleSubmit = () => {
    if (!name.trim() || !workspaceFolder) return;
    onSubmit(name.trim(), workspaceFolder);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md font-mono">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm font-semibold">
            Nieuw project
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-muted-foreground">
            Maak een project aan met een werkmap
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Projectnaam
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mijn project"
              className="font-mono text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Werkmap
            </label>
            <DropdownMenu open={folderPickerOpen} onOpenChange={setFolderPickerOpen}>
              <DropdownMenuTrigger
                className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 font-mono text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">
                  {displayName}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel
                    className="font-mono text-[10px] text-muted-foreground/50 truncate"
                    title={basePath}
                  >
                    {pathBasename(basePath)}
                  </DropdownMenuLabel>
                  {folders.length === 0 ? (
                    <div className="px-3 py-2 font-mono text-xs text-muted-foreground/50">
                      Geen mappen gevonden
                    </div>
                  ) : (
                    folders.map((folder) => {
                      const fullPath = pathJoin(basePath, folder);
                      const isActive = workspaceFolder === fullPath;
                      return (
                        <DropdownMenuItem
                          key={folder}
                          className="font-mono text-xs gap-2"
                          onClick={() => {
                            setWorkspaceFolder(fullPath);
                            setFolderPickerOpen(false);
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                          <span className="flex-1 truncate">{folder}</span>
                          {isActive && (
                            <Check className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </DropdownMenuItem>
                      );
                    })
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu            >
            <p className="text-[10px] text-muted-foreground/60">
              Alle chats binnen dit project gebruiken deze werkmap
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="font-mono text-xs"
            onClick={() => onOpenChange(false)}
          >
            Annuleren
          </Button>
          <Button
            size="sm"
            className="gap-2 font-mono text-xs"
            onClick={handleSubmit}
            disabled={!name.trim() || !workspaceFolder}
          >
            <Plus className="h-3.5 w-3.5" />
            Aanmaken
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function pathJoin(base: string, segment: string): string {
  return base.replace(/\/+$/, "") + "/" + segment;
}

function pathBasename(p: string): string {
  return p.split("/").filter(Boolean).pop() || p;
}
