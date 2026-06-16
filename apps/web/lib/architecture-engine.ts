import type { ArchitectureOutput, CostLineItem, DeploymentComponent, SecurityFinding, ServiceAlternative, ServiceRecommendation } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function inferWorkload(prompt: string) {
  const text = prompt.toLowerCase();
  return {
    healthcare: includesAny(text, ["hipaa", "ehr", "patient", "healthcare", "phi"]),
    finance: includesAny(text, ["fintech", "payment", "pci", "ledger", "fraud"]),
    ecommerce: includesAny(text, ["ecommerce", "checkout", "cart", "inventory", "order"]),
    iot: includesAny(text, ["iot", "device", "telemetry", "fleet"]),
    ai: includesAny(text, ["ai", "document", "ocr", "vector", "llm"]),
    multiRegion: includesAny(text, ["multi-region", "multi region", "global", "low-latency"]),
    highScale: includesAny(text, ["1m", "million", "high availability", "flash sale", "scale"])
  };
}

function alternative(name: string, tier: string, justification: string, estimatedMonthlyUsd: number, tradeoff: string): ServiceAlternative {
  return { name, tier, justification, estimatedMonthlyUsd, tradeoff };
}

function service(
  name: string,
  tier: string,
  reason: string,
  justification: string,
  estimatedMonthlyUsd: number,
  alternatives: ServiceAlternative[],
  wellArchitectedPillar: ServiceRecommendation["wellArchitectedPillar"]
): ServiceRecommendation {
  return { name, tier, reason, justification, estimatedMonthlyUsd, alternatives, wellArchitectedPillar };
}

