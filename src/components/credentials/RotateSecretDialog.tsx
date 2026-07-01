import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { rotateCredentialSecret } from "@/lib/api";
import type { Credential } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Rotación del secreto de una credencial. Nunca se prellena el secreto anterior.
export default function RotateSecretDialog({ credential, open, onOpenChange, onSaved }: {
  credential: Credential | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!credential) return;
    if (!secret) { toast.error("El nuevo secreto es obligatorio."); return; }
    setSaving(true);
    try {
      const res = await rotateCredentialSecret(credential.credential_id, {
        client_secret: secret, secret_expires_at: expires ? new Date(expires).toISOString() : null,
      });
      if (res.validation?.success) toast.success("Secreto rotado y validado correctamente.");
      else toast.warning(`Secreto rotado, pero la validación falló: ${res.validation?.error ?? ""}`);
      setSecret(""); setExpires(""); onOpenChange(false); onSaved();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSecret(""); setExpires(""); } onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Rotar secreto{credential ? ` · ${credential.credential_name}` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="rs">Nuevo Client Secret</Label>
            <Input id="rs" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Nuevo valor del secreto" />
            <p className="text-xs text-muted-foreground">Reemplaza el secreto en Key Vault y revalida contra Azure.</p></div>
          <div className="space-y-1"><Label htmlFor="rx">Vence el (opcional)</Label>
            <Input id="rx" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Rotando…" : "Rotar secreto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
