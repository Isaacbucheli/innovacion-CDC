import { describe, expect, test } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import PillarSparkline from "@/components/waf/PillarSparkline";

describe("PillarSparkline", () => {
  test("con >=2 puntos válidos dibuja área, línea y delta", () => {
    const { getByTestId, container } = render(<PillarSparkline values={[40, 45]} color="#123456" />);
    expect(getByTestId("pillar-sparkline")).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
    expect(container.querySelector("path")).toBeTruthy(); // relleno de área (estilo B)
    expect(getByTestId("pillar-sparkline").textContent).toContain("+5");
  });

  test("con <2 puntos válidos no renderiza nada", () => {
    const { container } = render(<PillarSparkline values={[null, 45]} color="#123456" />);
    expect(container.firstChild).toBeNull();
  });

  test("tendencia: subida ▲, bajada ▼ y sin cambio neutro ±0 (no flecha verde)", () => {
    // .container aísla cada render (getByTestId busca en todo document.body y chocaría).
    const up = render(<PillarSparkline values={[40, 45]} color="#123456" />).container;
    expect(up.textContent).toContain("▲ +5");

    const down = render(<PillarSparkline values={[80.4, 76]} color="#123456" />).container;
    expect(down.textContent).toContain("▼ -4.4");

    const flat = render(<PillarSparkline values={[78, 78]} color="#123456" />).container;
    expect(flat.textContent).toContain("±0");
    expect(flat.textContent).not.toContain("▲"); // 0 no muestra flecha de subida
  });

  test("al pasar el mouse sobre un punto muestra tooltip mes · score", () => {
    const { getAllByTestId, getByRole } = render(
      <PillarSparkline values={[40, 45]} labels={["May 26", "Jun 26"]} color="#123456" />,
    );
    const hits = getAllByTestId("spark-hit");
    fireEvent.mouseEnter(hits[hits.length - 1]); // último punto → índice 1
    expect(getByRole("tooltip").textContent).toBe("Jun 26 · 45%");
  });
});
