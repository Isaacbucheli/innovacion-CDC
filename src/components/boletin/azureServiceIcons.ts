// SVG imports from Vite
import vmUrl from "@/assets/azure-icons/virtual-machines.svg";
import vmScaleSetsUrl from "@/assets/azure-icons/vm-scale-sets.svg";
import sqlDatabaseUrl from "@/assets/azure-icons/sql-database.svg";
import sqlManagedInstanceUrl from "@/assets/azure-icons/sql-managed-instance.svg";
import sqlVmUrl from "@/assets/azure-icons/sql-vm.svg";
import postgresqlUrl from "@/assets/azure-icons/postgresql.svg";
import mysqlUrl from "@/assets/azure-icons/mysql.svg";
import cosmosDbUrl from "@/assets/azure-icons/cosmos-db.svg";
import storageAccountsUrl from "@/assets/azure-icons/storage-accounts.svg";
import functionsUrl from "@/assets/azure-icons/functions.svg";
import appServiceUrl from "@/assets/azure-icons/app-service.svg";
import aksUrl from "@/assets/azure-icons/aks.svg";
import apiManagementUrl from "@/assets/azure-icons/api-management.svg";
import keyVaultUrl from "@/assets/azure-icons/key-vault.svg";
import monitorUrl from "@/assets/azure-icons/monitor.svg";
import appInsightsUrl from "@/assets/azure-icons/application-insights.svg";
import automationUrl from "@/assets/azure-icons/automation.svg";
import eventHubsUrl from "@/assets/azure-icons/event-hubs.svg";
import serviceBusUrl from "@/assets/azure-icons/service-bus.svg";
import virtualNetworkUrl from "@/assets/azure-icons/virtual-network.svg";
import vpnGatewayUrl from "@/assets/azure-icons/vpn-gateway.svg";
import ddosProtectionUrl from "@/assets/azure-icons/ddos-protection.svg";
import frontDoorUrl from "@/assets/azure-icons/front-door.svg";
import backupUrl from "@/assets/azure-icons/backup.svg";
import databricksUrl from "@/assets/azure-icons/databricks.svg";
import loadBalancerUrl from "@/assets/azure-icons/load-balancer.svg";
import applicationGatewayUrl from "@/assets/azure-icons/application-gateway.svg";
import networkWatcherUrl from "@/assets/azure-icons/network-watcher.svg";
import logAnalyticsUrl from "@/assets/azure-icons/log-analytics.svg";
import azureOpenaiUrl from "@/assets/azure-icons/azure-openai.svg";
import aiFoundryUrl from "@/assets/azure-icons/ai-foundry.svg";

export interface ServiceIconInfo {
  icon: string; // URL del import Vite
  shortName: string; // Label en español para chips
}

