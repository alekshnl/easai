"use client";

import { useState, useRef, useCallback, useSyncExternalStore } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatView } from "@/components/chat/chat-view";
import { FolderOpen } from "lucide-react";
import type { Session } from "@/hooks/use-sessions";
import type { Project } from "@/hooks/use-projects";

const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 600;
const DEFAULT_SIDEBAR = 320;
const STORAGE_KEY = "easai:sidebarWidth";

function subscribe() { return () => {} }

function getSnapshot(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR && parsed <= MAX_SIDEBAR) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_SIDEBAR;
}

function getServerSnapshot(): number {
  return DEFAULT_SIDEBAR;
}

export function ResizableLayout({
  selectedSession,
  selectedProject,
  currentWorkspace,
  selectedAccountId,
  selectedModel,
  projects,
  projectsLoading,
  activeSessions,
  archivedSessions,
  sessionsLoading,
  handleSelectProject,
  setCreateProjectOpen,
  handleNewSession,
  handleSelectSession,
  handleArchiveSession,
  handleUnarchiveSession,
  handleDeleteSession,
  handleRenameSession,
  handleDeleteProject,
  handleAccountModelChange,
  fetchSessions,
}: {
  selectedSession: Session | null;
  selectedProject: Project | null;
  currentWorkspace: string | null;
  selectedAccountId: string | null;
  selectedModel: string | null;
  projects: Project[];
  projectsLoading: boolean;
  activeSessions: Session[];
  archivedSessions: Session[];
  sessionsLoading: boolean;
  handleSelectProject: (p: Project) => void;
  setCreateProjectOpen: (v: boolean) => void;
  handleNewSession: () => void;
  handleSelectSession: (s: Session) => void;
  handleArchiveSession: (id: string) => void;
  handleUnarchiveSession: (id: string) => void;
  handleDeleteSession: (id: string) => void;
  handleRenameSession: (id: string, title: string) => void;
  handleDeleteProject: (id: string) => void;
  handleAccountModelChange: (accountId: string, model: string) => void;
  fetchSessions: (projectId?: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const draggingWidth = useRef<number | null>(null);
  const storedWidth = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const displayWidth = draggingWidth.current !== null ? sidebarWidth : storedWidth;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    draggingWidth.current = storedWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (ev: MouseEvent) => {
      const newWidth = containerRect.right - ev.clientX;
      const clamped = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, newWidth));
      setSidebarWidth(clamped);
    };

    const handleMouseUp = (ev: MouseEvent) => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const finalWidth = containerRect.right - ev.clientX;
      const clamped = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, finalWidth));
      localStorage.setItem(STORAGE_KEY, String(clamped));
      draggingWidth.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [storedWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <div className="flex h-10 items-center justify-between border-b border-border/30 px-4">
          <span className="font-mono text-xs text-muted-foreground/40 truncate">
            {selectedSession?.title ?? selectedProject?.name ?? "easai"}
          </span>
          {currentWorkspace && (
            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground/50">
              <FolderOpen className="h-3 w-3" />
              <span className="truncate max-w-[300px]">{currentWorkspace}</span>
            </div>
          )}
        </div>

        <ChatView
          session={selectedSession}
          accounts={[]}
          selectedAccountId={selectedAccountId}
          selectedModel={selectedModel}
          onAccountModelChange={handleAccountModelChange}
          onSessionUpdate={() => fetchSessions(selectedProject?.id)}
        />
      </div>

      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 cursor-col-resize bg-border/40 hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0"
      />

      <div
        style={{ width: displayWidth, minWidth: MIN_SIDEBAR, maxWidth: MAX_SIDEBAR }}
        className="shrink-0 overflow-hidden"
      >
        <AppSidebar
          projects={projects}
          projectsLoading={projectsLoading}
          projectSessions={activeSessions}
          archivedSessions={archivedSessions}
          sessionsLoading={sessionsLoading}
          selectedProjectId={selectedProject?.id ?? null}
          selectedSessionId={selectedSession?.id ?? null}
          onSelectSession={handleSelectSession}
          onSelectProject={handleSelectProject}
          onNewProject={() => setCreateProjectOpen(true)}
          onNewSession={handleNewSession}
          onArchiveSession={handleArchiveSession}
          onUnarchiveSession={handleUnarchiveSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onDeleteProject={handleDeleteProject}
        />
      </div>
    </div>
  );
}