function generateServices(prompt: string): ServiceRecommendation[] {
  const workload = inferWorkload(prompt);
  const services: ServiceRecommendation[] = [
    service(
      "Azure Front Door + WAF",
      "Standard/Premium",
      "Global ingress, TLS termination, managed WAF rules, and regional failover.",
      "Chosen because the workload benefits from managed edge security, global routing, and a clean place to enforce TLS and failover policies before traffic reaches the API tier.",
      290,
      [
        alternative("Application Gateway + WAF", "WAF v2", "Works well for a region-first architecture that needs Layer 7 routing but not global anycast edge acceleration.", 210, "Cheaper, but you lose Front Door's simpler global failover and edge POP reach."),
        alternative("Traffic Manager + App Gateway", "Priority/Performance", "Useful when DNS-based routing is acceptable and cost sensitivity is higher than instant failover behavior.", 155, "Lower cost, but failover is slower and request-level edge protections are split across services.")
      ],
      "Reliability"
    ),
    service(
      "Azure API Management",
      "Standard v2",
      "Central API gateway for throttling, auth policy enforcement, versioning, and request observability.",
      "Chosen because the platform needs a policy layer for auth, rate limits, transformation, versioning, and consistent governance across internal and external APIs.",
      690,
      [
        alternative("API Management", "Consumption", "Best when traffic is spiky and the API surface is smaller, especially for early-stage environments.", 180, "Much cheaper, but fewer enterprise capabilities and less predictable latency under heavier load."),
        alternative("Front Door rules + Function routing", "Minimal gateway", "Viable for a lean MVP when you only need basic edge filtering and direct backend invocation.", 75, "Lowest cost, but no full API product layer, policy engine, or strong lifecycle tooling.")
      ],
      "Security"
    ),
    service(
      "Azure Functions",
      "Premium plan",
      "Elastic compute for API and background workloads with VNet integration and warm instances.",
      "Chosen because the request mixes synchronous APIs and async jobs, and Premium keeps cold starts under control while supporting private networking.",
      420,
      [
        alternative("Azure Functions", "Consumption", "Good when requests are intermittent and the team accepts cold starts for lower cost.", 95, "Cheaper, but cold starts and networking limits make it weaker for regulated production workloads."),
        alternative("Azure Container Apps", "Consumption + min replicas", "A strong option when workloads want containers, long-running jobs, or more runtime control.", 330, "Comparable cost with more control, but more operational surface and deployment complexity.")
      ],
      "Cost optimization"
    ),
    service(
      "Azure Service Bus",
      workload.highScale ? "Premium" : "Standard",
      "Durable asynchronous messaging between transactional APIs and downstream processors.",
      workload.highScale
        ? "Chosen because high-volume or regulated workloads benefit from predictable throughput, isolation, and advanced messaging features under Premium."
        : "Chosen because Standard is enough for durable decoupling, retries, and queue/topic patterns without overpaying early.",
      workload.highScale ? 780 : 80,
      workload.highScale
        ? [
            alternative("Azure Service Bus", "Standard", "Suitable when throughput is moderate and queue isolation or premium features are not critical yet.", 80, "Much cheaper, but less predictable under heavier contention and fewer enterprise guarantees."),
            alternative("Azure Storage Queues", "Standard", "Works for simple background jobs where ordering and rich pub/sub semantics are not important.", 25, "Lowest cost, but much weaker feature set for complex event workflows.")
          ]
        : [
            alternative("Azure Storage Queues", "Standard", "Useful for simpler asynchronous jobs with a tight cost target.", 25, "Cheaper, but you lose richer pub/sub and dead-lettering patterns."),
            alternative("Azure Event Grid", "Standard", "Better for reactive event fan-out where push-style integration is more important than queue semantics.", 45, "Can be elegant for eventing, but not a direct replacement for worker queue orchestration.")
          ],
      "Reliability"
    ),
    service(
      "Azure SQL Database",
      workload.multiRegion ? "Business Critical + geo-replica" : "General Purpose",
      "Relational system of record with encryption, PITR backups, and private connectivity.",
      workload.multiRegion
        ? "Chosen because the workload needs stronger HA characteristics, fast failover, and regional continuity for a transactional core."
        : "Chosen because it gives a managed relational core with private networking, backups, and enough performance for most production MVPs.",
      workload.multiRegion ? 1800 : 620,
      workload.multiRegion
        ? [
            alternative("Azure SQL Database", "General Purpose + geo-backup", "Better when regional DR matters but synchronous high-end performance is not yet necessary.", 820, "Cuts cost materially, but gives up the stronger HA/performance posture of Business Critical."),
            alternative("PostgreSQL Flexible Server", "General Purpose", "Useful if the team prefers Postgres features and open ecosystem tooling.", 540, "Cheaper, but shifts some data model and operational decisions.")
          ]
        : [
            alternative("PostgreSQL Flexible Server", "Burstable/General Purpose", "Strong alternative for teams that prefer Postgres extensions or lower-cost managed relational storage.", 390, "Lower cost, but not a like-for-like swap if the app expects SQL Server features."),
            alternative("Azure Cosmos DB", "Serverless/Provisioned", "Works better for globally distributed or flexible-schema access patterns.", 700, "Can outperform SQL for the right patterns, but is a poor fit for classic relational transactions.")
          ],
      "Reliability"
    ),
    service(
      "Azure Key Vault",
      "Standard",
      "Centralized secret, key, and certificate management using managed identities.",
      "Chosen because regulated and internal platforms should avoid application-managed secret distribution and centralize access control with auditability.",
      25,
      [
        alternative("App Service app settings", "Platform-managed secrets", "Acceptable for quick internal prototypes with a smaller blast radius.", 0, "No direct service cost, but much weaker secret governance and rotation posture."),
        alternative("Key Vault", "Premium", "Better when HSM-backed keys or stricter cryptographic requirements are needed.", 75, "Stronger crypto posture, but more expensive than most MVP workloads require.")
      ],
      "Security"
    ),
    service(
      "Azure Monitor + Application Insights",
      "Workspace-based",
      "Traces, metrics, logs, alerting, and audit-friendly diagnostics.",
      "Chosen because production architecture needs one place to trace requests, inspect failures, alert on drift, and retain operational evidence.",
      280,
      [
        alternative("Application Insights", "Basic retention", "Works for lighter observability needs when log retention and diagnostics are still modest.", 120, "Cheaper, but with less room for deep cross-service analysis."),
        alternative("Third-party observability stack", "Datadog/New Relic style", "Useful if the team already standardizes on an external platform.", 450, "Potentially richer product experience, but adds external dependency and cost.")
      ],
      "Operational excellence"
    ),
    service(
      "Storage Account",
      "ZRS hot + lifecycle policies",
      "Secure object storage for exports, documents, backups, and immutable audit evidence.",
      "Chosen because the architecture needs low-friction durable storage with lifecycle controls, private endpoints, and strong compatibility with the rest of Azure.",
      110,
      [
        alternative("Storage Account", "LRS hot", "Best when regional redundancy is not required and cost pressure is stronger than availability goals.", 65, "Cheaper, but weaker resilience profile."),
        alternative("Storage Account", "Cool tier + lifecycle", "Good when data is retained more than it is read.", 80, "Lower storage cost, but access and retrieval patterns become less forgiving.")
      ],
      "Cost optimization"
    ),
    service(
      "Virtual Network + Private Endpoints",
      "Regional hub/spoke",
      "Limits data-plane access to private network paths and supports segmented subnets.",
      "Chosen because the workload handles sensitive traffic and benefits from explicit network boundaries between ingress, compute, and data services.",
      140,
      [
        alternative("Flat VNet + service endpoints", "Single network", "Useful for simpler deployments where segmentation needs are lighter.", 70, "Cheaper and simpler, but weaker isolation and fewer clean boundaries."),
        alternative("Public endpoints + IP restrictions", "Minimal network control", "Possible for internal demos or short-lived prototypes.", 20, "Very low cost, but not appropriate for a serious regulated or security-sensitive architecture.")
      ],
      "Security"
    )
  ];

  if (workload.healthcare || workload.finance) {
    services.push(
      service(
        "Microsoft Defender for Cloud",
        "Cloud Security Posture Management",
        "Continuously evaluates compliance posture and detects workload misconfiguration.",
        "Chosen because regulated environments benefit from posture scoring, recommendations, and centralized security findings across resources.",
        160,
        [
          alternative("Azure Policy + Security Center free signals", "Baseline controls", "Good for teams that need governance first and can manually review more findings.", 40, "Lower cost, but less depth in threat detection and posture analytics."),
          alternative("Third-party CSPM", "Prisma/Wiz style", "Useful when an organization already has a cross-cloud security platform.", 260, "Potentially broader coverage, but more cost and integration overhead.")
        ],
        "Security"
      )
    );
  }

  if (workload.ai) {
    services.push(
      service(
        "Azure AI Document Intelligence",
        "S0",
        "Extracts structured data from documents before workflow and review stages.",
        "Chosen because the workload explicitly needs document extraction and review workflows, and this keeps the OCR/data extraction stage managed and Azure-native.",
        180,
        [
          alternative("Azure AI Vision OCR", "Read API", "Good when the team only needs text extraction rather than richer structured forms.", 95, "Cheaper, but weaker for forms and field extraction."),
          alternative("Custom OCR pipeline", "Open-source stack", "Possible for full control over the pipeline and model tuning.", 240, "Potentially flexible, but much higher engineering and ops burden.")
        ],
        "Performance efficiency"
      )
    );
    services.push(
      service(
        "Azure AI Search",
        "Basic/Standard",
        "Indexes extracted content for retrieval and semantic search patterns.",
        "Chosen because document workflows usually need a managed retrieval layer for lookup, filtering, and relevance ranking after extraction.",
        250,
        [
          alternative("PostgreSQL + pgvector", "Flexible Server", "Strong when the team wants vector search closer to the transactional store.", 170, "Cheaper and flexible, but less turnkey for classic search features."),
          alternative("Elasticsearch/OpenSearch", "Managed cluster", "Useful for heavier customization of search behavior and analytics.", 340, "Powerful, but more operational overhead and tuning.")
        ],
        "Performance efficiency"
      )
    );
  }

  if (workload.iot) {
    services.push(
      service(
        "Azure IoT Hub",
        "Standard",
        "Secure device identity, telemetry ingestion, and cloud-to-device messaging.",
        "Chosen because IoT device fleets need identity-aware ingestion, routing, and lifecycle support rather than a generic HTTP intake tier.",
        220,
        [
          alternative("Event Hubs", "Standard", "Useful when devices are simpler and identity management happens outside Azure.", 110, "Cheaper throughput pipe, but not a device management platform."),
          alternative("MQTT broker on Container Apps", "Custom", "Possible when protocol flexibility matters more than managed fleet controls.", 260, "More customizable, but much more to own operationally.")
        ],
        "Performance efficiency"
      )
    );
    services.push(
      service(
        "Azure Stream Analytics",
        "Standard",
        "Hot-path processing for alerting and near-real-time dashboards.",
        "Chosen because the workload needs fast streaming transformations without immediately owning a larger event processing stack.",
        140,
        [
          alternative("Azure Functions", "Event-driven stream handlers", "Good when transformations are lightweight and code-first control is preferred.", 90, "Cheaper, but can get harder to reason about at higher event rates."),
          alternative("Databricks Structured Streaming", "Jobs cluster", "Best for more advanced streaming analytics and ML-heavy pipelines.", 380, "Much more powerful, but significantly more expensive for an MVP.")
        ],
        "Operational excellence"
      )
    );
  }

  return services;
}

