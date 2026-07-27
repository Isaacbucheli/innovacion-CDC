import "@testing-library/jest-dom";

// jsdom no implementa matchMedia; next-themes (modo claro/oscuro) lo necesita.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Radix UI Select enfoca el item activo con scrollIntoView, que jsdom no implementa: sin este
// stub, abrir un Select en un test tira "candidate?.scrollIntoView is not a function".
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Radix UI DropdownMenu usa PointerEvent que jsdom no implementa completamente.
if (typeof window.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  window.PointerEvent = PointerEvent as typeof window.PointerEvent;
}
