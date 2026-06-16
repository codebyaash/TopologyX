import JSZip from "jszip";
import { generateArchitecture } from "@/lib/architecture-engine";
import type { ArchitectureOutput, AuthUser, ObservabilityDepth, ProjectDetail, ProjectSummary, RecommendationKey, RunContext, TrafficProfile } from "@/lib/types";

export type ArchitectureBundleComparisonProfile = {
  label: string;
  description: string;
  totalMonthlyUsd: number;
  services: Array<{
    name: string;
    tier: string;
    estimatedMonthlyUsd: number;
    justification: string;
  }>;
};

export type ArchitectureBundleOptions = {
  selectedRecommendationLabel?: string;
  selectedRecommendationDescription?: string;
  scenario?: {
    trafficProfile: string;
    regionCount: number;
    observabilityDepth: string;
  };
  comparisonProfiles?: ArchitectureBundleComparisonProfile[];
};

export type ArchitectureComparisonReportRun = {
  id: number;
  createdAt: string;
  prompt: string;
  output: ArchitectureOutput;
  runContext: RunContext;
  adjustedMonthlyTotal: number;
  serviceDiffs: string[];
};

export type ArchitectureComparisonReportSummary = {
  monthlyDelta: number;
  findingDelta: number;
  recommendationChanged: boolean;
  addedCompliance: string[];
  removedCompliance: string[];
  serviceChanges: string[];
};

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL;
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function createArchitecture(prompt: string): Promise<ArchitectureOutput> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return generateArchitecture(prompt);
  }

  try {
    const response = await fetch(`${apiUrl}/api/architecture/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return (await response.json()) as ArchitectureOutput;
  } catch {
    return generateArchitecture(prompt);
  }
}

export async function createProject(name: string, description?: string): Promise<ProjectSummary> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Project features require NEXT_PUBLIC_API_URL.");
  }

  const response = await fetch(`${apiUrl}/api/architecture/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description || null }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Project creation failed with ${response.status}`));
  }

  return (await response.json()) as ProjectSummary;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return [];
  }

  const response = await fetch(`${apiUrl}/api/architecture/projects`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Project list failed with ${response.status}`));
  }

  return (await response.json()) as ProjectSummary[];
}

export async function getProject(projectId: number): Promise<ProjectDetail> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Project features require NEXT_PUBLIC_API_URL.");
  }

  const response = await fetch(`${apiUrl}/api/architecture/projects/${projectId}`, {
    cache: "no-store",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Project fetch failed with ${response.status}`));
  }

  return (await response.json()) as ProjectDetail;
}

export async function createAndSaveArchitecture(prompt: string, projectId?: number): Promise<ArchitectureOutput> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return generateArchitecture(prompt);
  }

  const response = await fetch(`${apiUrl}/api/architecture/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, projectId: projectId ?? null }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `API returned ${response.status}`));
  }

  return (await response.json()) as ArchitectureOutput;
}

export type SaveArchitectureOptions = {
  projectId?: number;
  recommendationKey: RecommendationKey;
  recommendationLabel: string;
  recommendationDescription: string;
  trafficProfile: TrafficProfile;
  regionCount: number;
  observabilityDepth: ObservabilityDepth;
};

