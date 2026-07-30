# Seguridad — Frontend Plataforma CDC

Postura de seguridad del sitio (Azure Static Web App). Las cabeceras HTTP son la
principal superficie de defensa del front, ya que es una SPA estática sin servidor
propio por-request. La fuente de verdad de las cabeceras es
[`staticwebapp.config.template.json`](staticwebapp.config.template.json);
`staticwebapp.config.json` se genera a partir de ella en el build (inyectando el host
de la API) y no se versiona.

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

## Endurecimiento de `style-src` (hallazgo ZAP cerrado)

**Estado:** **corregido y desplegado.** La CSP ya no incluye `'unsafe-inline'` en
`style-src`.
**Detectado por:** OWASP ZAP 2.17.0 (escaneo del 2026-07-15), alerta "CSP: style-src
unsafe-inline" (riesgo Medio).

**Por qué existía:** Radix UI (dialog, dropdown, popover, select, tabs), sonner y
cmdk inyectan estilos en tiempo de ejecución con valores dinámicos. Los *nonces* de
CSP no aplican a atributos `style=""`; los *hashes* no sirven para valores dinámicos;
y un Static Web App estático no tiene servidor por-respuesta para emitir nonces.

**Cómo se resolvió:** el CSSOM no está gobernado por `style-src`, así que cada
inyección se redirigió a una forma que la CSP sí permite.

| Origen del estilo | Solución |
|---|---|
| `react-style-singleton` (scroll-lock de Radix, vía `react-remove-scroll`) | alias a un shim propio que usa `adoptedStyleSheets` — [`src/shims/react-style-singleton.ts`](src/shims/react-style-singleton.ts) |
| `sonner` (`__insertCSS`) | plugin de Vite `csp-safe-sonner` que reescribe la inyección a `adoptedStyleSheets`, con guarda que **falla el build** si sonner sube de versión — [`vite.config.ts`](vite.config.ts) |
| `@radix-ui/react-select` (oculta la scrollbar del viewport) | el CSS es estático: se sirve desde el bundle — [`src/index.css`](src/index.css) |
| `next-themes` (`disableTransitionOnChange`) | opción retirada; la supresión de transiciones se hace con la clase `.theme-switching` (CSS del bundle) — [`src/components/ThemeToggle.tsx`](src/components/ThemeToggle.tsx) |

Los estilos inline **dinámicos** que React aplica con el prop `style` (posición de
los popovers de Radix, dimensiones de Recharts) no necesitan `'unsafe-inline'`:
React los asigna por CSSOM, no escribiendo el atributo `style`. Lo que la CSP
bloquea son los elementos `<style>` creados en runtime y los atributos `style=""`
escritos con `setAttribute`.

**Verificado** (sesión autenticada contra producción, escuchando
`securitypolicyviolation` en vivo): Select y DropdownMenu de Radix abren, se
posicionan y se estilizan; el CSS de sonner y el del scroll-lock están en
`adoptedStyleSheets`; el modo oscuro aplica; siete gráficos Recharts renderizan con
dimensiones reales y los colores de marca.

### Ruido residual conocido

`@radix-ui/react-select` sigue **intentando** insertar su `<style>` cada vez que se
abre un Select, y el navegador lo sigue bloqueando: eso deja una violación
`style-src-elem` en la consola. El efecto visual está cubierto por el CSS estático
equivalente, así que no hay impacto funcional. No se parchea la librería porque un
parche por regex sobre su bundle es frágil y el único beneficio sería una consola
más limpia. ZAP no reporta esto: solo evalúa cabeceras.

## Alcance de los escaneos y limitaciones

El escaneo ZAP (2026-07-15 y 2026-07-17) cubrió **solo el shell estático** (`/`,
`/robots.txt`, `/sitemap.xml`). Al ser una SPA, el spider estándar no navegó las
rutas del cliente, **no probó login, formularios ni la API**. No debe leerse como un
pentest de la lógica de la aplicación. El recorrido autenticado de la sección
anterior validó el comportamiento de la CSP, no la autorización ni la lógica.

**Próximo paso recomendado:** escaneo **autenticado** (Ajax Spider + contexto con
sesión) y escaneo directo contra la **API .NET**, que es donde vive la superficie de
riesgo real (autorización, IDOR, inyección).

## Reportar una vulnerabilidad

Contactar al equipo por los canales internos de Business IT. No abrir issues públicos
con detalles de vulnerabilidades.
