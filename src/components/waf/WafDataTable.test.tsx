import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import WafDataTable from "@/components/waf/WafDataTable";
import { translateToEnglish } from "@/lib/wafTranslate";
import type { WafRecommendation } from "@/types";

vi.mock("@/lib/wafTranslate", () => ({
  translateToEnglish: vi.fn(async (texts: string[]) => {
    const m = new Map<string, string>();
    for (const t of texts) if (t?.trim()) m.set(t, `EN(${t})`);
    return m;
  }),
  clearTranslationCache: vi.fn(),
}));

const recs: WafRecommendation[] = [
  { canonical_id: 1, matrix_code: "2.1", pillar_number: 2, review_scope_es: "MFA admins", advisor_name_en: null, business_impact: "High", resource_count: 18, completion_pct: 20, remediation_end_date: "2026-08-15", is_new: true, source: "advisor" },
  { canonical_id: 2, matrix_code: "5.1", pillar_number: 5, review_scope_es: "Reserved Instances", advisor_name_en: null, business_impact: "High", resource_count: 31, completion_pct: 10, remediation_end_date: null, is_new: false, source: "excel" },
];

// Una con original de Azure (canónica que pasó por sync) y otra sin él (Excel/legacy).
const recsConOriginal: WafRecommendation[] = [
  { ...recs[0], advisor_name_en: "Enable multi-factor authentication for accounts with owner permissions" },
  recs[1],
];

const pillarNames = { 2: "Seguridad", 5: "Costos" };

test("renderiza filas y abre el detalle al hacer clic", () => {
  const onOpen = vi.fn();
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={onOpen} />);
  expect(screen.getByText("MFA admins")).toBeInTheDocument();
  expect(screen.getByText("Costos")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Reserved Instances"));
  expect(onOpen).toHaveBeenCalledWith(2);
});

test("el buscador global filtra por código o ámbito", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("Buscar ámbito o código…"), { target: { value: "Reserved" } });
  expect(screen.queryByText("MFA admins")).not.toBeInTheDocument();
  expect(screen.getByText("Reserved Instances")).toBeInTheDocument();
});

test("ofrece el botón de filtro en las columnas visibles (sin Origen)", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  for (const name of ["Código", "Pilar", "Ámbito", "Impacto", "Recursos", "Avance", "Fecha de cierre"]) {
    expect(screen.getByRole("button", { name: `Filtrar ${name}` })).toBeInTheDocument();
  }
});

test("la columna Origen está oculta por defecto", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  // Las etiquetas de origen (Advisor/Excel) y el botón de filtro de Origen no se muestran.
  expect(screen.queryByText("Advisor")).not.toBeInTheDocument();
  expect(screen.queryByText("Excel")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Filtrar Origen" })).not.toBeInTheDocument();
});

test("no existe el botón Modo cliente", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /Modo cliente/i })).not.toBeInTheDocument();
});

test("muestra la fecha de cierre formateada (y vacío cuando no hay)", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  expect(screen.getByText("15/08/2026")).toBeInTheDocument();
  // La fila sin fecha no pinta relleno: ni guion ni ningún otro texto.
  expect(screen.queryByText("—")).not.toBeInTheDocument();
});

test("el ámbito se muestra como disparador de tooltip con el texto completo", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  const scope = screen.getByText("Reserved Instances");
  expect(scope).toHaveAttribute("data-state", "closed");
});

test("muestra la chispa Nuevo solo en recomendaciones no vistas", () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  const sparks = screen.getAllByLabelText("Recomendación nueva");
  expect(sparks).toHaveLength(1);
});

test("muestra el botón Inglés y notifica el toggle", () => {
  const onEnglishChange = vi.fn();
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} english={false} onEnglishChange={onEnglishChange} />);
  fireEvent.click(screen.getByRole("button", { name: /Inglés/i }));
  expect(onEnglishChange).toHaveBeenCalledWith(true);
});

test("con inglés activo traduce el ámbito de la lista", async () => {
  render(<WafDataTable recommendations={recs} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} english onEnglishChange={vi.fn()} />);
  expect(await screen.findByText("EN(MFA admins)")).toBeInTheDocument();
  expect(screen.getByText("EN(Reserved Instances)")).toBeInTheDocument();
});

test("en inglés muestra el texto original de Azure tal cual, sin traducirlo", async () => {
  vi.mocked(translateToEnglish).mockClear();

  render(<WafDataTable recommendations={recsConOriginal} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} english onEnglishChange={vi.fn()} />);

  // La fila con original se ve literal (no "EN(...)").
  expect(screen.getByText("Enable multi-factor authentication for accounts with owner permissions")).toBeInTheDocument();
  expect(screen.queryByText("EN(MFA admins)")).not.toBeInTheDocument();
  // La otra sí cae a la traducción.
  expect(await screen.findByText("EN(Reserved Instances)")).toBeInTheDocument();
  // Y solo se mandó a traducir la que no tiene original.
  expect(translateToEnglish).toHaveBeenCalledTimes(1);
  expect(translateToEnglish).toHaveBeenCalledWith(["Reserved Instances"]);
});

test("cuando todas las filas tienen original no se llama a la IA", () => {
  const todas = recsConOriginal.map((r, i) => ({ ...r, advisor_name_en: `Original ${i}` }));
  vi.mocked(translateToEnglish).mockClear();

  render(<WafDataTable recommendations={todas} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} english onEnglishChange={vi.fn()} />);

  expect(screen.getByText("Original 0")).toBeInTheDocument();
  expect(translateToEnglish).not.toHaveBeenCalled();
});

test("en inglés etiqueta el origen del texto (Azure vs IA)", async () => {
  render(<WafDataTable recommendations={recsConOriginal} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} english onEnglishChange={vi.fn()} />);
  await screen.findByText("EN(Reserved Instances)"); // deja que asiente la traducción (re-render)
  expect(screen.getByText("Azure")).toBeInTheDocument();
  expect(screen.getByText("IA")).toBeInTheDocument();
});

test("en español no aparece la etiqueta de origen del texto", () => {
  render(<WafDataTable recommendations={recsConOriginal} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  expect(screen.queryByText("Azure")).not.toBeInTheDocument();
  expect(screen.queryByText("IA")).not.toBeInTheDocument();
});

test("el buscador encuentra por el texto original en inglés", () => {
  render(<WafDataTable recommendations={recsConOriginal} pillarNames={pillarNames} minPct={0} maxPct={100} onOpen={vi.fn()} />);
  fireEvent.change(screen.getByPlaceholderText("Buscar ámbito o código…"), { target: { value: "multi-factor" } });
  expect(screen.getByText("MFA admins")).toBeInTheDocument();
  expect(screen.queryByText("Reserved Instances")).not.toBeInTheDocument();
});
