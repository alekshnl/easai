"use client";

import React, { useState, useMemo } from "react";
import {
  Terminal,
  FileText,
  Pencil,
  Save,
  FolderOpen,
  Search,
  Globe,
  ListTodo,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  Bot,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolCallDisplayData {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: "running" | "completed" | "error";
  error?: string;
  workerId?: string;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  bash: <Terminal className="h-3 w-3" />,
  read: <FileText className="h-3 w-3" />,
  write: <Save className="h-3 w-3" />,
  edit: <Pencil className="h-3 w-3" />,
  list: <FolderOpen className="h-3 w-3" />,
  glob: <FolderOpen className="h-3 w-3" />,
  grep: <Search className="h-3 w-3" />,
  webfetch: <Globe className="h-3 w-3" />,
  websearch: <Globe className="h-3 w-3" />,
  todowrite: <ListTodo className="h-3 w-3" />,
  task: <Bot className="h-3 w-3" />,
};

function getToolIcon(name: string) {
  return TOOL_ICONS[name] || <Wrench className="h-3 w-3" />;
}

function formatArguments(name: string, argsStr: string): string {
  try {
    const args = JSON.parse(argsStr);
    if (name === "bash") return args.command || argsStr;
    if (name === "read") return args.filePath || argsStr;
    if (name === "write" || name === "edit") return args.filePath || argsStr;
    if (name === "glob") return args.pattern || argsStr;
    if (name === "grep") return args.pattern || argsStr;
    if (name === "webfetch") return args.url || argsStr;
    if (name === "websearch") return args.query || argsStr;
    if (name === "list") return args.path || "(root)";
    if (name === "todowrite") {
      const count = Array.isArray(args.todos) ? args.todos.length : 0;
      return `${count} todo(s)`;
    }
    if (name === "task") {
      const prompt = args.prompt || argsStr;
      return prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt;
    }
    return argsStr.slice(0, 50);
  } catch {
    return argsStr.slice(0, 50);
  }
}

interface WorkerGroupProps {
  workerId: string;
  toolCalls: ToolCallDisplayData[];
  isExpanded: boolean;
  onToggle: () => void;
}

function WorkerGroup({ workerId, toolCalls, isExpanded, onToggle }: WorkerGroupProps) {
  const runningCount = toolCalls.filter((tc) => tc.status === "running").length;
  const completedCount = toolCalls.filter((tc) => tc.status === "completed").length;
  const errorCount = toolCalls.filter((tc) => tc.status === "error").length;

  const isWorkerRunning = runningCount > 0;
  const hasError = errorCount > 0;

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        )}
        <Bot className={cn(
          "h-3.5 w-3.5 shrink-0",
          isWorkerRunning ? "text-blue-500 animate-pulse" : hasError ? "text-destructive" : "text-muted-foreground"
        )} />
        <span className="font-mono text-xs font-medium text-foreground shrink-0">
          {workerId === "Main" ? "Main" : `Worker ${workerId}`}
        </span>
        <span className="text-[10px] text-muted-foreground/60 shrink-0">
          ({toolCalls.length})
        </span>
        {isWorkerRunning && (
          <Loader2 className="h-3 w-3 animate-spin text-blue-500 ml-auto shrink-0" />
        )}
        {!isWorkerRunning && completedCount === toolCalls.length && (
          <span className="text-[10px] text-emerald-500/80 ml-auto shrink-0">done</span>
        )}
        {!isWorkerRunning && hasError && (
          <span className="text-[10px] text-destructive/80 ml-auto shrink-0">error</span>
        )}
      </button>

      {isExpanded && (
        <div className="pb-1.5 px-2 space-y-0.5">
          {toolCalls.map((tc) => (
            <div
              key={tc.id}
              className="flex items-center gap-1.5 py-0.5 px-1.5 rounded text-[10px] font-mono bg-muted/30"
            >
              <span className="text-muted-foreground/70 shrink-0">
                {getToolIcon(tc.name)}
              </span>
              <span className="text-muted-foreground font-medium shrink-0">
                {tc.name}
              </span>
              <span className="text-muted-foreground/40 truncate min-w-0">
                {formatArguments(tc.name, tc.arguments)}
              </span>
              {tc.status === "running" && (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500 ml-auto shrink-0" />
              )}
              {tc.status === "completed" && (
                <span className="text-emerald-500/80 ml-auto shrink-0">✓</span>
              )}
              {tc.status === "error" && (
                <span className="text-destructive/80 ml-auto shrink-0">✗</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ActionsPanelProps {
  toolCalls: ToolCallDisplayData[];
}

export function ActionsPanel({ toolCalls }: ActionsPanelProps) {
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set(["Main"]));

  const workerGroups = useMemo(() => {
    const groups = new Map<string, ToolCallDisplayData[]>();
    
    for (const tc of toolCalls) {
      const workerId = tc.workerId || "Main";
      if (!groups.has(workerId)) {
        groups.set(workerId, []);
      }
      groups.get(workerId)!.push(tc);
    }

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === "Main") return -1;
      if (b[0] === "Main") return 1;
      return a[0].localeCompare(b[0]);
    });

    return sortedGroups;
  }, [toolCalls]);

  const runningCount = toolCalls.filter((tc) => tc.status === "running").length;

  const toggleWorker = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  if (toolCalls.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 bg-muted/30">
        <Zap className={cn(
          "h-3.5 w-3.5",
          runningCount > 0 ? "text-blue-500 animate-pulse" : "text-muted-foreground"
        )} />
        <span className="font-mono text-xs font-medium text-foreground">
          Actions
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          ({toolCalls.length})
        </span>
        {runningCount > 0 && (
          <span className="text-[10px] text-blue-500 ml-auto animate-pulse">
            {runningCount} running...
          </span>
        )}
      </div>

      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {workerGroups.map(([workerId, calls]) => (
          <WorkerGroup
            key={workerId}
            workerId={workerId}
            toolCalls={calls}
            isExpanded={expandedWorkers.has(workerId)}
            onToggle={() => toggleWorker(workerId)}
          />
        ))}
      </div>
    </div>
  );
}
