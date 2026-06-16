from app.schemas.architecture import ArchitectureOutput, Diagram, DiagramEdge, DiagramNode, DiagramNodeData, DiagramPosition, IacTemplates
from app.services.ai.client import AIConfigurationError, AIRequestError, complete_json, is_ai_configured
from app.services.ai.prompts import SYSTEM_PROMPT, build_architecture_prompt
from app.services.architecture.catalog import deployment_components, infer_workload, recommended_services
from app.services.cost.estimator import estimate_cost
from app.services.iac.generator import build_iac_structure, generate_bicep, generate_terraform
from app.services.security.reviewer import build_security_profile, review_security


def build_diagram() -> Diagram:
    nodes = [
        DiagramNode(id="clients", type="input", position=DiagramPosition(x=20, y=120), data=DiagramNodeData(label="Clients / Users")),
        DiagramNode(id="frontdoor", position=DiagramPosition(x=210, y=80), data=DiagramNodeData(label="Azure Front Door + WAF")),
        DiagramNode(id="apim", position=DiagramPosition(x=430, y=80), data=DiagramNodeData(label="API Management")),
        DiagramNode(id="functions", position=DiagramPosition(x=650, y=80), data=DiagramNodeData(label="Azure Functions")),
        DiagramNode(id="servicebus", position=DiagramPosition(x=650, y=240), data=DiagramNodeData(label="Service Bus")),
        DiagramNode(id="sql", position=DiagramPosition(x=900, y=40), data=DiagramNodeData(label="Azure SQL Database")),
        DiagramNode(id="storage", position=DiagramPosition(x=900, y=170), data=DiagramNodeData(label="Storage Account")),
        DiagramNode(id="keyvault", position=DiagramPosition(x=430, y=240), data=DiagramNodeData(label="Key Vault")),
        DiagramNode(id="monitor", type="output", position=DiagramPosition(x=900, y=300), data=DiagramNodeData(label="Monitor + App Insights")),
        DiagramNode(id="private", position=DiagramPosition(x=650, y=390), data=DiagramNodeData(label="VNet + Private Endpoints")),
    ]
    pairs = [
        ("clients", "frontdoor"),
        ("frontdoor", "apim"),
        ("apim", "functions"),
        ("functions", "servicebus"),
        ("functions", "sql"),
        ("functions", "storage"),
        ("functions", "keyvault"),
        ("servicebus", "sql"),
        ("functions", "monitor"),
        ("sql", "private"),
        ("storage", "private"),
    ]
    edges = [DiagramEdge(id=f"{source}-{target}", source=source, target=target, animated=target == "servicebus") for source, target in pairs]
    return Diagram(nodes=nodes, edges=edges)


def build_data_flow(prompt: str) -> list[str]:
    workload = infer_workload(prompt)
    source = "Devices" if workload.iot else "Users upload documents" if workload.ai else "Clients"
    return [
        f"{source} connect through Azure Front Door and WAF for TLS, bot filtering, and regional routing.",
        "API Management validates JWT claims, applies rate limits, and forwards approved traffic to private backend endpoints.",
        "Azure Functions execute synchronous business logic and publish long-running work to Service Bus queues or topics.",
        "Workers consume events, write transactional state to Azure SQL, and persist files or evidence to encrypted Storage.",
        "Secrets are resolved through managed identities and Key Vault; no application secrets are stored in code.",
        "Application Insights, Log Analytics, and Defender for Cloud collect telemetry, alerts, and posture findings.",
    ]


def build_deterministic_architecture(prompt: str) -> ArchitectureOutput:
    workload = infer_workload(prompt)
    services = recommended_services(prompt)
    cost_estimate = estimate_cost(prompt, services)
    summary_target = (
        "a regulated healthcare platform"
        if workload.healthcare
        else "a financial services platform"
        if workload.finance
        else "an IoT ingestion platform"
        if workload.iot
        else "an AI document workflow"
        if workload.ai
        else "a production SaaS workload"
    )

    return ArchitectureOutput(
        generationSource="deterministic",
        generationNotes=["Generated with the built-in deterministic architecture engine."],
        summary=f"Recommended Azure architecture for {summary_target} with private data paths, asynchronous processing, observability, and IaC-ready foundations. Estimated baseline cost: ${cost_estimate.monthlyUsd:,}/month.",
        services=services,
        deployment=deployment_components(prompt),
        dataFlow=build_data_flow(prompt),
        risks=[
            "Compliance evidence depends on operational controls beyond cloud service selection.",
            "Static estimates must be validated against real traffic, retention, and regional pricing.",
            "Private endpoints and network segmentation require DNS and deployment governance.",
            "IaC templates are starter scaffolds and need policy, naming, and CI/CD hardening.",
        ],
        recommendations=[
            "Define RPO/RTO, SLOs, data classification, and threat model before production buildout.",
            "Use Azure Policy to enforce private endpoints, diagnostic settings, allowed regions, and TLS.",
            "Adopt managed identities and RBAC reviews for every service-to-service integration.",
            "Run load tests and chaos experiments before increasing production traffic.",
        ],
        scaling=[
            "Use Front Door origin groups and regional deployment stamps for global failover.",
            "Scale API Management and Functions independently from worker consumers.",
            "Partition queues/topics by tenant or workflow where message volume grows unevenly.",
            "Add SQL read replicas or CQRS projections for reporting-heavy workloads.",
        ],
        diagram=build_diagram(),
        securityProfile=build_security_profile(prompt, services),
        securityFindings=review_security(prompt, services),
        costEstimate=cost_estimate,
        iac=IacTemplates(bicep=generate_bicep(prompt), terraform=generate_terraform(prompt)),
        iacStructure=build_iac_structure(prompt),
    )


def generate_architecture(prompt: str) -> ArchitectureOutput:
    baseline = build_deterministic_architecture(prompt)

    if not is_ai_configured():
        return baseline

    try:
        candidate = complete_json(
            SYSTEM_PROMPT,
            build_architecture_prompt(prompt, baseline.model_dump_json(indent=2)),
        )
        output = ArchitectureOutput.model_validate(candidate)
        if not output.generationNotes:
            output.generationNotes = ["Generated through the configured AI provider and validated against the architecture schema."]
        return output
    except (AIConfigurationError, AIRequestError, ValueError):
        baseline.generationNotes = [
            "AI generation was configured but unavailable or invalid for this request.",
            "Returned to the deterministic architecture engine for a stable result.",
        ]
        return baseline
