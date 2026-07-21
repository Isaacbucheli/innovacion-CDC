import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PillarCards from "@/components/waf/PillarCards";
import type { WafSection } from "@/types";

const sections: WafSection[] = [
  { section_num: 2, section_name: "Seguridad", total_recs: 12, total_resources: 40, avg_progress: 35, high_recs: 5, medium_recs: 3 },
  { section_num: 5, section_name: "Costos", total_recs: 6, total_resources: 31, avg_progress: 40, high_recs: 3, medium_recs: 1 },
];

test("muestra una tarjeta por sección y dispara onPick al hacer clic", () => {
  const onPick = vi.fn();
  render(<PillarCards sections={sections} activePillar={null} onPick={onPick} scores={null} />);
  expect(screen.getByText("Seguridad")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(5);
});

test("clic en la tarjeta activa la deselecciona (onPick null)", () => {
  const onPick = vi.fn();
  render(<PillarCards sections={sections} activePillar={5} onPick={onPick} scores={null} />);
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(null);
});

test("muestra Score y porcentaje cuando scores tiene datos", () => {
  const costos: WafSection = { section_num: 5, section_name: "Costos", total_recs: 6, total_resources: 31, avg_progress: 40, high_recs: 3, medium_recs: 1 };
  render(<PillarCards sections={[costos]} activePillar={null} onPick={vi.fn()} scores={{ 5: 60 }} />);
  expect(screen.getByText("Score")).toBeInTheDocument();
  expect(screen.getByText("60%")).toBeInTheDocument();
});

test("pilar gestionado externamente: muestra score y nota, oculta el conteo, no es botón de filtro", () => {
  const onPick = vi.fn();
  const sec: WafSection = { section_num: 3, section_name: "Seguridad", total_recs: 0, total_resources: 0, avg_progress: 0, high_recs: 0, medium_recs: 0, managed_externally: true, managed_note: "Revisado por Gestión de Vulnerabilidades" };
  render(<PillarCards sections={[sec]} activePillar={null} onPick={onPick} scores={{ 3: 76 }} />);
  expect(screen.getByText("76%")).toBeInTheDocument();
  expect(screen.getByText(/Gestión de Vulnerabilidades/i)).toBeInTheDocument();
  // El bloque de métricas (conteo · recursos) no se muestra.
  expect(screen.queryByText(/recomendaciones ·/i)).not.toBeInTheDocument();
  // Click en el nombre no dispara el filtro (no es botón de pilar).
  fireEvent.click(screen.getByText("Seguridad"));
  expect(onPick).not.toHaveBeenCalled();
});

test("pilar gestionado: el botón de info abre el diálogo descriptivo", async () => {
  const sec: WafSection = { section_num: 3, section_name: "Seguridad", total_recs: 0, total_resources: 0, avg_progress: 0, high_recs: 0, medium_recs: 0, managed_externally: true, managed_note: "Nota GV" };
  render(<PillarCards sections={[sec]} activePillar={null} onPick={vi.fn()} scores={{ 3: 76 }} />);
  fireEvent.click(screen.getByRole("button", { name: /Detalle de seguridad gestionada/i }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});
