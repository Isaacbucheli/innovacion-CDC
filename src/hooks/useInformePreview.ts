import { useCallback, useEffect, useRef, useState } from "react";
import { previewInformeValor, previewVariacionConsumo } from "@/lib/api";
import type { InformeValorModelo, InformeValorPreviewRequest, InformeVariacionConsumo } from "@/types";

/**
 * Estado de la fase 2 (las reservas leídas contra Azure).
 *
 * - "inactiva": todavía no se pidió ningún informe.
 * - "cargando": la llamada está en vuelo. Puede tardar entre 10 y 30 segundos.
 * - "lista": volvió. Ojo: "lista" NO quiere decir que el eje esté medido -- un cliente sin
 *   credenciales activas devuelve 200 con `reservas.medido: false` y su motivo. Esa diferencia la
 *   lee la vista del propio bloque, no este estado.
 * - "error": la llamada falló (HTTP/red). El bloque queda sin cifras y con un botón de reintento.
 */
export type FaseReservas = "inactiva" | "cargando" | "lista" | "error";

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

/**
 * La vista previa del informe en dos fases, igual que la pantalla de reservas del producto
 * (ReservationsPage: primero la lista, después la utilización).
 *
 * Fase 1 (`POST /preview`) trae el modelo entero desde la base propia y el insumo BITCOST, y
 * responde rápido. Fase 2 (`POST /preview/variacion-consumo`) lee las reservas del cliente en vivo
 * contra Azure -- una llamada a Consumption por reserva activa, en secuencia -- y devuelve el
 * bloque `fact.variacionConsumo` COMPLETO.
 *
 * Por qué el bloque de la fase 1 no se dibuja mientras la 2 está en vuelo: el balde de reservas le
 * saca recursos a los otros dos ("gana la reserva", E3/E9), así que en la fase 1 los tres baldes y
 * la variación total son provisionales y cambian cuando llega la foto. Mostrarlos como definitivos
 * sería publicar cifras que se mueven solas. La fase 1 igual trae el eje declarado no medido, con
 * un motivo que dice que el dato se pide aparte: ese motivo es lo único que distingue "falta una
 * llamada" de "el cliente no tiene reservas", y la vista lo muestra tal cual.
 *
 * `variacion` reemplaza `modelo.fact.variacionConsumo` entero cuando llega; nunca se mezclan
 * campos de las dos respuestas.
 */
export function useInformePreview(clientId: number | null) {
  const [modelo, setModelo] = useState<InformeValorModelo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variacion, setVariacion] = useState<InformeVariacionConsumo | null>(null);
  const [faseReservas, setFaseReservas] = useState<FaseReservas>("inactiva");
  const [errorReservas, setErrorReservas] = useState<string | null>(null);

  // Corrida vigente: una respuesta vieja (o de otro cliente) que llega tarde no puede pisar la
  // pantalla. Mismo patrón que ReservationsPage.
  const runId = useRef(0);
  const mounted = useRef(true);
  // El cuerpo exacto de la corrida vigente: el reintento de la fase 2 tiene que mandar el MISMO
  // que la fase 1, o el bloque que vuelve mide otra ventana.
  const cuerpoVigente = useRef<InformeValorPreviewRequest | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const limpiar = useCallback(() => {
    runId.current++;
    cuerpoVigente.current = null;
    setModelo(null);
    setError(null);
    setVariacion(null);
    setErrorReservas(null);
    setFaseReservas("inactiva");
    setCargando(false);
  }, []);

  // Cambiar de cliente descarta el informe anterior: dejarlo en pantalla con el cliente nuevo ya
  // seleccionado es la peor forma de equivocarse en este módulo.
  useEffect(() => { limpiar(); }, [clientId, limpiar]);

  const pedirReservas = useCallback(async (cid: number, cuerpo: InformeValorPreviewRequest, corrida: number) => {
    setFaseReservas("cargando");
    setErrorReservas(null);
    try {
      const v = await previewVariacionConsumo(cid, cuerpo);
      if (!mounted.current || corrida !== runId.current) return;
      setVariacion(v);
      setFaseReservas("lista");
    } catch (e) {
      if (!mounted.current || corrida !== runId.current) return;
      setErrorReservas(msg(e));
      setFaseReservas("error");
    }
  }, []);

  const generar = useCallback(async (cuerpo: InformeValorPreviewRequest) => {
    if (clientId == null) return;
    const corrida = ++runId.current;
    cuerpoVigente.current = cuerpo;
    setCargando(true);
    setError(null);
    setModelo(null);
    setVariacion(null);
    setErrorReservas(null);
    setFaseReservas("inactiva");
    try {
      const m = await previewInformeValor(clientId, cuerpo);
      if (!mounted.current || corrida !== runId.current) return;
      setModelo(m);
      setCargando(false);
      // La fase 2 arranca sola: no se le pide al consultor un segundo clic para completar algo que
      // el informe siempre necesita.
      void pedirReservas(clientId, cuerpo, corrida);
    } catch (e) {
      if (!mounted.current || corrida !== runId.current) return;
      setError(msg(e));
      setCargando(false);
    }
  }, [clientId, pedirReservas]);

  const reintentarReservas = useCallback(() => {
    const cuerpo = cuerpoVigente.current;
    if (clientId == null || cuerpo == null) return;
    void pedirReservas(clientId, cuerpo, runId.current);
  }, [clientId, pedirReservas]);

  return {
    modelo, cargando, error,
    variacion, faseReservas, errorReservas,
    generar, reintentarReservas, limpiar,
  };
}
