import { describe, expect, it } from "vitest";

import { generateArchitecture } from "@/lib/architecture-engine";
import { architectureToMarkdown, buildArchitectureBundleFiles } from "@/services/architecture";

describe("architectureToMarkdown", () => {
  it("includes security, cost, and iac structure sections", () => {
    const output = generateArchitecture(
      "Design a CRM platform for sales and customer success with tenant isolation, lead ingestion, workflow automation, reporting dashboards, audit logs, and role-based access."
    );

    const markdown = architectureToMarkdown(output);

    expect(markdown).toContain("# Architecture Recommendation");
    expect(markdown).toContain("## Security Review");
    expect(markdown).toContain("## Cost Estimate");
    expect(markdown).toContain("## IaC Structure");
    expect(markdown).toContain("foundation");
    expect(markdown).toContain("policy");
  });

  it("adds recommendation comparison artifacts to the export bundle when provided", () => {
    const output = generateArchitecture(
      "Design an insurance claims and policy servicing platform with CRM integrations, call-center workflows, document intake, fraud checks, and reporting."
    );

    const files = buildArchitectureBundleFiles(output, {
      selectedRecommendationLabel: "Recommendation 2",
      selectedRecommendationDescription: "Cost-leaning alternative using the first substitute where available.",
      scenario: {
        trafficProfile: "growth",
        regionCount: 2,
        observabilityDepth: "deep"
      },
      comparisonProfiles: [
        {
          label: "Recommendation 1",
          description: "Balanced default",
          totalMonthlyUsd: 1200,
          services: [
            {
              name: "Azure Front Door",
              tier: "Standard",
              estimatedMonthlyUsd: 120,
              justification: "Global ingress with WAF and routing."
            }
          ]
        },
        {
          label: "Recommendation 2",
          description: "Cost-leaning alternative",
          totalMonthlyUsd: 980,
          services: [
            {
              name: "Application Gateway",
              tier: "v2",
              estimatedMonthlyUsd: 95,
              justification: "Lower cost regional ingress with operational tradeoffs."
            }
          ]
        }
      ]
    });

    expect(files["README.txt"]).toContain("Selected recommendation: Recommendation 2");
    expect(files["README.txt"]).toContain("Traffic profile: growth");
    expect(files["README.txt"]).toContain("- recommendation-comparison.md");
    expect(files["recommendation-comparison.md"]).toContain("# Recommendation Comparison");
    expect(files["recommendation-comparison.md"]).toContain("| Recommendation 2 |");
    expect(files["recommendation-comparison.md"]).toContain("Application Gateway");
  });
});
