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
| `Cross-Origin-Opener-Policy` | `same-origin` — corta la relación con ventanas de otro origen. |
| `Cross-Origin-Resource-Policy` | `same-origin` — impide que otros sitios embeban nuestros recursos. |
| `Cross-Origin-Embedder-Policy` | `require-corp` — aislamiento de origen (ZAP 90004). Seguro aquí porque **todas** las subcargas son del propio origen, `data:` o `blob:`; si alguna vez se embebe una imagen o script de otro host, hay que darle CORP o bajar a `credentialless`. |
| `X-Robots-Tag` | `noindex, nofollow` — herramienta interna, no debe indexarse. |
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
| `@radix-ui/react-select` (oculta la scrollbar del viewport) | el CSS es estático: se sirve desde el bundle en [`src/index.css`](src/index.css) y el plugin `csp-safe-radix-select` elimina la inyección, con la misma guarda de build — [`vite.config.ts`](vite.config.ts) |
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

### Sin violaciones residuales

No queda ningún `<style>` inyectado en runtime: la consola del navegador cierra en
**cero** violaciones de CSP recorriendo la app autenticada. Los cuatro orígenes de la
tabla están cubiertos y los tres parches (shim + dos plugins de Vite) tienen guardas
que **fallan el build** si la librería cambia, de modo que una regresión se detecta
en CI y no en producción.

### Si se agrega una dependencia nueva

Cualquier librería que inyecte `<style>` en runtime volverá a fallar bajo este CSP.
Para detectarlo sin abrir el navegador, buscar en las dependencias de runtime:

- un `<style>` como elemento de React: `jsx("style"` / `createElement("style"`
- una inyección imperativa: `document.createElement("style")`

Si el CSS de la librería es **estático**, lo más simple es servirlo desde
`src/index.css` y eliminar la inyección con un plugin. Si es **dinámico**, hay que
enrutarlo a CSSOM (`adoptedStyleSheets`), como el shim y el parche de sonner. Los
estilos que React aplica con el prop `style` no requieren nada.

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
