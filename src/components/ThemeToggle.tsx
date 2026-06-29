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

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Cambiar a modo ${next === "dark" ? "oscuro" : "claro"}`}
      title={`Modo ${next === "dark" ? "oscuro" : "claro"}`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
