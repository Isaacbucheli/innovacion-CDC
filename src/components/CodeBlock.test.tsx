import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import CodeBlock from "@/components/CodeBlock";

test("muestra el código y un botón copiar", () => {
  render(<CodeBlock code="AzureActivity | take 1" />);
  expect(screen.getByText(/AzureActivity/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
});