// Mapping de productos (feed) y tipos (ARG) a información de icono
// Las claves están en minúsculas para búsqueda case-insensitive
const iconMapping = new Map<string, ServiceIconInfo>([
  // Virtual Machines
  ["virtual machines", { icon: vmUrl, shortName: "Virtual Machines" }],
  ["microsoft.compute/virtualmachines", { icon: vmUrl, shortName: "Virtual Machines" }],

  // VM Scale Sets
  ["microsoft.compute/virtualmachinescalesets", { icon: vmScaleSetsUrl, shortName: "VM Scale Sets" }],

  // SQL Database
  ["azure sql database", { icon: sqlDatabaseUrl, shortName: "SQL Databases" }],
  ["sql database", { icon: sqlDatabaseUrl, shortName: "SQL Databases" }],
  ["microsoft.sql/servers/databases", { icon: sqlDatabaseUrl, shortName: "SQL Databases" }],

  // SQL Managed Instance
  ["azure sql managed instance", { icon: sqlManagedInstanceUrl, shortName: "SQL Managed Instances" }],
  ["microsoft.sql/managedinstances", { icon: sqlManagedInstanceUrl, shortName: "SQL Managed Instances" }],

  // SQL VM
  ["microsoft.sqlvirtualmachine/sqlvirtualmachines", { icon: sqlVmUrl, shortName: "SQL VMs" }],

  // PostgreSQL
  ["azure database for postgresql", { icon: postgresqlUrl, shortName: "PostgreSQL" }],
  ["microsoft.dbforpostgresql/flexibleservers", { icon: postgresqlUrl, shortName: "PostgreSQL" }],

  // MySQL
  ["azure database for mysql", { icon: mysqlUrl, shortName: "MySQL" }],
  ["microsoft.dbformysql/flexibleservers", { icon: mysqlUrl, shortName: "MySQL" }],

  // Cosmos DB
  ["azure cosmos db", { icon: cosmosDbUrl, shortName: "Cosmos DB" }],
  ["microsoft.documentdb/databaseaccounts", { icon: cosmosDbUrl, shortName: "Cosmos DB" }],

  // Storage Accounts
  ["storage accounts", { icon: storageAccountsUrl, shortName: "Storage Accounts" }],
  ["azure blob storage", { icon: storageAccountsUrl, shortName: "Storage Accounts" }],
  ["microsoft.storage/storageaccounts", { icon: storageAccountsUrl, shortName: "Storage Accounts" }],

  // Functions
  ["azure functions", { icon: functionsUrl, shortName: "Function Apps" }],
  ["microsoft.web/sites", { icon: functionsUrl, shortName: "Function Apps" }],

  // App Service
  ["app service", { icon: appServiceUrl, shortName: "App Services" }],
  ["azure app service", { icon: appServiceUrl, shortName: "App Services" }],

  // AKS
  ["azure kubernetes service (aks)", { icon: aksUrl, shortName: "AKS" }],
  ["microsoft.containerservice/managedclusters", { icon: aksUrl, shortName: "AKS" }],

  // API Management
  ["api management", { icon: apiManagementUrl, shortName: "API Management" }],
  ["microsoft.apimanagement/service", { icon: apiManagementUrl, shortName: "API Management" }],

  // Key Vault
  ["key vault", { icon: keyVaultUrl, shortName: "Key Vaults" }],
  ["azure key vault", { icon: keyVaultUrl, shortName: "Key Vaults" }],
  ["microsoft.keyvault/vaults", { icon: keyVaultUrl, shortName: "Key Vaults" }],

  // Azure Monitor / Application Insights
  ["azure monitor", { icon: monitorUrl, shortName: "Azure Monitor" }],
  ["application insights", { icon: appInsightsUrl, shortName: "Application Insights" }],
  ["microsoft.insights/components", { icon: appInsightsUrl, shortName: "Application Insights" }],

  // Automation
  ["azure automation", { icon: automationUrl, shortName: "Automation" }],
  ["microsoft.automation/automationaccounts", { icon: automationUrl, shortName: "Automation" }],

  // Event Hubs
  ["event hubs", { icon: eventHubsUrl, shortName: "Event Hubs" }],
  ["microsoft.eventhub/namespaces", { icon: eventHubsUrl, shortName: "Event Hubs" }],

  // Service Bus
  ["service bus", { icon: serviceBusUrl, shortName: "Service Bus" }],
  ["microsoft.servicebus/namespaces", { icon: serviceBusUrl, shortName: "Service Bus" }],

  // Virtual Network
  ["virtual network", { icon: virtualNetworkUrl, shortName: "VNets" }],
  ["microsoft.network/virtualnetworks", { icon: virtualNetworkUrl, shortName: "VNets" }],

  // VPN Gateway
  ["vpn gateway", { icon: vpnGatewayUrl, shortName: "VPN Gateways" }],
  ["microsoft.network/virtualnetworkgateways", { icon: vpnGatewayUrl, shortName: "VPN Gateways" }],

  // DDoS Protection
  ["azure ddos protection", { icon: ddosProtectionUrl, shortName: "DDoS Protection" }],
  ["microsoft.network/ddosprotectionplans", { icon: ddosProtectionUrl, shortName: "DDoS Protection" }],

  // Front Door
  ["azure front door", { icon: frontDoorUrl, shortName: "Front Door" }],
  ["microsoft.cdn/profiles", { icon: frontDoorUrl, shortName: "Front Door" }],

  // Backup
  ["azure backup", { icon: backupUrl, shortName: "Recovery Vaults" }],
  ["microsoft.recoveryservices/vaults", { icon: backupUrl, shortName: "Recovery Vaults" }],

  // Databricks
  ["azure databricks", { icon: databricksUrl, shortName: "Databricks" }],
  ["microsoft.databricks/workspaces", { icon: databricksUrl, shortName: "Databricks" }],

  // Load Balancer
  ["load balancer", { icon: loadBalancerUrl, shortName: "Load Balancers" }],
  ["microsoft.network/loadbalancers", { icon: loadBalancerUrl, shortName: "Load Balancers" }],

  // Application Gateway
  ["application gateway", { icon: applicationGatewayUrl, shortName: "App Gateways" }],
  ["microsoft.network/applicationgateways", { icon: applicationGatewayUrl, shortName: "App Gateways" }],

  // Network Watcher
  ["network watcher", { icon: networkWatcherUrl, shortName: "Network Watcher" }],
  ["microsoft.network/networkwatchers", { icon: networkWatcherUrl, shortName: "Network Watcher" }],

  // Log Analytics
  ["log analytics", { icon: logAnalyticsUrl, shortName: "Log Analytics" }],
  ["microsoft.operationalinsights/workspaces", { icon: logAnalyticsUrl, shortName: "Log Analytics" }],

  // Azure OpenAI
  ["azure openai service", { icon: azureOpenaiUrl, shortName: "Azure OpenAI" }],
  ["microsoft.cognitiveservices/accounts", { icon: azureOpenaiUrl, shortName: "Azure OpenAI" }],

  // AI Foundry
  ["azure ai foundry", { icon: aiFoundryUrl, shortName: "AI Foundry" }],

  // Public IPs (fallback to virtual network icon)
  ["microsoft.network/publicipaddresses", { icon: virtualNetworkUrl, shortName: "Public IPs" }],
]);

/**
 * Resuelve el ícono de servicio Azure a partir de una lista de nombres de productos.
 * Devuelve la URL del SVG para el primer producto mapeado, o null si ninguno está en el mapa.
 * La búsqueda es case-insensitive.
 *
 * @param productos Array de nombres de productos (ej. "Azure SQL Database", "Virtual Machines")
 * @returns URL del SVG o null
 */
export function resolveServiceIcon(productos: string[]): string | null {
  for (const producto of productos) {
    const key = producto.toLowerCase().trim();
    const info = iconMapping.get(key);
    if (info) {
      return info.icon;
    }
  }
  return null;
}

/**
 * Obtiene el nombre corto (label en español) para un tipo de recurso ARG.
 * Si el tipo está mapeado, devuelve el shortName.
 * Si no está mapeado, devuelve el último segmento del tipo (ej. "bares" de "microsoft.foo/bares").
 * La búsqueda es case-insensitive.
 *
 * @param type Tipo ARG (ej. "microsoft.compute/virtualmachines")
 * @returns Label en español o último segmento del tipo
 */
export function resourceTypeLabel(type: string): string {
  if (!type) return "";

  const key = type.toLowerCase().trim();
  const info = iconMapping.get(key);

  if (info) {
    return info.shortName;
  }

  // Sin mapeo: devolver el último segmento del tipo
  const segments = type.split("/");
  return segments[segments.length - 1] || "";
}
