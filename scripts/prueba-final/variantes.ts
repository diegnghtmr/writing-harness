// Las variantes de uso que la prueba final corre con cada agente.
//
// Una por cada forma en que se usa el arnés: corregir sin tono, reescribir con
// cada tono y aplicar cada pasada. Salen del registro de `src/rules.ts`, igual
// que las opciones del verificador, así que un tono nuevo entra a la prueba el
// mismo día que entra al registro.

import { PASADAS, TONES } from '../../src/rules.ts';
import { ENTRADA } from '../../src/skills.ts';
import { ErrorDeUso } from './errores.ts';

/**
 * La base normativa, que rige con tono o sin él.
 *
 * El registro no la declara como capa con nombre de skill: la base son reglas
 * sueltas. El test comprueba que esta skill exista en el repositorio, para que
 * renombrarla haga fallar la suite y no a todos los agentes de la prueba.
 */
export const SKILL_BASE = 'spanish-writing';

export type Variante = {
  id: string;
  clase: 'base' | 'tono' | 'pasada';
  /** La skill propia de la variante: la del tono o la de la pasada. La base no tiene. */
  skill: string | null;
  /** Las opciones con que se mide su salida. */
  banderas: string[];
};

type Capas = Record<string, { skill: string }>;

export function variantes(tonos: Capas = TONES, pasadas: Capas = PASADAS): Variante[] {
  return [
    { id: 'base', clase: 'base', skill: null, banderas: [] },
    ...Object.entries(tonos).map(([id, t]): Variante => ({
      id,
      clase: 'tono',
      skill: t.skill,
      banderas: ['--tono', id],
    })),
    ...Object.entries(pasadas).map(([id, p]): Variante => ({
      id,
      clase: 'pasada',
      skill: p.skill,
      banderas: ['--pasada', id],
    })),
  ];
}

/** Las skills que el agente tiene que haber cargado en esa variante. */
export function skillsRequeridas(v: Variante): string[] {
  return v.skill === null ? [ENTRADA, SKILL_BASE] : [ENTRADA, SKILL_BASE, v.skill];
}

/**
 * Las variantes pedidas con `--variantes`, en el orden del registro.
 *
 * Vale el identificador o el nombre de la skill, igual que en el verificador:
 * quien acaba de leer `camus-writing` escribe ese nombre.
 */
export function elegirVariantes(lista: string | undefined, todas: Variante[]): Variante[] {
  if (lista === undefined) return todas;
  const pedidas = lista
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const desconocidas = pedidas.filter((p) => !todas.some((v) => v.id === p || v.skill === p));
  if (desconocidas.length > 0) {
    throw new ErrorDeUso(
      `variante desconocida: ${desconocidas.join(', ')}. Disponibles: ${todas.map((v) => v.id).join(', ')}.`,
    );
  }
  return todas.filter((v) => pedidas.includes(v.id) || (v.skill !== null && pedidas.includes(v.skill)));
}
