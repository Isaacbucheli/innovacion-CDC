import { useCallback, useEffect, useRef, useState } from "react";
import { listAssignments, listPeople } from "@/lib/api";
import type { ConsultantAssignment, Person } from "@/types";

/** Carga en paralelo asignaciones + directorio de personas (mismo patrón que usePolicyCatalog). */
export function useConsultants() {
  const [assignments, setAssignments] = useState<ConsultantAssignment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [a, p] = await Promise.all([listAssignments(), listPeople()]);
      if (!mountedRef.current) return;
      setAssignments(a);
      setPeople(p);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { assignments, people, loading, error, reload };
}
