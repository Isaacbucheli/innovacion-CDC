// Reemplazo drop-in de `react-style-singleton` (dependencia transitiva de Radix
// vía `react-remove-scroll` / `react-remove-scroll-bar`).
//
// PROBLEMA: el paquete original inyecta un elemento <style> en <head> en runtime
// (para el scroll-lock de diálogos/popovers). El contenido es DINÁMICO (incluye el
// ancho del scrollbar calculado, 0/15/17px, y un id único por instancia), por lo
// que no se puede cubrir con un hash de CSP ni con un nonce (Azure Static Web Apps
// sirve archivos estáticos y no puede emitir un nonce por-respuesta).
//
// SOLUCIÓN: aplicamos exactamente el mismo CSS pero vía CSSOM
// (constructable stylesheets / adoptedStyleSheets). El CSSOM NO está gobernado por
// CSP `style-src`, así que podemos quitar `'unsafe-inline'` del CSP manteniendo el
// comportamiento de Radix byte por byte. Se conecta con un alias en vite.config.ts.
//
// Se preservan las 3 exportaciones y la semántica (singleton con conteo de
// referencias: se agrega al montar la primera instancia, se quita al desmontar la
// última) del paquete original 2.2.3.
import * as React from "react";

type Singleton = { add: (style: string) => void; remove: () => void };

const canUseCSSOM =
  typeof document !== "undefined" &&
  typeof CSSStyleSheet !== "undefined" &&
  "replaceSync" in CSSStyleSheet.prototype &&
  "adoptedStyleSheets" in document;

export const stylesheetSingleton = (): Singleton => {
  let counter = 0;
  let sheet: CSSStyleSheet | null = null;
  let fallback: HTMLStyleElement | null = null;

  return {
    add(style: string) {
      if (counter === 0) {
        if (canUseCSSOM) {
          try {
            sheet = new CSSStyleSheet();
            sheet.replaceSync(style);
            const doc = document as Document & { adoptedStyleSheets: CSSStyleSheet[] };
            doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
          } catch {
            sheet = null;
          }
        }
        if (!sheet && typeof document !== "undefined") {
          // Fallback solo para navegadores muy antiguos (pre-2023) sin
          // adoptedStyleSheets. Bajo un CSP estricto este <style> se bloquea y el
          // efecto degrada de forma inocua; los navegadores modernos nunca llegan aquí.
          fallback = document.createElement("style");
          fallback.appendChild(document.createTextNode(style));
          (document.head || document.getElementsByTagName("head")[0]).appendChild(fallback);
        }
      }
      counter++;
    },
    remove() {
      counter--;
      if (counter === 0) {
        if (sheet) {
          const doc = document as Document & { adoptedStyleSheets: CSSStyleSheet[] };
          doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
          sheet = null;
        }
        if (fallback) {
          fallback.parentNode?.removeChild(fallback);
          fallback = null;
        }
      }
    },
  };
};

export const styleHookSingleton = () => {
  const sheet = stylesheetSingleton();
  return (styles: string, isDynamic?: boolean) => {
    React.useEffect(() => {
      sheet.add(styles);
      return () => sheet.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [styles && isDynamic]);
  };
};

export const styleSingleton = () => {
  const useStyle = styleHookSingleton();
  const Sheet: React.FC<{ styles: string; dynamic?: boolean }> = ({ styles, dynamic }) => {
    useStyle(styles, dynamic);
    return null;
  };
  return Sheet;
};
