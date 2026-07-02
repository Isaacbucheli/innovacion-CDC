import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import FinOpsRefreshDialog from "@/components/costs/FinOpsRefreshDialog";
import * as api from "@/lib/api";

test("muestra estado por dataset al abrir", async () => {
  vi.spyOn(api, "getFinOpsStatus").mockResolvedValue([
    { dataset: "commitment_eligibility", refreshed_at: "2026-07-01T10:00:00", row_count: 121301, status: "ok" },
  ]);
  render(<FinOpsRefreshDialog open onOpenChange={() => {}} onDone={() => {}} />);
  await waitFor(() => expect(screen.getByText(/commitment_eligibility/)).toBeInTheDocument());
  expect(screen.getByText(/121,?301|121301/)).toBeInTheDocument();
});

test("Actualizar ahora llama al endpoint y notifica", async () => {
  vi.spyOn(api, "getFinOpsStatus").mockResolvedValue([]);
  const refresh = vi.spyOn(api, "refreshFinOpsData").mockResolvedValue({
    results: [{ dataset: "regions", status: "ok", row_count: 500 }],
  });
  const onDone = vi.fn();
  render(<FinOpsRefreshDialog open onOpenChange={() => {}} onDone={onDone} />);
  fireEvent.click(await screen.findByRole("button", { name: /actualizar ahora/i }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  await waitFor(() => expect(onDone).toHaveBeenCalled());
});
