import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startAzureUserSession, getAzureUserSession, disconnectAzureUserSession } from "@/lib/api";
import { pollSession } from "@/lib/lighthouse";
import type { AzureUserSession } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

/**
 * Tarjeta "Cliente temporal (Lighthouse)": conecta la cuenta Azure del usuario vía
 * device code (sin app registration) para luego elegir clientes delegados a costear.
 * Si el endpoint no existe o el usuario no tiene permiso (404/403), no se muestra nada
 * (feature apagado / fuera de alcance para este usuario).
 */
export default function LighthouseConnectCard({ onConnected }: { onConnected: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [session, setSession] = useState<AzureUserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function probe() {
    setLoading(true);
    getAzureUserSession()
      .then((s) => { if (mounted.current) setSession(s); })
      .catch(() => { if (mounted.current) setHidden(true); })
      .finally(() => { if (mounted.current) setLoading(false); });
  }
  useEffect(() => { probe(); }, []);

  async function connect() {
    setConnecting(true);
    try {
      const s = await startAzureUserSession();
      if (mounted.current) { setSession(s); setDialogOpen(true); }
      const final = await pollSession(async () => {
        const polled = await getAzureUserSession();
        if (mounted.current) setSession(polled);
        return polled;
      });
      if (!mounted.current) return;
      if (final.status === "authenticated") {
        setDialogOpen(false);
        toast.success(final.azure_upn ? `Cuenta Azure conectada como ${final.azure_upn}.` : "Cuenta Azure conectada.");
        onConnected();
      } else {
        setDialogOpen(false);
        toast.error(final.error || "No se pudo completar la autenticación.");
      }
    } catch (e) {
      if (mounted.current) setDialogOpen(false);
      toast.error(msg(e));
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await disconnectAzureUserSession();
      toast.success("Cuenta Azure desconectada.");
      probe();
    } catch (e) { toast.error(msg(e)); }
    finally { if (mounted.current) setDisconnecting(false); }
  }

  async function copyCode() {
    if (!session?.user_code) return;
    try {
      await navigator.clipboard.writeText(session.user_code);
      toast.success("Código copiado.");
    } catch { toast.error("No se pudo copiar el código."); }
  }

  if (hidden || loading) return null;

  const status = session?.status ?? "none";

  return (
    <div className="rounded-xl border p-4 space-y-3">
      {status === "authenticated" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">Cliente temporal (Lighthouse)</div>
            <div className="text-sm text-muted-foreground truncate">
              Conectado como <span className="font-medium text-foreground">{session?.azure_upn}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" onClick={onConnected}>Elegir clientes…</Button>
            <Button size="sm" variant="outline" disabled={disconnecting} onClick={disconnect}>
              {disconnecting ? "Desconectando…" : "Desconectar"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">Cliente temporal (Lighthouse)</div>
            <p className="text-sm text-muted-foreground">
              Conecta tu cuenta Azure para ver los clientes delegados y correr una optimización sin app registration.
            </p>
            {status === "failed" && session?.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{session.error}</p>
            )}
          </div>
          <Button size="sm" disabled={connecting} onClick={connect} className="shrink-0">
            {connecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Conectar mi cuenta Azure
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!connecting) setDialogOpen(o); }}>
        <DialogContent className="max-w-md" busy={connecting}>
          <DialogHeader><DialogTitle>Conectar cuenta Azure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Abre el enlace de verificación e ingresa este código para autorizar el acceso:
            </p>
            {session?.user_code ? (
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-semibold tracking-widest border rounded-lg px-4 py-2 bg-muted">
                  {session.user_code}
                </span>
                <Button type="button" size="icon" variant="outline" onClick={copyCode} title="Copiar código">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            )}
            {session?.verification_url && (
              <p className="text-sm text-center">
                <a href={session.verification_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  {session.verification_url}
                </a>
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Esperando autenticación…
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={connecting} onClick={() => setDialogOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
