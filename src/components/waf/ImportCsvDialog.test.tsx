import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ImportCsvDialog from "@/components/waf/ImportCsvDialog";

test("dispara onConfirm con el archivo elegido", () => {
  const onConfirm = vi.fn();
  render(<ImportCsvDialog open clientId={3} onOpenChange={() => {}} onConfirm={onConfirm} />);
  const file = new File(["a,b"], "advisor.csv", { type: "text/csv" });
  const input = screen.getByLabelText(/archivo csv/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /importar/i }));
  expect(onConfirm).toHaveBeenCalledWith(file);
});

test("el botón importar está deshabilitado sin archivo", () => {
  render(<ImportCsvDialog open clientId={3} onOpenChange={() => {}} onConfirm={vi.fn()} />);
  expect(screen.getByRole("button", { name: /importar/i })).toBeDisabled();
});
