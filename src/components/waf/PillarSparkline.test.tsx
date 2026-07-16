import { describe, expect, test } from "vitest";
import { render } from "@testing-library/react";
import PillarSparkline from "@/components/waf/PillarSparkline";

describe("PillarSparkline", () => {
  test("con >=2 puntos válidos dibuja polyline y delta", () => {
    const { getByTestId, container } = render(<PillarSparkline values={[40, 45]} color="#123456" />);
    expect(getByTestId("pillar-sparkline")).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
    expect(getByTestId("pillar-sparkline").textContent).toContain("+5");
  });

  test("con <2 puntos válidos no renderiza nada", () => {
    const { container } = render(<PillarSparkline values={[null, 45]} color="#123456" />);
    expect(container.firstChild).toBeNull();
  });
});
