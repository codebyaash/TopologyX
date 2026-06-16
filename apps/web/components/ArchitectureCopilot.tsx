"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import { AlertTriangle, ArrowLeft, Braces, CloudCog, Download, FileCode2, GitCompareArrows, Layers3, Loader2, Network, Play, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateArchitecture } from "@/lib/architecture-engine";
import { sampleScenarios } from "@/lib/samples";
import type { ArchitectureOutput, Severity } from "@/lib/types";
import { architectureToMarkdown, createArchitecture, downloadText } from "@/services/architecture";

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
type RecommendationKey = "recommendation1" | "recommendation2" | "recommendation3";
type ProfileService = ArchitectureOutput["services"][number];
type RecommendationProfile = {
  key: RecommendationKey;
  label: string;
  description: string;
  services: ProfileService[];
  totalMonthlyUsd: number;
};

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

function buildRecommendationProfiles(output: ArchitectureOutput): RecommendationProfile[] {
  const baseTotal = output.services.reduce((sum, service) => sum + service.estimatedMonthlyUsd, 0);
  const multiplier = baseTotal > 0 ? output.costEstimate.monthlyUsd / baseTotal : 1;
  const scaledCost = (value: number) => Math.round(value * multiplier);

  return [
    {
      key: "recommendation1",
      label: "Recommendation 1",
      description: "Balanced default for the current workload.",
      services: output.services.map((service) => ({
        ...service,
        estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
      })),
      totalMonthlyUsd: output.costEstimate.monthlyUsd
    },
    {
      key: "recommendation2",
      label: "Recommendation 2",
      description: "Cost-leaning alternative using the first substitute where available.",
      services: output.services.map((service) => {
        const option = service.alternatives[0];
        return option
          ? {
              ...service,
              name: option.name,
              tier: option.tier,
              justification: option.justification,
              estimatedMonthlyUsd: scaledCost(option.estimatedMonthlyUsd)
            }
          : {
              ...service,
              estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
            };
      }),
      totalMonthlyUsd: output.services.reduce((sum, service) => sum + scaledCost(service.alternatives[0]?.estimatedMonthlyUsd ?? service.estimatedMonthlyUsd), 0)
    },
    {
      key: "recommendation3",
      label: "Recommendation 3",
      description: "Second alternative path with a different operational tradeoff profile.",
      services: output.services.map((service) => {
        const option = service.alternatives[1];
        return option
          ? {
              ...service,
              name: option.name,
              tier: option.tier,
              justification: option.justification,
              estimatedMonthlyUsd: scaledCost(option.estimatedMonthlyUsd)
            }
          : {
              ...service,
              estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
            };
      }),
      totalMonthlyUsd: output.services.reduce((sum, service) => sum + scaledCost(service.alternatives[1]?.estimatedMonthlyUsd ?? service.estimatedMonthlyUsd), 0)
    }
  ];
}

export function ArchitectureCopilot() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [output, setOutput] = useState<ArchitectureOutput>(() => generateArchitecture(defaultPrompt));
  const [isLoading, setIsLoading] = useState(false);
  const [codeKind, setCodeKind] = useState<"bicep" | "terraform">("bicep");
  const [recommendationKey, setRecommendationKey] = useState<RecommendationKey>("recommendation1");
  const [showComparison, setShowComparison] = useState(false);

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

  async function handleGenerate() {
    setIsLoading(true);
    const next = await createArchitecture(prompt);
    setOutput(next);
    setRecommendationKey("recommendation1");
    setShowComparison(false);
    setIsLoading(false);
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
                      monthlyUsd: activeProfile.totalMonthlyUsd,
                      items: activeCostItems
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
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className={shellCardClassName}>
            <CardHeader>
              <CardTitle>Architecture Request</CardTitle>
              <CardDescription>Describe compliance, traffic, data sensitivity, integrations, and availability goals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-44 resize-none border-slate-200/80 bg-white/75" />
              <Button onClick={handleGenerate} className="w-full" disabled={isLoading || prompt.trim().length < 12}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Generate Architecture
              </Button>
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
            <Stat label="Monthly estimate" value={`$${activeProfile.totalMonthlyUsd.toLocaleString()}`} icon={WalletCards} />
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
                  <p className="mt-1 text-xl font-semibold text-slate-900">${activeProfile.totalMonthlyUsd.toLocaleString()}/mo</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">First data flow step</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{output.dataFlow[0]}</p>
                </div>
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Primary risk</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{output.risks[0]}</p>
                </div>
                <div className={mutedPanelClassName + " p-4"}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">First recommendation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-800">{output.recommendations[0]}</p>
                </div>
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
                  <CardTitle>Generated Azure Diagram</CardTitle>
                  <CardDescription>Client-side React Flow view generated from the structured architecture output.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[520px] overflow-hidden rounded-lg border border-slate-200/80 bg-white/80">
                    <ReactFlow nodes={output.diagram.nodes} edges={output.diagram.edges} fitView>
                      <MiniMap pannable zoomable />
                      <Controls />
                      <Background />
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
                <CardContent className="space-y-3">
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
                <CardContent>
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
                        {activeCostItems.map((item) => (
                          <tr key={item.service} className="border-t">
                            <td className="px-3 py-2 font-medium">{item.service}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.assumption}</td>
                            <td className="px-3 py-2 text-right font-mono">${item.monthlyUsd.toLocaleString()}</td>
                          </tr>
                        ))}
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
                <CardContent>
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
