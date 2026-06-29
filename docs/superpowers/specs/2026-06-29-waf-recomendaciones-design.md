# Spec — WAF Recomendaciones (núcleo, slice 1)

**Fecha:** 2026-06-29
**Módulo:** Matriz mejoras Azure → Recomendaciones, en el front nuevo (piloto `innovacion-CDC`, React + Vite + shadcn).
**Estado:** diseño aprobado por el usuario; pendiente de plan de implementación.

## Contexto

WAF es el módulo más grande del sistema (4 sub-vistas). Se migra **una sub-vista a la vez**; cada una es su propio ciclo spec → plan → implementación. Este spec cubre **solo** la primera sub-vista: **Recomendaciones (núcleo)**, en modo *read + seguimiento*.

Hallazgo clave de la exploración: **el backend .NET ya tiene WAF completamente migrado** (Fase 4: controllers `WafController`/`WafAdminController`, stores SQL, schema, servicios de IA/Advisor/Excel/dedup). El front nuevo habla **solo** con el .NET (`apiBase()` → `app-optimizacion-costos-api-dotnet…`, en DEV proxy `/api`; ver `STACK-NUEVO.md`). Por lo tanto este slice es **puramente frontend**: la API ya existe.

### Riesgos / supuestos a verificar en implementación
- Que el .NET apuntado por el piloto esté **desplegado** con los controllers WAF.
- Que la BD `-valida` tenga **datos WAF** de al menos un cliente para probar en vivo.
- Que las rutas/forma de respuesta del `WafController` .NET coincidan con las del FastAPI mapeadas aquí (validar contra `/openapi`/Swagger del .NET al implementar).

## Alcance

### Dentro (slice 1)
- Selector de cliente (reusa `ClientCombobox`) + **logo del cliente** en el header.
- **KPIs de resumen** (4): recomendaciones activas, recursos afectados, avance promedio, última ingesta. Fuente: `GET /waf/clients/{id}/summary` (+ `sections` para avance).
- **Tarjetas de los 5 pilares** (`sections`), **clicables** → filtran la tabla por pilar (sincronizadas con los chips de filtro).
- **Tabla de recomendaciones** (TanStack + `DataTablePagination`): columnas código (`matrix_code`), pilar, ámbito, impacto, recursos, avance. Orden por columnas. Filtros: pilar (chips/tarjetas) + rango de avance. Clic en fila → abre el detalle.
- **Detalle en Dialog centrado (modal)** con 5 secciones:
  1. **Resumen** (read): beneficio, acción cliente, acción BIT.
  2. **Seguimiento editable** (write): % avance, fecha inicio, esfuerzo BIT, prioridad, bitácora de ejecución, notas internas → `PUT …/tracking`.
  3. **Recursos asociados** (read): tabla nombre/tipo/grupo/suscripción/estado.
  4. **Comentarios** (read + write): timeline + agregar → `POST …/comments`.
  5. **Historial de cambios** (read): auditoría campo/antes/después/quién/cuándo.

### Fuera (slices futuros, NO en este spec)
Advisor-sync + polling, Excel import/export + preview, consolidar duplicados, descartar recomendación (DELETE), Validación inteligente (IA, admin), Costo referencial Azure, Historial de ingestas (vista aparte), Advisor score por pilar.

## Arquitectura (sigue el patrón del módulo de costos del piloto)

### Capa de datos — `src/lib/api.ts` (nuevas funciones, todas a `apiBase()`/.NET)
- `getWafSummary(clientId)` → `GET /waf/clients/{id}/summary`
- `getWafSections(clientId)` → `GET /waf/clients/{id}/sections` (siempre 5)
- `getWafRecommendations(clientId, pillar?)` → `GET /waf/clients/{id}/recommendations[?pillar=]`
- `getWafRecommendation(clientId, canonicalId)` → `GET …/recommendations/{cid}`
- `getWafResources(clientId, canonicalId)` → `GET …/recommendations/{cid}/resources`
- `getWafComments(clientId, canonicalId)` → `GET …/recommendations/{cid}/comments`
- `getWafHistory(clientId, canonicalId)` → `GET …/recommendations/{cid}/history`
- `updateWafTracking(clientId, canonicalId, body)` → `PUT …/recommendations/{cid}/tracking`
- `addWafComment(clientId, canonicalId, text)` → `POST …/recommendations/{cid}/comments`
- `listClients()` ya existe.

Tipos nuevos en `src/types.ts`: `WafSection`, `WafRecommendation`, `WafRecommendationDetail`, `WafResource`, `WafComment`, `WafHistoryEntry`, `WafTrackingUpdate`, `WafSummary`.