export async function createAndSaveArchitectureWithContext(prompt: string, options?: SaveArchitectureOptions): Promise<ArchitectureOutput> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return generateArchitecture(prompt);
  }

  const response = await fetch(`${apiUrl}/api/architecture/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      projectId: options?.projectId ?? null,
      runContext: options
        ? {
            recommendationKey: options.recommendationKey,
            recommendationLabel: options.recommendationLabel,
            recommendationDescription: options.recommendationDescription,
            trafficProfile: options.trafficProfile,
            regionCount: options.regionCount,
            observabilityDepth: options.observabilityDepth
          }
        : null
    }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `API returned ${response.status}`));
  }

  return (await response.json()) as ArchitectureOutput;
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Authentication requires NEXT_PUBLIC_API_URL.");
  }

  const response = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Registration failed with ${response.status}`));
  }

  return (await response.json()) as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Authentication requires NEXT_PUBLIC_API_URL.");
  }

  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Login failed with ${response.status}`));
  }

  return (await response.json()) as AuthUser;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return null;
  }

  const response = await fetch(`${apiUrl}/api/auth/me`, {
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readError(response, `Session check failed with ${response.status}`));
  }

  return (await response.json()) as AuthUser;
}

export async function logout(): Promise<void> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return;
  }

  const response = await fetch(`${apiUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Logout failed with ${response.status}`));
  }
}

export function architectureToMarkdown(output: ArchitectureOutput) {
  const services = output.services
    .map(
      (item) =>
        `- **${item.name}** (${item.tier}, $${item.estimatedMonthlyUsd}/month) - ${item.reason}
  - Why this option: ${item.justification}
  - Alternatives: ${item.alternatives.map((alt) => `${alt.name} (${alt.tier}, $${alt.estimatedMonthlyUsd}/month, ${alt.tradeoff})`).join("; ")}`
    )
    .join("\n");
  const deployment = output.deployment.map((item) => `- **${item.name}** (${item.category}) - ${item.purpose}\n  - IaC: ${item.iacResources.join(", ")}\n  - Connects to: ${item.connectsTo.join(", ")}`).join("\n");
  const findings = output.securityFindings.map((item) => `- **${item.severity}: ${item.title}** - ${item.remediation}`).join("\n");
  const cost = output.costEstimate.items.map((item) => `- ${item.service}: $${item.monthlyUsd}/month (${item.assumption})`).join("\n");
  const iacModules = output.iacStructure.modules
    .map((module) => `- **${module.name}** (${module.scope}) - ${module.purpose}\n  - Resources: ${module.resources.join(", ")}\n  - Depends on: ${module.dependsOn.join(", ") || "None"}`)
    .join("\n");

  return `# Architecture Recommendation

${output.summary}

## Services

${services}

## Deployment Structure

${deployment}

## Data Flow

${output.dataFlow.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Security Review

${findings}

## Cost Estimate

Estimated monthly baseline: **$${output.costEstimate.monthlyUsd}**

${cost}

## IaC Structure

${iacModules}

## Scaling Recommendations

${output.scaling.map((item) => `- ${item}`).join("\n")}
`;
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDelta(delta: number) {
  if (delta === 0) {
    return "$0";
  }
  return `${delta > 0 ? "+" : "-"}$${Math.abs(delta).toLocaleString()}`;
}

export function buildArchitectureComparisonMarkdown(
  projectName: string,
  runs: [ArchitectureComparisonReportRun, ArchitectureComparisonReportRun],
  summary: ArchitectureComparisonReportSummary
) {
  const [first, second] = runs;

  const runSection = (run: ArchitectureComparisonReportRun) => `## Run ${run.id}

- Created: ${new Date(run.createdAt).toLocaleString()}
- Recommendation: ${run.runContext.recommendationLabel}
- Traffic: ${run.runContext.trafficProfile}
- Regions: ${run.runContext.regionCount}
- Observability: ${run.runContext.observabilityDepth}
- Adjusted monthly: $${run.adjustedMonthlyTotal.toLocaleString()}/mo

Prompt:
${run.prompt}

Summary:
${run.output.summary}
`;

  return `# Run Comparison Report

Project: ${projectName}

## Difference Summary

- Cost delta: ${formatDelta(summary.monthlyDelta)}/mo
- Recommendation shift: ${summary.recommendationChanged ? "Changed" : "Unchanged"}
- Security finding delta: ${summary.findingDelta === 0 ? "No change" : `${summary.findingDelta > 0 ? "+" : ""}${summary.findingDelta}`}
- Service changes: ${summary.serviceChanges.length}

## Compliance Added

${summary.addedCompliance.length > 0 ? summary.addedCompliance.map((item) => `- ${item}`).join("\n") : "- None"}

## Compliance Removed

${summary.removedCompliance.length > 0 ? summary.removedCompliance.map((item) => `- ${item}`).join("\n") : "- None"}

## Service Diffs

${summary.serviceChanges.length > 0 ? summary.serviceChanges.map((item) => `- ${item}`).join("\n") : "- No service shifts"}

${runSection(first)}

${runSection(second)}
`;
}

export function downloadArchitectureComparisonReport(
  filename: string,
  projectName: string,
  runs: [ArchitectureComparisonReportRun, ArchitectureComparisonReportRun],
  summary: ArchitectureComparisonReportSummary
) {
  downloadText(filename, buildArchitectureComparisonMarkdown(projectName, runs, summary));
}

export function buildArchitectureComparisonBundleFiles(
  projectName: string,
  runs: [ArchitectureComparisonReportRun, ArchitectureComparisonReportRun],
  summary: ArchitectureComparisonReportSummary
): Record<string, string> {
  const [first, second] = runs;
  const comparisonMarkdown = buildArchitectureComparisonMarkdown(projectName, runs, summary);

  return {
    "comparison-report.md": comparisonMarkdown,
    "README.txt": [
      `Project comparison bundle: ${projectName}`,
      "",
      `Compared runs: ${first.id} and ${second.id}`,
      `Cost delta: ${formatDelta(summary.monthlyDelta)}/mo`,
      `Recommendation shift: ${summary.recommendationChanged ? "Changed" : "Unchanged"}`,
      `Finding delta: ${summary.findingDelta === 0 ? "No change" : `${summary.findingDelta > 0 ? "+" : ""}${summary.findingDelta}`}`,
      "",
      "Files:",
      "- comparison-report.md",
      `- run-${first.id}/architecture-review.md`,
      `- run-${first.id}/architecture.json`,
      `- run-${first.id}/iac/main.bicep`,
      `- run-${first.id}/iac/main.tf`,
      `- run-${second.id}/architecture-review.md`,
      `- run-${second.id}/architecture.json`,
      `- run-${second.id}/iac/main.bicep`,
      `- run-${second.id}/iac/main.tf`
    ].join("\n"),
    [`run-${first.id}/architecture-review.md`]: architectureToMarkdown(first.output),
    [`run-${first.id}/architecture.json`]: JSON.stringify(first.output, null, 2),
    [`run-${first.id}/iac/main.bicep`]: first.output.iac.bicep,
    [`run-${first.id}/iac/main.tf`]: first.output.iac.terraform,
    [`run-${second.id}/architecture-review.md`]: architectureToMarkdown(second.output),
    [`run-${second.id}/architecture.json`]: JSON.stringify(second.output, null, 2),
    [`run-${second.id}/iac/main.bicep`]: second.output.iac.bicep,
    [`run-${second.id}/iac/main.tf`]: second.output.iac.terraform
  };
}

export async function downloadArchitectureComparisonBundle(
  filename: string,
  projectName: string,
  runs: [ArchitectureComparisonReportRun, ArchitectureComparisonReportRun],
  summary: ArchitectureComparisonReportSummary
) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(buildArchitectureComparisonBundleFiles(projectName, runs, summary))) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildRecommendationComparisonMarkdown(profiles: ArchitectureBundleComparisonProfile[], selectedLabel?: string) {
  const rows = profiles
    .map((profile) => {
      const marker = profile.label === selectedLabel ? "Yes" : "No";
      return `| ${profile.label} | ${profile.description} | $${profile.totalMonthlyUsd.toLocaleString()} | ${marker} |`;
    })
    .join("\n");

  const serviceSections = profiles
    .map((profile) => {
      const services = profile.services
        .map(
          (service) =>
            `- **${service.name}** (${service.tier}, $${service.estimatedMonthlyUsd.toLocaleString()}/month) - ${service.justification}`
        )
        .join("\n");

      return `## ${profile.label}\n\n${profile.description}\n\n${services}`;
    })
    .join("\n\n");

  return `# Recommendation Comparison

| Recommendation | Positioning | Monthly estimate | Selected |
| --- | --- | ---: | --- |
${rows}

${serviceSections}
`;
}

