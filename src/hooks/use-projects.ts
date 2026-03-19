"use client";

import { useState, useEffect, useCallback } from "react";

export interface Project {
  id: string;
  name: string;
  workspaceFolder: string;
  createdAt: number;
  updatedAt: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (opts?: { name?: string; workspaceFolder?: string }) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts || {}),
      });
      if (res.ok) {
        const project = await res.json();
        await fetchProjects();
        return project as Project;
      }
      return null;
    },
    [fetchProjects]
  );

  const updateProject = useCallback(
    async (id: string, updates: Partial<Project>) => {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        await fetchProjects();
        return (await res.json()) as Project;
      }
      return null;
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchProjects();
    },
    [fetchProjects]
  );

  return {
    projects,
    loading,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
