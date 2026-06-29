import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  listClientSubscriptions: vi.fn(async () => [
    { client_subscription_id: 1, subscription_id: "sub-A", subscription_name: "Producción", is_active: true, is_managed: true },
    { client_subscription_id: 2, subscription_id: "sub-B", subscription_name: "Inactiva", is_active: false, is_managed: true },
  ]),
}));

test("lista solo suscripciones activas+administradas y confirma con sus ids", async () => {
  const { default: AdvisorSyncDialog } = await import("@/components/waf/AdvisorSyncDialog");
  const onConfirm = vi.fn();
  render(<AdvisorSyncDialog open clientId={3} onOpenChange={() => {}} onConfirm={onConfirm} />);
  await waitFor(() => expect(screen.getByText("Producción")).toBeInTheDocument());
  expect(screen.queryByText("Inactiva")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /consultar/i }));
  expect(onConfirm).toHaveBeenCalledWith(["sub-A"]);
});
