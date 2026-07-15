# Seguridad — Frontend Plataforma CDC

Postura de seguridad del sitio (Azure Static Web App). Las cabeceras HTTP son la
principal superficie de defensa del front, ya que es una SPA estática sin servidor
propio por-request. La fuente de verdad de las cabeceras es
[`staticwebapp.config.json`](staticwebapp.config.json).

## Cabeceras configuradas

| Cabecera | Valor / intención |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; scripts, conexiones, imágenes, fuentes y estilos restringidos al propio origen (más el host de la API en `connect-src`). `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — fuerza HTTPS. |
| `X-Content-Type-Options` | `nosniff`. |
| `X-Frame-Options` | `DENY` (redundante con `frame-ancestors 'none'`, cubre escáneres legacy). |
| `Referrer-Policy` | `strict-origin-when-cross-origin`. |
| `Permissions-Policy` | Desactiva geolocation, cámara, micrófono, payment y usb (no se usan). |
| `cache-control` | `no-cache, no-store, must-revalidate` global (shell siempre fresco). Los bundles con hash en `/assets/*` son `immutable` (caché largo). |

## Riesgo residual aceptado

### CSP `style-src 'unsafe-inline'`

**Estado:** aceptado y documentado — **no se corrige.**
**Detectado por:** OWASP ZAP 2.17.0 (escaneo del 2026-07-15), alerta "CSP: style-src
unsafe-inline" (riesgo Medio según ZAP).

**Por qué existe:** la app usa Radix UI (dialog, dropdown, popover, select, tabs),
Recharts, sonner y cmdk, además de estilos inline propios en varios componentes.
Todas estas librerías inyectan estilos inline (`style="…"`) en tiempo de ejecución
con valores dinámicos (transforms y posiciones calculadas según el viewport).

**Por qué no se puede quitar sin romper la UI:**

- Los *nonces* de CSP aplican a etiquetas `<style>` / `<script>`, **no** a atributos
  `style=""` inline, que es justo lo que usan Radix/Recharts.
- Los *hashes* solo sirven para valores estáticos conocidos; los estilos aquí son
  dinámicos, así que no existe un hash estable.
- Un Static Web App estático no tiene servidor por-request para emitir nonces de
  todas formas.

Quitar `'unsafe-inline'` rompería dropdowns, popovers, selects, tabs, gráficos y toasts.

**Por qué el riesgo real es bajo:** `script-src` sigue en `'self'`, por lo que esta
directiva **no habilita XSS de scripts**. El vector restante se limita a inyección
vía CSS, de severidad menor y mitigada por el resto de la CSP (`default-src 'self'`,
`object-src 'none'`, `base-uri 'self'`).

**Revisar si:** se migra a un modelo de estilos sin inline (poco probable con este
stack) o el hosting pasa a tener render/edge por-request que permita nonces.

## Alcance del último escaneo (2026-07-15) y limitaciones

El escaneo ZAP cubrió **solo el shell estático** (`/`, `/robots.txt`, `/sitemap.xml`).
Al ser una SPA, el spider estándar no navegó las rutas del cliente, **no probó login,
formularios ni la API**. No debe leerse como un pentest de la lógica de la aplicación.

**Próximo paso recomendado:** escaneo **autenticado** (Ajax Spider + contexto con
sesión) y escaneo directo contra la **API .NET**, que es donde vive la superficie de
riesgo real (autorización, IDOR, inyección).

## Reportar una vulnerabilidad

Contactar al equipo por los canales internos de Business IT. No abrir issues públicos
con detalles de vulnerabilidades.
