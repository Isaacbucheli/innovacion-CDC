import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { expect, test, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  getWafAiConfig: vi.fn(async () => ({ configured: true, deployment: "gpt-4o", api_version: "2024-02-01", has_key: true })),
  getWafCatalog: vi.fn(async () => [
    { canonical_id: 1, advisor_name: "Enable MFA", advisor_category: "Security", pillar_number: 2, review_scope_es: "MFA admins", benefit_es: "", client_action_es: "", bit_action_es: "", is_excluded: false, exclusion_reason: null, consolidates_to_id: null, ai_review_status: "pending", ai_decision: null, ai_confidence: null, ai_possible_additional_cost: false, ai_cost_reason: null, ai_exclusion_reason: null, ai_duplicate_group_key: null, ai_reviewed_at: null, created_at: "", updated_at: "" },
  ]),
  analyzeWafCanonical: vi.fn(async () => ({ canonical_id: 1, suggestion: {} })),
  applyWafSuggestion: vi.fn(async () => ({ message: "ok", canonical_id: 1 })),
}));
vi.mock("@/lib/auth", () => ({ getRole: () => "admin", getName: () => "Admin BIT", clearSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("muestra config IA y catálogo; abre el editor", async () => {
  const { default: ValidationPage } = await import("@/components/waf/ValidationPage");
  render(<ThemeProvider attribute="class" defaultTheme="light"><ValidationPage /></ThemeProvider>);
  await waitFor(() => expect(screen.getByText("Enable MFA")).toBeInTheDocument());
  expect(screen.getByText(/gpt-4o/i)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /revisar/i })[0]);
  expect(await screen.findByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
});