### Lógica pura — `src/lib/waf.ts` (+ `waf.test.ts`)
- `PILLAR_META`: 1–5 → `{ name, icon, color }` (Seguridad, Confiabilidad, Rendimiento, Excelencia operacional, Costos — confirmar numeración real contra el backend).
- `IMPACT_META`: High/Medium/Low → label + clase de chip (tokens `bg-danger`/`bg-warning`/`bg-success`).
- `formatProgress`, helpers de orden numérico para columnas nullables (recursos/avance).
- `filterRecommendations(recs, { pillar, progressRange })` (filtrado client-side).
- `validateTracking(form)`: % 0–100, fecha válida; devuelve errores por campo.

### Hook — `src/hooks/useWaf.ts`
Al seleccionar cliente carga `summary` + `sections` + `recommendations` en paralelo; expone `{ summary, sections, recommendations, loading, error, reload }`.

### Componentes — `src/components/waf/`
- `WafPage`: orquesta selector de cliente + logo + KPIs + tarjetas + tabla + Dialog. Maneja cliente activo, filtros y la recomendación abierta.
- `WafClientHeader`: identidad del cliente — `ClientLogo` (size ~32, redondeado) + nombre, junto al `ClientCombobox`. Si no hay logo, el fallback de iniciales de `ClientLogo` aplica.
- `WafKpis`: 4 KPIs (count-up, estilo `CostsKpis`).
- `PillarCards`: 5 tarjetas (icono+color por pilar, conteo, barra de avance, "Alta N"); clic → setea filtro de pilar.
- `WafDataTable`: TanStack + `DataTablePagination` (10/pág, 10/20/50/100), orden, chips de filtro de pilar, filtro de avance; fila clicable.
- `WafDetailDialog`: `Dialog` centrado; al abrir carga detail+resources+comments+history en paralelo; contiene:
  - `TrackingForm` (react-hook-form + zod o validación con `validateTracking`; submit → `updateWafTracking`).
  - `ResourcesTable` (read).
  - `Comments` (lista + textarea + enviar → `addWafComment`).
  - `History` (read).

### Navegación + tema
- `App.tsx`: agrega sección `"waf"` al switch; pasa `onNavigate`.
- `AppShell`: el ítem **Recomendaciones** (hoy placeholder `soon`) pasa a `section: "waf"` y navega; el grupo "Matriz mejoras Azure" abre cuando está activo.
- Todo con **tokens semánticos** (claro/oscuro ya integrado). Colores de pilar via clases utilitarias que funcionen en ambos modos.

### Gating de roles
- Lectura (tabla, detalle, recursos, comentarios, historial): **todos** los roles.
- Escrituras (guardar seguimiento, agregar comentario): `canEdit()` (admin/consultor). El `lector` ve el form/historial pero sin botones de guardar/enviar.

## Flujo de datos
1. Cliente seleccionado → `useWaf` carga summary+sections+recommendations (paralelo) con `BusyOverlay` mientras carga.
2. Filtros (pilar via chips/tarjetas, rango de avance) → client-side sobre `recommendations`.
3. Clic en fila → abre `WafDetailDialog`, que carga detail+resources+comments+history en paralelo.
4. Guardar seguimiento → `PUT tracking` → toast (sonner) + refresca el detalle y la fila en la tabla.
5. Agregar comentario → `POST comments` → refresca comentarios.

## Manejo de errores
- `request()` ya maneja 401 (limpia sesión + reload).
- Errores de carga/escritura → toast de error + estado vacío legible en tablas.
- `BusyOverlay` bloquea durante cargas y escrituras (convención del piloto).

## Testing
- `lib/waf.test.ts`: `PILLAR_META`/`IMPACT_META`, `filterRecommendations`, `validateTracking`, helpers de orden.
- Componentes (vitest + testing-library, api mockeada):
  - `WafDataTable`: render de filas, orden por columna, filtro por pilar.
  - `PillarCards`: clic en tarjeta dispara el filtro.
  - `TrackingForm`: submit válido llama `updateWafTracking`; inválido muestra error y no llama.
- `npm run build` (tsc+vite) y `npm run lint` verdes; suite completa verde.

## Entregable
La sub-vista Recomendaciones navegable desde el menú, contra el backend .NET, con detalle completo de las 5 secciones y seguimiento editable, alineada al tema claro/oscuro y al brandbook. Sin tocar el front de producción ni el módulo de costos del piloto.
