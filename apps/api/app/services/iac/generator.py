from app.services.architecture.catalog import deployment_components, infer_workload


def _iac_header(prompt: str, comment_prefix: str) -> str:
    return "\n".join(
        f"{comment_prefix} - {item['name']}: {', '.join(item['iacResources'])}"
        for item in deployment_components(prompt)
    )


def generate_bicep(prompt: str) -> str:
    workload = infer_workload(prompt)
    sql_sku = "BC_Gen5_2" if workload.multi_region else "GP_Gen5_2"
    service_bus_sku = "Premium" if workload.high_scale else "Standard"
    optional_ai = ""
    if workload.ai:
        optional_ai = """
resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${workloadName}-docai-${suffix}'
  location: location
  kind: 'FormRecognizer'
  sku: {
    name: 'S0'
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
  }
}

resource aiSearch 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '${workloadName}-search-${suffix}'
  location: location
  sku: {
    name: 'basic'
  }
  properties: {
    publicNetworkAccess: 'disabled'
    disableLocalAuth: true
  }
}
"""

    optional_iot = ""
    if workload.iot:
        optional_iot = """
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: '${workloadName}-iot-${suffix}'
  location: location
  sku: {
    name: 'S1'
    capacity: 1
  }
  properties: {
    publicNetworkAccess: 'Disabled'
  }
}

resource streamAnalytics 'Microsoft.StreamAnalytics/streamingjobs@2021-10-01-preview' = {
  name: '${workloadName}-stream-${suffix}'
  location: location
  properties: {
    sku: {
      name: 'Standard'
    }
  }
}
"""

    return f"""param location string = resourceGroup().location
param workloadName string = 'arch-copilot'
param environment string = 'dev'
param sqlAdministratorLogin string = 'sqladminuser'
@secure()
param sqlAdministratorPassword string

var suffix = uniqueString(resourceGroup().id, workloadName, environment)
var tags = {{
  app: workloadName
  environment: environment
  generatedBy: 'ai-architecture-copilot'
}}

// Deployment structure generated from suggested services and connectors:
{_iac_header(prompt, "//")}

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {{
  name: '${{workloadName}}-law-${{suffix}}'
  location: location
  tags: tags
  properties: {{
    sku: {{
      name: 'PerGB2018'
    }}
    retentionInDays: 90
  }}
}}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {{
  name: '${{workloadName}}-appi-${{suffix}}'
  location: location
  kind: 'web'
  tags: tags
  properties: {{
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }}
}}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {{
  name: '${{workloadName}}-uami-${{suffix}}'
  location: location
  tags: tags
}}

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {{
  name: '${{workloadName}}-vnet-${{suffix}}'
  location: location
  tags: tags
  properties: {{
    addressSpace: {{
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }}
  }}
}}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {{
  name: toLower('${{workloadName}}st${{suffix}}')
  location: location
  tags: tags
  sku: {{
    name: 'Standard_ZRS'
  }}
  kind: 'StorageV2'
  properties: {{
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
  }}
}}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {{
  name: '${{workloadName}}-kv-${{suffix}}'
  location: location
  tags: tags
  properties: {{
    tenantId: subscription().tenantId
    sku: {{
      family: 'A'
      name: 'standard'
    }}
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    enablePurgeProtection: true
  }}
}}

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {{
  name: '${{workloadName}}-sql-${{suffix}}'
  location: location
  tags: tags
  properties: {{
    administratorLogin: sqlAdministratorLogin
    administratorLoginPassword: sqlAdministratorPassword
    publicNetworkAccess: 'Disabled'
    minimalTlsVersion: '1.2'
  }}
}}

resource database 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {{
  parent: sqlServer
  name: 'appdb'
  location: location
  sku: {{
    name: '{sql_sku}'
  }}
  properties: {{
    zoneRedundant: true
  }}
}}

resource serviceBus 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {{
  name: '${{workloadName}}-sb-${{suffix}}'
  location: location
  tags: tags
  sku: {{
    name: '{service_bus_sku}'
    tier: '{service_bus_sku}'
  }}
  properties: {{
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
  }}
}}

resource workflowQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {{
  parent: serviceBus
  name: 'architecture-workflow'
}}

resource eventTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {{
  parent: serviceBus
  name: 'domain-events'
}}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {{
  name: '${{workloadName}}-func-plan-${{suffix}}'
  location: location
  tags: tags
  sku: {{
    name: 'EP1'
    tier: 'ElasticPremium'
  }}
}}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {{
  name: '${{workloadName}}-func-${{suffix}}'
  location: location
  tags: tags
  kind: 'functionapp'
  identity: {{
    type: 'UserAssigned'
    userAssignedIdentities: {{
      '${{identity.id}}': {{}}
    }}
  }}
  properties: {{
    serverFarmId: plan.id
    httpsOnly: true
  }}
}}

resource apim 'Microsoft.ApiManagement/service@2023-09-01-preview' = {{
  name: '${{workloadName}}-apim-${{suffix}}'
  location: location
  tags: tags
  sku: {{
    name: 'StandardV2'
    capacity: 1
  }}
  properties: {{
    publisherEmail: 'cloud-team@example.com'
    publisherName: 'Cloud Architecture Team'
  }}
}}

resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = {{
  name: '${{workloadName}}-afd-${{suffix}}'
  location: 'global'
  sku: {{
    name: 'Standard_AzureFrontDoor'
  }}
  tags: tags
}}

resource defenderSql 'Microsoft.Security/pricings@2024-01-01' = {{
  name: 'SqlServers'
  properties: {{
    pricingTier: 'Standard'
  }}
}}
{optional_ai}{optional_iot}
"""


