"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, FolderKanban, GitCompareArrows, History, Loader2, LogIn, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildAdjustedCostItems, buildRecommendationProfiles, formatObservabilityDepthLabel, formatTrafficProfileLabel, resolveRunContext } from "@/lib/recommendations";
import type { AuthUser, ProjectDetail, ProjectSummary } from "@/lib/types";
import { architectureToMarkdown, createProject, downloadArchitectureBundle, downloadArchitectureComparisonBundle, downloadArchitectureComparisonReport, downloadText, getCurrentUser, getProject, listProjects, login, register } from "@/services/architecture";

const shellCardClassName = "border-slate-200/80 bg-white/82 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur";
const mutedPanelClassName = "rounded-lg border border-slate-200/80 bg-slate-50/90";

function formatDelta(delta: number) {
  if (delta === 0) {
    return "$0";
  }
  return `${delta > 0 ? "+" : "-"}$${Math.abs(delta).toLocaleString()}`;
}

type ServiceDiffRow = {
  key: string;
  previousName: string;
  previousTier: string;
  previousMonthlyUsd: number;
  nextName: string;
  nextTier: string;
  nextMonthlyUsd: number;
  delta: number;
  changed: boolean;
};

export function ProjectsWorkspace() {
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [compareRunIds, setCompareRunIds] = useState<number[]>([]);

  const totalRuns = useMemo(() => projects.reduce((sum, project) => sum + project.requestCount, 0), [projects]);

  const refreshProjects = useCallback(async (nextProjectId?: number) => {
    if (!apiEnabled || !currentUser) {
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const projectList = await listProjects();
      setProjects(projectList);

      const desiredId = nextProjectId ?? (selectedProjectId === "" ? projectList[0]?.id : selectedProjectId);
      if (desiredId) {
        const detail = await getProject(desiredId);
        setActiveProject(detail);
        setSelectedProjectId(detail.id);
        setCompareRunIds([]);
      } else {
        setActiveProject(null);
        setSelectedProjectId("");
        setCompareRunIds([]);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load projects.");
    } finally {
      setIsRefreshing(false);
    }
  }, [apiEnabled, currentUser, selectedProjectId]);

  useEffect(() => {
    if (!apiEnabled) {
      return;
    }

    void (async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        if (user) {
          await refreshProjects();
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to restore session.");
      }
    })();
  }, [apiEnabled, refreshProjects]);

  async function handleAuthSubmit() {
    if (!authEmail.trim() || !authPassword.trim()) {
      setError("Email and password are required.");
      return;
    }

    setError(null);
    setStatus(authMode === "login" ? "Signing in..." : "Creating account...");

    try {
      const user = authMode === "login" ? await login(authEmail.trim(), authPassword) : await register(authEmail.trim(), authPassword);
      setCurrentUser(user);
      setAuthPassword("");
      setStatus(authMode === "login" ? `Signed in as ${user.email}.` : `Account created for ${user.email}.`);
      await refreshProjects();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Authentication failed.");
      setStatus(null);
    }
  }

  async function handleCreateProject() {
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setError(null);
    setStatus("Creating project...");

    try {
      const project = await createProject(projectName.trim(), projectDescription.trim() || undefined);
      setProjectName("");
      setProjectDescription("");
      setStatus(`Project "${project.name}" created.`);
      await refreshProjects(project.id);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create project.");
      setStatus(null);
    }
  }

  async function handleSelectProject(projectId: number) {
    setSelectedProjectId(projectId);
    setError(null);

    try {
      const detail = await getProject(projectId);
      setActiveProject(detail);
      setCompareRunIds([]);
      setStatus(`Loaded "${detail.name}".`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load project.");
    }
  }

  function getRunView(run: NonNullable<ProjectDetail["history"]>[number]) {
    const runContext = resolveRunContext(run.runContext);
    const profiles = buildRecommendationProfiles(run.output);
    const activeProfile = profiles.find((profile) => profile.key === runContext.recommendationKey) ?? profiles[0];
    const adjustedCostItems = buildAdjustedCostItems(activeProfile, runContext);
    const adjustedMonthlyTotal = adjustedCostItems.reduce((sum, item) => sum + item.monthlyUsd, 0);

    return {
      runContext,
      profiles,
      activeProfile,
      adjustedCostItems,
      adjustedMonthlyTotal
    };
  }

  function toggleCompareRun(runId: number) {
    setCompareRunIds((current) => {
      if (current.includes(runId)) {
        return current.filter((id) => id !== runId);
      }
      if (current.length < 2) {
        return [...current, runId];
      }
      return [current[1], runId];
    });
  }

  const compareRuns = useMemo(() => {
    if (!activeProject || compareRunIds.length !== 2) {
      return [];
    }
    return compareRunIds
      .map((runId) => activeProject.history.find((run) => run.id === runId))
      .filter((run): run is NonNullable<typeof run> => Boolean(run));
  }, [activeProject, compareRunIds]);

  const compareRunViews = useMemo(
    () => compareRuns.map((run) => ({ run, view: getRunView(run) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compareRuns]
  );

  const compareSummary = useMemo(() => {
    if (compareRunViews.length !== 2) {
      return null;
    }

    const [first, second] = compareRunViews;
    const monthlyDelta = second.view.adjustedMonthlyTotal - first.view.adjustedMonthlyTotal;
    const firstCompliance = new Set(first.run.output.securityProfile.compliancePacks);
    const secondCompliance = new Set(second.run.output.securityProfile.compliancePacks);
    const addedCompliance = [...secondCompliance].filter((item) => !firstCompliance.has(item));
    const removedCompliance = [...firstCompliance].filter((item) => !secondCompliance.has(item));
    const findingDelta = second.run.output.securityFindings.length - first.run.output.securityFindings.length;

    const serviceChanges = second.view.activeProfile.services
      .map((service, index) => {
        const previous = first.view.activeProfile.services[index];
        if (!previous) {
          return `${service.name} added`;
        }
        if (previous.name !== service.name || previous.tier !== service.tier) {
          return `${previous.name} (${previous.tier}) -> ${service.name} (${service.tier})`;
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));

    return {
      monthlyDelta,
      findingDelta,
      recommendationChanged: first.view.runContext.recommendationLabel !== second.view.runContext.recommendationLabel,
      addedCompliance,
      removedCompliance,
      serviceChanges
    };
  }, [compareRunViews]);

  const compareServiceRows = useMemo(() => {
    if (compareRunViews.length !== 2) {
      return [] as ServiceDiffRow[];
    }

    const [first, second] = compareRunViews;
    const maxLength = Math.max(first.view.activeProfile.services.length, second.view.activeProfile.services.length);

    return Array.from({ length: maxLength }, (_, index) => {
      const previous = first.view.activeProfile.services[index];
      const next = second.view.activeProfile.services[index];

      const previousName = previous?.name ?? "Not present";
      const previousTier = previous?.tier ?? "-";
      const previousMonthlyUsd = previous?.estimatedMonthlyUsd ?? 0;
      const nextName = next?.name ?? "Not present";
      const nextTier = next?.tier ?? "-";
      const nextMonthlyUsd = next?.estimatedMonthlyUsd ?? 0;

      return {
        key: `${index}-${previousName}-${nextName}`,
        previousName,
        previousTier,
        previousMonthlyUsd,
        nextName,
        nextTier,
        nextMonthlyUsd,
        delta: nextMonthlyUsd - previousMonthlyUsd,
        changed: previousName !== nextName || previousTier !== nextTier || previousMonthlyUsd !== nextMonthlyUsd
      };
    });
  }, [compareRunViews]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,148,136,0.12),_transparent_28%),linear-gradient(180deg,_#f7f5ef_0%,_#edf2ef_100%)]">
      <section className="border-b border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <FolderKanban className="h-4 w-4" />
              </div>
              <span>Projects workspace</span>
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-900 sm:text-5xl">Track architecture work as projects, not just prompts.</h1>
              <p className="max-w-3xl text-base leading-7 text-slate-700">
                Review saved runs, keep project-level history in one place, and jump back into the generator when you want to deepen or regenerate an architecture package.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/generate"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open Generator
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle>Workspace Access</CardTitle>
              <CardDescription>Sign in to review saved projects and architecture history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!apiEnabled ? (
                <div className="rounded-lg border border-dashed border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-600">
                  Set `NEXT_PUBLIC_API_URL` to enable projects, saved history, and account-backed workflows.
                </div>
              ) : !currentUser ? (
                <>
                  <div className="grid gap-3">
                    <Input placeholder="Email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                    <Input placeholder="Password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setAuthMode((mode) => (mode === "login" ? "register" : "login"))}>
                      {authMode === "login" ? "Need an account?" : "Have an account?"}
                    </Button>
                    <Button type="button" onClick={handleAuthSubmit}>
                      <LogIn className="h-4 w-4" />
                      {authMode === "login" ? "Sign In" : "Create Account"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className={mutedPanelClassName + " p-4"}>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <UserRound className="h-4 w-4" />
                      <span>{currentUser.email}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">Projects and saved runs are scoped to this signed-in workspace.</p>
                  </div>
                  <div className="grid gap-2">
                    <Input placeholder="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                    <Textarea
                      value={projectDescription}
                      onChange={(event) => setProjectDescription(event.target.value)}
                      placeholder="Short description"
                      className="min-h-20 resize-none border-slate-200/80 bg-white/80"
                    />
                    <Button type="button" variant="outline" onClick={handleCreateProject}>
                      <FolderKanban className="h-4 w-4" />
                      Create Project
                    </Button>
                  </div>
                </>
              )}
              {status ? <p className="text-sm text-slate-600">{status}</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </CardContent>
          </Card>

          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle>Workspace Snapshot</CardTitle>
              <CardDescription>Quick project-level count and recent activity view.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Projects</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{projects.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Saved runs</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{totalRuns}</p>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card className={shellCardClassName}>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Projects</CardTitle>
                  <CardDescription>Choose a project to inspect its saved architecture history and current working summary.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => void refreshProjects()} disabled={!currentUser || isRefreshing}>
                  {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    className={`rounded-lg border p-4 text-left transition ${selectedProjectId === project.id ? "border-primary bg-primary/5" : "border-slate-200/80 bg-white/75 hover:border-primary/50"}`}
                    onClick={() => void handleSelectProject(project.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{project.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{project.description || "No description yet."}</p>
                      </div>
                      <Badge variant="outline">{project.requestCount} runs</Badge>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      {project.latestRequestAt ? `Last updated ${new Date(project.latestRequestAt).toLocaleString()}` : "No generations saved yet."}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">No projects yet. Create one from here or generate and save from the studio.</div>
              )}
            </CardContent>
          </Card>

          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Project Detail
              </CardTitle>
              <CardDescription>Inspect the selected project’s saved runs, security posture, and exportable review package.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeProject ? (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{activeProject.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{activeProject.description || "No description provided."}</p>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Compliance packs</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(activeProject.history[0]?.output.securityProfile.compliancePacks ?? ["No saved run yet"]).map((pack) => (
                          <Badge key={pack} variant="secondary">
                            {pack}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Last run estimate</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {activeProject.history[0] ? `$${activeProject.history[0].output.costEstimate.monthlyUsd.toLocaleString()}/mo` : "No saved run"}
                      </p>
                    </div>
                  </div>

                  {compareRuns.length === 2 ? (
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <GitCompareArrows className="h-4 w-4 text-slate-700" />
                            <p className="text-sm font-semibold text-slate-900">Run Comparison</p>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">Compare recommendation posture, adjusted cost, service mix, and security findings across two saved runs.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!compareSummary || compareRunViews.length !== 2) {
                                return;
                              }
                              const [first, second] = compareRunViews;
                              downloadArchitectureComparisonReport(
                                `project-${activeProject.id}-run-comparison.md`,
                                activeProject.name,
                                [
                                  {
                                    id: first.run.id,
                                    createdAt: first.run.createdAt,
                                    prompt: first.run.prompt,
                                    output: first.run.output,
                                    runContext: first.view.runContext,
                                    adjustedMonthlyTotal: first.view.adjustedMonthlyTotal,
                                    serviceDiffs: compareSummary.serviceChanges
                                  },
                                  {
                                    id: second.run.id,
                                    createdAt: second.run.createdAt,
                                    prompt: second.run.prompt,
                                    output: second.run.output,
                                    runContext: second.view.runContext,
                                    adjustedMonthlyTotal: second.view.adjustedMonthlyTotal,
                                    serviceDiffs: compareSummary.serviceChanges
                                  }
                                ],
                                compareSummary
                              );
                            }}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Export Compare
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!compareSummary || compareRunViews.length !== 2) {
                                return;
                              }
                              const [first, second] = compareRunViews;
                              void downloadArchitectureComparisonBundle(
                                `project-${activeProject.id}-run-comparison.zip`,
                                activeProject.name,
                                [
                                  {
                                    id: first.run.id,
                                    createdAt: first.run.createdAt,
                                    prompt: first.run.prompt,
                                    output: first.run.output,
                                    runContext: first.view.runContext,
                                    adjustedMonthlyTotal: first.view.adjustedMonthlyTotal,
                                    serviceDiffs: compareSummary.serviceChanges
                                  },
                                  {
                                    id: second.run.id,
                                    createdAt: second.run.createdAt,
                                    prompt: second.run.prompt,
                                    output: second.run.output,
                                    runContext: second.view.runContext,
                                    adjustedMonthlyTotal: second.view.adjustedMonthlyTotal,
                                    serviceDiffs: compareSummary.serviceChanges
                                  }
                                ],
                                compareSummary
                              );
                            }}
                          >
                            <FolderKanban className="h-4 w-4" />
                            Bundle Compare
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setCompareRunIds([])}>
                            Clear Compare
                          </Button>
                        </div>
                      </div>
                      {compareSummary ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Cost delta</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDelta(compareSummary.monthlyDelta)}/mo</p>
                          </div>
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Recommendation shift</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {compareSummary.recommendationChanged ? "Changed" : "Unchanged"}
                            </p>
                          </div>
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Finding delta</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{compareSummary.findingDelta === 0 ? "No change" : `${compareSummary.findingDelta > 0 ? "+" : ""}${compareSummary.findingDelta}`}</p>
                          </div>
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Service changes</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{compareSummary.serviceChanges.length}</p>
                          </div>
                        </div>
                      ) : null}
                      {compareSummary ? (
                        <div className="mt-4 grid gap-3 xl:grid-cols-3">
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Compliance added</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {compareSummary.addedCompliance.length > 0 ? compareSummary.addedCompliance.map((item) => (
                                <Badge key={`added-${item}`} variant="secondary">{item}</Badge>
                              )) : <span className="text-sm text-slate-600">None</span>}
                            </div>
                          </div>
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Compliance removed</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {compareSummary.removedCompliance.length > 0 ? compareSummary.removedCompliance.map((item) => (
                                <Badge key={`removed-${item}`} variant="outline">{item}</Badge>
                              )) : <span className="text-sm text-slate-600">None</span>}
                            </div>
                          </div>
                          <div className={mutedPanelClassName + " p-3"}>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Service diffs</p>
                            <div className="mt-2 space-y-1">
                              {compareSummary.serviceChanges.length > 0 ? compareSummary.serviceChanges.slice(0, 4).map((item) => (
                                <p key={item} className="text-sm text-slate-700">{item}</p>
                              )) : <span className="text-sm text-slate-600">No service shifts</span>}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {compareServiceRows.length > 0 ? (
                        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80 bg-white/85">
                          <div className="border-b border-slate-200/80 bg-slate-50/90 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Service Diff Table</p>
                            <p className="mt-1 text-sm text-slate-600">Structured before-and-after view of the selected service mix and tier changes.</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-sm">
                              <thead className="bg-slate-50 text-left">
                                <tr>
                                  <th className="px-3 py-2 font-medium">Service Area</th>
                                  <th className="px-3 py-2 font-medium">Run {compareRunViews[0]?.run.id}</th>
                                  <th className="px-3 py-2 font-medium">Run {compareRunViews[1]?.run.id}</th>
                                  <th className="px-3 py-2 text-right font-medium">Delta</th>
                                  <th className="px-3 py-2 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {compareServiceRows.map((row) => (
                                  <tr key={row.key} className="border-t align-top">
                                    <td className="px-3 py-3 font-medium text-slate-900">{row.previousName !== "Not present" ? row.previousName : row.nextName}</td>
                                    <td className="px-3 py-3">
                                      <p className="font-medium text-slate-900">{row.previousName}</p>
                                      <p className="text-xs text-slate-500">{row.previousTier}</p>
                                      <p className="mt-1 text-sm text-slate-700">${row.previousMonthlyUsd.toLocaleString()}/mo</p>
                                    </td>
                                    <td className="px-3 py-3">
                                      <p className="font-medium text-slate-900">{row.nextName}</p>
                                      <p className="text-xs text-slate-500">{row.nextTier}</p>
                                      <p className="mt-1 text-sm text-slate-700">${row.nextMonthlyUsd.toLocaleString()}/mo</p>
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono text-slate-900">{formatDelta(row.delta)}</td>
                                    <td className="px-3 py-3">
                                      <Badge variant={row.changed ? "secondary" : "outline"}>{row.changed ? "Changed" : "Unchanged"}</Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        {compareRunViews.map(({ run, view: runView }) => {
                          return (
                            <div key={`compare-panel-${run.id}`} className="rounded-lg border border-slate-200/80 bg-white/80 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Run {run.id}</Badge>
                                <Badge variant="secondary">{runView.runContext.recommendationLabel}</Badge>
                                <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="mt-3 text-sm text-slate-700">{run.output.summary}</p>
                              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Adjusted monthly</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">${runView.adjustedMonthlyTotal.toLocaleString()}/mo</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Security findings</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{run.output.securityFindings.length}</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Traffic posture</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatTrafficProfileLabel(runView.runContext.trafficProfile)}</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Observability</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatObservabilityDepthLabel(runView.runContext.observabilityDepth)}</p>
                                </div>
                              </div>
                              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200/80 bg-white/80">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 text-left">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">Service</th>
                                      <th className="px-3 py-2 font-medium">Tier</th>
                                      <th className="px-3 py-2 text-right font-medium">Monthly</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {runView.activeProfile.services.slice(0, 5).map((service) => (
                                      <tr key={`${run.id}-${service.name}`} className="border-t">
                                        <td className="px-3 py-2 font-medium text-slate-900">{service.name}</td>
                                        <td className="px-3 py-2 text-slate-600">{service.tier}</td>
                                        <td className="px-3 py-2 text-right font-mono">${service.estimatedMonthlyUsd.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {activeProject.history.length > 0 ? (
                      activeProject.history.map((run) => {
                        const { runContext, profiles, activeProfile, adjustedCostItems, adjustedMonthlyTotal } = getRunView(run);
                        const isSelectedForCompare = compareRunIds.includes(run.id);

                        return (
                        <div key={run.id} className="rounded-lg border border-slate-200/80 bg-white/75 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Run {run.id}</Badge>
                                <Badge variant="secondary">{run.output.generationSource === "ai" ? "AI-enhanced" : "Deterministic"}</Badge>
                                <Badge variant="outline">{runContext.recommendationLabel}</Badge>
                                <Badge variant="outline">{formatTrafficProfileLabel(runContext.trafficProfile)}</Badge>
                                <Badge variant="outline">{runContext.regionCount} region{runContext.regionCount > 1 ? "s" : ""}</Badge>
                                <Badge variant="outline">{formatObservabilityDepthLabel(runContext.observabilityDepth)}</Badge>
                                <span className="text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-slate-800">{run.prompt}</p>
                              <p className="text-sm text-slate-600">{run.output.summary}</p>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Saved recommendation</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{runContext.recommendationLabel}</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Traffic posture</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatTrafficProfileLabel(runContext.trafficProfile)}</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Observability</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatObservabilityDepthLabel(runContext.observabilityDepth)}</p>
                                </div>
                                <div className={mutedPanelClassName + " p-3"}>
                                  <p className="text-xs uppercase tracking-wide text-slate-500">Adjusted monthly</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">${adjustedMonthlyTotal.toLocaleString()}/mo</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {run.output.securityProfile.compliancePacks.map((pack) => (
                                  <Badge key={`${run.id}-${pack}`} variant="secondary">
                                    {pack}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant={isSelectedForCompare ? "secondary" : "outline"}
                                onClick={() => toggleCompareRun(run.id)}
                              >
                                <GitCompareArrows className="h-4 w-4" />
                                {isSelectedForCompare
                                  ? compareRunIds[0] === run.id
                                    ? "Compare A"
                                    : "Compare B"
                                  : compareRunIds.length === 0
                                    ? "Add Compare A"
                                    : compareRunIds.length === 1
                                      ? "Add Compare B"
                                      : "Swap Into Compare"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => downloadText(`architecture-review-run-${run.id}.md`, architectureToMarkdown(run.output))}
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Markdown
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const adjustedOutput = {
                                    ...run.output,
                                    services: activeProfile.services,
                                    costEstimate: {
                                      ...run.output.costEstimate,
                                      monthlyUsd: adjustedCostItems.reduce((sum, item) => sum + item.monthlyUsd, 0),
                                      items: adjustedCostItems
                                    }
                                  };

                                  void downloadArchitectureBundle(`project-${activeProject.id}-run-${run.id}`, adjustedOutput, {
                                    selectedRecommendationLabel: runContext.recommendationLabel,
                                    selectedRecommendationDescription: runContext.recommendationDescription,
                                    scenario: {
                                      trafficProfile: runContext.trafficProfile,
                                      regionCount: runContext.regionCount,
                                      observabilityDepth: runContext.observabilityDepth
                                    },
                                    comparisonProfiles: profiles.map((profile) => ({
                                      label: profile.label,
                                      description: profile.description,
                                      totalMonthlyUsd: profile.totalMonthlyUsd,
                                      services: profile.services.map((service) => ({
                                        name: service.name,
                                        tier: service.tier,
                                        estimatedMonthlyUsd: service.estimatedMonthlyUsd,
                                        justification: service.justification
                                      }))
                                    }))
                                  });
                                }}
                              >
                                <FolderKanban className="h-4 w-4" />
                                Bundle
                              </Button>
                              <Link
                                href={`/generate?projectId=${activeProject.id}&runId=${run.id}`}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                Re-open Studio
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">No saved runs yet for this project. Generate from the studio to populate history here.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">Choose a project to inspect its architecture history.</div>
              )}
            </CardContent>
          </Card>
        </section>
      </section>
    </main>
  );
}
