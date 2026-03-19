"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ChatView } from "@/components/chat/chat-view";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { OAuthWaitDialog } from "@/components/auth/oauth-wait-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { useSessions } from "@/hooks/use-sessions";
import { useProjects } from "@/hooks/use-projects";
import type { Session } from "@/hooks/use-sessions";
import type { Project } from "@/hooks/use-projects";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FolderOpen } from "lucide-react";

function AppShellInner() {
  const searchParams = useSearchParams();

  const {
    accounts,
    loading: accountsLoading,
    fetchAccounts,
    deleteAccount,
    startOAuth,
  } = useAccounts();

  const {
    projects,
    loading: projectsLoading,
    fetchProjects,
    createProject,
    deleteProject,
  } = useProjects();

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const {
    active: activeSessions,
    archived: archivedSessions,
    loading: sessionsLoading,
    fetchSessions,
    createSession,
    archiveSession,
    unarchiveSession,
    deleteSession,
    updateSession,
  } = useSessions(selectedProject?.id ?? null);

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const oauthCleanupRef = useRef<(() => void) | null>(null);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    fetch("/api/init", { method: "POST" }).catch(console.error);
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    if (error) {
      toast.error(`Authenticatie mislukt: ${message || error}`);
      window.history.replaceState({}, "", "/");
    } else {
      const hasNew = searchParams.get("new_account");
      if (hasNew) {
        fetchAccounts();
        toast.success("Account succesvol toegevoegd");
        window.history.replaceState({}, "", "/");
      }
    }
  }, [searchParams, fetchAccounts]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
      setSelectedModel("gpt-5.4");
    }
  }, [accounts, selectedAccountId]);

  // Restore selected project from localStorage after projects load
  useEffect(() => {
    if (projectsLoading || projects.length === 0 || selectedProject) return;
    const savedId = localStorage.getItem("easai:selectedProjectId");
    if (savedId) {
      const found = projects.find((p) => p.id === savedId);
      if (found) {
        setSelectedProject(found);
      }
    }
  }, [projects, projectsLoading, selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      setSelectedSession(null);
      fetchSessions(selectedProject.id);
    }
  }, [selectedProject, fetchSessions]);

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    localStorage.setItem("easai:selectedProjectId", project.id);
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, workspaceFolder: string) => {
      const project = await createProject({ name, workspaceFolder });
      if (project) {
        setSelectedProject(project);
        localStorage.setItem("easai:selectedProjectId", project.id);
        toast.success(`Project "${name}" aangemaakt`);
      }
    },
    [createProject]
  );

  const handleNewSession = useCallback(async () => {
    if (!selectedProject) return;
    const session = await createSession({
      projectId: selectedProject.id,
      accountId: selectedAccountId ?? undefined,
      model: selectedModel ?? undefined,
    });
    if (session) {
      setSelectedSession(session);
    }
  }, [createSession, selectedProject, selectedAccountId, selectedModel]);

  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSession(session);
  }, []);

  const handleAccountModelChange = useCallback(
    (accountId: string, model: string) => {
      setSelectedAccountId(accountId);
      setSelectedModel(model);
    },
    []
  );

  const handleDeleteAccount = useCallback(
    async (id: string) => {
      await deleteAccount(id);
      if (selectedAccountId === id) {
        setSelectedAccountId(null);
        setSelectedModel(null);
      }
      toast.success("Account verwijderd");
    },
    [deleteAccount, selectedAccountId]
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
      toast.success("Chat verwijderd");
    },
    [deleteSession, selectedSession]
  );

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      const updated = await updateSession(id, { title });
      if (updated && selectedSession?.id === id) {
        setSelectedSession(updated);
      }
      toast.success("Chat hernoemd");
    },
    [updateSession, selectedSession]
  );

  const handleArchiveSession = useCallback(
    async (id: string) => {
      await archiveSession(id);
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    },
    [archiveSession, selectedSession]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id);
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        localStorage.removeItem("easai:selectedProjectId");
        setSelectedSession(null);
      }
      toast.success("Project verwijderd");
    },
    [deleteProject, selectedProject]
  );

  const handleAddAccount = useCallback(() => {
    setOauthWaiting(true);
    const cleanup = startOAuth(
      () => {},
      (email, planType) => {
        setOauthWaiting(false);
        toast.success(`Account toegevoegd: ${email} (${planType})`);
      },
      (error) => {
        setOauthWaiting(false);
        toast.error(`Authenticatie mislukt: ${error}`);
      }
    );
    oauthCleanupRef.current = cleanup;
  }, [startOAuth]);

  const currentWorkspace = selectedProject?.workspaceFolder ?? null;

  return (
    <>
      <SidebarProvider
        defaultOpen={true}
        style={
          {
            "--sidebar-width": "260px",
          } as React.CSSProperties
        }
      >
        <div className="flex h-screen w-full overflow-hidden">
          <SidebarInset className="flex flex-col overflow-hidden">
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
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              selectedModel={selectedModel}
              onAccountModelChange={handleAccountModelChange}
              onSessionUpdate={() => fetchSessions(selectedProject?.id)}
            />
          </SidebarInset>

          <AppSidebar
            accounts={accounts}
            accountsLoading={accountsLoading}
            projects={projects}
            projectsLoading={projectsLoading}
            projectSessions={activeSessions}
            archivedSessions={archivedSessions}
            sessionsLoading={sessionsLoading}
            selectedProjectId={selectedProject?.id ?? null}
            selectedSessionId={selectedSession?.id ?? null}
            selectedAccountId={selectedAccountId}
            selectedModel={selectedModel}
            onSelectSession={handleSelectSession}
            onSelectProject={handleSelectProject}
            onNewProject={() => setCreateProjectOpen(true)}
            onNewSession={handleNewSession}
            onArchiveSession={handleArchiveSession}
            onUnarchiveSession={unarchiveSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            onDeleteProject={handleDeleteProject}
            onAddAccount={handleAddAccount}
            onDeleteAccount={handleDeleteAccount}
            onSelectAccountModel={handleAccountModelChange}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      </SidebarProvider>

      <OAuthWaitDialog
        open={oauthWaiting}
        onCancel={() => {
          oauthCleanupRef.current?.();
          setOauthWaiting(false);
        }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onSubmit={handleCreateProject}
      />
    </>
  );
}

export function AppShell() {
  return (
    <Suspense>
      <AppShellInner />
    </Suspense>
  );
}
