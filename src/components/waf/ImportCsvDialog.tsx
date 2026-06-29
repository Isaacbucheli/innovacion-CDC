import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function ImportCsvDialog({ open, clientId, busy, onOpenChange, onConfirm }: {
  open: boolean; clientId: number; busy?: boolean;
  onOpenChange: (o: boolean) => void; onConfirm: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { if (open) setFile(null); }, [open, clientId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Importar Advisor CSV</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Carga un export CSV de Azure Advisor para este cliente.</p>
        <div className="space-y-1.5">
          <Label htmlFor="csv">Archivo CSV</Label>
          <input id="csv" type="file" accept=".csv" className="block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!file || busy} onClick={() => file && onConfirm(file)}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