function generateDataFlow(prompt: string) {
  const workload = inferWorkload(prompt);
  const source = workload.iot ? "Devices" : workload.ai ? "Users upload documents" : "Clients";
  return [
    `${source} connect through Azure Front Door and WAF for TLS, bot filtering, and regional routing.`,
    "API Management validates JWT claims, applies rate limits, and forwards approved traffic to private backend endpoints.",
    "Azure Functions execute synchronous business logic and publish long-running work to Service Bus queues or topics.",
    "Workers consume events, write transactional state to Azure SQL, and persist files or evidence to encrypted Storage.",
    "Secrets are resolved through managed identities and Key Vault; no application secrets are stored in code.",
    "Application Insights, Log Analytics, and Defender for Cloud collect telemetry, alerts, and posture findings."
  ];
}

function component(name: DeploymentComponent["name"], category: DeploymentComponent["category"], purpose: string, iacResources: string[], connectsTo: string[], dependsOn: string[]): DeploymentComponent {
  return { name, category, purpose, iacResources, connectsTo, dependsOn };
}

function generateDeploymentComponents(prompt: string): DeploymentComponent[] {
  const workload = inferWorkload(prompt);
  const components: DeploymentComponent[] = [
    component("Resource group and naming", "Connector", "Owns the workload deployment boundary, naming suffix, tags, and shared location.", ["azurerm_resource_group", "random_string", "tags variable"], ["All resources"], []),
    component("Virtual network", "Network", "Creates isolated address space for API, compute, private endpoints, and integration subnets.", ["Microsoft.Network/virtualNetworks", "subnets: api, compute, private-endpoints"], ["API Management", "Function App", "Private Endpoints"], ["Resource group"]),
    component("Private DNS zones", "Network", "Resolves private endpoints for SQL, Storage, Key Vault, and Service Bus inside the VNet.", ["privatelink.database.windows.net", "privatelink.blob.core.windows.net", "privatelink.vaultcore.azure.net", "privatelink.servicebus.windows.net"], ["Private Endpoints", "Virtual network"], ["Virtual network"]),
    component("Azure Front Door + WAF", "Ingress", "Global edge entry with TLS, WAF policy, origin group, health probes, and route to API Management.", ["Microsoft.Cdn/profiles", "afdEndpoints", "originGroups", "routes", "securityPolicies", "wafPolicies"], ["API Management"], ["Resource group"]),
    component("API Management", "Ingress", "Gateway for API contracts, JWT validation, throttling, transformation, and backend policy routing.", ["Microsoft.ApiManagement/service", "apis", "backends", "policies", "diagnostic settings"], ["Function App", "Log Analytics"], ["Virtual network", "Managed identity"]),
    component("Managed identity", "Security", "Least-privilege identity used by compute and API resources to access Key Vault, Storage, SQL, and Service Bus.", ["Microsoft.ManagedIdentity/userAssignedIdentities", "roleAssignments"], ["Key Vault", "Storage", "Service Bus", "SQL"], ["Resource group"]),
    component("Function App runtime", "Compute", "Premium Functions plan with app settings, VNet integration, queue processing, and Application Insights connection.", ["Microsoft.Web/serverfarms", "Microsoft.Web/sites", "config", "appsettings"], ["Service Bus", "Azure SQL", "Storage", "Key Vault", "Application Insights"], ["Storage", "Managed identity", "Virtual network"]),
    component("Service Bus namespace", "Messaging", "Durable queue/topic backbone for async workflows, retries, and event decoupling.", ["Microsoft.ServiceBus/namespaces", "queues", "topics", "subscriptions", "privateEndpointConnections"], ["Function App", "Azure SQL"], ["Private DNS zones", "Managed identity"]),
    component("Azure SQL Database", "Data", "Encrypted relational system of record with private access, zone redundancy, PITR, auditing, and optional geo-replica.", ["Microsoft.Sql/servers", "databases", "auditingSettings", "backupShortTermRetentionPolicies", "privateEndpoints"], ["Function App", "Private DNS zones", "Log Analytics"], ["Managed identity", "Virtual network"]),
    component("Storage account", "Data", "Secure blob storage for exports, documents, audit evidence, and Function runtime state.", ["Microsoft.Storage/storageAccounts", "blobServices/containers", "managementPolicies", "privateEndpoints"], ["Function App", "Private DNS zones"], ["Managed identity", "Virtual network"]),
    component("Key Vault", "Security", "Centralizes secrets, keys, certificates, purge protection, RBAC, and private data-plane access.", ["Microsoft.KeyVault/vaults", "accessPolicies/RBAC", "privateEndpoints"], ["Function App", "API Management"], ["Managed identity", "Private DNS zones"]),
    component("Observability workspace", "Observability", "Captures application traces, platform logs, metrics, dashboards, and alert targets.", ["Microsoft.OperationalInsights/workspaces", "Microsoft.Insights/components", "diagnosticSettings", "actionGroups", "metricAlerts"], ["All services"], ["Resource group"]),
    component("Defender and policy controls", "Security", "Enables posture checks and guardrails for private endpoints, diagnostics, TLS, allowed regions, and encryption.", ["Microsoft.Security/pricings", "Microsoft.Authorization/policyAssignments"], ["All services"], ["Resource group"])
  ];

  if (workload.multiRegion) {
    components.push(component("Regional deployment stamp", "Connector", "Defines a repeatable stamp for secondary regions and failover routing.", ["deployment module: regionalStamp", "Front Door origin group", "SQL geo-replica"], ["Front Door", "Azure SQL", "Function App"], ["Core resource group"]));
  }

  if (workload.ai) {
    components.push(component("Document Intelligence", "AI", "Extracts structured data from uploaded documents before workflow review.", ["Microsoft.CognitiveServices/accounts kind=FormRecognizer", "privateEndpoints", "diagnosticSettings"], ["Function App", "Storage", "Key Vault"], ["Managed identity", "Private DNS zones"]));
    components.push(component("Azure AI Search", "AI", "Indexes extracted content and supports retrieval workflows.", ["Microsoft.Search/searchServices", "indexes", "privateEndpoints", "diagnosticSettings"], ["Function App", "Storage"], ["Managed identity", "Private DNS zones"]));
  }

  if (workload.iot) {
    components.push(component("IoT Hub", "IoT", "Provides device identity, secure telemetry ingestion, and cloud-to-device messaging.", ["Microsoft.Devices/IotHubs", "consumerGroups", "routes", "privateEndpoints"], ["Stream Analytics", "Service Bus", "Storage"], ["Private DNS zones"]));
    components.push(component("Stream Analytics", "IoT", "Processes hot-path telemetry into alerts, dashboards, and storage sinks.", ["Microsoft.StreamAnalytics/streamingjobs", "inputs", "outputs", "transformation"], ["IoT Hub", "Service Bus", "Storage"], ["IoT Hub"]));
  }

  return components;
}

