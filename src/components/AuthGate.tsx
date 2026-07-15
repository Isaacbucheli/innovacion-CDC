import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import LoginScreen from "@/components/LoginScreen";
import ChangePasswordScreen from "@/components/ChangePasswordScreen";
import { me } from "@/lib/api";
import { clearSession, getToken, setEmail, setModulePerms, setSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";

// Pantalla breve mientras se valida el token guardado contra /auth/me: misma tarjeta
// de marca del login para que la transición no "salte" entre estilos distintos.
function VerifyingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        <div className="h-1.5 bg-primary" />
        <div className="p-7 flex flex-col items-center gap-4">
          <img src="/business-it-logo.webp" alt="Business IT" className="h-10 w-auto object-contain dark:hidden" />
          <img src="/business-it-logo-white-green.webp" alt="" aria-hidden className="h-10 w-auto object-contain hidden dark:block" />
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
          <div className="text-center">
            <p className="text-sm font-medium">Verificando tu sesión…</p>
            <p className="mt-1 text-xs text-muted-foreground">Un momento, estamos preparando la plataforma.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  // "change" = sesión válida pero con contraseña temporal: se fuerza el cambio antes de entrar.
  const [state, setState] = useState<"checking" | "in" | "out" | "change">("checking");

  async function check() {
    if (!getToken()) { setState("out"); return; }
    try {
      const u = await me();
      setSession(getToken(), u.role, u.full_name || u.email || "Usuario BIT");
      setEmail(u.email || "");
      setModulePerms(Object.fromEntries(
        (u.modules ?? []).map((m) => [m.key, { can_view: m.can_view, can_edit: m.can_edit }]),
      ));
      setState(u.must_change_password ? "change" : "in");
    } catch {
      clearSession();
      setState("out");
    }
  }
  useEffect(() => { check(); }, []);

  if (state === "checking") return <VerifyingScreen />;
  if (state === "out") return <LoginScreen onAuthed={(mustChange) => { if (mustChange) setState("change"); else check(); }} />;
  if (state === "change") return <ChangePasswordScreen onChanged={() => check()} />;
  return <>{children}</>;
}
