import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BLOQUES_ECONOMICOS } from "@/lib/informeValor";
import SeccionConsumo from "./SeccionConsumo";
import SeccionOperacion from "./SeccionOperacion";
import SeccionPostura from "./SeccionPostura";
import SeccionRoadmap from "./SeccionRoadmap";
import SeccionSeguridad from "./SeccionSeguridad";
import type {
  InformeConsumo, InformeOperacion, InformePostura, InformeRoadmap, InformeSeguridad,
} from "@/types";

// Los fixtures están tipados contra el modelo real a propósito: si la API cambia la forma de un
// bloque, estos tests dejan de compilar en vez de seguir probando una forma que ya no existe.

function fact(over: Partial<InformeConsumo> = {}): InformeConsumo {
  return {
    filas: 26608, filasEnRango: 12040, total: 154000,
    meses: [["2026-01", 80000, 0], ["2026-02", 74000, 1]],
    ultCompleto: "2026-01", parciales: ["2026-02"], autoParciales: ["2026-02"], parcialesInexistentes: [],
    subs: [["Suscripción principal", 154000]],
    nRecursos: 320, nIds: 340, nRg: 22, nCats: 9, picoAct: 318, picoMes: "2026-01",
    serie: [["2026-01", 318, 0, 0, 80000, 0, 0], ["2026-02", 300, 2, 0, 74000, 0, 1]],
    bajasDef: 4, cargaRet: 1200, unidadCargaRet: "USD, suma del ultimo mes facturado de cada recurso dado de baja",
    prom: [["2026", 1, 80000, 80000]],
    ahorro: null, comp: null, cc: [["(sin asignar)", 154000]],
    variacionConsumo: null,
    ...over,
  };
}

describe("SeccionConsumo", () => {
  it("marca el mes parcial en vez de dejarlo pasar como mes cerrado", () => {
    render(<SeccionConsumo fact={fact()} catSerie={null} />);

    expect(screen.getByText(/mes\(es\) parcial\(es\): feb 2026/i)).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });

  // D5: en un mes parcial las bajas no se cuentan. Ese 0 del modelo no es "no hubo bajas".
  it("no dibuja las bajas de un mes parcial como cero", () => {
    render(<SeccionConsumo fact={fact()} catSerie={null} />);

    const marcas = screen.getAllByTitle(/mes parcial: las bajas de un mes incompleto no se cuentan/i);
    expect(marcas.length).toBeGreaterThan(0);
  });

  it("avisa cuando el consultor declaro parcial un mes que no existe en el insumo", () => {
    render(<SeccionConsumo fact={fact({ parcialesInexistentes: ["2025-12"] })} catSerie={null} />);

    expect(screen.getByText(/dic 2025/)).toBeInTheDocument();
    expect(screen.getByText(/no se aplicó nada/i)).toBeInTheDocument();
  });

  it("sin caida sostenida dice por que no hay ahorro activo, no publica un ahorro de cero", () => {
    render(<SeccionConsumo fact={fact()} catSerie={null} />);

    expect(screen.getByText(/no es un ahorro de cero/i)).toBeInTheDocument();
  });

  it("no publica una cifra anualizada cuando la caida no lleva tres meses cerrados", () => {
    render(<SeccionConsumo catSerie={null} fact={fact({
      ahorro: {
        cat: "Storage", pico: 5000, picoMes: "2026-01", fin: 2000, finMes: "2026-02",
        dif: 3000, mesesSostenido: 1, anualizada: null,
      },
    })} />);

    expect(screen.getByText("No se publica")).toBeInTheDocument();
    expect(screen.getByTitle(/se necesitan 3 para anualizar/i)).toBeInTheDocument();
  });

  // La política global de serialización de la API transforma las claves de diccionario: el monto
  // es correcto pero el rótulo ya no es el nombre de la categoría. Se declara, no se disimula.
  it("avisa cuando los nombres de categoria llegan normalizados por la API", () => {
    render(<SeccionConsumo fact={fact()} catSerie={{ redes_y_conectividad: { "2026-01": 500 } }} />);

    expect(screen.getByText(/nombres de categoría llegan normalizados/i)).toBeInTheDocument();
  });

  it("no avisa nada cuando los nombres de categoria llegan intactos", () => {
    render(<SeccionConsumo fact={fact()} catSerie={{ "Redes y Conectividad": { "2026-01": 500 } }} />);

    expect(screen.queryByText(/nombres de categoría llegan normalizados/i)).toBeNull();
  });

  // D11: la identidad de un recurso es la terna suscripción + grupo + nombre (`nIds`). `nRecursos`
  // cuenta por nombre global y colapsa homónimos de suscripciones distintas: es el conteo que D11
  // rechaza, y el informe entregado nunca lo publicó. Publicarlo acá dejaba dos cifras distintas
  // rotuladas "recursos", una por renderizador.
  it("cuenta los recursos por la terna y no por nombre global", () => {
    render(<SeccionConsumo fact={fact()} catSerie={null} />);

    expect(screen.getAllByText("340").length).toBeGreaterThan(0);
    expect(screen.queryByText("320")).toBeNull();
  });
});