function generateDiagram() {
  const nodes = [
    { id: "clients", type: "input", position: { x: 20, y: 120 }, data: { label: "Clients / Users" } },
    { id: "frontdoor", position: { x: 210, y: 80 }, data: { label: "Azure Front Door + WAF" } },
    { id: "apim", position: { x: 430, y: 80 }, data: { label: "API Management" } },
    { id: "functions", position: { x: 650, y: 80 }, data: { label: "Azure Functions" } },
    { id: "servicebus", position: { x: 650, y: 240 }, data: { label: "Service Bus" } },
    { id: "sql", position: { x: 900, y: 40 }, data: { label: "Azure SQL Database" } },
    { id: "storage", position: { x: 900, y: 170 }, data: { label: "Storage Account" } },
    { id: "keyvault", position: { x: 430, y: 240 }, data: { label: "Key Vault" } },
    { id: "monitor", type: "output", position: { x: 900, y: 300 }, data: { label: "Monitor + App Insights" } },
    { id: "private", position: { x: 650, y: 390 }, data: { label: "VNet + Private Endpoints" } }
  ];

  const edges = [
    ["clients", "frontdoor"],
    ["frontdoor", "apim"],
    ["apim", "functions"],
    ["functions", "servicebus"],
    ["functions", "sql"],
    ["functions", "storage"],
    ["functions", "keyvault"],
    ["servicebus", "sql"],
    ["functions", "monitor"],
    ["sql", "private"],
    ["storage", "private"]
  ].map(([source, target]) => ({ id: `${source}-${target}`, source, target, animated: target === "servicebus" }));

  return { nodes, edges };
}

