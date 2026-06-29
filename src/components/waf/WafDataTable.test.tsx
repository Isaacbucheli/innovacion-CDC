import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import WafDataTable from "@/components/waf/WafDataTable";
import type { WafRecommendation } from "@/types";

const recs: WafRecommendation[] = [
  { canonical_id: 1, matrix_code: "2.1", pillar_number: 2, review_scope_es: "MFA admins", business_impact: "High", resource_count: 18, completion_pct: 20 },
  { canonical_id: 2, matrix_code: "5.1", pillar_number: 5, review_scope_es: "Reserved Instances", business_impact: "High", resource_count: 31, completion_pct: 10 },
];

test("renderiza filas y abre el detalle al hacer clic", () => {
  const onOpen = vi.fn();
  render(<WafDataTable recommendations={recs} pillarNames={{ 2: "Seguridad", 5: "Costos" }} minPct={0} maxPct={100} onOpen={onOpen} />);
  expect(screen.getByText("MFA admins")).toBeInTheDocument();
  expect(screen.getByText("Costos")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Reserved Instances"));
  expect(onOpen).toHaveBeenCalledWith(2);
});
