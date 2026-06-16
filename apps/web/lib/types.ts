import type { Edge, Node } from "reactflow";

export type Severity = "Critical" | "High" | "Medium" | "Low";

export type ServiceRecommendation = {
  name: string;
  tier: string;
  reason: string;
  justification: string;
  estimatedMonthlyUsd: number;
  alternatives: ServiceAlternative[];
  wellArchitectedPillar: "Reliability" | "Security" | "Cost optimization" | "Operational excellence" | "Performance efficiency";
};

export type ServiceAlternative = {
  name: string;
  tier: string;
  justification: string;
  estimatedMonthlyUsd: number;
  tradeoff: string;
};

export type SecurityFinding = {
  severity: Severity;
  title: string;
  detail: string;
  remediation: string;
};

export type CostLineItem = {
  service: string;
  assumption: string;
  monthlyUsd: number;
};

export type DeploymentComponent = {
  name: string;
  category: "Ingress" | "Network" | "Compute" | "Data" | "Messaging" | "Security" | "Observability" | "AI" | "IoT" | "Connector";
  purpose: string;
  iacResources: string[];
  connectsTo: string[];
  dependsOn: string[];
};

export type ArchitectureOutput = {
  summary: string;
  services: ServiceRecommendation[];
  deployment: DeploymentComponent[];
  dataFlow: string[];
  risks: string[];
  recommendations: string[];
  scaling: string[];
  diagram: {
    nodes: Node[];
    edges: Edge[];
  };
  securityFindings: SecurityFinding[];
  costEstimate: {
    monthlyUsd: number;
    items: CostLineItem[];
    disclaimer: string;
  };
  iac: {
    bicep: string;
    terraform: string;
  };
};

export type SampleScenario = {
  title: string;
  prompt: string;
  tag: string;
};
