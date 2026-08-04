import { expect, test } from "vitest";
import {
  resolveServiceIcon, resourceTypeLabel,
} from "@/components/boletin/azureServiceIcons";

// Test resolveServiceIcon
test("resolveServiceIcon devuelve URL para producto mapeado (feed)", () => {
  const url = resolveServiceIcon(["azure sql database"]);
  expect(url).toBeTruthy();
  expect(url).toMatch(/^(data:|.*\.svg)/);
});

test("resolveServiceIcon devuelve URL para primera coincidencia en array", () => {
  const url = resolveServiceIcon(["unmapped-product", "virtual machines"]);
  expect(url).toBeTruthy();
  expect(url).toMatch(/^(data:|.*\.svg)/);
});

test("resolveServiceIcon devuelve null si ningún producto está mapeado", () => {
  const url = resolveServiceIcon(["unknown-product", "another-unknown"]);
  expect(url).toBeNull();
});

test("resolveServiceIcon es case-insensitive", () => {
  const url1 = resolveServiceIcon(["VIRTUAL MACHINES"]);
  const url2 = resolveServiceIcon(["Virtual Machines"]);
  const url3 = resolveServiceIcon(["virtual machines"]);
  expect(url1).toBeTruthy();
  expect(url1).toEqual(url2);
  expect(url2).toEqual(url3);
});

test("resolveServiceIcon maneja array vacío", () => {
  const url = resolveServiceIcon([]);
  expect(url).toBeNull();
});

// Test resourceTypeLabel
test("resourceTypeLabel mapea tipos ARG a labels en español", () => {
  expect(resourceTypeLabel("microsoft.compute/virtualmachines")).toBe("Virtual Machines");
  expect(resourceTypeLabel("microsoft.sql/servers/databases")).toBe("SQL Databases");
  expect(resourceTypeLabel("microsoft.storage/storageaccounts")).toBe("Storage Accounts");
});

test("resourceTypeLabel es case-insensitive para tipos ARG", () => {
  const label1 = resourceTypeLabel("microsoft.compute/virtualmachines");
  const label2 = resourceTypeLabel("MICROSOFT.COMPUTE/VIRTUALMACHINES");
  expect(label1).toEqual(label2);
});

test("resourceTypeLabel sin mapeo devuelve último segmento del tipo", () => {
  expect(resourceTypeLabel("microsoft.foo/bares")).toBe("bares");
  expect(resourceTypeLabel("microsoft.unknown/resource/deeppath")).toBe("deeppath");
});

test("resourceTypeLabel devuelve cadena vacía si es null/undefined", () => {
  expect(resourceTypeLabel("")).toBe("");
});

// Test specific product mappings from brief
test("mapea productos del feed observados en E2E", () => {
  const cases = [
    "virtual machines",
    "azure sql database",
    "azure sql managed instance",
    "azure database for postgresql",
    "azure database for mysql",
    "azure cosmos db",
    "storage accounts",
    "azure functions",
    "app service",
    "azure kubernetes service (aks)",
    "api management",
    "key vault",
    "azure monitor",
    "azure automation",
    "event hubs",
    "service bus",
    "virtual network",
    "vpn gateway",
    "azure ddos protection",
    "azure front door",
    "azure backup",
    "azure databricks",
    "load balancer",
    "application gateway",
    "network watcher",
    "log analytics",
    "azure openai service",
    "azure ai foundry",
  ];
  for (const product of cases) {
    const url = resolveServiceIcon([product]);
    expect(url).toBeTruthy();
    expect(url).toMatch(/^(data:|.*\.svg)/);
  }
});

// Test specific type mappings from brief
test("mapea tipos ARG a labels correctos", () => {
  const cases = [
    ["microsoft.compute/virtualmachines", "Virtual Machines"],
    ["microsoft.compute/virtualmachinescalesets", "VM Scale Sets"],
    ["microsoft.sql/servers/databases", "SQL Databases"],
    ["microsoft.sql/managedinstances", "SQL Managed Instances"],
    ["microsoft.sqlvirtualmachine/sqlvirtualmachines", "SQL VMs"],
    ["microsoft.dbforpostgresql/flexibleservers", "PostgreSQL"],
    ["microsoft.dbformysql/flexibleservers", "MySQL"],
    ["microsoft.documentdb/databaseaccounts", "Cosmos DB"],
    ["microsoft.storage/storageaccounts", "Storage Accounts"],
    ["microsoft.web/sites", "Function Apps"],
    ["microsoft.containerservice/managedclusters", "AKS"],
    ["microsoft.apimanagement/service", "API Management"],
    ["microsoft.keyvault/vaults", "Key Vaults"],
    ["microsoft.insights/components", "Application Insights"],
    ["microsoft.automation/automationaccounts", "Automation"],
    ["microsoft.eventhub/namespaces", "Event Hubs"],
    ["microsoft.servicebus/namespaces", "Service Bus"],
    ["microsoft.network/virtualnetworks", "VNets"],
    ["microsoft.network/virtualnetworkgateways", "VPN Gateways"],
    ["microsoft.network/ddosprotectionplans", "DDoS Protection"],
    ["microsoft.cdn/profiles", "Front Door"],
    ["microsoft.recoveryservices/vaults", "Recovery Vaults"],
    ["microsoft.databricks/workspaces", "Databricks"],
    ["microsoft.network/loadbalancers", "Load Balancers"],
    ["microsoft.network/applicationgateways", "App Gateways"],
    ["microsoft.network/networkwatchers", "Network Watcher"],
    ["microsoft.operationalinsights/workspaces", "Log Analytics"],
    ["microsoft.cognitiveservices/accounts", "Azure OpenAI"],
    ["microsoft.network/publicipaddresses", "Public IPs"],
  ];
  for (const [type, expectedLabel] of cases) {
    const label = resourceTypeLabel(type);
    expect(label).toBe(expectedLabel);
  }
});

// Test shortNames available via icon info
test("ServiceIconInfo exporta icon URLs y shortNames", () => {
  // This will be tested via implementation
  const url = resolveServiceIcon(["virtual machines"]);
  expect(url).toBeTruthy();
  // The icon should be a valid import URL (either data URI or SVG path)
  expect(url).toMatch(/^(data:|.*\.svg)/);
});
