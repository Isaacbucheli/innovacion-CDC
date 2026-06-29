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
  render(<PillarCards sections={sections} activePillar={null} onPick={onPick} />);
  expect(screen.getByText("Seguridad")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(5);
});

test("clic en la tarjeta activa la deselecciona (onPick null)", () => {
  const onPick = vi.fn();
  render(<PillarCards sections={sections} activePillar={5} onPick={onPick} />);
  fireEvent.click(screen.getByText("Costos"));
  expect(onPick).toHaveBeenCalledWith(null);
});
