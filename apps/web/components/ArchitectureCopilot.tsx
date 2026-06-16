"use client";

import dynamic from "next/dynamic";
import { toPng } from "html-to-image";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, type NodeProps } from "reactflow";
import { Activity, AlertTriangle, ArrowLeft, Braces, CloudCog, Database, Download, FileCode2, FolderKanban, GitCompareArrows, Globe, HardDrive, History, KeyRound, Layers3, Loader2, LogIn, LogOut, Network, Play, ServerCog, ShieldCheck, Sparkles, UserRound, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateArchitecture } from "@/lib/architecture-engine";
import { buildAdjustedCostItems, buildRecommendationProfiles, formatObservabilityDepthLabel, formatTrafficProfileLabel, resolveRunContext } from "@/lib/recommendations";
import { sampleScenarios } from "@/lib/samples";
import type { ArchitectureOutput, AuthUser, ObservabilityDepth, ProjectDetail, ProjectSummary, RecommendationKey, RunContext, Severity, TrafficProfile } from "@/lib/types";
import { architectureToMarkdown, createAndSaveArchitectureWithContext, createProject, downloadArchitectureBundle, downloadText, getCurrentUser, getProject, listProjects, login, logout, register } from "@/services/architecture";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">Loading editor...</div>
});

const defaultPrompt = sampleScenarios[0].prompt;

const severityVariant: Record<Severity, "critical" | "high" | "medium" | "low"> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low"
};

const ghostLinkClassName =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200/80 bg-white/75 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const shellCardClassName = "border-slate-200/80 bg-white/82 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur";
const mutedPanelClassName = "rounded-lg border border-slate-200/80 bg-slate-50/90";
const selectClassName =
  "h-10 rounded-md border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-800 outline-none transition focus-visible:ring-2 focus-visible:ring-ring";

function diagramNodeTone(label: string) {
  const text = label.toLowerCase();

  if (text.includes("front door") || text.includes("client") || text.includes("user")) {
    return {
      icon: Globe,
      chip: "Ingress",
      iconClassName: "bg-sky-500/12 text-sky-700",
      borderClassName: "border-sky-200/80",
    };
  }
  if (text.includes("api") || text.includes("function")) {
    return {
      icon: ServerCog,
      chip: "Application",
      iconClassName: "bg-violet-500/12 text-violet-700",
      borderClassName: "border-violet-200/80",
    };
  }
  if (text.includes("service bus")) {
    return {
      icon: Activity,
      chip: "Messaging",
      iconClassName: "bg-amber-500/12 text-amber-700",
      borderClassName: "border-amber-200/80",
    };
  }
  if (text.includes("sql")) {
    return {
      icon: Database,
      chip: "Data",
      iconClassName: "bg-emerald-500/12 text-emerald-700",
      borderClassName: "border-emerald-200/80",
    };
  }
  if (text.includes("storage")) {
    return {
      icon: HardDrive,
      chip: "Storage",
      iconClassName: "bg-teal-500/12 text-teal-700",
      borderClassName: "border-teal-200/80",
    };
  }
  if (text.includes("key vault") || text.includes("private")) {
    return {
      icon: KeyRound,
      chip: "Security",
      iconClassName: "bg-rose-500/12 text-rose-700",
      borderClassName: "border-rose-200/80",
    };
  }

  return {
    icon: Network,
    chip: "Platform",
    iconClassName: "bg-slate-500/12 text-slate-700",
    borderClassName: "border-slate-200/80",
  };
}

function DiagramNodeCard({ data }: NodeProps<{ label: string }>) {
  const tone = diagramNodeTone(data.label);
  const Icon = tone.icon;

  return (
    <div className={`min-w-[210px] rounded-lg border bg-white/95 px-4 py-3 shadow-[0_16px_36px_rgba(15,23,42,0.10)] backdrop-blur ${tone.borderClassName}`}>
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-slate-300" />
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone.iconClassName}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-slate-900">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{tone.chip}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-slate-300" />
    </div>
  );
}

