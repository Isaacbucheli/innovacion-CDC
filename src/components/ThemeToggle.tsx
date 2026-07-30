import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// Conmutador de modo claro/oscuro. Vive en el sidebar; usa next-themes (que
// aplica la clase .dark en <html> y persiste la preferencia). Se renderiza
// solo tras montar para evitar el desajuste de hidratación de next-themes.
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  // Suprime la animación de colores durante el cambio de tema. No usamos
  // `disableTransitionOnChange` de next-themes porque inyecta un <style> en
  // runtime y la CSP lo bloquea (`style-src 'self'`); en su lugar prendemos una
  // clase con CSS ya presente en el bundle (ver index.css) y la apagamos en el
  // siguiente frame, cuando los colores nuevos ya se pintaron. Un cambio de tema
  // disparado por el sistema operativo (enableSystem) no pasa por aquí y sí
  // animará: es un caso de borde aceptado a cambio de no violar la CSP.
  const toggle = () => {
    const root = document.documentElement;
    const clear = () => root.classList.remove("theme-switching");
    root.classList.add("theme-switching");
    setTheme(next);
    // Dos frames: al segundo, el navegador ya pintó los colores nuevos sin animar.
    requestAnimationFrame(() => requestAnimationFrame(clear));
    // Red de seguridad: en una pestaña oculta el navegador no corre
    // requestAnimationFrame, así que la clase se quedaría pegada y la app entera
    // perdería sus transiciones hasta el siguiente cambio de tema. `clear` es
    // idempotente, así que gana el que dispare primero.
    window.setTimeout(clear, 150);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Cambiar a modo ${next === "dark" ? "oscuro" : "claro"}`}
      title={`Modo ${next === "dark" ? "oscuro" : "claro"}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
