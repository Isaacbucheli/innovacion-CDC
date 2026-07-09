// Contenido estático de la pestaña Leyenda del Catálogo de políticas.
// Las fases y los parámetros sugeridos vienen TEXTUALES del Excel
// "BIT-CDC-Azure Policy Lineabase.xlsx" (hojas "Resumen" y "Parámetros sugeridos").

export const LEYENDA_POLICIES: { columna: string; significado: string }[] = [
  { columna: "Nº", significado: "Número correlativo de la política dentro de la línea base." },
  { columna: "POLÍTICA", significado: "Nombre oficial (displayName) de la política built-in de Azure." },
  { columna: "CATEGORÍA", significado: "Área que cubre: gobierno / cumplimiento geográfico, control de servicios, FinOps / tagueo, estandarización IaaS o seguridad." },
  { columna: "TIPO", significado: "Origen de la definición. Toda la línea base usa Built-in Azure Policy (no requiere definiciones personalizadas)." },
  { columna: "EFECTO RECOMENDADO", significado: "Efecto sugerido al asignar: Deny (bloquea), Modify (corrige/agrega, p. ej. tags), Audit (solo reporta) o 'Deny o Audit' según la madurez del cliente." },
  { columna: "MODO", significado: "Modo de evaluación de la política: Indexed (recursos que soportan tags y location) o All (incluye resource groups y suscripciones)." },
  { columna: "PARÁMETROS CLAVE", significado: "Parámetro principal que hay que definir al asignar la política (p. ej. listOfAllowedLocations, tagName, listOfAllowedSKUs, effect)." },
  { columna: "DESCRIPCIÓN", significado: "Qué valida o restringe la política." },
  { columna: "OBJETIVO / BENEFICIO", significado: "Qué riesgo, costo o desorden evita al cliente." },
  { columna: "SCOPE RECOMENDADO", significado: "Nivel de asignación sugerido: Management Group o Subscription." },
  { columna: "ROLLOUT RECOMENDADO", significado: "Cómo desplegarla de forma segura (típicamente Audit primero y Deny/Modify después)." },
  { columna: "RIESGO / IMPACTO", significado: "Qué puede bloquearse o romperse al activarla; excepciones a validar antes del Deny." },
  { columna: "PARÁMETROS EJEMPLO", significado: "JSON de parámetros de ejemplo listo para usar en la asignación (CLI/PowerShell)." },
  { columna: "AZURE CLI / POWERSHELL", significado: "Scripts completos de asignación individual. Reemplazar <subscription-id> o usar scope de Management Group: /providers/Microsoft.Management/managementGroups/<mg-id>." },
  { columna: "FUENTE OFICIAL", significado: "Documentación de Microsoft Learn que respalda la política." },
];

// Hoja "Resumen" — Fases de implementación (textos exactos del Excel).
export const FASES_IMPLEMENTACION: { fase: string; accion: string; resultado: string }[] = [
  { fase: "1", accion: "Asignar en Audit cuando aplique", resultado: "Identificar impacto sin bloquear operación" },
  { fase: "2", accion: "Validar excepciones y parámetros", resultado: "Alinear arquitectura, seguridad y operación" },
  { fase: "3", accion: "Cambiar a Deny / Modify / DeployIfNotExists", resultado: "Gobierno preventivo y corrección automática" },
  { fase: "4", accion: "Crear initiative personalizada", resultado: "Baseline replicable por cliente/suscripción" },
];

// Hoja "Parámetros sugeridos" (textos exactos del Excel).
export const PARAMETROS_SUGERIDOS: {
  parametro: string; valorSugerido: string; aplicaA: string; notas: string; prioridad: string; ejemplo: string;
}[] = [
  { parametro: "Regiones permitidas", valorSugerido: "eastus, eastus2, brazilsouth", aplicaA: "Allowed locations / RGs", notas: "Ajustar según arquitectura, DR y residencia de datos.", prioridad: "Alta", ejemplo: "eastus" },
  { parametro: "Tags obligatorios", valorSugerido: "Cliente, Ambiente, Owner, CentroCosto, Criticidad, Servicio", aplicaA: "Require tag / Inherit tag", notas: "Crear una asignación por cada tag obligatorio.", prioridad: "Alta", ejemplo: "Ambiente=Produccion" },
  { parametro: "VM SKUs permitidos", valorSugerido: "Standard_B2s, Standard_D2s_v5, Standard_D4s_v5", aplicaA: "Allowed VM SKUs", notas: "Definir por ambiente: dev/test/prod.", prioridad: "Media", ejemplo: "Standard_D2s_v5" },
  { parametro: "Resource types no permitidos", valorSugerido: "Servicios no aprobados por arquitectura", aplicaA: "Not allowed resource types", notas: "Mantener catálogo formal de servicios restringidos.", prioridad: "Alta", ejemplo: "Microsoft.Databricks/workspaces" },
  { parametro: "Efecto inicial", valorSugerido: "Audit", aplicaA: "Varias", notas: "Útil para levantamiento inicial sin afectar operación.", prioridad: "Media", ejemplo: "Audit" },
  { parametro: "Efecto final", valorSugerido: "Deny / Modify", aplicaA: "Varias", notas: "Aplicar después de validar excepciones.", prioridad: "Alta", ejemplo: "Deny" },
];