function tickets(over: Partial<InformeOperacion> = {}): InformeOperacion {
  return {
    n: 40, cumple: 30, noCumple: 4, sinEvaluar: 6, pct: 88.2, denominadorPct: 34,
    cerrados: 38, media: 12.5, mediana: 8, p90: 40, mediaOk: 6, enDias: false,
    cats: [{ n: "Incidente", c: 25, f: 3, med: 7 }],
    meses: [["2026-01", 20, 2], ["2026-02", 20, 2]],
    racha: 2, rachaCasos: 20,
    frentes: [{ n: "Backup", c: 10, r: true }],
    nFrentes: 5, nFrentesR: 2, nFrentesP: 2, casosR: 12, casosSinSubcategoria: 3,
    hor: [["Horario de oficina", 30]], desde: "2026-01-01", hasta: "2026-02-28",
    fuera: [["CAS-1", "2026-01-10", "Incidente", "Backup", 8, 30]],
    lista: [],
    ...over,
  };
}

describe("SeccionOperacion", () => {
  it("declara el denominador del cumplimiento en vez de dividir sobre el total", () => {
    render(<SeccionOperacion t={tickets()} />);

    expect(screen.getByText("88.2%")).toBeInTheDocument();
    expect(screen.getByText(/sobre 34 caso\(s\) evaluado\(s\), no sobre los 40/i)).toBeInTheDocument();
  });

  // Sin ningún caso evaluado el porcentaje del modelo vale 0. Dibujarlo diría que la mesa
  // incumplió todo.
  it("sin casos evaluados no dibuja un cumplimiento de cero por ciento", () => {
    render(<SeccionOperacion t={tickets({ cumple: 0, noCumple: 0, sinEvaluar: 40, pct: 0, denominadorPct: 0 })} />);

    expect(screen.queryByText("0.0%")).toBeNull();
    expect(screen.getByTitle(/no hay denominador que dividir/i)).toBeInTheDocument();
  });

  it("saca los casos sin subcategoria del conteo proactivo y lo dice", () => {
    render(<SeccionOperacion t={tickets()} />);

    expect(screen.getByText(/no se cuentan como proactivos por omisión/i)).toBeInTheDocument();
  });

  // El frente residual "(sin subcategoría)" no es reactivo, y `nFrentes - nFrentesR` lo contaba como
  // proactivo: la proporción por frentes se calcula sobre los CLASIFICADOS.
  it("no cuenta el frente residual como proactivo", () => {
    // 6 proactivos, 3 reactivos, 1 residual: 6/9 = 66.7 %, no 7/10 = 70.0 %.
    render(<SeccionOperacion t={tickets({ nFrentes: 10, nFrentesR: 3, nFrentesP: 6 })} />);

    expect(screen.getByText(/por frentes clasificados: 66\.7%/i)).toBeInTheDocument();
    expect(screen.queryByText(/70\.0%/)).toBeNull();
    expect(screen.getByText(/1 sin clasificar/i)).toBeInTheDocument();
  });

  it("sin ningun caso con subcategoria no publica una proporcion de trabajo proactivo", () => {
    render(<SeccionOperacion t={tickets({
      n: 40, casosR: 0, casosSinSubcategoria: 40, nFrentes: 1, nFrentesR: 0, nFrentesP: 0,
    })} />);

    expect(screen.getByTitle(/no hay nada que clasificar/i)).toBeInTheDocument();
    expect(screen.queryByText("0.0%")).toBeNull();
  });

  // Contrato F0: el informe entregado publica la tabla de TODOS los casos y esta vista tenía solo
  // los que quedaron fuera de SLA. El consultor aprobaba la entrega sin haber visto la tabla más
  // larga que recibe el cliente.
  it("publica el detalle de todos los casos con los tres estados de cumplimiento", () => {
    render(<SeccionOperacion t={tickets({
      lista: [["CAS-9", "2026-01-11", "Incidente", "", 8, 2, "SIN EVALUAR", "Fuera de horario"]],
    })} />);

    expect(screen.getByText("CAS-9")).toBeInTheDocument();
    expect(screen.getByTitle(/no cuenta ni a favor ni en contra/i)).toBeInTheDocument();
  });

  it("publica la mediana y los casos fuera de SLA de cada categoria", () => {
    render(<SeccionOperacion t={tickets()} />);

    expect(screen.getByText("Mediana de atención")).toBeInTheDocument();
    expect(screen.getByText("7.0 h")).toBeInTheDocument();
  });
});

