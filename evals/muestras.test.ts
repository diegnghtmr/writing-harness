// Una skill de tono tiene que mostrar el tono, no solo describirlo.
//
// El defecto que esto cierra ocurrió y lo encontró una persona leyendo, no la
// suite. El decimotercer tono se escribió con la mitad cuantitativa completa
// (medias, medianas, proporciones, todo medido) y sin un solo fragmento de prosa
// escrito en el registro que describía. Quien tenía que usarlo no tenía contra
// qué contrastar lo que estaba escribiendo.
//
// La lección general es que una cifra dice cuánto y no dice cómo. «La mediana
// está en 25 palabras» no le enseña a nadie a construir un periodo de 25
// palabras de este registro y no de otro. Hace falta la muestra al lado.
//
// **El piso es bajo a propósito.** Tres fragmentos no hacen una buena skill;
// solo impiden la que no muestra nada. Lo que separa a una skill útil de una
// pobre sigue siendo lectura, y este gate no la reemplaza.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TONE_IDS, TONES } from '../src/rules.ts';
import { readSkill, skillNames } from '../src/skills.ts';

/** Cuántos fragmentos de muestra tiene que traer una skill de tono. */
const PISO = 3;

/**
 * Las skills que no llegan al piso y son anteriores a este gate.
 *
 * Es el mismo trato que `evals/cobertura.ts` le da a los ítems sin regla: un
 * registro de lo que falta, que falla en las dos direcciones. Una skill nueva
 * por debajo del piso no entra, y una de estas que se arregle tiene que salir de
 * la lista o el gate deja de decir la verdad.
 *
 * La lista solo puede encoger. Si crece, alguien escribió una skill sin muestras
 * y la anotó acá en vez de escribirlas, que es exactamente lo que este archivo
 * viene a impedir.
 *
 * Hoy está vacía, y conviene decir por qué existe igual. Al escribir este gate una
 * sola skill quedaba por debajo del piso, con un único fragmento, y se prefirió
 * escribirle el ejemplo que le faltaba antes que anotarla. La lista queda para el
 * caso en que arreglar no sea posible en el momento, no como puerta de entrada.
 */
const SIN_MUESTRAS: Record<string, number> = {};

/**
 * Los fragmentos que muestran el registro en vez de describirlo.
 *
 * Se cuentan tres formas, porque la casa usa las tres y ninguna es la correcta:
 * la cita angular larga, que es como citan los tonos medidos sobre habla; el
 * bloque de cita, y el par «Antes/Después», que es como enseña la base.
 *
 * El umbral de cuarenta caracteres no es decorativo. Con veinte entraban
 * «oraciones cortas» y «perfectamente», que son palabras citadas y no muestras
 * de prosa: una skill puede entrecomillar veintidós términos sueltos y no haber
 * mostrado nunca una oración suya.
 */
export function muestrasDe(md: string): number {
  const cuerpo = md.replace(/^---\r?\n[\s\S]*?\r?\n---/u, '');
  const citas = (cuerpo.match(/«[^»]{40,}»/gu) ?? []).length;
  const bloques = (cuerpo.match(/^> .+$/gmu) ?? []).length;
  const pares = (cuerpo.match(/^(?:Antes|Después|Despues|Incorrecto|Correcto)\b/gmu) ?? []).length;
  return citas + bloques + pares;
}

const DE_TONO = () => TONE_IDS.map((t) => TONES[t]?.skill as string);

describe('cada skill de tono muestra el registro que describe', () => {
  test('ninguna baja del piso, salvo las anotadas', () => {
    const flacas = DE_TONO()
      .filter((s) => muestrasDe(readSkill(s)) < PISO)
      .filter((s) => !(s in SIN_MUESTRAS));
    assert.deepEqual(
      flacas,
      [],
      `estas skills describen un registro y no lo muestran, con menos de ${PISO} fragmentos`,
    );
  });

  test('la lista de anotadas dice la verdad sobre cada una', () => {
    // La otra dirección, y es la que hace que la lista encoja. Si una skill
    // anotada se arregla y nadie la saca, el registro pasa a describir un
    // problema que ya no existe y el próximo que lo lea no sabrá cuál creer.
    const mentirosas = Object.entries(SIN_MUESTRAS)
      .map(([s, n]) => [s, n, muestrasDe(readSkill(s))] as const)
      .filter(([, anotado, real]) => anotado !== real)
      .map(([s, anotado, real]) => `${s}: anotada con ${anotado}, tiene ${real}`);
    assert.deepEqual(mentirosas, []);
  });

  test('ninguna anotada llega ya al piso', () => {
    // Si una llega, se arregló y hay que sacarla de la lista.
    const arregladas = Object.keys(SIN_MUESTRAS).filter((s) => muestrasDe(readSkill(s)) >= PISO);
    assert.deepEqual(arregladas, [], 'estas ya cumplen y sobran en la lista');
  });

  test('la lista no nombra skills que no existen', () => {
    const vivas = new Set(skillNames());
    assert.deepEqual(Object.keys(SIN_MUESTRAS).filter((s) => !vivas.has(s)), []);
  });

  test('el contador distingue una muestra de una palabra entrecomillada', () => {
    // El canario. Con el umbral en veinte, una skill que cita veintidós términos
    // sueltos pasaba como si mostrara prosa.
    assert.equal(muestrasDe('Usa «perfectamente» y «evidentemente» a menudo.'), 0);
    assert.equal(
      muestrasDe('Así abre: «La política, anunciada sin aviso, afecta a miles de trabajadores».'),
      1,
    );
    assert.equal(muestrasDe('> Un bloque de cita cuenta igual.\n'), 1);
    assert.equal(muestrasDe('Antes: lo que no va.\nDespués: lo que va.\n'), 2);
    // El frontmatter no cuenta: su descripción cita frases de invocación, y esas
    // no muestran el registro. `adria-sola` daba una muestra falsa por ahí.
    assert.equal(
      muestrasDe('---\nname: x\ndescription: Úsese con «que le diga al lector qué hacer y cómo».\n---\nCuerpo.'),
      0,
    );
  });
});
