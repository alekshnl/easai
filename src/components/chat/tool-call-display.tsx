"use client";

import React, { useState } from "react";
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
} from "lucide-react";

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
};

function getDefaultIcon() {
  return <Wrench className="h-3 w-3" />;
}

function formatArguments(name: string, argsStr: string): string {
  try {
    const args = JSON.parse(argsStr);
    if (name === "bash") {
      return args.command || argsStr;
    }
    if (name === "read") {
      return args.filePath || argsStr;
    }
    if (name === "write" || name === "edit") {
      return args.filePath || argsStr;
    }
    if (name === "glob") {
      return args.pattern || argsStr;
    }
    if (name === "grep") {
      return args.pattern || argsStr;
    }
    if (name === "webfetch") {
      return args.url || argsStr;
    }
    if (name === "websearch") {
      return args.query || argsStr;
    }
    if (name === "list") {
      return args.path || "(workspace root)";
    }
    if (name === "todowrite") {
      const count = Array.isArray(args.todos) ? args.todos.length : 0;
      return `${count} todo(s)`;
    }
    return argsStr.slice(0, 120);
  } catch {
    return argsStr.slice(0, 120);
  }
}

function truncateResult(result: string, maxLines: number = 12): string {
  const lines = result.split("\n");
  if (lines.length <= maxLines) return result;
  return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length - maxLines} more lines)`;
}

export interface ToolCallDisplayData {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: "running" | "completed" | "error";
  error?: string;
}

interface ToolCallDisplayProps {
  tool: ToolCallDisplayData;
}

export function ToolCallDisplay({ tool }: ToolCallDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[tool.name] || getDefaultIcon();
  const isRunning = tool.status === "running";
  const summary = formatArguments(tool.name, tool.arguments);

  return (
    <div className="my-1.5 rounded-lg border border-border/50 bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-mono hover:bg-muted/50 transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
        )}
        <span className="text-muted-foreground/70 shrink-0">{icon}</span>
        <span className="text-muted-foreground font-medium shrink-0">{tool.name}</span>
        <span className="text-muted-foreground/40 truncate min-w-0">{summary}</span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground/50" />}
        {!isRunning && tool.status === "completed" && (
          <span className="ml-auto text-emerald-500/60 shrink-0">done</span>
        )}
        {!isRunning && tool.status === "error" && (
          <span className="ml-auto text-destructive/60 shrink-0">error</span>
        )}
      </button>

      {expanded && tool.result && (
        <div className="border-t border-border/30 px-3 py-2">
          <pre className="max-h-64 overflow-auto text-[11px] font-mono text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
            {truncateResult(tool.result)}
          </pre>
        </div>
      )}

      {expanded && tool.error && (
        <div className="border-t border-border/30 px-3 py-2">
          <pre className="text-[11px] font-mono text-destructive/80 whitespace-pre-wrap leading-relaxed">
            {tool.error}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ToolCallListProps {
  toolCalls: ToolCallDisplayData[];
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="my-2 space-y-1">
      {toolCalls.map((tc) => (
        <ToolCallDisplay key={tc.id} tool={tc} />
      ))}
    </div>
  );
}
