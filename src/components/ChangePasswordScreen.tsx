import { useState } from "react";
import { KeyRound, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { changePassword, logout } from "@/lib/api";

// Pantalla forzada tras el login cuando la contraseña es temporal (must_change_password=1):
// el usuario debe definir su contraseña definitiva antes de entrar a la plataforma.
export default function ChangePasswordScreen({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (next === current) { setError("La nueva contraseña debe ser distinta a la temporal."); return; }
    if (next !== confirm) { setError("La confirmación no coincide con la nueva contraseña."); return; }
    setBusy(true);
    try {
      // WEB-12: el backend revoca las sesiones anteriores (incluido el token con el que se
      // hace esta llamada) y devuelve un reemplazo, que changePassword ya deja persistido.
      await changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-sm overflow-hidden p-0">
        {/* Barra de acento de marca */}
        <div className="h-1.5 bg-primary" />
        <div className="p-7">
          <div className="flex justify-center">
            <img src="/business-it-logo.webp" alt="Business IT" className="h-10 w-auto object-contain dark:hidden" />
            <img src="/business-it-logo-white-green.webp" alt="" aria-hidden className="h-10 w-auto object-contain hidden dark:block" />
          </div>
          <div className="mt-4 mb-6 text-center">
            <h1 className="text-base font-semibold flex items-center justify-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" /> Cambia tu contraseña
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu contraseña actual es temporal. Define una nueva para continuar.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Contraseña temporal</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="current" type="password" autoComplete="current-password" className="h-11 pl-9 focus-visible:ring-primary" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="next" type="password" autoComplete="new-password" className="h-11 pl-9 focus-visible:ring-primary" value={next} onChange={(e) => setNext(e.target.value)} required placeholder="Mínimo 8 caracteres" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nueva contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirm" type="password" autoComplete="new-password" className="h-11 pl-9 focus-visible:ring-primary" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />Guardando…</> : "Guardar y continuar"}
            </Button>
          </form>

          <button type="button" onClick={logout} className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
            Salir e ingresar con otra cuenta
          </button>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">© Business IT · Uso interno</p>
        </div>
      </Card>
    </div>
  );
}
