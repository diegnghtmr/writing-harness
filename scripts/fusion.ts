// Unir lo que se acaba de medir con el registro de lo que ya no se puede medir.
//
// Los dos generadores del registro, `manifiesto.ts` y `medir.ts`, se escribieron
// cuando el corpus entero estaba delante: leían todo y reescribían el archivo
// completo. Eso dejó de ser posible el día que se borró el primer corpus, y
// nadie se enteró porque desde entonces no se volvió a correr ninguno de los
// dos.
//
// Se enteró el día que llegó un corpus nuevo. `manifiesto.ts` habría borrado los
// trece registros anteriores, que son irrecuperables porque su corpus ya no
// existe, y `medir.ts` habría reventado al buscar en disco el primer archivo de
// un corpus ausente. Un generador que solo sabe reescribirlo todo es correcto
// mientras el todo esté a mano y destructivo en cuanto deja de estarlo.
//
// La regla que arregla las dos cosas es una sola: **un generador no puede borrar
// un registro que no puede volver a producir.** Un corpus ausente del disco no
// es un corpus retirado, es el estado normal de este repositorio. Así que lo que
// está en disco se vuelve a medir y lo que no está se conserva tal cual.
//
// Vive acá y no dentro de cada script por el motivo de siempre: la misma
// decisión escrita dos veces se corrige una sola vez y la otra queda mintiendo.

/**
 * Reemplaza las filas de los corpus medidos y conserva las de los ausentes.
 *
 * `medidos` son las carpetas que de verdad se leyeron del disco, no las que
 * produjeron filas. La diferencia importa: un corpus presente pero vacío tiene
 * que delatarse en su script, no colarse acá como si no estuviera.
 *
 * El orden final es por skill. `sort` es estable, así que el orden interno de
 * cada corpus, que en las mediciones es significativo, se conserva.
 */
export function fusionarPorSkill<T extends { skill: string }>(
  previas: readonly T[],
  nuevas: readonly T[],
  medidos: ReadonlySet<string>,
): T[] {
  const conservadas = previas.filter((f) => !medidos.has(f.skill));
  return [...nuevas, ...conservadas].sort((a, b) => a.skill.localeCompare(b.skill));
}

/** Los corpus del registro anterior que esta corrida no volvió a medir. */
export function conservados<T extends { skill: string }>(
  previas: readonly T[],
  medidos: ReadonlySet<string>,
): string[] {
  return [...new Set(previas.map((f) => f.skill))].filter((s) => !medidos.has(s)).sort();
}
