import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import type { ClientAdmin } from "@/types";
import { deleteClientLogo, uploadClientLogo } from "@/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED = ["image/png", "image/jpeg", "image/svg+xml"];
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";

export default function ClientLogoDialog({
  open,
  client,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  client: ClientAdmin | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFile(null);
    setValidationError("");
    setSubmitError("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [client, open]);

  if (!client) return null;

  function onPick(f: File | null) {
    setSubmitError("");
    if (!f) { setFile(null); setValidationError(""); return; }
    // El SVG en algunos navegadores llega con type vacío: validar también por extensión.
    const okType = ACCEPTED.includes(f.type) || /\.(png|jpe?g|svg)$/i.test(f.name);
    if (!okType) {
      setFile(null);
      setValidationError("Formato no admitido. Usa PNG, JPG o SVG.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setValidationError("El archivo supera el máximo de 2 MB.");
      return;
    }
    setValidationError("");
    setFile(f);
  }

  async function onUpload() {
    if (!client || !file) return;
    setBusy(true);
    setSubmitError("");
    try {
      await uploadClientLogo(client.client_id, file);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al subir el logo");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!client) return;
    setBusy(true);
    setSubmitError("");
    try {
      await deleteClientLogo(client.client_id);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al quitar el logo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" busy={busy}>
        <DialogHeader>
          <DialogTitle>Logo de {client.client_name}</DialogTitle>
          <DialogDescription>PNG, JPG o SVG. Tamaño máximo 2 MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="logo_file">Seleccionar archivo</Label>
            <input
              ref={inputRef}
              id="logo_file"
              type="file"
              accept={ACCEPT_ATTR}
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70 file:cursor-pointer"
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
            {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter className="sm:justify-between">
          {client.has_logo ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={onRemove}
            >
              Quitar logo
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" disabled={!file || busy} onClick={onUpload}>
              <Upload className="w-4 h-4 mr-1" /> {busy ? "Subiendo…" : "Subir logo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
