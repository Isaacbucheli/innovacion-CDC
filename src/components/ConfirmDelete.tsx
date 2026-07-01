import { useState, type MouseEvent, type ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ConfirmDelete({ open, label, title, description, confirmLabel = "Eliminar", onOpenChange, onConfirm }: {
  open: boolean;
  label: string;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  // Estado propio: mientras corre el borrado, deshabilita los botones, evita el cierre
  // automático del AlertDialogAction y bloquea Escape, para que no se dispare dos veces
  // ni quede la petición en vuelo con el diálogo ya cerrado. El caller cierra en éxito.
  const [busy, setBusy] = useState(false);
  async function handleConfirm(e: MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <AlertDialogContent onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? "¿Desactivar del catálogo?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? <>Se desactivará "{label}". Es reversible (soft delete).</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy}>{busy ? "Eliminando…" : confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
