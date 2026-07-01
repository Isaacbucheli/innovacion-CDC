import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { login } from "@/lib/api";

export default function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
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
          {/* Logo centrado (conmuta con el tema) */}
          <div className="flex justify-center">
            <img src="/business-it-logo.webp" alt="Business IT" className="h-10 w-auto object-contain dark:hidden" />
            <img src="/business-it-logo-white-green.webp" alt="" aria-hidden className="h-10 w-auto object-contain hidden dark:block" />
          </div>
          <p className="mt-3 mb-6 text-center text-sm text-muted-foreground">Plataforma de optimización Azure — ingresa con tu cuenta.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="username" className="h-11 pl-9 focus-visible:ring-primary" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="current-password" className="h-11 pl-9 focus-visible:ring-primary" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-11" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</Button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">© Business IT · Uso interno</p>
        </div>
      </Card>
    </div>
  );
}
