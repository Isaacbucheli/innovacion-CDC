import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSession, getName } from "@/lib/auth";

export default function AppShell({ title, active, children }: { title: string; active?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr] bg-secondary">
      <aside className="bg-white border-r flex flex-col p-5 gap-2">
        <div className="mb-5">
          <img src="/business-it-logo.webp" alt="Business IT" className="h-9 w-auto" />
          <div className="text-xs text-muted-foreground mt-2 tracking-wide">Gestión CDC</div>
        </div>
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
            active === "alerts" ? "bg-[#A3C243] text-white" : "text-[#606161] hover:bg-secondary"
          }`}
        >
          <Bell className="w-4 h-4" /> Catálogo de alertas
        </button>
        <div className="mt-auto pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{getName()}</span>
          <Button variant="ghost" size="icon" onClick={() => { clearSession(); if (typeof location !== "undefined") location.reload(); }} aria-label="Salir">
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
