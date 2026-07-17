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

  test("al pasar el mouse sobre un punto muestra tooltip mes · score", () => {
    const { getAllByTestId, getByRole } = render(
      <PillarSparkline values={[40, 45]} labels={["May 26", "Jun 26"]} color="#123456" />,
    );
    const hits = getAllByTestId("spark-hit");
    fireEvent.mouseEnter(hits[hits.length - 1]); // último punto → índice 1
    expect(getByRole("tooltip").textContent).toBe("Jun 26 · 45%");
  });
});
