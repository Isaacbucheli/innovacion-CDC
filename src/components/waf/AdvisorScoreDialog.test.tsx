import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AdvisorScoreDialog from "@/components/waf/AdvisorScoreDialog";

test("confirma con include_in_reports false por defecto", () => {
  const onConfirm = vi.fn();
  render(<AdvisorScoreDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
  expect(onConfirm).toHaveBeenCalledWith(false);
});

test("permite incluir en informes", () => {
  const onConfirm = vi.fn();
  render(<AdvisorScoreDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText(/incluir en informes/i));
  fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));
  expect(onConfirm).toHaveBeenCalledWith(true);
});