function generateSecurityFindings(prompt: string, services: ServiceRecommendation[]): SecurityFinding[] {
  const serviceNames = services.map((item) => item.name.toLowerCase()).join(" ");
  const text = prompt.toLowerCase();
  const findings: SecurityFinding[] = [];

  if (!serviceNames.includes("key vault")) {
    findings.push({ severity: "High", title: "Missing Key Vault", detail: "Secrets require centralized storage and access policies.", remediation: "Use Key Vault with managed identities and rotation policies." });
  }
  if (!serviceNames.includes("private endpoints")) {
    findings.push({ severity: "High", title: "Public data plane exposure", detail: "Databases and storage should not be reachable from the public internet.", remediation: "Add private endpoints and disable public network access." });
  }
  if (!serviceNames.includes("waf")) {
    findings.push({ severity: "Medium", title: "No WAF/API gateway", detail: "Public APIs need managed edge filtering and request policy enforcement.", remediation: "Add Front Door WAF and API Management policies." });
  }
  if (!serviceNames.includes("monitor")) {
    findings.push({ severity: "Medium", title: "No monitoring strategy", detail: "The architecture needs health, audit, and incident telemetry.", remediation: "Send app and platform logs to Log Analytics with alerts." });
  }
  if (!text.includes("backup") && !text.includes("restore")) {
    findings.push({ severity: "Medium", title: "Backup strategy needs proof", detail: "The requirement does not mention recovery point or recovery time objectives.", remediation: "Define RPO/RTO, enable PITR, and run restore drills." });
  }
  if (!text.includes("rbac") && !text.includes("managed identity")) {
    findings.push({ severity: "Low", title: "RBAC assumptions should be explicit", detail: "Least-privilege identity boundaries should be documented.", remediation: "Use Azure RBAC, managed identities, and privileged access review." });
  }
  if (!text.includes("encrypt")) {
    findings.push({ severity: "Low", title: "Encryption requirements implicit", detail: "Azure services encrypt by default, but regulated workloads need explicit key ownership decisions.", remediation: "Document encryption at rest, TLS, and when customer-managed keys are required." });
  }

  return findings;
}

function estimateCost(prompt: string, services: ServiceRecommendation[]) {
  const workload = inferWorkload(prompt);
  const multiplier = workload.highScale ? 1.7 : workload.multiRegion ? 2.1 : 1;
  const items = services.map((item) => ({
    service: item.name,
    assumption: `${item.tier} recommendation selected for the current workload profile`,
    monthlyUsd: Math.round(item.estimatedMonthlyUsd * multiplier)
  }));
  return {
    monthlyUsd: items.reduce((sum, item) => sum + item.monthlyUsd, 0),
    items,
    disclaimer: "Static portfolio estimate only. Validate production pricing with the Azure Pricing Calculator before committing spend."
  };
}