const memoizedNodeTypes = { architectureNode: DiagramNodeCard };

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className={shellCardClassName}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCostDelta(current: number, alternative: number) {
  const diff = alternative - current;
  if (diff === 0) {
    return "same cost";
  }
  return diff > 0 ? `$${diff.toLocaleString()} more` : `$${Math.abs(diff).toLocaleString()} less`;
}

export function ArchitectureCopilot() {
  const apiEnabled = Boolean(process.env.NEXT_PUBLIC_API_URL);
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [output, setOutput] = useState<ArchitectureOutput>(() => generateArchitecture(defaultPrompt));
  const [isLoading, setIsLoading] = useState(false);
  const [codeKind, setCodeKind] = useState<"bicep" | "terraform">("bicep");
  const [recommendationKey, setRecommendationKey] = useState<RecommendationKey>("recommendation1");
  const [showComparison, setShowComparison] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [activeProject, setActiveProject] = useState<ProjectDetail | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [trafficProfile, setTrafficProfile] = useState<TrafficProfile>("steady");
  const [regionCount, setRegionCount] = useState(1);
  const [observabilityDepth, setObservabilityDepth] = useState<ObservabilityDepth>("standard");
  const [handledDeepLinkKey, setHandledDeepLinkKey] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement | null>(null);

  const criticalCount = useMemo(() => output.securityFindings.filter((item) => item.severity === "Critical" || item.severity === "High").length, [output]);
  const code = codeKind === "bicep" ? output.iac.bicep : output.iac.terraform;
  const recommendationProfiles = useMemo(() => buildRecommendationProfiles(output), [output]);
  const activeProfile = useMemo(
    () => recommendationProfiles.find((profile) => profile.key === recommendationKey) ?? recommendationProfiles[0],
    [recommendationKey, recommendationProfiles]
  );
  const activeCostItems = useMemo(
    () =>
      activeProfile.services.map((service) => ({
        service: service.name,
        assumption: `${service.tier} selected in ${activeProfile.label.toLowerCase()}`,
        monthlyUsd: service.estimatedMonthlyUsd
      })),
    [activeProfile]
  );
  const adjustedCostItems = useMemo(
    () =>
      buildAdjustedCostItems(activeProfile, {
        recommendationKey,
        recommendationLabel: activeProfile.label,
        recommendationDescription: activeProfile.description,
        trafficProfile,
        regionCount,
        observabilityDepth
      }),
    [activeProfile, observabilityDepth, recommendationKey, regionCount, trafficProfile]
  );
  const adjustedMonthlyTotal = useMemo(() => adjustedCostItems.reduce((sum, item) => sum + item.monthlyUsd, 0), [adjustedCostItems]);
  const baselineMonthlyTotal = useMemo(() => activeCostItems.reduce((sum, item) => sum + item.monthlyUsd, 0), [activeCostItems]);
  const diagramNodes = useMemo(
    () =>
      output.diagram.nodes.map((node) => ({
        ...node,
        type: "architectureNode",
      })),
    [output.diagram.nodes]
  );
  const diagramEdges = useMemo(
    () =>
      output.diagram.edges.map((edge) => ({
        ...edge,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
        animated: edge.animated,
      })),
    [output.diagram.edges]
  );

  const refreshProjects = useCallback(async (nextSelectedId?: number) => {
    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      const fallbackId = nextSelectedId ?? (selectedProjectId === "" ? undefined : selectedProjectId);
      if (fallbackId) {
        const project = await getProject(fallbackId);
        setActiveProject(project);
        setSelectedProjectId(project.id);
      } else if (nextProjects.length > 0) {
        setSelectedProjectId(nextProjects[0].id);
        const project = await getProject(nextProjects[0].id);
        setActiveProject(project);
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Unable to load projects.");
    }
  }, [selectedProjectId]);

  function applyRunContext(runContext?: RunContext | null) {
    if (!runContext) {
      setRecommendationKey("recommendation1");
      setTrafficProfile("steady");
      setRegionCount(1);
      setObservabilityDepth("standard");
      return;
    }

    setRecommendationKey(runContext.recommendationKey);
    setTrafficProfile(runContext.trafficProfile);
    setRegionCount(runContext.regionCount);
    setObservabilityDepth(runContext.observabilityDepth);
  }

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
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to restore session.");
      }
    })();
  }, [apiEnabled, refreshProjects]);

  useEffect(() => {
    if (!apiEnabled || !currentUser) {
      return;
    }

    const rawProjectId = searchParams.get("projectId");
    const rawRunId = searchParams.get("runId");
    if (!rawProjectId) {
      return;
    }

    const projectId = Number(rawProjectId);
    const runId = rawRunId ? Number(rawRunId) : undefined;
    if (!Number.isFinite(projectId) || (rawRunId && !Number.isFinite(runId))) {
      return;
    }

    const deepLinkKey = `${projectId}:${runId ?? "latest"}`;
    if (handledDeepLinkKey === deepLinkKey) {
      return;
    }

    void (async () => {
      try {
        const project = await getProject(projectId);
        setActiveProject(project);
        setSelectedProjectId(project.id);
        setProjects((current) => (current.some((item) => item.id === project.id) ? current : [...current, project]));

        const run = runId ? project.history.find((item) => item.id === runId) : project.history[0];
        if (run) {
          setPrompt(run.prompt);
          setOutput(run.output);
          applyRunContext(run.runContext);
          setShowComparison(false);
          setProjectStatus(`Loaded ${project.name} run ${run.id} from the projects workspace.`);
        } else {
          setProjectStatus(`Loaded project "${project.name}". No matching saved run was found.`);
        }
        setHandledDeepLinkKey(deepLinkKey);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : "Unable to load the requested saved run.");
        setHandledDeepLinkKey(deepLinkKey);
      }
    })();
  }, [apiEnabled, currentUser, handledDeepLinkKey, searchParams]);

  async function handleGenerate() {
    setIsLoading(true);
    setProjectError(null);

    try {
      const next = await createAndSaveArchitectureWithContext(prompt, {
        projectId: selectedProjectId === "" ? undefined : selectedProjectId,
        recommendationKey,
        recommendationLabel: activeProfile.label,
        recommendationDescription: activeProfile.description,
        trafficProfile,
        regionCount,
        observabilityDepth
      });
      setOutput(next);
      setShowComparison(false);
      setProjectStatus(selectedProjectId === "" ? "Generated in preview mode." : "Architecture generated and saved to the selected project.");

      if (selectedProjectId !== "" && apiEnabled) {
        const project = await getProject(selectedProjectId);
        setActiveProject(project);
        setProjects((current) =>
          current.map((item) =>
            item.id === project.id
              ? {
                  ...item,
                  requestCount: project.requestCount,
                  latestRequestAt: project.latestRequestAt
                }
              : item
          )
        );
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!currentUser) {
      setProjectError("Please sign in before creating a project.");
      return;
    }

    if (!projectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }

    setProjectError(null);
    setProjectStatus("Creating project...");

    try {
      const project = await createProject(projectName.trim(), projectDescription.trim() || undefined);
      setProjectName("");
      setProjectDescription("");
      setProjectStatus(`Project "${project.name}" created.`);
      await refreshProjects(project.id);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Unable to create project.");
      setProjectStatus(null);
    }
  }

  async function handleSelectProject(projectId: number) {
    setSelectedProjectId(projectId);
    setProjectError(null);

    try {
      const project = await getProject(projectId);
      setActiveProject(project);
      setProjectStatus(`Loaded history for "${project.name}".`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Unable to load project.");
    }
  }

  function loadHistoryRun(project: ProjectDetail, runId: number) {
    const match = project.history.find((item) => item.id === runId);
    if (!match) {
      return;
    }
    setPrompt(match.prompt);
    setOutput(match.output);
    applyRunContext(match.runContext);
    setShowComparison(false);
    setProjectStatus(`Loaded saved run from ${new Date(match.createdAt).toLocaleString()}.`);
  }

  async function handleAuthSubmit() {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    setAuthError(null);
    setAuthStatus(authMode === "login" ? "Signing in..." : "Creating account...");

    try {
      const user = authMode === "login" ? await login(authEmail.trim(), authPassword) : await register(authEmail.trim(), authPassword);
      setCurrentUser(user);
      setAuthPassword("");
      setAuthStatus(authMode === "login" ? `Signed in as ${user.email}.` : `Account created for ${user.email}.`);
      await refreshProjects();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      setAuthStatus(null);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      setCurrentUser(null);
      setProjects([]);
      setSelectedProjectId("");
      setActiveProject(null);
      setAuthStatus("Signed out.");
      setProjectStatus(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign out.");
    }
  }

  async function handleExportDiagram() {
    if (!diagramRef.current) {
      return;
    }

    try {
      const dataUrl = await toPng(diagramRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f8fafc"
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "architecture-diagram.png";
      link.click();
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Unable to export diagram.");
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,148,136,0.12),_transparent_28%),linear-gradient(180deg,_#f7f5ef_0%,_#edf2ef_100%)]">
      <section className="border-b border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/70 px-3 py-2 text-sm text-slate-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CloudCog className="h-4 w-4" />
              </div>
              <span>Generator workspace</span>
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-900 sm:text-5xl">
                Build the full Azure architecture package from one prompt.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-700">
                This studio expands the overview into detailed recommendations, deployment structure, diagram, security findings, cost assumptions, and full IaC coverage for services, connectors, identities, private access paths, and workload add-ons.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={ghostLinkClassName}>
              <ArrowLeft className="h-4 w-4" />
              Overview
            </Link>
            <Link href="/projects" className={ghostLinkClassName}>
              <FolderKanban className="h-4 w-4" />
              Projects
            </Link>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  "architecture-review.md",
                  architectureToMarkdown({
                    ...output,
                    services: activeProfile.services,
                    costEstimate: {
                      ...output.costEstimate,
                      monthlyUsd: adjustedMonthlyTotal,
                      items: adjustedCostItems
                    }
                  })
                )
              }
            >
              <Download className="h-4 w-4" />
              Markdown
            </Button>
            <Button variant="outline" onClick={() => downloadText(codeKind === "bicep" ? "main.bicep" : "main.tf", code)}>
              <FileCode2 className="h-4 w-4" />
              IaC
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void downloadArchitectureBundle("architecture-bundle", {
                  ...output,
                  services: activeProfile.services,
                  costEstimate: {
                    ...output.costEstimate,
                    monthlyUsd: adjustedMonthlyTotal,
                    items: adjustedCostItems,
                  },
                }, {
                  selectedRecommendationLabel: activeProfile.label,
                  selectedRecommendationDescription: activeProfile.description,
                  scenario: {
                    trafficProfile,
                    regionCount,
                    observabilityDepth
                  },
                  comparisonProfiles: recommendationProfiles.map((profile) => ({
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
                })
              }
            >
              <Braces className="h-4 w-4" />
              Bundle
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className={shellCardClassName}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Architecture Request</CardTitle>
                  <CardDescription>Describe compliance, traffic, data sensitivity, integrations, and availability goals.</CardDescription>
                </div>
                {currentUser ? (
                  <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-right">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <UserRound className="h-4 w-4" />
                      <span>{currentUser.email}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiEnabled ? (
                <div className="grid gap-3 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3">
                  {!currentUser ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input placeholder="Email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                        <Input placeholder="Password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => setAuthMode((mode) => (mode === "login" ? "register" : "login"))}>
                          {authMode === "login" ? "Need an account?" : "Have an account?"}
                        </Button>
                        <Button type="button" onClick={handleAuthSubmit}>
                          <LogIn className="h-4 w-4" />
                          {authMode === "login" ? "Sign In" : "Create Account"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Sign in to save architectures, organize projects, and revisit history.</p>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">Active project</p>
                          <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                            <LogOut className="h-4 w-4" />
                            Logout
                          </Button>
                        </div>
                        <select value={selectedProjectId} onChange={(event) => void handleSelectProject(Number(event.target.value))} className={selectClassName}>
                          {projects.length === 0 ? <option value="">No projects yet</option> : null}
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                          {selectedProjectId === ""
                            ? "Create a project to start saving generations."
                            : "New generations will be attached to the selected project."}
                        </p>
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
                  {authStatus ? <p className="text-sm text-slate-600">{authStatus}</p> : null}
                  {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-600">
                  Project history is available when `NEXT_PUBLIC_API_URL` points to the FastAPI backend. You can still generate locally in preview mode.
                </div>
              )}
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-44 resize-none border-slate-200/80 bg-white/75" />
              <Button onClick={handleGenerate} className="w-full" disabled={isLoading || prompt.trim().length < 12}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Generate Architecture
              </Button>
              {projectStatus ? <p className="text-sm text-slate-600">{projectStatus}</p> : null}
              {projectError ? <p className="text-sm text-red-600">{projectError}</p> : null}
            </CardContent>
          </Card>

          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle>Example Scenarios</CardTitle>
              <CardDescription>Portfolio-ready demos for common cloud architecture interviews.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {sampleScenarios.map((sample) => (
                <button
                  key={sample.title}
                  className="rounded-md border border-slate-200/80 bg-white/75 p-3 text-left transition hover:border-primary hover:bg-primary/5"
                  onClick={() => setPrompt(sample.prompt)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{sample.title}</span>
                    <Badge variant="outline">{sample.tag}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sample.prompt}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Project History
              </CardTitle>
              <CardDescription>Re-open saved prompts and architecture outputs from the selected project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!apiEnabled ? (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-600">History appears here when the API-backed project flow is enabled.</div>
              ) : !currentUser ? (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-600">Sign in to unlock per-user project history.</div>
              ) : activeProject && activeProject.history.length > 0 ? (
                activeProject.history.slice(0, 6).map((item) => {
                  const runContext = resolveRunContext(item.runContext);
                  return (
                    <button
                      key={item.id}
                      className="w-full rounded-md border border-slate-200/80 bg-white/75 p-3 text-left transition hover:border-primary hover:bg-primary/5"
                      onClick={() => loadHistoryRun(activeProject, item.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-900">{new Date(item.createdAt).toLocaleString()}</span>
                        <Badge variant="outline">Run {item.id}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{runContext.recommendationLabel}</Badge>
                        <Badge variant="outline">{formatTrafficProfileLabel(runContext.trafficProfile)}</Badge>
                        <Badge variant="outline">{runContext.regionCount} region{runContext.regionCount > 1 ? "s" : ""}</Badge>
                        <Badge variant="outline">{formatObservabilityDepthLabel(runContext.observabilityDepth)}</Badge>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{item.prompt}</p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-sm text-slate-600">
                  {selectedProjectId === "" ? "Choose or create a project to build history." : "No saved runs yet for this project."}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-6">
          <Card className={shellCardClassName}>
            <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Recommendation set</p>
                  <select value={recommendationKey} onChange={(event) => setRecommendationKey(event.target.value as RecommendationKey)} className={selectClassName}>
                    {recommendationProfiles.map((profile) => (
                      <option key={profile.key} value={profile.key}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{activeProfile.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{activeProfile.description}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setShowComparison((value) => !value)}>
                <GitCompareArrows className="h-4 w-4" />
                {showComparison ? "Hide Compare" : "Compare"}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Recommended services" value={String(activeProfile.services.length)} icon={Layers3} />
            <Stat label="High-risk findings" value={String(criticalCount)} icon={AlertTriangle} />
            <Stat label="Monthly estimate" value={`$${adjustedMonthlyTotal.toLocaleString()}`} icon={WalletCards} />
            <Stat label="IaC templates" value="Bicep + Terraform" icon={Braces} />
          </div>

          {showComparison ? (
            <Card className={shellCardClassName}>
              <CardHeader>
                <CardTitle>Recommendation Comparison</CardTitle>
                <CardDescription>Compare recommendation 1, 2, and 3 side by side by selected service option and monthly cost.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/75">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Service area</th>
                        {recommendationProfiles.map((profile) => (
                          <th key={profile.key} className="px-3 py-2 font-medium">
                            {profile.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {output.services.map((service, index) => (
                        <tr key={`compare-${service.name}-${index}`} className="border-t align-top">
                          <td className="px-3 py-3 font-medium">{service.name}</td>
                          {recommendationProfiles.map((profile) => {
                            const option = profile.services[index];
                            return (
                              <td key={`${profile.key}-${service.name}`} className="px-3 py-3">
                                <p className="font-medium text-slate-900">{option.name}</p>
                                <p className="text-xs text-muted-foreground">{option.tier}</p>
                                <p className="mt-2 text-sm">${option.estimatedMonthlyUsd.toLocaleString()}/month</p>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-t bg-slate-50">
                        <td className="px-3 py-3 font-semibold">Total monthly estimate</td>
                        {recommendationProfiles.map((profile) => (
                          <td key={`${profile.key}-total`} className="px-3 py-3 font-semibold text-slate-900">
                            ${profile.totalMonthlyUsd.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className={shellCardClassName}>
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>Architecture Summary</CardTitle>
                  <CardDescription className="mt-2 max-w-4xl text-sm leading-6 text-slate-700">{output.summary}</CardDescription>
                </div>
                <div className={mutedPanelClassName + " px-4 py-3"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{activeProfile.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">${adjustedMonthlyTotal.toLocaleString()}/mo</p>
                  <p className="mt-1 text-xs text-slate-500">Baseline ${baselineMonthlyTotal.toLocaleString()}/mo</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Generation mode</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-800">
                    {output.generationSource === "ai" ? <Sparkles className="h-4 w-4 text-primary" /> : <CloudCog className="h-4 w-4 text-primary" />}
                    <span>{output.generationSource === "ai" ? "AI-enhanced" : "Deterministic preview"}</span>
                  </div>
                  {output.generationNotes?.[0] ? <p className="mt-2 text-sm leading-6 text-slate-700">{output.generationNotes[0]}</p> : null}
                </div>
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">First data flow step</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{output.dataFlow[0]}</p>
                </div>
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Primary risk</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{output.risks[0]}</p>
                </div>
              </div>
              <div className={mutedPanelClassName + " p-4"}>
                <p className="text-xs uppercase tracking-wide text-slate-500">First recommendation</p>
                <p className="mt-2 text-sm leading-6 text-slate-800">{output.recommendations[0]}</p>
              </div>
            </CardHeader>
          </Card>

          <Tabs defaultValue="diagram">
            <TabsList className="w-full justify-start overflow-x-auto border border-slate-200/80 bg-white/70 p-1 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <TabsTrigger value="diagram">Diagram</TabsTrigger>
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="cost">Cost</TabsTrigger>
              <TabsTrigger value="iac">IaC</TabsTrigger>
              <TabsTrigger value="scale">Scale</TabsTrigger>
            </TabsList>

            <TabsContent value="diagram">
              <Card className={shellCardClassName}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Generated Azure Diagram</CardTitle>
                      <CardDescription>Client-side React Flow view generated from the structured architecture output.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleExportDiagram}>
                      <Download className="h-4 w-4" />
                      PNG
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div ref={diagramRef} className="h-[520px] overflow-hidden rounded-lg border border-slate-200/80 bg-white/80">
                    <ReactFlow nodes={diagramNodes} edges={diagramEdges} nodeTypes={memoizedNodeTypes} fitView fitViewOptions={{ padding: 0.18 }}>
                      <MiniMap
                        pannable
                        zoomable
                        nodeStrokeColor="#cbd5e1"
                        nodeColor="#f8fafc"
                        maskColor="rgba(241,245,249,0.72)"
                      />
                      <Controls />
                      <Background color="#e2e8f0" gap={20} />
                    </ReactFlow>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="structure">
              <Card className={shellCardClassName}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Deployment Structure
                  </CardTitle>
                  <CardDescription>Every suggested service and connector mapped to IaC resources, dependencies, and runtime connections.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/75">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Component</th>
                          <th className="px-3 py-2 font-medium">IaC Resources</th>
                          <th className="px-3 py-2 font-medium">Connections</th>
                        </tr>
                      </thead>
                      <tbody>
                        {output.deployment.map((item) => (
                          <tr key={item.name} className="border-t align-top">
                            <td className="w-[28%] px-3 py-3">
                              <div className="flex flex-col gap-2">
                                <span className="font-medium">{item.name}</span>
                                <Badge variant="outline">{item.category}</Badge>
                                <span className="text-xs text-muted-foreground">{item.purpose}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {item.iacResources.map((resource) => (
                                  <Badge key={resource} variant="secondary">
                                    {resource}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-xs text-muted-foreground">Connects to</p>
                              <p className="text-sm">{item.connectsTo.join(", ")}</p>
                              {item.dependsOn.length > 0 ? (
                                <>
                                  <p className="mt-2 text-xs text-muted-foreground">Depends on</p>
                                  <p className="text-sm">{item.dependsOn.join(", ")}</p>
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="services">
              <div className="grid gap-3 md:grid-cols-2">
                {activeProfile.services.map((item, index) => (
                  <Card key={`${item.name}-${item.tier}-${index}`} className={shellCardClassName}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle>{item.name}</CardTitle>
                        <Badge variant="secondary">{item.wellArchitectedPillar}</Badge>
                      </div>
                      <CardDescription>{item.tier} · ${item.estimatedMonthlyUsd.toLocaleString()}/month</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                      <div className={mutedPanelClassName + " p-4"}>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{activeProfile.label} justification</p>
                        <p className="mt-2 text-sm leading-6 text-slate-800">{item.justification}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Compared with recommendation 1, this service is {formatCostDelta(output.services[index].estimatedMonthlyUsd, item.estimatedMonthlyUsd)} in the selected profile.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="security">
              <Card className={shellCardClassName}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Rules-based Security Review
                  </CardTitle>
                  <CardDescription>Findings map to private access, RBAC, monitoring, encryption, backup, gateway, and Key Vault controls.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Compliance packs</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {output.securityProfile.compliancePacks.map((pack) => (
                          <Badge key={pack} variant="secondary">
                            {pack}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Identity strategy</p>
                      <p className="mt-2 text-sm leading-6 text-slate-800">{output.securityProfile.identityStrategy}</p>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Network boundary</p>
                      <p className="mt-2 text-sm leading-6 text-slate-800">{output.securityProfile.networkBoundary}</p>
                    </div>
                  </div>
                  <div className={mutedPanelClassName + " p-4"}>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Azure Policy posture</p>
                    <div className="mt-2 grid gap-2">
                      {output.securityProfile.policyRecommendations.map((item) => (
                        <p key={item} className="text-sm leading-6 text-slate-800">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  {output.securityFindings.map((finding) => (
                    <div key={finding.title} className="rounded-lg border border-slate-200/80 bg-white/75 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant[finding.severity]}>{finding.severity}</Badge>
                        <h3 className="text-sm font-semibold">{finding.title}</h3>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{finding.detail}</p>
                      <p className="mt-2 text-sm">{finding.remediation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cost">
              <Card className={shellCardClassName}>
                <CardHeader>
                  <CardTitle>Monthly Cost Estimate</CardTitle>
                  <CardDescription>{output.costEstimate.disclaimer}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 rounded-lg border border-slate-200/80 bg-slate-50/80 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Traffic profile</p>
                      <select value={trafficProfile} onChange={(event) => setTrafficProfile(event.target.value as TrafficProfile)} className={selectClassName}>
                        <option value="steady">Steady</option>
                        <option value="growth">Growth</option>
                        <option value="burst">Burst / Peak</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Regions</p>
                      <Input type="number" min={1} max={6} value={regionCount} onChange={(event) => setRegionCount(Math.min(6, Math.max(1, Number(event.target.value) || 1)))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Observability</p>
                      <select value={observabilityDepth} onChange={(event) => setObservabilityDepth(event.target.value as ObservabilityDepth)} className={selectClassName}>
                        <option value="lean">Lean</option>
                        <option value="standard">Standard</option>
                        <option value="deep">Deep retention</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <a
                        href="https://azure.microsoft.com/pricing/calculator/"
                        target="_blank"
                        rel="noreferrer"
                        className={ghostLinkClassName + " w-full"}
                      >
                        Pricing Calculator
                      </a>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Adjusted monthly total</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">${adjustedMonthlyTotal.toLocaleString()}</p>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Baseline recommendation</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">${baselineMonthlyTotal.toLocaleString()}</p>
                    </div>
                    <div className={mutedPanelClassName + " p-4"}>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Delta</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {adjustedMonthlyTotal === baselineMonthlyTotal
                          ? "$0"
                          : `${adjustedMonthlyTotal > baselineMonthlyTotal ? "+" : "-"}$${Math.abs(adjustedMonthlyTotal - baselineMonthlyTotal).toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/75">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Service</th>
                          <th className="px-3 py-2 font-medium">Assumption</th>
                          <th className="px-3 py-2 text-right font-medium">Monthly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustedCostItems.map((item) => (
                          <tr key={item.service} className="border-t">
                            <td className="px-3 py-2 font-medium">{item.service}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.assumption}</td>
                            <td className="px-3 py-2 text-right font-mono">${item.monthlyUsd.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="border-t bg-slate-50">
                          <td className="px-3 py-2 font-semibold">Total</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {trafficProfile === "steady" ? "Base traffic posture" : trafficProfile === "growth" ? "Growth allowance applied" : "Peak traffic allowance applied"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">${adjustedMonthlyTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="iac">
              <Card className={shellCardClassName}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Infrastructure as Code</CardTitle>
                      <CardDescription>Bicep first, Terraform second. Includes services, network, identities, private endpoints, observability, connectors, and optional workload resources.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant={codeKind === "bicep" ? "default" : "outline"} size="sm" onClick={() => setCodeKind("bicep")}>
                        Bicep
                      </Button>
                      <Button variant={codeKind === "terraform" ? "default" : "outline"} size="sm" onClick={() => setCodeKind("terraform")}>
                        Terraform
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {output.iacStructure.modules.map((module) => (
                      <div key={module.name} className="rounded-lg border border-slate-200/80 bg-white/75 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{module.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{module.scope}</p>
                          </div>
                          <Badge variant="outline">{module.resources.length} resources</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-700">{module.purpose}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {module.resources.map((resource) => (
                            <Badge key={resource} variant="secondary">
                              {resource}
                            </Badge>
                          ))}
                        </div>
                        {module.dependsOn.length > 0 ? (
                          <p className="mt-3 text-xs text-slate-500">Depends on: {module.dependsOn.join(", ")}</p>
                        ) : (
                          <p className="mt-3 text-xs text-slate-500">Deploy first in the stack order.</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={mutedPanelClassName + " p-4"}>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Deployment order</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {output.iacStructure.deploymentOrder.map((moduleName, index) => (
                        <Badge key={moduleName} variant="outline">
                          {index + 1}. {moduleName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/75">
                    <MonacoEditor height="460px" language={codeKind === "bicep" ? "bicep" : "hcl"} theme="vs-light" value={code} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scale">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className={shellCardClassName}>
                  <CardHeader>
                    <CardTitle>Data Flow</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {output.dataFlow.map((item, index) => (
                      <div key={item} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className={shellCardClassName}>
                  <CardHeader>
                    <CardTitle>Scaling Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {output.scaling.map((item) => (
                      <p key={item} className="rounded-md border border-slate-200/80 bg-white/75 p-3 text-sm text-muted-foreground">
                        {item}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </section>
    </main>
  );
}