export function buildArchitectureBundleFiles(
  output: ArchitectureOutput,
  options: ArchitectureBundleOptions = {}
): Record<string, string> {
  const files: Record<string, string> = {
    "architecture-review.md": architectureToMarkdown(output),
    "iac/main.bicep": output.iac.bicep,
    "iac/main.tf": output.iac.terraform,
    "architecture.json": JSON.stringify(output, null, 2)
  };

  const summary = [
    "# Export Bundle",
    "",
    `Summary: ${output.summary}`,
    `Generation source: ${output.generationSource ?? "deterministic"}`,
    options.selectedRecommendationLabel ? `Selected recommendation: ${options.selectedRecommendationLabel}` : null,
    options.selectedRecommendationDescription ? `Recommendation rationale: ${options.selectedRecommendationDescription}` : null,
    options.scenario ? `Traffic profile: ${options.scenario.trafficProfile}` : null,
    options.scenario ? `Regions: ${options.scenario.regionCount}` : null,
    options.scenario ? `Observability depth: ${options.scenario.observabilityDepth}` : null,
    `Services: ${output.services.length}`,
    `Deployment components: ${output.deployment.length}`,
    `Monthly estimate: $${output.costEstimate.monthlyUsd}`,
    "",
    "Files:",
    "- architecture-review.md",
    "- architecture.json",
    "- iac/main.bicep",
    "- iac/main.tf",
    options.comparisonProfiles?.length ? "- recommendation-comparison.md" : null
  ]
    .filter(Boolean)
    .join("\n");

  files["README.txt"] = summary;

  if (options.comparisonProfiles?.length) {
    files["recommendation-comparison.md"] = buildRecommendationComparisonMarkdown(
      options.comparisonProfiles,
      options.selectedRecommendationLabel
    );
  }

  return files;
}

export async function downloadArchitectureBundle(
  bundleName: string,
  output: ArchitectureOutput,
  options: ArchitectureBundleOptions = {}
) {
  const zip = new JSZip();
  for (const [filename, content] of Object.entries(buildArchitectureBundleFiles(output, options))) {
    zip.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${bundleName}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
