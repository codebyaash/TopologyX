import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectsWorkspace } from "@/components/ProjectsWorkspace";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/services/architecture", () => ({
  architectureToMarkdown: vi.fn(() => "# Mock Architecture"),
  createProject: vi.fn(),
  downloadArchitectureBundle: vi.fn(),
  downloadArchitectureComparisonBundle: vi.fn(),
  downloadArchitectureComparisonReport: vi.fn(),
  downloadText: vi.fn(),
  getCurrentUser: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

describe("ProjectsWorkspace", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  });

  it("shows validation error when auth form is submitted empty", async () => {
    const services = await import("@/services/architecture");
    vi.mocked(services.getCurrentUser).mockResolvedValue(null);

    render(<ProjectsWorkspace />);

    await waitFor(() => expect(screen.getByText("Workspace Access")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Email and password are required.")).not.toBeNull();
  });

  it("loads projects and exposes deep link back to the generator", async () => {
    const services = await import("@/services/architecture");
    vi.mocked(services.getCurrentUser).mockResolvedValue({
      id: 7,
      email: "ash@example.com",
      createdAt: "2026-06-17T00:00:00Z",
    });
    vi.mocked(services.listProjects).mockResolvedValue([
      {
        id: 12,
        name: "Claims Platform",
        description: "Insurance workflow",
        userId: 7,
        createdAt: "2026-06-17T00:00:00Z",
        latestRequestAt: "2026-06-17T01:00:00Z",
        requestCount: 2,
      },
    ]);
    vi.mocked(services.getProject).mockResolvedValue({
      id: 12,
      name: "Claims Platform",
      description: "Insurance workflow",
      userId: 7,
      createdAt: "2026-06-17T00:00:00Z",
      latestRequestAt: "2026-06-17T01:00:00Z",
      requestCount: 1,
      history: [
        {
          id: 42,
          projectId: 12,
          prompt: "Design an insurance claims workflow.",
          createdAt: "2026-06-17T01:00:00Z",
          runContext: {
            recommendationKey: "recommendation2",
            recommendationLabel: "Recommendation 2",
            recommendationDescription: "Cost-leaning alternative using the first substitute where available.",
            trafficProfile: "growth",
            regionCount: 2,
            observabilityDepth: "deep",
          },
          output: {
            generationSource: "deterministic",
            generationNotes: ["Generated with the built-in deterministic architecture engine."],
            summary: "Architecture summary",
            services: [
              {
                name: "Azure Front Door",
                tier: "Standard",
                reason: "Global entry point",
                justification: "Managed global ingress with WAF.",
                estimatedMonthlyUsd: 120,
                alternatives: [
                  {
                    name: "Application Gateway",
                    tier: "v2",
                    justification: "Regional ingress alternative.",
                    estimatedMonthlyUsd: 90,
                    tradeoff: "Less global reach."
                  }
                ],
                wellArchitectedPillar: "Reliability"
              }
            ],
            deployment: [],
            dataFlow: [],
            risks: [],
            recommendations: [],
            scaling: [],
            diagram: { nodes: [], edges: [] },
            securityProfile: {
              compliancePacks: ["PII Handling"],
              identityStrategy: "Managed identities",
              networkBoundary: "Private endpoints",
              policyRecommendations: ["Use Azure Policy"],
            },
            securityFindings: [],
            costEstimate: {
              monthlyUsd: 1800,
              items: [],
              disclaimer: "Estimate only",
            },
            iac: {
              bicep: "",
              terraform: "",
            },
            iacStructure: {
              modules: [],
              deploymentOrder: [],
            },
          },
        },
        {
          id: 43,
          projectId: 12,
          prompt: "Design a CRM-integrated insurance servicing workflow.",
          createdAt: "2026-06-17T02:00:00Z",
          runContext: {
            recommendationKey: "recommendation1",
            recommendationLabel: "Recommendation 1",
            recommendationDescription: "Balanced default for the current workload.",
            trafficProfile: "steady",
            regionCount: 1,
            observabilityDepth: "standard",
          },
          output: {
            generationSource: "ai",
            generationNotes: ["Generated through the configured AI provider and validated against the architecture schema."],
            summary: "Updated CRM servicing architecture summary",
            services: [
              {
                name: "Azure Front Door",
                tier: "Premium",
                reason: "Global entry point",
                justification: "Premium ingress with more edge controls.",
                estimatedMonthlyUsd: 170,
                alternatives: [
                  {
                    name: "Application Gateway",
                    tier: "v2",
                    justification: "Regional ingress alternative.",
                    estimatedMonthlyUsd: 90,
                    tradeoff: "Less global reach."
                  }
                ],
                wellArchitectedPillar: "Reliability"
              }
            ],
            deployment: [],
            dataFlow: [],
            risks: [],
            recommendations: [],
            scaling: [],
            diagram: { nodes: [], edges: [] },
            securityProfile: {
              compliancePacks: ["PII Handling", "PCI Boundary"],
              identityStrategy: "Managed identities",
              networkBoundary: "Private endpoints",
              policyRecommendations: ["Use Azure Policy"],
            },
            securityFindings: [
              {
                severity: "Medium",
                title: "Backup strategy needs proof",
                detail: "RPO and RTO are not defined.",
                remediation: "Define recovery targets and test restores.",
              },
            ],
            costEstimate: {
              monthlyUsd: 2200,
              items: [],
              disclaimer: "Estimate only",
            },
            iac: {
              bicep: "",
              terraform: "",
            },
            iacStructure: {
              modules: [],
              deploymentOrder: [],
            },
          },
        },
      ],
    });

    render(<ProjectsWorkspace />);

    await waitFor(() => expect(screen.getByText("Claims Platform")).not.toBeNull());
    expect(screen.getAllByText("PII Handling").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recommendation 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Growth").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Deep retention").length).toBeGreaterThan(0);
    expect(screen.getByText("$1,350/mo")).not.toBeNull();
    expect(screen.getByText("$2,200/mo")).not.toBeNull();

    const reopenLinks = screen.getAllByRole("link", { name: /re-open studio/i });
    expect(reopenLinks[0].getAttribute("href")).toBe("/generate?projectId=12&runId=42");

    fireEvent.click(screen.getAllByRole("button", { name: /add compare a/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /add compare b/i }));

    expect(screen.getByText("Run Comparison")).not.toBeNull();
    expect(screen.getAllByText(/adjusted monthly/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Updated CRM servicing architecture summary").length).toBeGreaterThan(0);
    expect(screen.getByText("Cost delta")).not.toBeNull();
    expect(screen.getByText("+$850/mo")).not.toBeNull();
    expect(screen.getByText("Compliance added")).not.toBeNull();
    expect(screen.getAllByText("PCI Boundary").length).toBeGreaterThan(0);
    expect(screen.getByText("Application Gateway (v2) -> Azure Front Door (Premium)")).not.toBeNull();
    expect(screen.getByText("Service Diff Table")).not.toBeNull();
    expect(screen.getAllByText("Run 42").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Run 43").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Changed").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /export compare/i }));
    expect(vi.mocked(services.downloadArchitectureComparisonReport)).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /bundle compare/i }));
    expect(vi.mocked(services.downloadArchitectureComparisonBundle)).toHaveBeenCalled();
  });
});
