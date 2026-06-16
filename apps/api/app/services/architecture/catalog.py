from dataclasses import dataclass


@dataclass(frozen=True)
class WorkloadSignals:
    healthcare: bool
    finance: bool
    ecommerce: bool
    iot: bool
    ai: bool
    multi_region: bool
    high_scale: bool


def includes_any(text: str, terms: list[str]) -> bool:
    return any(term in text for term in terms)


def infer_workload(prompt: str) -> WorkloadSignals:
    text = prompt.lower()
    return WorkloadSignals(
        healthcare=includes_any(text, ["hipaa", "ehr", "patient", "healthcare", "phi"]),
        finance=includes_any(text, ["fintech", "payment", "pci", "ledger", "fraud"]),
        ecommerce=includes_any(text, ["ecommerce", "checkout", "cart", "inventory", "order"]),
        iot=includes_any(text, ["iot", "device", "telemetry", "fleet"]),
        ai=includes_any(text, ["ai", "document", "ocr", "vector", "llm"]),
        multi_region=includes_any(text, ["multi-region", "multi region", "global", "low-latency"]),
        high_scale=includes_any(text, ["1m", "million", "high availability", "flash sale", "scale"]),
    )


def recommended_services(prompt: str) -> list[dict[str, object]]:
    workload = infer_workload(prompt)
    services = [
        {
            "name": "Azure Front Door + WAF",
            "tier": "Standard/Premium",
            "reason": "Global ingress, TLS termination, managed WAF rules, and regional failover.",
            "justification": "Chosen because the workload benefits from managed edge security, global routing, and a clean place to enforce TLS and failover policies before traffic reaches the API tier.",
            "estimatedMonthlyUsd": 290,
            "alternatives": [
                {"name": "Application Gateway + WAF", "tier": "WAF v2", "justification": "Works well for a region-first architecture that needs Layer 7 routing but not global anycast edge acceleration.", "estimatedMonthlyUsd": 210, "tradeoff": "Cheaper, but you lose Front Door's simpler global failover and edge POP reach."},
                {"name": "Traffic Manager + App Gateway", "tier": "Priority/Performance", "justification": "Useful when DNS-based routing is acceptable and cost sensitivity is higher than instant failover behavior.", "estimatedMonthlyUsd": 155, "tradeoff": "Lower cost, but failover is slower and request-level edge protections are split across services."},
            ],
            "wellArchitectedPillar": "Reliability",
        },
        {
            "name": "Azure API Management",
            "tier": "Standard v2",
            "reason": "Central API gateway for throttling, auth policy enforcement, versioning, and request observability.",
            "justification": "Chosen because the platform needs a policy layer for auth, rate limits, transformation, versioning, and consistent governance across internal and external APIs.",
            "estimatedMonthlyUsd": 690,
            "alternatives": [
                {"name": "API Management", "tier": "Consumption", "justification": "Best when traffic is spiky and the API surface is smaller, especially for early-stage environments.", "estimatedMonthlyUsd": 180, "tradeoff": "Much cheaper, but fewer enterprise capabilities and less predictable latency under heavier load."},
                {"name": "Front Door rules + Function routing", "tier": "Minimal gateway", "justification": "Viable for a lean MVP when you only need basic edge filtering and direct backend invocation.", "estimatedMonthlyUsd": 75, "tradeoff": "Lowest cost, but no full API product layer, policy engine, or strong lifecycle tooling."},
            ],
            "wellArchitectedPillar": "Security",
        },
        {
            "name": "Azure Functions",
            "tier": "Premium plan",
            "reason": "Elastic compute for API and background workloads with VNet integration and warm instances.",
            "justification": "Chosen because the request mixes synchronous APIs and async jobs, and Premium keeps cold starts under control while supporting private networking.",
            "estimatedMonthlyUsd": 420,
            "alternatives": [
                {"name": "Azure Functions", "tier": "Consumption", "justification": "Good when requests are intermittent and the team accepts cold starts for lower cost.", "estimatedMonthlyUsd": 95, "tradeoff": "Cheaper, but cold starts and networking limits make it weaker for regulated production workloads."},
                {"name": "Azure Container Apps", "tier": "Consumption + min replicas", "justification": "A strong option when workloads want containers, long-running jobs, or more runtime control.", "estimatedMonthlyUsd": 330, "tradeoff": "Comparable cost with more control, but more operational surface and deployment complexity."},
            ],
            "wellArchitectedPillar": "Cost optimization",
        },
        {
            "name": "Azure Service Bus",
            "tier": "Premium" if workload.high_scale else "Standard",
            "reason": "Durable asynchronous messaging between transactional APIs and downstream processors.",
            "justification": "Chosen because the service tier balances asynchronous decoupling with the expected event volume for this workload.",
            "estimatedMonthlyUsd": 780 if workload.high_scale else 80,
            "alternatives": [
                {"name": "Azure Storage Queues", "tier": "Standard", "justification": "Useful for simpler asynchronous jobs with a tight cost target.", "estimatedMonthlyUsd": 25, "tradeoff": "Cheaper, but you lose richer pub/sub and dead-lettering patterns."},
                {"name": "Azure Event Grid", "tier": "Standard", "justification": "Better for reactive event fan-out where push-style integration is more important than queue semantics.", "estimatedMonthlyUsd": 45 if not workload.high_scale else 60, "tradeoff": "Can be elegant for eventing, but not a direct replacement for worker queue orchestration."},
            ],
            "wellArchitectedPillar": "Reliability",
        },
        {
            "name": "Azure SQL Database",
            "tier": "Business Critical + geo-replica" if workload.multi_region else "General Purpose",
            "reason": "Relational system of record with encryption, PITR backups, and private connectivity.",
            "justification": "Chosen because the workload needs a managed relational core with strong private networking, backup support, and predictable transactional behavior.",
            "estimatedMonthlyUsd": 1800 if workload.multi_region else 620,
            "alternatives": [
                {"name": "PostgreSQL Flexible Server", "tier": "General Purpose", "justification": "Strong alternative for teams that prefer Postgres features or want to reduce relational database spend.", "estimatedMonthlyUsd": 540 if workload.multi_region else 390, "tradeoff": "Lower cost, but not a like-for-like swap if the app expects SQL Server features."},
                {"name": "Azure Cosmos DB", "tier": "Serverless/Provisioned", "justification": "Works better for globally distributed or flexible-schema access patterns.", "estimatedMonthlyUsd": 700, "tradeoff": "Can outperform SQL for the right patterns, but is a poor fit for classic relational transactions."},
            ],
            "wellArchitectedPillar": "Reliability",
        },
        {
            "name": "Azure Key Vault",
            "tier": "Standard",
            "reason": "Centralized secret, key, and certificate management using managed identities.",
            "justification": "Chosen because regulated and internal platforms should avoid application-managed secret distribution and centralize access control with auditability.",
            "estimatedMonthlyUsd": 25,
            "alternatives": [
                {"name": "App Service app settings", "tier": "Platform-managed secrets", "justification": "Acceptable for quick internal prototypes with a smaller blast radius.", "estimatedMonthlyUsd": 0, "tradeoff": "No direct service cost, but much weaker secret governance and rotation posture."},
                {"name": "Key Vault", "tier": "Premium", "justification": "Better when HSM-backed keys or stricter cryptographic requirements are needed.", "estimatedMonthlyUsd": 75, "tradeoff": "Stronger crypto posture, but more expensive than most MVP workloads require."},
            ],
            "wellArchitectedPillar": "Security",
        },
        {
            "name": "Azure Monitor + Application Insights",
            "tier": "Workspace-based",
            "reason": "Traces, metrics, logs, alerting, and audit-friendly diagnostics.",
            "justification": "Chosen because production architecture needs one place to trace requests, inspect failures, alert on drift, and retain operational evidence.",
            "estimatedMonthlyUsd": 280,
            "alternatives": [
                {"name": "Application Insights", "tier": "Basic retention", "justification": "Works for lighter observability needs when log retention and diagnostics are still modest.", "estimatedMonthlyUsd": 120, "tradeoff": "Cheaper, but with less room for deep cross-service analysis."},
                {"name": "Third-party observability stack", "tier": "Datadog/New Relic style", "justification": "Useful if the team already standardizes on an external platform.", "estimatedMonthlyUsd": 450, "tradeoff": "Potentially richer product experience, but adds external dependency and cost."},
            ],
            "wellArchitectedPillar": "Operational excellence",
        },
        {
            "name": "Storage Account",
            "tier": "ZRS hot + lifecycle policies",
            "reason": "Secure object storage for exports, documents, backups, and immutable audit evidence.",
            "justification": "Chosen because the architecture needs low-friction durable storage with lifecycle controls, private endpoints, and strong compatibility with the rest of Azure.",
            "estimatedMonthlyUsd": 110,
            "alternatives": [
                {"name": "Storage Account", "tier": "LRS hot", "justification": "Best when regional redundancy is not required and cost pressure is stronger than availability goals.", "estimatedMonthlyUsd": 65, "tradeoff": "Cheaper, but weaker resilience profile."},
                {"name": "Storage Account", "tier": "Cool tier + lifecycle", "justification": "Good when data is retained more than it is read.", "estimatedMonthlyUsd": 80, "tradeoff": "Lower storage cost, but access and retrieval patterns become less forgiving."},
            ],
            "wellArchitectedPillar": "Cost optimization",
        },
        {
            "name": "Virtual Network + Private Endpoints",
            "tier": "Regional hub/spoke",
            "reason": "Limits data-plane access to private network paths and supports segmented subnets.",
            "justification": "Chosen because the workload handles sensitive traffic and benefits from explicit network boundaries between ingress, compute, and data services.",
            "estimatedMonthlyUsd": 140,
            "alternatives": [
                {"name": "Flat VNet + service endpoints", "tier": "Single network", "justification": "Useful for simpler deployments where segmentation needs are lighter.", "estimatedMonthlyUsd": 70, "tradeoff": "Cheaper and simpler, but weaker isolation and fewer clean boundaries."},
                {"name": "Public endpoints + IP restrictions", "tier": "Minimal network control", "justification": "Possible for internal demos or short-lived prototypes.", "estimatedMonthlyUsd": 20, "tradeoff": "Very low cost, but not appropriate for a serious regulated or security-sensitive architecture."},
            ],
            "wellArchitectedPillar": "Security",
        },
    ]

    if workload.healthcare or workload.finance:
        services.append({"name": "Microsoft Defender for Cloud", "tier": "Cloud Security Posture Management", "reason": "Continuously evaluates compliance posture and detects workload misconfiguration.", "justification": "Chosen because regulated environments benefit from posture scoring, recommendations, and centralized security findings across resources.", "estimatedMonthlyUsd": 160, "alternatives": [{"name": "Azure Policy + Security Center free signals", "tier": "Baseline controls", "justification": "Good for teams that need governance first and can manually review more findings.", "estimatedMonthlyUsd": 40, "tradeoff": "Lower cost, but less depth in threat detection and posture analytics."}, {"name": "Third-party CSPM", "tier": "Prisma/Wiz style", "justification": "Useful when an organization already has a cross-cloud security platform.", "estimatedMonthlyUsd": 260, "tradeoff": "Potentially broader coverage, but more cost and integration overhead."}], "wellArchitectedPillar": "Security"})
    if workload.ai:
        services.append({"name": "Azure AI Document Intelligence", "tier": "S0", "reason": "Extracts structured data from documents before workflow and review stages.", "justification": "Chosen because the workload explicitly needs document extraction and review workflows, and this keeps the OCR/data extraction stage managed and Azure-native.", "estimatedMonthlyUsd": 180, "alternatives": [{"name": "Azure AI Vision OCR", "tier": "Read API", "justification": "Good when the team only needs text extraction rather than richer structured forms.", "estimatedMonthlyUsd": 95, "tradeoff": "Cheaper, but weaker for forms and field extraction."}, {"name": "Custom OCR pipeline", "tier": "Open-source stack", "justification": "Possible for full control over the pipeline and model tuning.", "estimatedMonthlyUsd": 240, "tradeoff": "Potentially flexible, but much higher engineering and ops burden."}], "wellArchitectedPillar": "Performance efficiency"})
        services.append({"name": "Azure AI Search", "tier": "Basic/Standard", "reason": "Indexes extracted content for retrieval and semantic search patterns.", "justification": "Chosen because document workflows usually need a managed retrieval layer for lookup, filtering, and relevance ranking after extraction.", "estimatedMonthlyUsd": 250, "alternatives": [{"name": "PostgreSQL + pgvector", "tier": "Flexible Server", "justification": "Strong when the team wants vector search closer to the transactional store.", "estimatedMonthlyUsd": 170, "tradeoff": "Cheaper and flexible, but less turnkey for classic search features."}, {"name": "Elasticsearch/OpenSearch", "tier": "Managed cluster", "justification": "Useful for heavier customization of search behavior and analytics.", "estimatedMonthlyUsd": 340, "tradeoff": "Powerful, but more operational overhead and tuning."}], "wellArchitectedPillar": "Performance efficiency"})
    if workload.iot:
        services.append({"name": "Azure IoT Hub", "tier": "Standard", "reason": "Secure device identity, telemetry ingestion, and cloud-to-device messaging.", "justification": "Chosen because IoT device fleets need identity-aware ingestion, routing, and lifecycle support rather than a generic HTTP intake tier.", "estimatedMonthlyUsd": 220, "alternatives": [{"name": "Event Hubs", "tier": "Standard", "justification": "Useful when devices are simpler and identity management happens outside Azure.", "estimatedMonthlyUsd": 110, "tradeoff": "Cheaper throughput pipe, but not a device management platform."}, {"name": "MQTT broker on Container Apps", "tier": "Custom", "justification": "Possible when protocol flexibility matters more than managed fleet controls.", "estimatedMonthlyUsd": 260, "tradeoff": "More customizable, but much more to own operationally."}], "wellArchitectedPillar": "Performance efficiency"})
        services.append({"name": "Azure Stream Analytics", "tier": "Standard", "reason": "Hot-path processing for alerting and near-real-time dashboards.", "justification": "Chosen because the workload needs fast streaming transformations without immediately owning a larger event processing stack.", "estimatedMonthlyUsd": 140, "alternatives": [{"name": "Azure Functions", "tier": "Event-driven stream handlers", "justification": "Good when transformations are lightweight and code-first control is preferred.", "estimatedMonthlyUsd": 90, "tradeoff": "Cheaper, but can get harder to reason about at higher event rates."}, {"name": "Databricks Structured Streaming", "tier": "Jobs cluster", "justification": "Best for more advanced streaming analytics and ML-heavy pipelines.", "estimatedMonthlyUsd": 380, "tradeoff": "Much more powerful, but significantly more expensive for an MVP."}], "wellArchitectedPillar": "Operational excellence"})

    return services


