from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["Critical", "High", "Medium", "Low"]
Pillar = Literal["Reliability", "Security", "Cost optimization", "Operational excellence", "Performance efficiency"]
GenerationSource = Literal["deterministic", "ai"]


class ArchitectureRequest(BaseModel):
    prompt: str = Field(min_length=12)
    projectId: Optional[int] = None


class ServiceAlternative(BaseModel):
    name: str
    tier: str
    justification: str
    estimatedMonthlyUsd: int
    tradeoff: str


class ServiceRecommendation(BaseModel):
    name: str
    tier: str
    reason: str
    justification: str
    estimatedMonthlyUsd: int
    alternatives: list[ServiceAlternative]
    wellArchitectedPillar: Pillar


class DiagramPosition(BaseModel):
    x: int
    y: int


class DiagramNodeData(BaseModel):
    label: str


class DiagramNode(BaseModel):
    id: str
    position: DiagramPosition
    data: DiagramNodeData
    type: Optional[str] = None


class DiagramEdge(BaseModel):
    id: str
    source: str
    target: str
    animated: bool = False


class Diagram(BaseModel):
    nodes: list[DiagramNode]
    edges: list[DiagramEdge]


class SecurityFinding(BaseModel):
    severity: Severity
    title: str
    detail: str
    remediation: str


class SecurityProfile(BaseModel):
    compliancePacks: list[str]
    identityStrategy: str
    networkBoundary: str
    policyRecommendations: list[str]


class CostLineItem(BaseModel):
    service: str
    assumption: str
    monthlyUsd: int


class DeploymentComponent(BaseModel):
    name: str
    category: Literal["Ingress", "Network", "Compute", "Data", "Messaging", "Security", "Observability", "AI", "IoT", "Connector"]
    purpose: str
    iacResources: list[str]
    connectsTo: list[str]
    dependsOn: list[str]


class CostEstimate(BaseModel):
    monthlyUsd: int
    items: list[CostLineItem]
    disclaimer: str


class IacTemplates(BaseModel):
    bicep: str
    terraform: str


class IacModule(BaseModel):
    name: str
    scope: Literal["Foundation", "Network", "Identity", "Data", "Application", "Observability", "Policy", "AI", "IoT"]
    purpose: str
    resources: list[str]
    dependsOn: list[str]


class IacStructure(BaseModel):
    modules: list[IacModule]
    deploymentOrder: list[str]


class ArchitectureOutput(BaseModel):
    generationSource: GenerationSource = "deterministic"
    generationNotes: list[str] = []
    summary: str
    services: list[ServiceRecommendation]
    deployment: list[DeploymentComponent]
    dataFlow: list[str]
    risks: list[str]
    recommendations: list[str]
    scaling: list[str]
    diagram: Diagram
    securityProfile: SecurityProfile
    securityFindings: list[SecurityFinding]
    costEstimate: CostEstimate
    iac: IacTemplates
    iacStructure: IacStructure


class ProjectCreate(BaseModel):
    name: str = Field(min_length=3, max_length=160)
    description: Optional[str] = None


class ProjectSummary(BaseModel):
    id: int
    name: str
    description: Optional[str]
    userId: int
    createdAt: datetime
    latestRequestAt: Optional[datetime] = None
    requestCount: int = 0


class SavedArchitectureRun(BaseModel):
    id: int
    projectId: int
    prompt: str
    createdAt: datetime
    output: ArchitectureOutput


class ProjectDetail(ProjectSummary):
    history: list[SavedArchitectureRun]


class AuthRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthUser(BaseModel):
    id: int
    email: str
    createdAt: datetime
