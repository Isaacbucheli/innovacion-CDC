import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import SecurityManagementDialog from "@/components/waf/SecurityManagementDialog";
import { getWafSecurityManagement, setWafSecurityManagement } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getWafSecurityManagement: vi.fn(),
  setWafSecurityManagement: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = getWafSecurityManagement as unknown as ReturnType<typeof vi.fn>;
const set = setWafSecurityManagement as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { get.mockReset(); set.mockReset(); });

test("pre-carga el estado y guarda", async () => {
  get.mockResolvedValueOnce({ managed_externally: false, note: "Nota por defecto" });
  set.mockResolvedValueOnce({ message: "ok" });
  const onChanged = vi.fn();
  render(<SecurityManagementDialog clientId={3} open onOpenChange={() => {}} onChanged={onChanged} />);
  await waitFor(() => expect(get).toHaveBeenCalledWith(3));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));
  await waitFor(() => expect(set).toHaveBeenCalledWith(3, true, expect.any(String)));
  await waitFor(() => expect(onChanged).toHaveBeenCalled());
});