function iacHeader(components: DeploymentComponent[]) {
  return components
    .map((item) => `// - ${item.name}: ${item.iacResources.join(", ")}`)
    .join("\n");
}

function generateBicep(prompt: string) {
  const workload = inferWorkload(prompt);
  const components = generateDeploymentComponents(prompt);
  const sqlSku = workload.multiRegion ? "BC_Gen5_2" : "GP_Gen5_2";
  const serviceBusSku = workload.highScale ? "Premium" : "Standard";
  const optionalAi = workload.ai
    ? `
resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '\${workloadName}-docai-\${suffix}'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: 'S0'
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '\${identity.id}': {}
    }
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
  }
}

resource aiSearch 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '\${workloadName}-search-\${suffix}'
  location: location
  sku: {
    name: 'basic'
  }
  properties: {
    hostingMode: 'default'
    publicNetworkAccess: 'disabled'
    disableLocalAuth: true
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}
`
    : "";
  const optionalIot = workload.iot
    ? `
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: '\${workloadName}-iot-\${suffix}'
  location: location
  sku: {
    name: 'S1'
    capacity: 1
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    routing: {
      endpoints: {
        serviceBusQueues: []
      }
      routes: []
    }
  }
}

resource streamAnalytics 'Microsoft.StreamAnalytics/streamingjobs@2021-10-01-preview' = {
  name: '\${workloadName}-stream-\${suffix}'
  location: location
  properties: {
    sku: {
      name: 'Standard'
    }
    eventsOutOfOrderPolicy: 'Adjust'
    outputErrorPolicy: 'Stop'
  }
}
`
    : "";
  return `param location string = resourceGroup().location
param workloadName string = 'arch-copilot'
param environment string = 'dev'
param sqlAdministratorLogin string = 'sqladminuser'
@secure()
param sqlAdministratorPassword string

var suffix = uniqueString(resourceGroup().id, workloadName, environment)
var tags = {
  app: workloadName
  environment: environment
  generatedBy: 'ai-architecture-copilot'
}

// Deployment structure generated from suggested services and connectors:
${iacHeader(components)}

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '\${workloadName}-law-\${suffix}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '\${workloadName}-appi-\${suffix}'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '\${workloadName}-uami-\${suffix}'
  location: location
  tags: tags
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: '\${workloadName}-vnet-\${suffix}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'snet-apim'
        properties: {
          addressPrefix: '10.42.1.0/24'
        }
      }
      {
        name: 'snet-functions'
        properties: {
          addressPrefix: '10.42.2.0/24'
          delegations: [
            {
              name: 'Microsoft.Web.serverFarms'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: '10.42.10.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource sqlDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.database.windows.net'
  location: 'global'
}

resource blobDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.core.windows.net'
  location: 'global'
}

resource vaultDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
}

resource busDns 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.servicebus.windows.net'
  location: 'global'
}

resource sqlDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: sqlDns
  name: 'vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnet.id
    }
    registrationEnabled: false
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: toLower('\${workloadName}st\${suffix}')
  location: location
  tags: tags
  sku: {
    name: 'Standard_ZRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource exportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: storage
  name: 'default/architecture-exports'
  properties: {
    publicAccess: 'None'
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '\${workloadName}-kv-\${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    enablePurgeProtection: true
    enableSoftDelete: true
  }
}

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: '\${workloadName}-sql-\${suffix}'
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdministratorLogin
    administratorLoginPassword: sqlAdministratorPassword
    publicNetworkAccess: 'Disabled'
    minimalTlsVersion: '1.2'
  }
}

resource database 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {
    name: '${sqlSku}'
  }
  properties: {
    zoneRedundant: true
    readScale: 'Enabled'
  }
}

resource sqlAudit 'Microsoft.Sql/servers/auditingSettings@2023-05-01-preview' = {
  parent: sqlServer
  name: 'default'
  properties: {
    state: 'Enabled'
    auditActionsAndGroups: [
      'SUCCESSFUL_DATABASE_AUTHENTICATION_GROUP'
      'FAILED_DATABASE_AUTHENTICATION_GROUP'
      'BATCH_COMPLETED_GROUP'
    ]
    isAzureMonitorTargetEnabled: true
  }
}

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '\${workloadName}-sb-\${suffix}'
  location: location
  tags: tags
  sku: {
    name: '${serviceBusSku}'
    tier: '${serviceBusSku}'
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
  }
}

resource workflowQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBus
  name: 'architecture-workflow'
  properties: {
    lockDuration: 'PT1M'
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
  }
}

resource eventTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  parent: serviceBus
  name: 'domain-events'
  properties: {
    defaultMessageTimeToLive: 'P14D'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '\${workloadName}-func-plan-\${suffix}'
  location: location
  tags: tags
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  properties: {
    reserved: false
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '\${workloadName}-func-\${suffix}'
  location: location
  tags: tags
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '\${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: vnet.properties.subnets[1].id
    siteConfig: {
      minTlsVersion: '1.2'
      alwaysOn: true
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'SERVICE_BUS_NAMESPACE'
          value: serviceBus.name
        }
        {
          name: 'SQL_SERVER_NAME'
          value: sqlServer.name
        }
        {
          name: 'KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
      ]
    }
  }
}

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: '\${workloadName}-apim-\${suffix}'
  location: location
  tags: tags
  sku: {
    name: 'StandardV2'
    capacity: 1
  }
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '\${identity.id}': {}
    }
  }
  properties: {
    publisherEmail: 'cloud-team@example.com'
    publisherName: 'Cloud Architecture Team'
    publicNetworkAccess: 'Enabled'
  }
}

resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '\${workloadName}-afd-\${suffix}'
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  tags: tags
}

resource wafPolicy 'Microsoft.Network/frontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: '\${workloadName}-waf-\${suffix}'
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
        }
      ]
    }
  }
}

resource defenderSql 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'SqlServers'
  properties: {
    pricingTier: 'Standard'
  }
}

resource functionDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'send-to-log-analytics'
  scope: functionApp
  properties: {
    workspaceId: logWorkspace.id
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}
${optionalAi}${optionalIot}
`;
}

