// Lo que se le pide a cada agente. Están todos acá para que se lean juntos.
//
// Son los de un usuario: qué hacer con el texto y dónde dejarlo. No dicen que
// se mida, ni que se anuncie el tono, ni que el texto no se repita en la
// respuesta. Esas tres cosas son las que la prueba comprueba, y las tiene que
// exigir `redactar-espanol`; si las pidiera el prompt, pasaría también un agente
// que no cargó ninguna skill.
//
// El tono se nombra por su skill, que es como lo nombra quien la tiene
// instalada. Las rutas van entre comillas invertidas para que el punto final
// no se lea como parte del nombre del archivo.

import type { Variante } from './variantes.ts';

/** El verbo con que un usuario pide cada pasada. Una pasada nueva necesita el suyo. */
const VERBO_DE_PASADA: Record<string, string> = {
  humanizar: 'Humaniza',
};

export function promptDe(v: Variante, entrada: string, salida: string): string {
  const destino = `y guarda el resultado en \`${salida}\`.`;
  if (v.clase === 'base') return `Corrige el texto de \`${entrada}\` ${destino}`;
  if (v.clase === 'tono') return `Reescribe el texto de \`${entrada}\` con el tono \`${v.skill}\` ${destino}`;
  const verbo = VERBO_DE_PASADA[v.id];
  if (verbo === undefined) {
    throw new Error(`la pasada ${v.id} no tiene prompt: hay que escribir su verbo en scripts/prueba-final/prompts.ts`);
  }
  return `${verbo} el texto de \`${entrada}\` ${destino}`;
}