def generate_terraform(prompt: str) -> str:
    workload = infer_workload(prompt)
    service_bus_sku = "Premium" if workload.high_scale else "Standard"
    optional_ai = ""
    if workload.ai:
        optional_ai = """
resource "azurerm_cognitive_account" "document_intelligence" {
  name                          = "docai-${local.name_suffix}"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  kind                          = "FormRecognizer"
  sku_name                      = "S0"
  public_network_access_enabled = false
  local_auth_enabled            = false
  tags                          = local.tags
}

resource "azurerm_search_service" "main" {
  name                          = "srch-${local.name_suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  sku                           = "basic"
  public_network_access_enabled = false
  local_authentication_enabled  = false
  tags                          = local.tags
}
"""
    optional_iot = ""
    if workload.iot:
        optional_iot = """
resource "azurerm_iothub" "main" {
  name                          = "iot-${local.name_suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  public_network_access_enabled = false
  sku {
    name     = "S1"
    capacity = 1
  }
  tags = local.tags
}

resource "azurerm_stream_analytics_job" "main" {
  name                = "asa-${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  streaming_units     = 3
  tags                = local.tags
}
"""

    return f"""terraform {{
  required_providers {{
    azurerm = {{
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }}
    random = {{
      source  = "hashicorp/random"
      version = "~> 3.6"
    }}
  }}
}}

provider "azurerm" {{
  features {{}}
}}

data "azurerm_client_config" "current" {{}}

variable "location" {{
  type    = string
  default = "eastus"
}}

variable "sql_admin_password" {{
  type      = string
  sensitive = true
}}

random_string "suffix" {{
  length  = 8
  upper   = false
  special = false
}}

locals {{
  name_suffix = "arch-${{random_string.suffix.result}}"
  tags = {{
    app         = "ai-architecture-copilot"
    environment = "dev"
    generatedBy = "ai-architecture-copilot"
  }}
}}

# Deployment structure generated from suggested services and connectors:
{_iac_header(prompt, "#")}

resource "azurerm_resource_group" "main" {{
  name     = "rg-arch-copilot"
  location = var.location
  tags     = local.tags
}}

resource "azurerm_log_analytics_workspace" "main" {{
  name                = "law-${{local.name_suffix}}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 90
  tags                = local.tags
}}

resource "azurerm_application_insights" "main" {{
  name                = "appi-${{local.name_suffix}}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}}

resource "azurerm_user_assigned_identity" "app" {{
  name                = "uami-${{local.name_suffix}}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}}

resource "azurerm_virtual_network" "main" {{
  name                = "vnet-${{local.name_suffix}}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.42.0.0/16"]
  tags                = local.tags
}}

resource "azurerm_storage_account" "main" {{
  name                          = "archst${{random_string.suffix.result}}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  account_tier                  = "Standard"
  account_replication_type      = "ZRS"
  min_tls_version               = "TLS1_2"
  allow_nested_items_to_be_public = false
  public_network_access_enabled = false
  tags                          = local.tags
}}

resource "azurerm_storage_container" "exports" {{
  name                  = "architecture-exports"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}}

resource "azurerm_key_vault" "main" {{
  name                          = "kv-${{local.name_suffix}}"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  enable_rbac_authorization     = true
  public_network_access_enabled = false
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  tags                          = local.tags
}}

resource "azurerm_servicebus_namespace" "main" {{
  name                          = "sb-${{local.name_suffix}}"
  location                      = azurerm_resource_group.main.location
  resource_group_name           = azurerm_resource_group.main.name
  sku                           = "{service_bus_sku}"
  public_network_access_enabled = false
  local_auth_enabled            = false
  tags                          = local.tags
}}

resource "azurerm_servicebus_queue" "workflow" {{
  name                                 = "architecture-workflow"
  namespace_id                         = azurerm_servicebus_namespace.main.id
  max_delivery_count                   = 10
  dead_lettering_on_message_expiration = true
}}

resource "azurerm_mssql_server" "main" {{
  name                          = "sql-${{local.name_suffix}}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "12.0"
  administrator_login           = "sqladminuser"
  administrator_login_password  = var.sql_admin_password
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
  tags                          = local.tags
}}

resource "azurerm_mssql_database" "main" {{
  name           = "appdb"
  server_id      = azurerm_mssql_server.main.id
  sku_name       = "{'BC_Gen5_2' if workload.multi_region else 'GP_Gen5_2'}"
  zone_redundant = true
}}

resource "azurerm_service_plan" "functions" {{
  name                = "plan-${{local.name_suffix}}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Windows"
  sku_name            = "EP1"
  tags                = local.tags
}}

resource "azurerm_windows_function_app" "main" {{
  name                 = "func-${{local.name_suffix}}"
  resource_group_name  = azurerm_resource_group.main.name
  location             = azurerm_resource_group.main.location
  service_plan_id      = azurerm_service_plan.functions.id
  storage_account_name = azurerm_storage_account.main.name
  https_only           = true
  identity {{
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }}
  site_config {{
    always_on = true
    application_insights_connection_string = azurerm_application_insights.main.connection_string
  }}
  app_settings = {{
    SERVICE_BUS_NAMESPACE = azurerm_servicebus_namespace.main.name
    SQL_SERVER_NAME       = azurerm_mssql_server.main.name
    KEY_VAULT_URI         = azurerm_key_vault.main.vault_uri
  }}
  tags = local.tags
}}

resource "azurerm_api_management" "main" {{
  name                = "apim-${{local.name_suffix}}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = "Cloud Architecture Team"
  publisher_email     = "cloud-team@example.com"
  sku_name            = "StandardV2_1"
  identity {{
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }}
  tags = local.tags
}}

resource "azurerm_cdn_frontdoor_profile" "main" {{
  name                = "afd-${{local.name_suffix}}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Standard_AzureFrontDoor"
  tags                = local.tags
}}
{optional_ai}{optional_iot}
"""
