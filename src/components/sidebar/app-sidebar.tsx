"use client";

import React, { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronRight,
  Plus,
  Settings,
  Archive,
  Trash2,
  MoreHorizontal,
  LogIn,
  UserX,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/hooks/use-accounts";
import type { Session } from "@/hooks/use-sessions";
import type { Project } from "@/hooks/use-projects";
import { OPENAI_MODELS } from "@/lib/openai/models";

interface AppSidebarProps {
  accounts: Account[];
  accountsLoading: boolean;
  projects: Project[];
  projectsLoading: boolean;
  projectSessions: Session[];
  archivedSessions: Session[];
  sessionsLoading: boolean;
  selectedProjectId: string | null;
  selectedSessionId: string | null;
  selectedAccountId: string | null;
  selectedModel: string | null;
  onSelectSession: (session: Session) => void;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onNewSession: () => void;
  onArchiveSession: (id: string) => void;
  onUnarchiveSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;
  onAddAccount: () => void;
  onDeleteAccount: (id: string) => void;
  onSelectAccountModel: (accountId: string, model: string) => void;
  onOpenSettings: () => void;
}

export function AppSidebar({
  accounts,
  accountsLoading,
  projects,
  projectsLoading,
  projectSessions,
  archivedSessions,
  sessionsLoading,
  selectedProjectId,
  selectedSessionId,
  selectedAccountId,
  selectedModel,
  onSelectSession,
  onSelectProject,
  onNewProject,
  onNewSession,
  onArchiveSession,
  onUnarchiveSession,
  onDeleteSession,
  onRenameSession,
  onDeleteProject,
  onAddAccount,
  onDeleteAccount,
  onSelectAccountModel,
  onOpenSettings,
}: AppSidebarProps) {
  const [archivedOpen, setArchivedOpen] = useState(false);
  const expandedProjects = useState<string[]>(() =>
    projects.map((p) => p.id)
  );

  return (
    <Sidebar side="right" collapsible="none" className="border-l border-border/40">
      <SidebarHeader className="px-4 py-3">
        <div className="font-mono text-sm font-semibold tracking-wider text-foreground/80">
          easai
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Accounts
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {accountsLoading ? (
              <div className="space-y-2 px-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-3/4" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="px-2 py-2">
                <p className="font-mono text-xs text-muted-foreground/50">
                  Geen accounts
                </p>
              </div>
            ) : (
              <SidebarMenu>
                {accounts.map((account) => (
                  <AccountItem
                    key={account.id}
                    account={account}
                    selectedAccountId={selectedAccountId}
                    selectedModel={selectedModel}
                    onSelectModel={onSelectAccountModel}
                    onDelete={onDeleteAccount}
                  />
                ))}
              </SidebarMenu>
            )}
            <div className="px-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full justify-start gap-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground"
                onClick={onAddAccount}
              >
                <LogIn className="h-3.5 w-3.5" />
                Account toevoegen
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="flex-1">
          <div className="flex items-center justify-between px-2">
            <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Projecten
            </SidebarGroupLabel>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground/40 hover:text-muted-foreground"
              onClick={onNewProject}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <SidebarGroupContent>
            {projectsLoading ? (
              <div className="space-y-2 px-2">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-5/6" />
              </div>
            ) : projects.length === 0 ? (
              <div className="px-2 py-2">
                <p className="font-mono text-xs text-muted-foreground/40">
                  Geen projecten — maak er een aan
                </p>
              </div>
            ) : (
              <SidebarMenu>
                {projects.map((project) => (
                  <ProjectItem
                    key={project.id}
                    project={project}
                    isActive={project.id === selectedProjectId}
                    sessions={project.id === selectedProjectId ? projectSessions : []}
                    sessionsLoading={
                      project.id === selectedProjectId ? sessionsLoading : false
                    }
                    selectedSessionId={selectedSessionId}
                    expanded={true}
                    onSelect={() => onSelectProject(project)}
                    onNewSession={onNewSession}
                    onSelectSession={onSelectSession}
                    onArchiveSession={onArchiveSession}
                    onUnarchiveSession={onUnarchiveSession}
                    onDeleteSession={onDeleteSession}
                    onRenameSession={onRenameSession}
                    onDeleteProject={onDeleteProject}
                    archivedSessions={
                      project.id === selectedProjectId ? archivedSessions : []
                    }
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="gap-1 px-2 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start gap-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings className="h-3.5 w-3.5" />
          Instellingen
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

interface AccountItemProps {
  account: Account;
  selectedAccountId: string | null;
  selectedModel: string | null;
  onSelectModel: (accountId: string, model: string) => void;
  onDelete: (id: string) => void;
}

function AccountItem({
  account,
  selectedAccountId,
  selectedModel,
  onSelectModel,
  onDelete,
}: AccountItemProps) {
  const [open, setOpen] = useState(true);
  const isSelected = account.id === selectedAccountId;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger
            className={cn(
              "peer/menu-button group/menu-button flex flex-1 items-center gap-1.5 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
              isSelected && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform",
                open && "rotate-90"
              )}
            />
            <span className="truncate font-mono text-xs">{account.name}</span>
            {account.planType && account.planType !== "unknown" && (
              <Badge
                variant="secondary"
                className="ml-auto h-4 px-1 font-mono text-[9px]"
              >
                {account.planType}
              </Badge>
            )}
          </CollapsibleTrigger>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-7 w-5 items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="gap-2 font-mono text-xs text-destructive"
                onClick={() => onDelete(account.id)}
              >
                <UserX className="h-3.5 w-3.5" />
                Verwijder account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/30 pl-3">
            {OPENAI_MODELS.map((model) => {
              const isActiveModel =
                isSelected && selectedModel === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => onSelectModel(account.id, model.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 font-mono text-xs transition-colors",
                    isActiveModel
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      isActiveModel ? "bg-primary" : "bg-transparent"
                    )}
                  />
                  {model.name}
                </button>
              );
            })}
          </div>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  sessions: Session[];
  sessionsLoading: boolean;
  selectedSessionId: string | null;
  expanded: boolean;
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
  expanded,
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
  const [open, setOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    if (isActive) setOpen(true);
  }, [isActive]);

  const activeSessions = sessions.filter((s) => !s.archived);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem className="group/project-item">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger
            className={cn(
              "peer/menu-button group/menu-button flex flex-1 items-center gap-1.5 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2",
              isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
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
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            <span className="truncate font-mono text-xs">{project.name}</span>
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
                  className="gap-2 font-mono text-xs text-destructive"
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
                <div className="py-1">
                  <p className="font-mono text-[10px] text-muted-foreground/40 px-2">
                    Geen chats
                  </p>
                </div>
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
                    <CollapsibleTrigger className="flex w-full items-center gap-1 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
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
      </SidebarMenuItem>
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
            "flex w-full items-center gap-2 rounded-md px-2 py-1 font-mono text-xs transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0 transition-colors" />
          <span className="truncate">{session.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-6 w-5 items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover/chat-item:opacity-100 transition-opacity shrink-0"
          >
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2 font-mono text-xs"
              onClick={() => {
                setNewTitle(session.title);
                setRenaming(true);
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              Hernoem
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-mono text-xs"
              onClick={onArchive}
            >
              <Archive className="h-3.5 w-3.5" />
              {archived ? "Uit archief" : "Archiveer"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 font-mono text-xs text-destructive"
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
            <DialogTitle className="font-mono text-sm">Hernoem chat</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            autoFocus
            className="font-mono text-sm"
            placeholder="Chat naam..."
          />
          <DialogFooter className="gap-2">
            <DialogClose className="font-mono text-xs rounded-md border border-input bg-background px-3 py-1.5 hover:bg-accent hover:text-accent-foreground">
              Annuleer
            </DialogClose>
            <Button size="sm" className="font-mono text-xs" onClick={handleRename}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
