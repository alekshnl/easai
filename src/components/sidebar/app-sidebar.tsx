"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Plus, Settings, Archive, Trash2, MoreHorizontal, FolderOpen } from "lucide-react";
import type { Session } from "@/hooks/use-sessions";
import type { Project } from "@/hooks/use-projects";

interface AppSidebarProps {
  projects: Project[];
  projectsLoading: boolean;
  projectSessions: Session[];
  archivedSessions: Session[];
  sessionsLoading: boolean;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onNewSession: () => void;
  onArchiveSession: (id: string) => void;
  onUnarchiveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
}

export function AppSidebar({
  projects,
  projectsLoading,
  projectSessions,
  archivedSessions,
  sessionsLoading,
  selectedProjectId,
  selectedSessionId,
  onSelectSession,
  onSelectProject,
  onNewProject,
  onNewSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onRenameSession,
  onDeleteProject,
}: AppSidebarProps) {
  return (
    <div className="flex flex-col h-full border-l border-border/40 bg-sidebar text-sidebar-foreground">
      <div className="border-b border-border/30" />

      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
            Projecten
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground"
            onClick={onNewProject}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {projectsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-5/6" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-muted-foreground/40 px-2 py-2">
            Geen projecten — maak er een aan
          </p>
        ) : (
          projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === selectedProjectId}
              sessions={project.id === selectedProjectId ? projectSessions : []}
              sessionsLoading={project.id === selectedProjectId ? sessionsLoading : false}
              selectedSessionId={selectedSessionId}
              onSelect={() => onSelectProject(project)}
              onNewSession={onNewSession}
              onSelectSession={onSelectSession}
              onArchiveSession={onArchiveSession}
              onUnarchiveSession={onUnarchiveSession}
              onDeleteSession={onDeleteSession}
              onRenameSession={onRenameSession}
              onDeleteProject={onDeleteProject}
              archivedSessions={project.id === selectedProjectId ? archivedSessions : []}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  sessions: Session[];
  sessionsLoading: boolean;
  selectedSessionId: string | null;
  onSelect: () => void;
  onNewSession: () => void;
  onSelectSession: (session: Session) => void;
  onArchiveSession: (id: string) => void;
  onUnarchiveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
  archivedSessions: Session[];
}

function ProjectItem({
  project,
  isActive,
  sessions,
  sessionsLoading,
  selectedSessionId,
  onSelect,
  onNewSession,
  onSelectSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onRenameSession,
  onDeleteProject,
  archivedSessions,
}: ProjectItemProps) {
  const [open, setOpen] = useState(isActive);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const activeSessions = sessions.filter((s) => !s.archived);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="group/project-item">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger
            className={cn(
              "flex flex-1 items-center gap-1.5 overflow-hidden rounded-md p-2 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:ring-2",
              isActive && "bg-sidebar-accent font-medium"
            )}
            onClick={(e) => {
              if (!isActive) {
                e.preventDefault();
                onSelect();
              }
            }}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform",
                open && isActive && "rotate-90"
              )}
            />
            <FolderOpen className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            <span className="truncate text-xs">{project.name}</span>
          </CollapsibleTrigger>

          <div className="flex items-center gap-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover/project-item:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                if (isActive) onNewSession();
              }}
              disabled={!isActive}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-7 w-5 items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover/project-item:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="gap-2 text-xs text-destructive"
                  onClick={() => onDeleteProject(project.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Verwijder project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isActive && (
          <CollapsibleContent>
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/30 pl-3">
              {sessionsLoading ? (
                <div className="space-y-1 py-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-5/6" />
                </div>
              ) : activeSessions.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/40 px-2 py-1">
                  Geen chats
                </p>
              ) : (
                activeSessions.map((session) => (
                  <ChatItem
                    key={session.id}
                    session={session}
                    isActive={session.id === selectedSessionId}
                    onSelect={() => onSelectSession(session)}
                    onArchive={() => onArchiveSession(session.id)}
                    onDelete={() => onDeleteSession(session.id)}
                    onRename={onRenameSession}
                  />
                ))
              )}

              {archivedSessions.length > 0 && (
                <div className="mt-1">
                  <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
                    <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform",
                          archivedOpen && "rotate-90"
                        )}
                      />
                      Gearchiveerd ({archivedSessions.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {archivedSessions.map((session) => (
                        <ChatItem
                          key={session.id}
                          session={session}
                          isActive={session.id === selectedSessionId}
                          onSelect={() => onSelectSession(session)}
                          onArchive={() => onUnarchiveSession(session.id)}
                          onDelete={() => onDeleteSession(session.id)}
                          onRename={onRenameSession}
                          archived
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

interface ChatItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRename: (id: string, title: string) => void;
  archived?: boolean;
}

function ChatItem({
  session,
  isActive,
  onSelect,
  onArchive,
  onDelete,
  onRename,
  archived = false,
}: ChatItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);

  const handleDoubleClick = () => {
    setNewTitle(session.title);
    setRenaming(true);
  };

  const handleRename = () => {
    const trimmed = newTitle.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(session.id, trimmed);
    }
    setRenaming(false);
  };

  return (
    <>
      <div className="group/chat-item flex items-center">
        <button
          onClick={onSelect}
          onDoubleClick={handleDoubleClick}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <span className="h-1 w-1 rounded-full shrink-0 bg-muted-foreground/30" />
          <span className="truncate text-[11px]">{session.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-6 w-5 items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover/chat-item:opacity-100 transition-opacity shrink-0"
          >
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => {
                setNewTitle(session.title);
                setRenaming(true);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              Hernoem
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={onArchive}
            >
              <Archive className="h-3.5 w-3.5" />
              {archived ? "Uit archief" : "Archiveer"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 text-xs text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Verwijder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Hernoem chat</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            className="text-sm"
            placeholder="Chat naam..."
          />
          <DialogFooter className="gap-2">
            <DialogClose className="text-xs rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground">
              Annuleer
            </DialogClose>
            <Button size="sm" className="text-xs" onClick={handleRename}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
