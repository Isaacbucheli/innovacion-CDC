import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import CostsDataTable from "@/components/costs/CostsDataTable";
import type { CostResult } from "@/types";

const R = (over: Partial<CostResult>): CostResult => ({
  cost_result_id: 1, resource_id: 1, service_key: "vms",
  resource_name: null, resource_type: null, location: null,
  subscription_name: null, resource_group: null, azure_resource_id: null,
  payg_hourly: null, payg_monthly: null, ri_1y_monthly: null, ri_3y_monthly: null,
  savings_1y_pct: null, savings_3y_pct: null, savings_1y_monthly: null, savings_3y_monthly: null,
  sql_addon_monthly: null, ahb_discount_monthly: null, storage_monthly: null,
  calculation_status: "calculated", is_variable_pricing: null, is_manual_cost: null,
  manual_monthly_cost: null, manual_cost_note: null, ri_applies: null,
  ri_not_applicable_reason: null, ri_coverage: null, ri_reservation_name: null, ri_term: null,
  ri_eligibility: null,
  power_running_hours: null, power_uptime_pct: null, power_period_start: null, power_period_end: null,
  calculation_notes: null, calculated_at: null, ...over,
});

test("renderiza recurso, PAYG formateado y estado", () => {
  render(<CostsDataTable rows={[R({ resource_name: "vm-prod-01", payg_monthly: 1234.5, calculation_status: "calculated" })]} />);
  expect(screen.getByText("vm-prod-01")).toBeInTheDocument();
  expect(screen.getByText("$1,234.50")).toBeInTheDocument();
  expect(screen.getByText("Calculado")).toBeInTheDocument();
});

test("estado vacío cuando no hay filas", () => {
  render(<CostsDataTable rows={[]} />);
  expect(screen.getByText(/Sin recursos que coincidan/i)).toBeInTheDocument();
});
