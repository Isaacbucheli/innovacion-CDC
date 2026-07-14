import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ addWafComment: vi.fn(async () => ({ comment_id: 1 })) }));
vi.mock("@/lib/auth", () => ({ canEdit: () => true, canEditModule: () => true }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("agrega un comentario", async () => {
  const { default: Comments } = await import("@/components/waf/Comments");
  const { addWafComment } = await import("@/lib/api");
  const onAdded = vi.fn();
  render(<Comments clientId={3} canonicalId={9} comments={[]} onAdded={onAdded} />);
  fireEvent.change(screen.getByPlaceholderText(/comentario/i), { target: { value: "Hola" } });
  fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
  await waitFor(() => expect(addWafComment).toHaveBeenCalledWith(3, 9, "Hola"));
  expect(onAdded).toHaveBeenCalled();
});

test("muestra comentarios existentes", async () => {
  const { default: Comments } = await import("@/components/waf/Comments");
  render(<Comments clientId={3} canonicalId={9} comments={[{ comment_id: 1, user_display: "IB", comment_text: "Nota previa", created_at: "2026-06-24T00:00:00Z" }]} onAdded={() => {}} />);
  expect(screen.getByText("Nota previa")).toBeInTheDocument();
});