def deployment_components(prompt: str) -> list[dict[str, object]]:
    workload = infer_workload(prompt)
    components: list[dict[str, object]] = [
        {
            "name": "Resource group and naming",
            "category": "Connector",
            "purpose": "Owns the workload deployment boundary, naming suffix, tags, and regional settings.",
            "iacResources": ["azurerm_resource_group", "random_string", "tags variable"],
            "connectsTo": ["All resources"],
            "dependsOn": [],
        },
        {
            "name": "Virtual network",
            "category": "Network",
            "purpose": "Creates isolated subnets for API, compute, and private endpoints.",
            "iacResources": ["virtualNetwork", "subnets: apim, functions, private-endpoints"],
            "connectsTo": ["API Management", "Function App", "Private Endpoints"],
            "dependsOn": ["Resource group and naming"],
        },
        {
            "name": "Private DNS zones",
            "category": "Network",
            "purpose": "Resolves private endpoint traffic for SQL, Blob, Key Vault, and Service Bus.",
            "iacResources": [
                "privatelink.database.windows.net",
                "privatelink.blob.core.windows.net",
                "privatelink.vaultcore.azure.net",
                "privatelink.servicebus.windows.net",
            ],
            "connectsTo": ["Virtual network", "Private Endpoints"],
            "dependsOn": ["Virtual network"],
        },
        {
            "name": "Azure Front Door + WAF",
            "category": "Ingress",
            "purpose": "Provides edge routing, TLS termination, and managed WAF policy enforcement.",
            "iacResources": ["Front Door profile", "endpoint", "routes", "WAF policy"],
            "connectsTo": ["API Management"],
            "dependsOn": ["Resource group and naming"],
        },
        {
            "name": "API Management",
            "category": "Ingress",
            "purpose": "Handles API contracts, auth policy, throttling, diagnostics, and backend routing.",
            "iacResources": ["API Management service", "APIs", "policies", "diagnostic settings"],
            "connectsTo": ["Function App", "Log Analytics"],
            "dependsOn": ["Virtual network", "Managed identity"],
        },
        {
            "name": "Managed identity",
            "category": "Security",
            "purpose": "Provides least-privilege access from runtime services to data and secret stores.",
            "iacResources": ["userAssignedIdentity", "roleAssignments"],
            "connectsTo": ["Function App", "Key Vault", "Storage", "Service Bus", "SQL"],
            "dependsOn": ["Resource group and naming"],
        },
        {
            "name": "Function App runtime",
            "category": "Compute",
            "purpose": "Runs synchronous APIs and background workers with VNet integration.",
            "iacResources": ["servicePlan", "functionApp", "appSettings", "VNet integration"],
            "connectsTo": ["Service Bus", "Azure SQL", "Storage", "Key Vault", "Application Insights"],
            "dependsOn": ["Managed identity", "Virtual network", "Storage account"],
        },
        {
            "name": "Service Bus namespace",
            "category": "Messaging",
            "purpose": "Supports queues, topics, retries, and asynchronous workflow decoupling.",
            "iacResources": ["namespace", "queues", "topics", "subscriptions"],
            "connectsTo": ["Function App", "Azure SQL"],
            "dependsOn": ["Managed identity", "Private DNS zones"],
        },
        {
            "name": "Azure SQL Database",
            "category": "Data",
            "purpose": "Stores transactional records with encryption, private access, auditing, and backups.",
            "iacResources": ["sqlServer", "database", "auditingSettings", "backupRetention", "privateEndpoint"],
            "connectsTo": ["Function App", "Private DNS zones", "Log Analytics"],
            "dependsOn": ["Managed identity", "Virtual network"],
        },
        {
            "name": "Storage account",
            "category": "Data",
            "purpose": "Stores exports, documents, runtime state, and evidence artifacts.",
            "iacResources": ["storageAccount", "blob containers", "managementPolicy", "privateEndpoint"],
            "connectsTo": ["Function App", "Private DNS zones"],
            "dependsOn": ["Managed identity", "Virtual network"],
        },
        {
            "name": "Key Vault",
            "category": "Security",
            "purpose": "Centralizes secrets, keys, certificates, RBAC, and purge protection.",
            "iacResources": ["keyVault", "RBAC assignments", "privateEndpoint"],
            "connectsTo": ["Function App", "API Management"],
            "dependsOn": ["Managed identity", "Private DNS zones"],
        },
        {
            "name": "Observability workspace",
            "category": "Observability",
            "purpose": "Captures logs, traces, metrics, dashboards, and alerts across the stack.",
            "iacResources": ["logAnalyticsWorkspace", "applicationInsights", "diagnosticSettings", "metricAlerts"],
            "connectsTo": ["All services"],
            "dependsOn": ["Resource group and naming"],
        },
        {
            "name": "Defender and policy controls",
            "category": "Security",
            "purpose": "Applies posture monitoring and guardrails for network, logging, TLS, and data protection.",
            "iacResources": ["Defender pricing", "policyAssignments"],
            "connectsTo": ["All services"],
            "dependsOn": ["Resource group and naming"],
        },
    ]

    if workload.multi_region:
        components.append(
            {
                "name": "Regional deployment stamp",
                "category": "Connector",
                "purpose": "Repeats the stack in a secondary region and supports failover routing.",
                "iacResources": ["regional deployment module", "Front Door origin group", "SQL geo-replica"],
                "connectsTo": ["Front Door", "Function App", "Azure SQL"],
                "dependsOn": ["Azure Front Door + WAF", "Azure SQL Database"],
            }
        )
    if workload.ai:
        components.append(
            {
                "name": "Document Intelligence",
                "category": "AI",
                "purpose": "Extracts structured data from documents before downstream review or indexing.",
                "iacResources": ["Cognitive Services account", "privateEndpoint", "diagnosticSettings"],
                "connectsTo": ["Function App", "Storage account", "Key Vault"],
                "dependsOn": ["Managed identity", "Private DNS zones"],
            }
        )
        components.append(
            {
                "name": "Azure AI Search",
                "category": "AI",
                "purpose": "Indexes extracted content for retrieval and workflow acceleration.",
                "iacResources": ["searchService", "indexes", "privateEndpoint", "diagnosticSettings"],
                "connectsTo": ["Function App", "Storage account"],
                "dependsOn": ["Managed identity", "Private DNS zones"],
            }
        )
    if workload.iot:
        components.append(
            {
                "name": "IoT Hub",
                "category": "IoT",
                "purpose": "Provides secure device identity, telemetry ingestion, and route management.",
                "iacResources": ["iotHub", "routes", "consumerGroups", "privateEndpoint"],
                "connectsTo": ["Stream Analytics", "Service Bus", "Storage account"],
                "dependsOn": ["Private DNS zones"],
            }
        )
        components.append(
            {
                "name": "Stream Analytics",
                "category": "IoT",
                "purpose": "Processes hot-path telemetry into alerts, dashboards, and storage sinks.",
                "iacResources": ["streamAnalyticsJob", "inputs", "outputs", "transformation"],
                "connectsTo": ["IoT Hub", "Service Bus", "Storage account"],
                "dependsOn": ["IoT Hub"],
            }
        )

    return components
