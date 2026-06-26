import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CodeBlock from "@/components/CodeBlock";

test("muestra el código y un botón copiar", () => {
  render(<CodeBlock code="AzureActivity | take 1" />);
  expect(screen.getByText(/AzureActivity/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
});

test("al hacer click copia al portapapeles y muestra Copiado", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<CodeBlock code="AzureActivity | take 1" />);
  fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
  expect(writeText).toHaveBeenCalledWith("AzureActivity | take 1");
  expect(await screen.findByRole("button", { name: /copiado/i })).toBeInTheDocument();
});
