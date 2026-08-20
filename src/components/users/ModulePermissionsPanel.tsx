import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import BusyOverlay from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import {
  getModulePermissions, saveModulePermissions,
  type ModuleDef, type ModulePermissionRow,
} from "@/lib/api";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

type Perm = { can_view: boolean; can_edit: boolean };
type PermMap = Record<string, Perm>;

export const toMap = (rows: ModulePermissionRow[]): PermMap =>
  Object.fromEntries(rows.map((r) => [r.module_key, { can_view: r.can_view, can_edit: r.can_edit }]));

// El payload PUT reemplaza el rol completo: hay que viajar con TODOS los módulos
// del catálogo (no solo los presentes en el mapa), explícitos en false/false si
// el módulo nunca se tocó.
export const toRows = (map: PermMap, modules: ModuleDef[]): ModulePermissionRow[] =>
  modules.map((m) => ({ module_key: m.key, ...(map[m.key] ?? { can_view: false, can_edit: false }) }));

// Defensa en profundidad: lector jamás edita, aunque llegue un can_edit:true
// obsoleto desde el GET (o desde algún estado intermedio antes de guardar).
export const scrubEdits = (map: PermMap): PermMap =>
  Object.fromEntries(Object.entries(map).map(([key, p]) => [key, { ...p, can_edit: false }]));

// Payload del PUT con los tres roles del catálogo. Lector y monitoreo viajan
// scrubbeados: son de solo lectura y ningún can_edit puede colarse al guardado.
export const buildSavePayload = (
  consultor: PermMap, lector: PermMap, monitoreo: PermMap, modules: ModuleDef[],
) => ({
  consultor: toRows(consultor, modules),
  lector: toRows(scrubEdits(lector), modules),
  monitoreo: toRows(scrubEdits(monitoreo), modules),
});

// Reglas espejo del backend: editar ⇒ ver; quitar ver ⇒ quitar editar.
export function applyPerm(cur: Perm, field: "can_view" | "can_edit", value: boolean): Perm {
  const next = { ...cur, [field]: value };
  if (field === "can_edit" && value) next.can_view = true;
  if (field === "can_view" && !value) next.can_edit = false;
  return next;
}

/**
 * Matriz de permisos por módulo para los grupos consultor, lector y monitoreo.
 * Reglas espejo del backend: editar ⇒ ver; quitar ver ⇒ quitar editar;
 * lector y monitoreo jamás editan (checkbox deshabilitado).
 */
export default function ModulePermissionsPanel() {
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [consultor, setConsultor] = useState<PermMap>({});
  const [lector, setLector] = useState<PermMap>({});
  const [monitoreo, setMonitoreo] = useState<PermMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getModulePermissions()
      .then((m) => {
        setModules(m.modules);
        setConsultor(toMap(m.permissions.consultor));
        setLector(scrubEdits(toMap(m.permissions.lector)));
        setMonitoreo(scrubEdits(toMap(m.permissions.monitoreo ?? [])));
      })
      .catch((e) => toast.error(msg(e)))
      .finally(() => setLoading(false));
  }, []);

  const setters = { consultor: setConsultor, lector: setLector, monitoreo: setMonitoreo } as const;
  function setPerm(role: keyof typeof setters, key: string, field: "can_view" | "can_edit", value: boolean) {
    setters[role]((prev) => {
      const cur = prev[key] ?? { can_view: false, can_edit: false };
      return { ...prev, [key]: applyPerm(cur, field, value) };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await saveModulePermissions(buildSavePayload(consultor, lector, monitoreo, modules));
      setConsultor(toMap(updated.permissions.consultor));
      setLector(scrubEdits(toMap(updated.permissions.lector)));
      setMonitoreo(scrubEdits(toMap(updated.permissions.monitoreo ?? [])));
      toast.success("Permisos guardados. Los usuarios los verán al volver a ingresar.");
    } catch (e) { toast.error(msg(e)); } finally { setSaving(false); }
  }

  const groups = [...new Set(modules.map((m) => m.group))];
  const check = (checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <input type="checkbox" className="h-4 w-4 accent-primary disabled:opacity-40"
      checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
  );

  return (
    <div className="relative">
      <BusyOverlay show={loading || saving} title={saving ? "Guardando…" : "Cargando permisos"} />
      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-4 py-2 font-medium">Módulo</th>
              <th className="px-4 py-2 font-medium text-center" colSpan={2}>Consultor</th>
              <th className="px-4 py-2 font-medium text-center" colSpan={2}>Lector</th>
              <th className="px-4 py-2 font-medium text-center" colSpan={2}>Monitoreo</th>
            </tr>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-4 py-1" />
              <th className="px-4 py-1 text-center font-normal">Ver</th>
              <th className="px-4 py-1 text-center font-normal">Editar</th>
              <th className="px-4 py-1 text-center font-normal">Ver</th>
              <th className="px-4 py-1 text-center font-normal">Editar</th>
              <th className="px-4 py-1 text-center font-normal">Ver</th>
              <th className="px-4 py-1 text-center font-normal">Editar</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="border-b bg-muted/30">
                  <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">{group}</td>
                </tr>
                {modules.filter((m) => m.group === group).map((m) => {
                  const c = consultor[m.key] ?? { can_view: false, can_edit: false };
                  const l = lector[m.key] ?? { can_view: false, can_edit: false };
                  const mo = monitoreo[m.key] ?? { can_view: false, can_edit: false };
                  return (
                    <tr key={m.key} className="border-b last:border-0">
                      <td className="px-4 py-2">{m.label}</td>
                      <td className="px-4 py-2 text-center">{check(c.can_view, (v) => setPerm("consultor", m.key, "can_view", v))}</td>
                      <td className="px-4 py-2 text-center">{check(c.can_edit, (v) => setPerm("consultor", m.key, "can_edit", v))}</td>
                      <td className="px-4 py-2 text-center">{check(l.can_view, (v) => setPerm("lector", m.key, "can_view", v))}</td>
                      {/* Lector jamás edita: candado espejo del backend. */}
                      <td className="px-4 py-2 text-center">{check(false, () => {}, true)}</td>
                      <td className="px-4 py-2 text-center">{check(mo.can_view, (v) => setPerm("monitoreo", m.key, "can_view", v))}</td>
                      {/* Monitoreo jamás edita: mismo candado que lector. */}
                      <td className="px-4 py-2 text-center">{check(false, () => {}, true)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          El perfil administrador siempre tiene acceso completo y no aparece en esta matriz.
          Lector y Monitoreo son de solo lectura; Monitoreo además ve todos los clientes.
        </p>
        <Button size="sm" onClick={save} disabled={loading || saving}>Guardar cambios</Button>
      </div>
    </div>
  );
}
