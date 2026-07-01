import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUser, updateUser } from "@/lib/api";
import type { PublicUser } from "@/types";

export const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "consultor", label: "Consultor" },
  { value: "lector", label: "Lector" },
];
export function roleLabel(role: string) { return ROLES.find((r) => r.value === role)?.label ?? role; }
function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

// Alta/edición de usuario. Las contraseñas sólo se ingresan aquí (nunca se muestran).
export default function UserFormDialog({ user, open, onOpenChange, onSaved }: {
  user: PublicUser | null; // null = crear
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const editing = user != null;
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("lector");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    if (user) { setEmail(user.email); setFullName(user.full_name); setRole(user.role); setIsActive(user.is_active); }
    else { setEmail(""); setFullName(""); setRole("lector"); setIsActive(true); }
  }, [open, user]);

  async function save() {
    if (!email.trim() || !fullName.trim()) { toast.error("Correo y nombre son obligatorios."); return; }
    if (!editing && password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    if (editing && password && password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres."); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateUser(user!.user_id, {
          email: email.trim(), full_name: fullName.trim(), role, is_active: isActive,
          ...(password ? { password } : {}),
        });
        toast.success("Usuario actualizado.");
      } else {
        await createUser({ email: email.trim(), full_name: fullName.trim(), role, password });
        toast.success("Usuario creado.");
      }
      onOpenChange(false); onSaved();
    } catch (e) { toast.error(msg(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar usuario" : "Nuevo usuario"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="ue">Correo</Label>
            <Input id="ue" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@grupobusiness.it" /></div>
          <div className="space-y-1"><Label htmlFor="un">Nombre completo</Label>
            <Input id="un" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellido" /></div>
          <div className="space-y-1"><Label htmlFor="ur">Perfil</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="ur"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label htmlFor="up">Contraseña{editing ? " (opcional)" : ""}</Label>
            <Input id="up" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "Dejar en blanco para no cambiar" : "Mínimo 8 caracteres"} /></div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary h-4 w-4" />
              Usuario activo
            </label>
          )}
          {(role === "consultor" || role === "lector") && !editing && (
            <p className="text-xs text-muted-foreground">Tras crearlo, asigna sus clientes con la acción "Acceso a clientes".</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar" : "Crear usuario"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