function rbac(over: Partial<InformeSeguridad> = {}): InformeSeguridad {
  return {
    n: 120, nu: 90, ns: 30, ids: 45, idsU: 35, idsS: 10,
    subs: [["Suscripción principal", 90, 30]],
    roles: [["Reader", 60, 0], ["Owner", 4, 1]], rolesSp: [["Contributor", 30, 1]],
    owner: 4, uaa: 1, contrib: 30, priv: 35,
    sinLogin: null, ultimoLoginMedido: false,
    sinNombre: 2, disab: 3, estadoCuentaMedido: true,
    spTop: null, find: [], crit: 0,
    ...over,
  };
}

describe("SeccionSeguridad", () => {
  // El caso que dio origen a la regla: con el último login sin leer, la versión anterior emitía un
  // hallazgo Alto pidiendo depurar los accesos de toda la gente del cliente.
  it("con el eje de sesion sin medir no publica un conteo de cero", () => {
    render(<SeccionSeguridad rb={rbac()} origen="base" />);

    expect(screen.getByTitle(/el último inicio de sesión no se pudo leer/i)).toBeInTheDocument();
    expect(screen.getByText(/los hallazgos que dependen de esos ejes no se emiten/i)).toBeInTheDocument();
  });

  it("con el eje medido publica el conteo, incluso si es cero", () => {
    render(<SeccionSeguridad rb={rbac({ sinLogin: 0, ultimoLoginMedido: true })} origen="base" />);

    expect(screen.queryByTitle(/el último inicio de sesión no se pudo leer/i)).toBeNull();
    expect(screen.getByText("Identidades sin inicio de sesión registrado")).toBeInTheDocument();
  });

  it("dice de que fuente salieron los permisos", () => {
    render(<SeccionSeguridad rb={rbac()} origen="archivo" />);
    expect(screen.getByText(/fuente: archivo subido/i)).toBeInTheDocument();
  });

  // Contrato F0: el informe entregado nombra la suscripción que concentra la automatización. `spTop`
  // es null cuando no hay ninguna asignación de service principal, que no es un cero.
  it("nombra la suscripcion que concentra la automatizacion", () => {
    render(<SeccionSeguridad rb={rbac({ spTop: ["Suscripción principal", 90, 24] })} origen="base" />);

    expect(screen.getByText(/concentra 24 de las 30/i)).toBeInTheDocument();
  });

  it("sin asignaciones de service principal no dice nada de la automatizacion", () => {
    render(<SeccionSeguridad rb={rbac({ spTop: null })} origen="base" />);

    expect(screen.queryByText(/de toda la automatización/i)).toBeNull();
  });
});