function generateTerraform(prompt: string) {
  const workload = inferWorkload(prompt);
  const components = generateDeploymentComponents(prompt);
  const serviceBusSku = workload.highScale ? "Premium" : "Standard";
  const optionalAi = workload.ai
    ? `
resource "azurerm_cognitive_account" "document_intelligence" {
  name                          = "docai-\${local.name_suffix}"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  kind                          = "FormRecognizer"
  sku_name                      = "S0"
  public_network_access_enabled = false
  local_auth_enabled            = false
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
  tags = local.tags
}

resource "azurerm_search_service" "main" {
  name                          = "srch-\${local.name_suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  sku                           = "basic"
  public_network_access_enabled = false
  local_authentication_enabled  = false
  tags = local.tags
}
`
    : "";
  const optionalIot = workload.iot
    ? `
resource "azurerm_iothub" "main" {
  name                = "iot-\${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku {
    name     = "S1"
    capacity = 1
  }
  public_network_access_enabled = false
  tags = local.tags
}

resource "azurerm_stream_analytics_job" "main" {
  name                                     = "asa-\${local.name_suffix}"
  resource_group_name                      = azurerm_resource_group.main.name
  location                                 = azurerm_resource_group.main.location
  compatibility_level                      = "1.2"
  data_locale                              = "en-US"
  events_out_of_order_policy               = "Adjust"
  output_error_policy                      = "Stop"
  streaming_units                          = 3
  tags = local.tags
}
`
    : "";
  return `terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "sql_admin_password" {
  type      = string
  sensitive = true
}

random_string "suffix" {
  length  = 8
  upper   = false
  special = false
}

locals {
  name_suffix = "arch-\${random_string.suffix.result}"
  tags = {
    app         = "ai-architecture-copilot"
    environment = "dev"
    generatedBy = "ai-architecture-copilot"
  }
}

# Deployment structure generated from suggested services and connectors:
${components.map((item) => `# - ${item.name}: ${item.iacResources.join(", ")}`).join("\n")}

resource "azurerm_resource_group" "main" {
  name     = "rg-arch-copilot"
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 90
  tags                = local.tags
}

resource "azurerm_application_insights" "main" {
  name                = "appi-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "app" {
  name                = "uami-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_virtual_network" "main" {
  name                = "vnet-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.42.0.0/16"]
  tags                = local.tags
}

resource "azurerm_subnet" "apim" {
  name                 = "snet-apim"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.42.1.0/24"]
}

resource "azurerm_subnet" "functions" {
  name                 = "snet-functions"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.42.2.0/24"]
  delegation {
    name = "Microsoft.Web.serverFarms"
    service_delegation {
      name = "Microsoft.Web/serverFarms"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                                      = "snet-private-endpoints"
  resource_group_name                       = azurerm_resource_group.main.name
  virtual_network_name                      = azurerm_virtual_network.main.name
  address_prefixes                          = ["10.42.10.0/24"]
  private_endpoint_network_policies_enabled = false
}

resource "azurerm_private_dns_zone" "sql" {
  name                = "privatelink.database.windows.net"
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_private_dns_zone" "blob" {
  name                = "privatelink.blob.core.windows.net"
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_private_dns_zone" "vault" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_private_dns_zone" "servicebus" {
  name                = "privatelink.servicebus.windows.net"
  resource_group_name = azurerm_resource_group.main.name
}

resource "azurerm_storage_account" "main" {
  name                     = "archst\${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "ZRS"
  min_tls_version          = "TLS1_2"
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
  tags = local.tags
}

resource "azurerm_storage_container" "exports" {
  name                  = "architecture-exports"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

resource "azurerm_key_vault" "main" {
  name                       = "kv-\${local.name_suffix}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  public_network_access_enabled = false
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  tags = local.tags
}

data "azurerm_client_config" "current" {}

resource "azurerm_servicebus_namespace" "main" {
  name                = "sb-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "${serviceBusSku}"
  public_network_access_enabled = false
  local_auth_enabled            = false
  tags = local.tags
}

resource "azurerm_servicebus_queue" "workflow" {
  name         = "architecture-workflow"
  namespace_id = azurerm_servicebus_namespace.main.id
  max_delivery_count = 10
  dead_lettering_on_message_expiration = true
}

resource "azurerm_servicebus_topic" "events" {
  name         = "domain-events"
  namespace_id = azurerm_servicebus_namespace.main.id
}

resource "azurerm_mssql_server" "main" {
  name                         = "sql-\${local.name_suffix}"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = "sqladminuser"
  administrator_login_password = var.sql_admin_password
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
  tags = local.tags
}

resource "azurerm_mssql_database" "main" {
  name      = "appdb"
  server_id = azurerm_mssql_server.main.id
  sku_name  = "${workload.multiRegion ? "BC_Gen5_2" : "GP_Gen5_2"}"
  zone_redundant = true
}

resource "azurerm_service_plan" "functions" {
  name                = "plan-\${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Windows"
  sku_name            = "EP1"
  tags                = local.tags
}

resource "azurerm_windows_function_app" "main" {
  name                = "func-\${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.functions.id
  storage_account_name = azurerm_storage_account.main.name
  https_only          = true
  virtual_network_subnet_id = azurerm_subnet.functions.id
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
  site_config {
    always_on = true
    application_insights_connection_string = azurerm_application_insights.main.connection_string
  }
  app_settings = {
    SERVICE_BUS_NAMESPACE = azurerm_servicebus_namespace.main.name
    SQL_SERVER_NAME       = azurerm_mssql_server.main.name
    KEY_VAULT_URI         = azurerm_key_vault.main.vault_uri
  }
  tags = local.tags
}

resource "azurerm_api_management" "main" {
  name                = "apim-\${local.name_suffix}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = "Cloud Architecture Team"
  publisher_email     = "cloud-team@example.com"
  sku_name            = "StandardV2_1"
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
  tags = local.tags
}

resource "azurerm_cdn_frontdoor_profile" "main" {
  name                = "afd-\${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Standard_AzureFrontDoor"
  tags                = local.tags
}

resource "azurerm_cdn_frontdoor_endpoint" "main" {
  name                     = "endpoint-\${local.name_suffix}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.main.id
}

resource "azurerm_cdn_frontdoor_firewall_policy" "main" {
  name                = "waf\${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = azurerm_cdn_frontdoor_profile.main.sku_name
  enabled             = true
  mode                = "Prevention"
  managed_rule {
    type    = "Microsoft_DefaultRuleSet"
    version = "2.1"
    action  = "Block"
  }
}
${optionalAi}${optionalIot}
`;
}

export function generateArchitecture(prompt: string): ArchitectureOutput {
  const services = generateServices(prompt);
  const securityFindings = generateSecurityFindings(prompt, services);
  const costEstimate = estimateCost(prompt, services);
  const workload = inferWorkload(prompt);

  return {
    summary: `Recommended Azure architecture for ${workload.healthcare ? "a regulated healthcare platform" : workload.finance ? "a financial services platform" : workload.iot ? "an IoT ingestion platform" : workload.ai ? "an AI document workflow" : "a production SaaS workload"} with private data paths, asynchronous processing, observability, and IaC-ready foundations. Estimated baseline cost: ${currency.format(costEstimate.monthlyUsd)}/month.`,
    services,
    deployment: generateDeploymentComponents(prompt),
    dataFlow: generateDataFlow(prompt),
    risks: [
      "Compliance evidence depends on operational controls beyond cloud service selection.",
      "Static estimates must be validated against real traffic, retention, and regional pricing.",
      "Private endpoints and network segmentation require DNS and deployment governance.",
      "IaC templates are starter scaffolds and need policy, naming, and CI/CD hardening."
    ],
    recommendations: [
      "Define RPO/RTO, SLOs, data classification, and threat model before production buildout.",
      "Use Azure Policy to enforce private endpoints, diagnostic settings, allowed regions, and TLS.",
      "Adopt managed identities and RBAC reviews for every service-to-service integration.",
      "Run load tests and chaos experiments before increasing production traffic."
    ],
    scaling: [
      "Use Front Door origin groups and regional deployment stamps for global failover.",
      "Scale API Management and Functions independently from worker consumers.",
      "Partition queues/topics by tenant or workflow where message volume grows unevenly.",
      "Add SQL read replicas or CQRS projections for reporting-heavy workloads."
    ],
    diagram: generateDiagram(),
    securityFindings,
    costEstimate,
    iac: {
      bicep: generateBicep(prompt),
      terraform: generateTerraform(prompt)
    }
  };
}
