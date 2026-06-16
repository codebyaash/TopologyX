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

export type SecurityProfile = {
  compliancePacks: string[];
  identityStrategy: string;
  networkBoundary: string;
  policyRecommendations: string[];
};

export type CostLineItem = {
  service: string;
  assumption: string;
  monthlyUsd: number;
};

export type RecommendationKey = "recommendation1" | "recommendation2" | "recommendation3";
export type TrafficProfile = "steady" | "growth" | "burst";
export type ObservabilityDepth = "lean" | "standard" | "deep";

export type RunContext = {
  recommendationKey: RecommendationKey;
  recommendationLabel: string;
  recommendationDescription: string;
  trafficProfile: TrafficProfile;
  regionCount: number;
  observabilityDepth: ObservabilityDepth;
};

export type DeploymentComponent = {
  name: string;
  category: "Ingress" | "Network" | "Compute" | "Data" | "Messaging" | "Security" | "Observability" | "AI" | "IoT" | "Connector";
  purpose: string;
  iacResources: string[];
  connectsTo: string[];
  dependsOn: string[];
};

export type IacModule = {
  name: string;
  scope: "Foundation" | "Network" | "Identity" | "Data" | "Application" | "Observability" | "Policy" | "AI" | "IoT";
  purpose: string;
  resources: string[];
  dependsOn: string[];
};

export type ArchitectureOutput = {
  generationSource?: "deterministic" | "ai";
  generationNotes?: string[];
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
  securityProfile: SecurityProfile;
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
  iacStructure: {
    modules: IacModule[];
    deploymentOrder: string[];
  };
};

export type SampleScenario = {
  title: string;
  prompt: string;
  tag: string;
};

export type ProjectSummary = {
  id: number;
  name: string;
  description: string | null;
  userId: number;
  createdAt: string;
  latestRequestAt: string | null;
  requestCount: number;
};

export type SavedArchitectureRun = {
  id: number;
  projectId: number;
  prompt: string;
  createdAt: string;
  output: ArchitectureOutput;
  runContext?: RunContext | null;
};

export type ProjectDetail = ProjectSummary & {
  history: SavedArchitectureRun[];
};

export type AuthUser = {
  id: number;
  email: string;
  createdAt: string;
};
