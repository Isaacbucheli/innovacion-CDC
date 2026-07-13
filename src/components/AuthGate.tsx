import { useEffect, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import ChangePasswordScreen from "@/components/ChangePasswordScreen";
import { me } from "@/lib/api";
import { clearSession, getToken, setSession } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  // "change" = sesión válida pero con contraseña temporal: se fuerza el cambio antes de entrar.
  const [state, setState] = useState<"checking" | "in" | "out" | "change">("checking");

  async function check() {
    if (!getToken()) { setState("out"); return; }
    try {
      const u = await me();
      setSession(getToken(), u.role, u.full_name || u.email || "Usuario BIT");
      setState(u.must_change_password ? "change" : "in");
    } catch {
      clearSession();
      setState("out");
    }
  }
  useEffect(() => { check(); }, []);

  if (state === "checking") return <div className="p-8"><Skeleton className="h-8 w-48" /></div>;
  if (state === "out") return <LoginScreen onAuthed={(mustChange) => setState(mustChange ? "change" : "in")} />;
  if (state === "change") return <ChangePasswordScreen onChanged={() => setState("in")} />;
  return <>{children}</>;
}
