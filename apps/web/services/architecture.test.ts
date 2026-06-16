import { describe, expect, it } from "vitest";

import { generateArchitecture } from "@/lib/architecture-engine";
import { architectureToMarkdown } from "@/services/architecture";

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
});
