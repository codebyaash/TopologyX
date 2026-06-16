import { generateArchitecture } from "@/lib/architecture-engine";
import type { ArchitectureOutput, AuthUser, ProjectDetail, ProjectSummary } from "@/lib/types";

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
