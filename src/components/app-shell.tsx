"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ResizableLayout } from "@/components/resizable-layout";
import { Topbar } from "@/components/topbar/topbar";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { OAuthWaitDialog } from "@/components/auth/oauth-wait-dialog";
import { ZaiApiKeyDialog } from "@/components/auth/zai-api-key-dialog";
import { useAccounts } from "@/hooks/use-accounts";
import { useSessions } from "@/hooks/use-sessions";
import { useProjects } from "@/hooks/use-projects";
import { useAccountUsage } from "@/hooks/use-account-usage";
import type { Session } from "@/hooks/use-sessions";
import type { Project } from "@/hooks/use-projects";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AppShellInner() {
  const searchParams = useSearchParams();

  const {
    accounts,
    fetchAccounts,
    deleteAccount,
    startOAuth,
  } = useAccounts();

  const {
    projects,
    loading: projectsLoading,
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
  const [mode, setMode] = useState<"plan" | "build">("build");
  const [initialized, setInitialized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [oauthWaiting, setOauthWaiting] = useState(false);
  const [zaiApiKeyOpen, setZaiApiKeyOpen] = useState(false);
  const [zaiApiKeyId, setZaiApiKeyId] = useState<string | null>(null);
  const oauthCleanupRef = useRef<(() => void) | null>(null);
  const initialProjectLoad = useRef(true);

  const accountIds = accounts.map((a) => a.id);
  const { usageMap, fetchAll, refetchAccount } = useAccountUsage(accountIds);

  const dbInitialized = useRef(false);
  useEffect(() => {
    if (dbInitialized.current) return;
    dbInitialized.current = true;
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

  // Initialize account and project selection once
  useEffect(() => {
    if (initialized) return;
    if (accounts.length === 0 || projectsLoading) return;

    const accountId = selectedAccountId || accounts[0]?.id || null;
    const model = selectedModel || "gpt-5.4";
    let project = selectedProject;

    if (!project) {
      const savedId = localStorage.getItem("easai:selectedProjectId");
      if (savedId) {
        const found = projects.find((p) => p.id === savedId);
        if (found) project = found;
      }
    }

    setSelectedAccountId(accountId);
    setSelectedModel(model);
    if (project && project !== selectedProject) setSelectedProject(project);
    setSelectedSession(null);
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, accounts, projects, projectsLoading]);

  useEffect(() => {
    if (!selectedProject) return;
    if (initialProjectLoad.current) {
      initialProjectLoad.current = false;
    } else {
      setSelectedSession(null);
      localStorage.removeItem("easai:selectedSessionId");
    }
    fetchSessions(selectedProject.id);
  }, [selectedProject, fetchSessions]);

  useEffect(() => {
    if (sessionsLoading || !activeSessions.length) return;
    const savedSessionId = localStorage.getItem("easai:selectedSessionId");
    if (savedSessionId && !selectedSession) {
      const found = activeSessions.find((s) => s.id === savedSessionId);
      if (found) setSelectedSession(found);
    }
  }, [sessionsLoading, activeSessions, selectedSession]);

  const handleSelectProject = useCallback((project: Project) => {
    initialProjectLoad.current = false;
    setSelectedProject(project);
    localStorage.setItem("easai:selectedProjectId", project.id);
  }, []);

  const handleCreateProject = useCallback(
    async (name: string, workspaceFolder: string) => {
      const project = await createProject({ name, workspaceFolder });
      if (project) {
        initialProjectLoad.current = false;
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
      localStorage.setItem("easai:selectedSessionId", session.id);
    }
  }, [createSession, selectedProject, selectedAccountId, selectedModel]);

  const handleSelectSession = useCallback((session: Session) => {
    setSelectedSession(session);
    localStorage.setItem("easai:selectedSessionId", session.id);
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
        localStorage.removeItem("easai:selectedSessionId");
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
        localStorage.removeItem("easai:selectedSessionId");
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
        localStorage.removeItem("easai:selectedSessionId");
        initialProjectLoad.current = true;
      }
      toast.success("Project verwijderd");
    },
    [deleteProject, selectedProject]
  );

  const handleAddAccount = useCallback((provider: string) => {
    setOauthWaiting(true);
    const cleanup = startOAuth(
      provider,
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

  const handleLinkApiKey = useCallback((accountId: string) => {
    setZaiApiKeyId(accountId);
    setZaiApiKeyOpen(true);
  }, []);

  const handleZaiApiKeyDone = useCallback(async () => {
    setZaiApiKeyOpen(false);
    const id = zaiApiKeyId;
    if (id) {
      await fetchAccounts();
      toast.success("API key gekoppeld");
    } else {
      await fetchAccounts();
      toast.success("Z.AI account toegevoegd");
    }
  }, [fetchAccounts, zaiApiKeyId]);

  const currentWorkspace = selectedProject?.workspaceFolder ?? null;

  return (
    <div className="flex h-screen w-full flex-col">
      <Topbar
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          selectedModel={selectedModel}
          usageMap={usageMap}
          mode={mode}
          onAccountModelChange={handleAccountModelChange}
          onAddAccount={handleAddAccount}
          onDeleteAccount={handleDeleteAccount}
          onOpenSettings={() => setSettingsOpen(true)}
          onFetchAllUsage={fetchAll}
          onRefetchAccountUsage={refetchAccount}
          onLinkApiKey={handleLinkApiKey}
          onRenameAccount={async (accountId, name) => {
            await fetch(`/api/accounts`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: accountId, name }),
            });
            await fetchAccounts();
            toast.success("Naam gewijzigd");
          }}
        />

        <ResizableLayout
          selectedSession={selectedSession}
          selectedProject={selectedProject}
          currentWorkspace={currentWorkspace}
          selectedAccountId={selectedAccountId}
          selectedModel={selectedModel}
          projects={projects}
          projectsLoading={projectsLoading}
          activeSessions={activeSessions}
          archivedSessions={archivedSessions}
          sessionsLoading={sessionsLoading}
          handleSelectProject={handleSelectProject}
          setCreateProjectOpen={setCreateProjectOpen}
          handleNewSession={handleNewSession}
          handleSelectSession={handleSelectSession}
          handleArchiveSession={handleArchiveSession}
          handleUnarchiveSession={unarchiveSession}
          handleDeleteSession={handleDeleteSession}
          handleRenameSession={handleRenameSession}
          handleDeleteProject={handleDeleteProject}
          handleAccountModelChange={handleAccountModelChange}
          fetchSessions={fetchSessions}
          mode={mode}
          onModeChange={setMode}
        />
        <OAuthWaitDialog open={oauthWaiting} onCancel={() => { setOauthWaiting(false); oauthCleanupRef.current?.(); }} />
        <ZaiApiKeyDialog open={zaiApiKeyOpen} accountId={zaiApiKeyId} onClose={() => setZaiApiKeyOpen(false)} onDone={handleZaiApiKeyDone} />
        <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} onSubmit={handleCreateProject} />
      </div>
  );
}

export function AppShell() {
  return (
    <Suspense>
      <AppShellInner />
    </Suspense>
  );
}
