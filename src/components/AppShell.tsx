import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSession, getName } from "@/lib/auth";

export default function AppShell({ title, active, children }: { title: string; active?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-secondary">
      <aside className="bg-[#0e1512] text-white flex flex-col p-4 gap-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center font-bold">BIT</div>
          <div className="leading-tight">
            <div className="font-semibold text-sm">Innovación CDC</div>
            <div className="text-xs text-white/50">Gestión CDC</div>
          </div>
        </div>
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${
            active === "alerts" ? "bg-primary/15 text-primary" : "text-white/70 hover:bg-white/5"
          }`}
        >
          <Bell className="w-4 h-4" /> Catálogo de alertas
        </button>
        <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
          <span className="truncate">{getName()}</span>
          <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" onClick={() => { clearSession(); if (typeof location !== "undefined") location.reload(); }} aria-label="Salir">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>
      <main className="overflow-y-auto">
        <header className="px-8 py-5 border-b bg-background">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">Catálogo estándar de alertas Azure Monitor. Centralizado para el equipo.</p>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
