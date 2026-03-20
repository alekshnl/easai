"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { GitCommitHorizontal, GitMerge, GitBranch } from "lucide-react";

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

const QUICK_ACTIONS = [
  {
    label: "Git create feature",
    icon: GitBranch,
    prompt: 'Git create feature ""',
  },
  {
    label: "Git+Commit",
    icon: GitCommitHorizontal,
    prompt:
      "Review the staged changes and create an appropriate git commit with a clear, descriptive commit message following conventional commits format, then push to remote.",
  },
  {
    label: "Git+Commit, feature>main, switch",
    icon: GitMerge,
    prompt:
      "Commit all staged changes with a descriptive message, then merge the current feature branch into main, and switch to the main branch.",
  },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 rounded-md border-border/60 bg-background/50 font-mono text-xs text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
          onClick={() => onAction(action.prompt)}
          disabled={disabled}
        >
          <action.icon className="h-3 w-3" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}
