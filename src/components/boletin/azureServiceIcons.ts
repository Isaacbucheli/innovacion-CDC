// Iconos SVG cargados como data URIs vía import.meta.glob con query "?raw"
// (reusa el patrón de src/lib/azureIcons.ts para evitar bug de cache del SWA)
const raws = import.meta.glob("../../assets/azure-icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

// Mapa de nombre de archivo → data URI
const iconUrls = new Map<string, string>();
for (const [path, raw] of Object.entries(raws)) {
  const name = path.split("/").pop()!.replace(".svg", "");
  iconUrls.set(name, `data:image/svg+xml,${encodeURIComponent(raw)}`);
}

export interface ServiceIconInfo {
  icon: string; // Data URI del SVG
  shortName: string; // Label en español para chips
}

// Mapping de productos (feed) y tipos (ARG) a información de icono
// Las claves están en minúsculas para búsqueda case-insensitive
const iconMapping = new Map<string, ServiceIconInfo>([
  // Virtual Machines
  ["virtual machines", { icon: iconUrls.get("virtual-machines")!, shortName: "Virtual Machines" }],
  ["microsoft.compute/virtualmachines", { icon: iconUrls.get("virtual-machines")!, shortName: "Virtual Machines" }],

  // VM Scale Sets
  ["microsoft.compute/virtualmachinescalesets", { icon: iconUrls.get("vm-scale-sets")!, shortName: "VM Scale Sets" }],

  // SQL Database
  ["azure sql database", { icon: iconUrls.get("sql-database")!, shortName: "SQL Databases" }],
  ["sql database", { icon: iconUrls.get("sql-database")!, shortName: "SQL Databases" }],
  ["microsoft.sql/servers/databases", { icon: iconUrls.get("sql-database")!, shortName: "SQL Databases" }],

  // SQL Managed Instance
  ["azure sql managed instance", { icon: iconUrls.get("sql-managed-instance")!, shortName: "SQL Managed Instances" }],
  ["microsoft.sql/managedinstances", { icon: iconUrls.get("sql-managed-instance")!, shortName: "SQL Managed Instances" }],

  // SQL VM
  ["microsoft.sqlvirtualmachine/sqlvirtualmachines", { icon: iconUrls.get("sql-vm")!, shortName: "SQL VMs" }],

  // PostgreSQL
  ["azure database for postgresql", { icon: iconUrls.get("postgresql")!, shortName: "PostgreSQL" }],
  ["microsoft.dbforpostgresql/flexibleservers", { icon: iconUrls.get("postgresql")!, shortName: "PostgreSQL" }],

  // MySQL
  ["azure database for mysql", { icon: iconUrls.get("mysql")!, shortName: "MySQL" }],
  ["microsoft.dbformysql/flexibleservers", { icon: iconUrls.get("mysql")!, shortName: "MySQL" }],

  // Cosmos DB
  ["azure cosmos db", { icon: iconUrls.get("cosmos-db")!, shortName: "Cosmos DB" }],
  ["microsoft.documentdb/databaseaccounts", { icon: iconUrls.get("cosmos-db")!, shortName: "Cosmos DB" }],

  // Storage Accounts
  ["storage accounts", { icon: iconUrls.get("storage-accounts")!, shortName: "Storage Accounts" }],
  ["azure blob storage", { icon: iconUrls.get("storage-accounts")!, shortName: "Storage Accounts" }],
  ["microsoft.storage/storageaccounts", { icon: iconUrls.get("storage-accounts")!, shortName: "Storage Accounts" }],

  // Functions
  ["azure functions", { icon: iconUrls.get("functions")!, shortName: "Function Apps" }],
  ["microsoft.web/sites", { icon: iconUrls.get("functions")!, shortName: "Function Apps" }],

  // App Service
  ["app service", { icon: iconUrls.get("app-service")!, shortName: "App Services" }],
  ["azure app service", { icon: iconUrls.get("app-service")!, shortName: "App Services" }],

  // AKS
  ["azure kubernetes service (aks)", { icon: iconUrls.get("aks")!, shortName: "AKS" }],
  ["microsoft.containerservice/managedclusters", { icon: iconUrls.get("aks")!, shortName: "AKS" }],

  // API Management
  ["api management", { icon: iconUrls.get("api-management")!, shortName: "API Management" }],
  ["microsoft.apimanagement/service", { icon: iconUrls.get("api-management")!, shortName: "API Management" }],

  // Key Vault
  ["key vault", { icon: iconUrls.get("key-vault")!, shortName: "Key Vaults" }],
  ["azure key vault", { icon: iconUrls.get("key-vault")!, shortName: "Key Vaults" }],
  ["microsoft.keyvault/vaults", { icon: iconUrls.get("key-vault")!, shortName: "Key Vaults" }],

  // Azure Monitor / Application Insights
  ["azure monitor", { icon: iconUrls.get("monitor")!, shortName: "Azure Monitor" }],
  ["application insights", { icon: iconUrls.get("application-insights")!, shortName: "App Insights" }],
  ["microsoft.insights/components", { icon: iconUrls.get("application-insights")!, shortName: "App Insights" }],

  // Automation
  ["azure automation", { icon: iconUrls.get("automation")!, shortName: "Automation" }],
  ["microsoft.automation/automationaccounts", { icon: iconUrls.get("automation")!, shortName: "Automation" }],

  // Event Hubs
  ["event hubs", { icon: iconUrls.get("event-hubs")!, shortName: "Event Hubs" }],
  ["microsoft.eventhub/namespaces", { icon: iconUrls.get("event-hubs")!, shortName: "Event Hubs" }],

  // Service Bus
  ["service bus", { icon: iconUrls.get("service-bus")!, shortName: "Service Bus" }],
  ["microsoft.servicebus/namespaces", { icon: iconUrls.get("service-bus")!, shortName: "Service Bus" }],

  // Virtual Network
  ["virtual network", { icon: iconUrls.get("virtual-network")!, shortName: "VNets" }],
  ["microsoft.network/virtualnetworks", { icon: iconUrls.get("virtual-network")!, shortName: "VNets" }],

  // VPN Gateway
  ["vpn gateway", { icon: iconUrls.get("vpn-gateway")!, shortName: "VPN Gateways" }],
  ["microsoft.network/virtualnetworkgateways", { icon: iconUrls.get("vpn-gateway")!, shortName: "VPN Gateways" }],

  // DDoS Protection
  ["azure ddos protection", { icon: iconUrls.get("ddos-protection")!, shortName: "DDoS Protection" }],
  ["microsoft.network/ddosprotectionplans", { icon: iconUrls.get("ddos-protection")!, shortName: "DDoS Protection" }],

  // Front Door
  ["azure front door", { icon: iconUrls.get("front-door")!, shortName: "Front Door" }],
  ["microsoft.cdn/profiles", { icon: iconUrls.get("front-door")!, shortName: "Front Door" }],

  // Backup
  ["azure backup", { icon: iconUrls.get("backup")!, shortName: "Recovery Vaults" }],
  ["microsoft.recoveryservices/vaults", { icon: iconUrls.get("backup")!, shortName: "Recovery Vaults" }],

  // Databricks
  ["azure databricks", { icon: iconUrls.get("databricks")!, shortName: "Databricks" }],
  ["microsoft.databricks/workspaces", { icon: iconUrls.get("databricks")!, shortName: "Databricks" }],

  // Load Balancer
  ["load balancer", { icon: iconUrls.get("load-balancer")!, shortName: "Load Balancers" }],
  ["microsoft.network/loadbalancers", { icon: iconUrls.get("load-balancer")!, shortName: "Load Balancers" }],

  // Application Gateway
  ["application gateway", { icon: iconUrls.get("application-gateway")!, shortName: "App Gateways" }],
  ["microsoft.network/applicationgateways", { icon: iconUrls.get("application-gateway")!, shortName: "App Gateways" }],

  // Network Watcher
  ["network watcher", { icon: iconUrls.get("network-watcher")!, shortName: "Network Watcher" }],
  ["microsoft.network/networkwatchers", { icon: iconUrls.get("network-watcher")!, shortName: "Network Watcher" }],

  // Log Analytics
  ["log analytics", { icon: iconUrls.get("log-analytics")!, shortName: "Log Analytics" }],
  ["microsoft.operationalinsights/workspaces", { icon: iconUrls.get("log-analytics")!, shortName: "Log Analytics" }],

  // Azure OpenAI
  ["azure openai service", { icon: iconUrls.get("azure-openai")!, shortName: "Azure OpenAI" }],
  ["microsoft.cognitiveservices/accounts", { icon: iconUrls.get("azure-openai")!, shortName: "Azure OpenAI" }],

  // AI Foundry
  ["azure ai foundry", { icon: iconUrls.get("ai-foundry")!, shortName: "AI Foundry" }],

  // Public IPs (fallback to virtual network icon)
  ["microsoft.network/publicipaddresses", { icon: iconUrls.get("virtual-network")!, shortName: "Public IPs" }],
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
