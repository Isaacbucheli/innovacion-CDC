import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./index.css";
import App from "./App";

// Sin `disableTransitionOnChange`: esa opción de next-themes inyecta un <style>
// en runtime y la CSP (`style-src 'self'`, sin 'unsafe-inline') lo bloquea, así
// que no suprimía nada y solo ensuciaba la consola. La supresión de transiciones
// ahora la hace ThemeToggle con la clase `.theme-switching` (ver index.css).
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <App />
    </ThemeProvider>
  </StrictMode>
);
