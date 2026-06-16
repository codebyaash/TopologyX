import { generateArchitecture } from "@/lib/architecture-engine";
import type { ArchitectureOutput } from "@/lib/types";

export async function createArchitecture(prompt: string): Promise<ArchitectureOutput> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

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
