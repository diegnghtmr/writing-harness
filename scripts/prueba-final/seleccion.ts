// `--fallidas`: volver a correr solo lo que falló.
//
// Después de una serie completa, repetir tres corridas que fallaron o que el
// agente no terminó obligaba a elegir entre correr la serie entera de nuevo o
// armar a mano un `--agentes` y un `--variantes` que, cruzados, corrían
// también los pares que habían pasado. Esto elige los pares exactos de la
// serie de la raíz, y el ejecutor corre solo esos.

import { celda, type Veredicto } from './resumen.ts';

export type Par = { agente: string; variante: string; celda: string };

/**
 * Los pares de la raíz que vuelven a correr: los que dieron falla o error y,
 * con `conAvisos`, también los que pasaron con aviso. Van en el orden de la
 * matriz, por variante y dentro de cada una por agente. Los que tocaría
 * repetir pero no se pueden correr, por un agente o una variante que no está
 * entre los dados, quedan en `fuera`.
 */
export function fallidas(
  veredictos: readonly Veredicto[],
  o: { conAvisos: boolean; agentes: readonly string[]; variantes: readonly string[] },
): { pares: Par[]; fuera: Par[] } {
  const estados = new Set(o.conAvisos ? ['falla', 'error', 'aviso'] : ['falla', 'error']);
  const posicion = (xs: readonly string[], x: string) => (xs.includes(x) ? xs.indexOf(x) : xs.length);
  const elegidos = veredictos
    .filter((v) => estados.has(v.estado))
    .sort((a, b) => posicion(o.variantes, a.variante) - posicion(o.variantes, b.variante) || posicion(o.agentes, a.agente) - posicion(o.agentes, b.agente))
    .map((v) => ({ agente: v.agente, variante: v.variante, celda: celda(v) }));
  const corre = (p: Par) => o.agentes.includes(p.agente) && o.variantes.includes(p.variante);
  return { pares: elegidos.filter(corre), fuera: elegidos.filter((p) => !corre(p)) };
}
