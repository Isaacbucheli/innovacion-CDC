import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ConsolidateDialog from "@/components/waf/ConsolidateDialog";

test("confirma con use_ai true por defecto", () => {
  const onConfirm = vi.fn();
  render(<ConsolidateDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole("button", { name: /consolidar/i }));
  expect(onConfirm).toHaveBeenCalledWith(true);
});

test("permite desactivar la IA", () => {
  const onConfirm = vi.fn();
  render(<ConsolidateDialog open onOpenChange={() => {}} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByLabelText(/usar ia/i));
  fireEvent.click(screen.getByRole("button", { name: /consolidar/i }));
  expect(onConfirm).toHaveBeenCalledWith(false);
});
