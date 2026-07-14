import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";

/** Fallback del guard central: la sección activa no está permitida para el perfil. */
export default function NoAccessPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  return (
    <AppShell title="Sin acceso" subtitle="Tu perfil no tiene habilitado este módulo" onNavigate={onNavigate}>
      <div className="grid place-items-center py-16 text-center gap-4">
        <p className="text-sm text-muted-foreground max-w-md">
          No tienes acceso a este módulo. Si crees que deberías verlo, pide a un
          administrador que lo habilite para tu perfil en Usuarios y perfiles →
          Permisos de grupos.
        </p>
        <Button size="sm" onClick={() => onNavigate?.("home")}>Ir al inicio</Button>
      </div>
    </AppShell>
  );
}
