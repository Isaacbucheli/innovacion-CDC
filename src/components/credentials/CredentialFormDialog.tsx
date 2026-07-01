import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCredential } from "@/lib/api";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Alta de credencial Azure. El client_secret sólo se ingresa aquí y viaja al backend
// (Key Vault); nunca se muestra ni se prellena.
export default function CredentialFormDialog({ clientId, open, onOpenChange, onSaved }: {
  clientId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [tenant, setTenant] = useState("");
  const [appClient, setAppClient] = useState("");
  const [secret, setSecret] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() { setName(""); setTenant(""); setAppClient(""); setSecret(""); setExpires(""); }

  async function save() {
    if (!name.trim() || !tenant.trim() || !appClient.trim() || !secret) {
      toast.error("Nombre, Tenant ID, App Client ID y Secret son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      const res = await createCredential({
        client_id: clientId, credential_name: name.trim(), tenant_id: tenant.trim(),
        app_client_id: appClient.trim(), client_secret: secret,
        secret_expires_at: expires ? new Date(expires).toISOString() : null,
      });
      if (res.validation?.success) toast.success("Credencial creada y validada correctamente.");
      else toast.warning(`Credencial creada, pero la validación falló: ${res.validation?.error ?? "revisa los datos"}`);
      reset(); onOpenChange(false); onSaved();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva credencial Azure</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="cn">Nombre</Label>
            <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. App Registration BANISI" /></div>
          <div className="space-y-1"><Label htmlFor="tn">Tenant ID</Label>
            <Input id="tn" value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" /></div>
          <div className="space-y-1"><Label htmlFor="ac">App Client ID</Label>
            <Input id="ac" value={appClient} onChange={(e) => setAppClient(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" /></div>
          <div className="space-y-1"><Label htmlFor="cs">Client Secret</Label>
            <Input id="cs" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Valor del secreto del App Registration" />
            <p className="text-xs text-muted-foreground">Se guarda cifrado en Key Vault; no se vuelve a mostrar.</p></div>
          <div className="space-y-1"><Label htmlFor="ex">Vence el (opcional)</Label>
            <Input id="ex" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Crear credencial"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
