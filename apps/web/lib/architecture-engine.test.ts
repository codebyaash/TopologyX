import { describe, expect, it } from "vitest";

import { generateArchitecture } from "@/lib/architecture-engine";

describe("generateArchitecture", () => {
  it("builds healthcare security posture and iac structure", () => {
    const output = generateArchitecture(
      "Design a HIPAA-compliant EHR platform handling 1M requests/day with private patient records, audit logging, backups, and secure provider access."
    );

    expect(output.generationSource).toBe("deterministic");
    expect(output.securityProfile.compliancePacks).toContain("HIPAA");
    expect(output.securityProfile.compliancePacks).toContain("PHI Handling");
    expect(output.iacStructure.deploymentOrder[0]).toBe("foundation");
    expect(output.iacStructure.modules.some((module) => module.name === "policy")).toBe(true);
    expect(output.securityFindings.length).toBeGreaterThan(0);
  });

  it("adds ai-specific modules for ai document workloads", () => {
    const output = generateArchitecture(
      "Design an AI document processing platform with file ingestion, OCR, vector search, human review, PII protection, and asynchronous workflows."
    );

    expect(output.services.some((service) => service.name.includes("Document Intelligence"))).toBe(true);
    expect(output.securityProfile.compliancePacks).toContain("PII Review for AI Pipelines");
    expect(output.iacStructure.modules.some((module) => module.name === "ai-extension")).toBe(true);
  });

  it("adds iot module structure for telemetry workloads", () => {
    const output = generateArchitecture(
      "Design an IoT telemetry ingestion platform handling device messages, hot-path alerts, cold storage, dashboards, and fleet identity."
    );

    expect(output.services.some((service) => service.name.includes("IoT Hub"))).toBe(true);
    expect(output.securityProfile.compliancePacks).toContain("Device Identity");
    expect(output.iacStructure.modules.some((module) => module.name === "iot-extension")).toBe(true);
  });
});
