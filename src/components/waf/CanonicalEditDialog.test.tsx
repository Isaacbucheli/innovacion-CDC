import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  analyzeWafCanonical: vi.fn(async () => ({ canonical_id: 1, suggestion: { decision: "include", possible_additional_cost: false, cost_reason: "", duplicate_group_key: "", pillar_number: 2, review_scope_es: "MFA admins (IA)", benefit_es: "b", client_action_es: "c", bit_action_es: "d", exclusion_reason: "", confidence: 0.9, raw_model_text: "" } })),
  applyWafSuggestion: vi.fn(async () => ({ message: "ok", canonical_id: 1 })),
  updateWafCanonical: vi.fn(async () => ({ message: "ok", canonical_id: 1 })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const canonical = {
  canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2,
  review_scope_es: "MFA admins", benefit_es: "b", client_action_es: "c", bit_action_es: "d",
  is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending",
  ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null,
  ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "",
};

beforeEach(() => vi.clearAllMocks());

test("guardar cambios llama updateWafCanonical", async () => {
  const { default: CanonicalEditDialog } = await import("@/components/waf/CanonicalEditDialog");
  const { updateWafCanonical } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<CanonicalEditDialog open canonical={canonical} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
  await waitFor(() => expect(updateWafCanonical).toHaveBeenCalledWith(1, expect.objectContaining({ review_scope_es: "MFA admins" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("analizar con IA muestra la sugerencia y permite aplicarla", async () => {
  const { default: CanonicalEditDialog } = await import("@/components/waf/CanonicalEditDialog");
  const { analyzeWafCanonical, applyWafSuggestion } = await import("@/lib/api");
  const onSaved = vi.fn();
  render(<CanonicalEditDialog open canonical={canonical} onOpenChange={() => {}} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
  await waitFor(() => expect(analyzeWafCanonical).toHaveBeenCalledWith(1));
  await waitFor(() => expect(screen.getByText(/MFA admins \(IA\)/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /aplicar sugerencia/i }));
  await waitFor(() => expect(applyWafSuggestion).toHaveBeenCalled());
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});
