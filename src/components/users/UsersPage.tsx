import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import BusyOverlay from "@/components/BusyOverlay";
import SimpleTable, { type SimpleCol } from "@/components/reports/SimpleTable";
import UserFormDialog, { roleLabel } from "@/components/users/UserFormDialog";
import UserClientsDialog from "@/components/users/UserClientsDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listUsers, updateUser, deleteUser } from "@/lib/api";
import { getName, getRole } from "@/lib/auth";
import type { PublicUser } from "@/types";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }
const chip = (cls: string, text: React.ReactNode) => <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{text}</span>;
const OK = "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
const NEUTRAL = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
const roleChipCls = (role: string) =>
  role === "admin" ? "bg-primary/15 text-primary" : role === "consultor"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : NEUTRAL;

export default function UsersPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const isAdmin = getRole() === "admin";
  const myName = getName();
  const [rows, setRows] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [formUser, setFormUser] = useState<PublicUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [clientsUser, setClientsUser] = useState<PublicUser | null>(null);
  const [toDelete, setToDelete] = useState<PublicUser | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback(() => {
    setLoading(true);
    listUsers().then((u) => { if (mounted.current) setRows(u); })
      .catch((e) => toast.error(msg(e)))
      .finally(() => { if (mounted.current) setLoading(false); });
  }, []);
  useEffect(() => { if (isAdmin) reload(); else setLoading(false); }, [isAdmin, reload]);

  function openNew() { setFormUser(null); setFormOpen(true); }
  function openEdit(u: PublicUser) { setFormUser(u); setFormOpen(true); }

  async function toggleActive(u: PublicUser) {
    try {
      await updateUser(u.user_id, { is_active: !u.is_active });
      toast.success(u.is_active ? "Usuario desactivado." : "Usuario activado.");
      reload();
    } catch (e) { toast.error(msg(e)); }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteUser(toDelete.user_id);
      toast.success(`Usuario ${toDelete.email} eliminado.`);
      setToDelete(null); reload();
    } catch (e) { toast.error(msg(e)); setToDelete(null); }
  }

  const cols: SimpleCol<PublicUser>[] = [
    { key: "email", label: "Correo", render: (u) => <span className="font-medium">{u.email}</span> },
    { key: "full_name", label: "Nombre" },
    { key: "role", label: "Perfil", render: (u) => chip(roleChipCls(u.role), roleLabel(u.role)) },
    { key: "is_active", label: "Estado", render: (u) => chip(u.is_active ? OK : NEUTRAL, u.is_active ? "Activo" : "Inactivo") },
    { key: "acc", label: "", render: (u) => {
      const isSelf = myName && u.email.toLowerCase() === (myName || "").toLowerCase();
      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Acciones"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(u)}>Editar</DropdownMenuItem>
              {(u.role === "consultor" || u.role === "lector") && (
                <DropdownMenuItem onClick={() => setClientsUser(u)}>Acceso a clientes</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => toggleActive(u)}>{u.is_active ? "Desactivar" : "Activar"}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setToDelete(u)} disabled={!!isSelf} className="text-destructive focus:text-destructive">Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    } },
  ];

  return (
    <AppShell title="Usuarios y perfiles" subtitle="Administración · accesos internos de la plataforma"
      active="usuarios" onNavigate={onNavigate}
      headerRight={isAdmin ? <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nuevo usuario</Button> : undefined}>
      <BusyOverlay show={loading} title="Cargando usuarios" />
      {!isAdmin ? (
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      ) : (
        <SimpleTable cols={cols} rows={rows} empty="No hay usuarios registrados." />
      )}
      <UserFormDialog user={formUser} open={formOpen} onOpenChange={setFormOpen} onSaved={reload} />
      <UserClientsDialog user={clientsUser} open={clientsUser != null} onOpenChange={(o) => !o && setClientsUser(null)} />
      <AlertDialog open={toDelete != null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar a {toDelete?.full_name} ({toDelete?.email})? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