function advisor(over: Partial<InformePostura> = {}): InformePostura {
  return {
    n: 51, tipos_rec: 14,
    cats: [{ n: "Optimización de costos", c: 20, h: 5, m: 10, l: 5 }],
    subs: [{ n: "Suscripción principal", c: 51 }],
    tipos: [{ n: "virtualMachines", c: 30 }],
    top: [["Redimensionar VMs", "Costos", "Alto", 12]], topSum: 12, det: [],
    nRes: 40, recomendacionesConRecurso: 48, high: 5, medium: 30, low: 16,
    bruto: 0, real: 0, descarte: 0, nSav: 0, savLineas: [], porSub: {},
    rets: [], vencidos: 0, proximos: 0, retirosMedido: true, retirosMotivo: null,
    seguridadGestionadaExternamente: false, seguridadGestionadaNota: null,
    ...over,
  };
}

describe("SeccionPostura", () => {
  // Azure no siempre devuelve el ahorro anual y no se persiste en columna propia: sin ninguna
  // línea cuantificada, el cero es falta de dato, no falta de ahorro.
  it("sin lineas cuantificadas no publica un ahorro de cero", () => {
    render(<SeccionPostura ad={advisor()} corte="31/7/2026" />);

    expect(screen.queryByText("$0.00")).toBeNull();
    expect(screen.getAllByTitle(/ahorro anual cuantificado/i).length).toBeGreaterThan(0);
  });

  it("con lineas cuantificadas publica bruto, realizable y descartado", () => {
    render(<SeccionPostura corte="31/7/2026" ad={advisor({
      bruto: 12000, real: 9000, descarte: 3000, nSav: 2,
      savLineas: [
        { rec: "Comprar reserva", sub: "Suscripción principal", monto: 9000, tipo: "reserva", contada: true },
        { rec: "Comprar savings plan", sub: "Suscripción principal", monto: 3000, tipo: "savings plan", contada: false },
      ],
    })} />);

    // El realizable sale dos veces a propósito: como titular y como la línea que lo compone.
    expect(screen.getAllByText("$9,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("$12,000.00")).toBeInTheDocument();
    expect(screen.getByText("No, excluyente")).toBeInTheDocument();
  });

  // Contrato F0: el desglose de impacto por pilar decide por dónde empezar y el informe entregado lo
  // dibuja como barra segmentada; un gráfico de barras simple solo lleva el total, así que va en tabla.
  it("publica el desglose de impacto por pilar y la concentracion del backlog", () => {
    render(<SeccionPostura ad={advisor()} corte="31/7/2026" />);

    expect(screen.getByText("Concentración del backlog")).toBeInTheDocument();
    expect(screen.getByText(/las 15 recomendaciones más repetidas suman 12 de 51/i)).toBeInTheDocument();
    expect(screen.getByText("Bajo")).toBeInTheDocument();
  });

  // Los retiros salen del módulo Boletín, que se sincroniza a mano y por cliente: "0 retiros" y
  // "nadie fue a buscarlos" son dos hechos distintos y hasta acá salían iguales en las dos vistas.
  it("sin corrida del boletin no afirma que no hay retiros", () => {
    render(<SeccionPostura corte="31/7/2026" ad={advisor({
      retirosMedido: false,
      retirosMotivo: "El módulo Boletín todavía no sincronizó los anuncios de Azure para este cliente.",
    })} />);

    expect(screen.queryByText(/ningún retiro vigente/i)).toBeNull();
    expect(screen.getByText(/todavía no sincronizó/i)).toBeInTheDocument();
    expect(screen.getByTitle(/todavía no sincronizó/i)).toBeInTheDocument();
  });

  it("con la corrida completa publica el cero de retiros como un hecho", () => {
    render(<SeccionPostura ad={advisor({ retirosMedido: true, retirosMotivo: null })} corte="31/7/2026" />);

    expect(screen.getByText(/no registra ningún retiro vigente/i)).toBeInTheDocument();
  });

  it("publica el backlog desagregado por suscripcion", () => {
    render(<SeccionPostura corte="31/7/2026" ad={advisor({
      det: [["Redimensionar VMs", "Costos", "Alto", "Suscripción secundaria", 7]],
    })} />);

    expect(screen.getByText("Suscripción secundaria")).toBeInTheDocument();
  });

  it("distingue un pilar de seguridad vacio de uno gestionado por fuera", () => {
    render(<SeccionPostura corte="31/7/2026" ad={advisor({
      seguridadGestionadaExternamente: true,
      seguridadGestionadaNota: "El cliente gestiona la seguridad con su propio servicio.",
    })} />);

    expect(screen.getByText(/quedaron excluidas a propósito/i)).toBeInTheDocument();
  });
});

describe("los seis bloques economicos", () => {
  // El cable entre esta vista y la pestaña de entrega: los seis bloques que se aprueban uno por uno
  // se nombran en BLOQUES_ECONOMICOS, y esta vista marca los seis desde esa misma lista. Si alguien
  // agrega un bloque a la lista y no lo marca (o al revés), este test cae.
  it("estan todos marcados en la vista, con la etiqueta de la lista compartida", () => {
    render(<>
      <SeccionConsumo fact={fact()} catSerie={null} />
      <SeccionPostura ad={advisor()} corte="31/7/2026" />
    </>);

    const titulos = screen.getAllByText("Económico").map((b) => b.getAttribute("title") ?? "");
    expect(titulos).toHaveLength(BLOQUES_ECONOMICOS.length);
    for (const bloque of BLOQUES_ECONOMICOS) {
      expect(titulos.some((t) => t.includes(bloque.etiqueta))).toBe(true);
    }
  });
});

function matriz(over: Partial<InformeRoadmap> = {}): InformeRoadmap {
  return {
    n: 18, items: [{ a: "Costos", t: "Apagar VMs sin uso", f: "2026-05-01", i: 3, p: "1", e: null, v: 40, n: 2, g: "REG-1" }],
    amb: [{ n: "Costos", c: 8, rec: 12, av: 40 }],
    cerrados: 5, curso: 6, sinIniciar: 7, avance: 42, horas: null,
    ...over,
  };
}

describe("SeccionRoadmap", () => {
  it("no publica cero horas pendientes cuando el esfuerzo no esta medido", () => {
    render(<SeccionRoadmap mz={matriz()} />);

    expect(screen.queryByText("0 h")).toBeNull();
    expect(screen.getAllByTitle(/publicar 0 h afirmaría que cerrar el roadmap no cuesta trabajo/i).length)
      .toBeGreaterThan(0);
  });

  it("publica las horas cuando si estan medidas", () => {
    render(<SeccionRoadmap mz={matriz({ horas: 120 })} />);
    expect(screen.getByText("120 h")).toBeInTheDocument();
  });

  // Hallazgos y recomendaciones asociadas son dos cifras distintas por ámbito: en el informe
  // entregado el largo de la barra medía una y su rótulo nombraba la otra.
  it("publica hallazgos y recomendaciones por ambito en columnas propias", () => {
    render(<SeccionRoadmap mz={matriz()} />);

    expect(screen.getAllByText("Hallazgos").length).toBeGreaterThan(0);
    expect(screen.getByText("Recomendaciones de Advisor")).toBeInTheDocument();
  });
});
