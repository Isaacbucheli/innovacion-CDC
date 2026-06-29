# Spec — WAF Recomendaciones · Acciones (Slice A)

**Fecha:** 2026-06-29
**Módulo:** Matriz mejoras Azure → Recomendaciones (front nuevo `innovacion-CDC`), barra de acciones.
**Estado:** diseño aprobado por el usuario (mockups: toolbar + flujos + Consultar Advisor con selector). Pendiente plan.

## Contexto
Continúa la vista WAF Recomendaciones (núcleo desplegado, merges `c2cad9e`/`ca7e143`). Agrega la **barra de acciones** del header, espejo del módulo de costos. Se divide en dos slices (decisión del usuario):
- **Slice A (este):** Exportar Excel · Importar Advisor CSV · Consultar Advisor (con selector de suscripciones).
- **Slice B (después):** Importar matriz Excel (preview/aplicar) · Consolidar duplicados · (Actualizar Advisor Score).

## Contrato backend .NET (verificado 2026-06-29)
- `GET /waf/clients/{id}/export-excel` → archivo `.xlsx` (binario).
- `POST /waf/clients/{id}/ingestions` → multipart, campo **`file`** (CSV de Advisor). **No** tiene parámetro de reemplazo. Devuelve el resultado de la ingesta.
- `GET /azure/subscriptions?client_id={id}` → `SubscriptionListItem[]` con `subscription_id`, `subscription_name`, `is_active`, `is_managed` (entre otros), snake_case.
- `POST /waf/clients/{id}/advisor-sync` → body `{ subscriptions?: string[], timeout_seconds_per_subscription?: number }` (rango 60–1800, default 600). **Corre síncrono** (no background): la respuesta llega al terminar con `{ run_id, status, subscriptions_queued, subscriptions_processed, subscriptions_failed, new_recommendations, new_findings, resolved_findings, merged_duplicates, ai_processed, ai_errors, warnings, timeout_seconds_per_subscription }`. ⇒ **No hace falta polling.**

## Alcance

### Dentro (Slice A)
- **Barra de acciones** en el tope del body de `WafPage` (arriba de los KPIs), patrón de costos:
  - `Consultar Advisor` (botón primario verde) · `Exportar Excel` (outline) · `Opciones ▾` (dropdown; en Slice A contiene **Importar Advisor CSV**).
  - Deshabilitada si no hay cliente. **Gating:** escrituras (Consultar Advisor, Importar CSV) → `canEdit()` (admin/consultor); Exportar Excel → todos.
- **Exportar Excel:** `downloadFromApi('/waf/clients/{id}/export-excel', nombreArchivo)` con `BusyOverlay`; toast en error. Sin diálogo.
- **Importar Advisor CSV:** diálogo con `<input type="file" accept=".csv">` → subida multipart (campo `file`) → `BusyOverlay` → toast (con conteos si vienen) → `reloadData()`. (Sin checkbox de reemplazo: el endpoint no lo soporta.)
- **Consultar Advisor:** diálogo →
  1. al abrir, `GET /azure/subscriptions?client_id=` y filtra `is_active && is_managed`; multi-select (todas seleccionadas por defecto).
  2. `POST advisor-sync` con `{ subscriptions: idsSeleccionados, timeout_seconds_per_subscription: 600 }`. Requiere ≥1 suscripción seleccionada.
  3. `BusyOverlay` bloqueante e **indeterminado** ("Consultando Advisor…", aviso de no cerrar) mientras la llamada está en curso (puede tardar).
  4. al responder, toast con resumen (`subscriptions_processed`, `new_recommendations`, `resolved_findings`) → `reloadData()` (refresca KPIs, pilares con Score, tabla).

### Fuera (Slice B y otros)
Importar matriz Excel (preview/aplicar), Consolidar duplicados, Actualizar Advisor Score (admin), vista Historial de ingestas, descartar recomendación.

## Arquitectura (sigue patrón de costos)
- **`src/lib/api.ts`** (nuevas funciones, todas a `apiBase()`/.NET):
  - `listClientSubscriptions(clientId)` → `GET /azure/subscriptions?client_id={id}`
  - `uploadWafIngestion(clientId, file)` → `POST /waf/clients/{id}/ingestions` (multipart, igual patrón que `uploadClientLogo`)
  - `runWafAdvisorSync(clientId, body)` → `POST /waf/clients/{id}/advisor-sync`
  - Exportar reusa `downloadFromApi` (ya existe).
- **`src/types.ts`**: `ClientSubscription` (subscription_id, subscription_name, is_active, is_managed), `WafAdvisorSyncRequest` ({ subscriptions, timeout_seconds_per_subscription }), `WafAdvisorSyncResult` (campos de la respuesta).
- **`src/lib/waf.ts`** (+ tests): `advisorSyncSummary(result)` → string en español para el toast.
- **`src/components/waf/`:**
  - `WafActions.tsx`: la barra (botones + `DropdownMenu` "Opciones" estilo `OptionsMenu` de costos); maneja estado de diálogos y `busy`; recibe `clientId`, `onChanged` (=reloadData), y un setter de `busy`.
  - `AdvisorSyncDialog.tsx`: carga suscripciones al abrir, multi-select, submit → `runWafAdvisorSync`.
  - `ImportCsvDialog.tsx`: file input + submit → `uploadWafIngestion`.
- **`src/components/waf/WafPage.tsx`:** renderiza `<WafActions … />` en el tope del body; agrega estado `busy` para acciones y lo une al `BusyOverlay` (`show={waf.loading || waf.dataLoading || busy}` con título dinámico).

## Flujo y errores
- Toda escritura/descarga muestra `BusyOverlay` (convención del piloto) y bloquea; resultado vía toast (sonner). Errores → `toast.error(mensaje)`; `request()` ya maneja 401.
- Tras Consultar Advisor / Importar CSV exitosos → `reloadData()` recarga summary+sections+recommendations+scores.

## Gating
- `Consultar Advisor` e `Importar Advisor CSV`: visibles/habilitados solo si `canEdit()`.
- `Exportar Excel`: todos los roles.

## Testing
- `lib/waf.test.ts`: `advisorSyncSummary` arma el texto esperado.
- Componentes (vitest + testing-library, api mockeada):
  - `WafActions`: renderiza el primario + Exportar + Opciones; oculta acciones de escritura para `lector` (mock `canEdit`).
  - `AdvisorSyncDialog`: al abrir lista suscripciones (filtra is_active&&is_managed); submit con selección llama `runWafAdvisorSync` con los ids correctos; bloquea submit si 0 seleccionadas.
  - `ImportCsvDialog`: submit con archivo llama `uploadWafIngestion`.
- `npm run build` + `npm run lint` verdes; suite completa verde.

## Riesgos / notas
- `advisor-sync` síncrono puede tardar (varias subs × hasta 600 s); el overlay es indeterminado. Conocido y aceptado (igual que el "Calcular costos" por lotes). Si en pruebas reales diera timeout de gateway, se reevaluaría pasar a background+polling en un slice posterior.
- Verificar en implementación el nombre exacto del campo multipart (`file`) y la forma del resultado de `ingestions` para el conteo del toast (si difiere, el toast cae a un mensaje genérico de éxito).
