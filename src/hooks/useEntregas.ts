import { useCallback, useEffect, useRef, useState } from "react";
import {
  descargarEntregaInformeValor, generarInformeValor, getEntregasInformeValor,
} from "@/lib/api";
import type { InformeValorEntrega, InformeValorGenerarRequest } from "@/types";

/**
 * El archivo de entregas de un cliente y la generación de una nueva.
 *
 * Las dos cosas viven en el mismo hook a propósito: generar produce una fila del archivo, así que la
 * tabla tiene que quedar al día sin que nadie recargue la pantalla. Si la generación viviera aparte,
 * el consultor bajaría un informe y no lo vería en el historial hasta cambiar de cliente y volver.
 *
 * `generar` descarga por el MISMO camino que la tabla (la entrega archivada), no por una respuesta
 * binaria propia: así lo que se acaba de bajar es exactamente lo que se va a poder volver a bajar.
 */
export function useEntregas(clientId: number | null) {
  const [entregas, setEntregas] = useState<InformeValorEntrega[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState<string | null>(null);

  const mounted = useRef(true);
  // Corrida vigente: la lista de un cliente que llega tarde no puede pisar la del cliente que ya
  // está en pantalla. Mismo patrón que el resto del módulo.
  const runId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const cargar = useCallback(async (cid: number) => {
    const corrida = ++runId.current;
    setCargando(true);
    setError(null);
    try {
      const lista = await getEntregasInformeValor(cid);
      if (!mounted.current || corrida !== runId.current) return;
      setEntregas(lista);
    } catch (e) {
      if (!mounted.current || corrida !== runId.current) return;
      // La lista vacía y la lista que no se pudo leer se distinguen: `error` manda sobre `entregas`
      // en la vista, o una falla de red se vería como "este cliente nunca recibió un informe".
      setEntregas([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current && corrida === runId.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (clientId == null) {
      runId.current++;
      setEntregas([]);
      setError(null);
      return;
    }
    void cargar(clientId);
  }, [clientId, cargar]);

  const recargar = useCallback(async () => {
    if (clientId != null) await cargar(clientId);
  }, [clientId, cargar]);

  /**
   * Genera, archiva, descarga y refresca la tabla. Devuelve la entrega tal como quedó archivada
   * (con los bloques que el artefacto publica de verdad) para que quien llame pueda contarlo.
   */
  const generar = useCallback(async (body: InformeValorGenerarRequest): Promise<InformeValorEntrega> => {
    if (clientId == null) throw new Error("No hay cliente seleccionado.");
    setGenerando(body.variante);
    try {
      const entrega = await generarInformeValor(clientId, body);
      try {
        await descargarEntregaInformeValor(clientId, entrega);
      } finally {
        // La fila ya está archivada aunque la descarga falle, así que la tabla se refresca igual: el
        // historial no puede mostrar menos entregas de las que existen, y desde ahí se vuelve a
        // bajar el archivo que no llegó.
        void recargar();
      }
      return entrega;
    } finally {
      if (mounted.current) setGenerando(null);
    }
  }, [clientId, recargar]);

  return { entregas, cargando, error, generando, generar, recargar };
}
