// Las cifras que dos o más gates comparan entre sí, en un solo sitio.
//
// Es el mismo motivo de `retiradas.ts`, y vale la pena decirlo entero porque se
// llegó acá por el camino largo. Estas cifras vivían dentro de los `describe`
// que las comprueban, y el README las repetía de memoria. Envejecieron: decía
// dos corpus exactos cuando eran tres, y las dos proporciones de expresiones
// seguían en la versión anterior a que se retiraran tres skills.
//
// El primer arreglo fue importar un archivo de test desde otro. Funcionaba y
// estaba mal: un `*.test.ts` importado vuelve a correr sus propios `describe`
// dentro del proceso del que lo importa, así que veintiún tests pasaban a
// ejecutarse dos veces y el recuento de la suite mentía sobre cuánto se está
// comprobando de verdad.
//
// Un dato que leen dos gates no es un test. Es un dato, y vive en un módulo
// llano que no declara ninguno.

import { EXPRESIONES } from '../src/mediciones.ts';
import { readSkill, skillNames } from '../src/skills.ts';

/**
 * Lo que cada skill enuncia en su prosa contra lo que se midió de su corpus.
 *
 * Los dos números están congelados a propósito, incluso donde no coinciden.
 * Ocho corpus caen dentro del 0,5 % y tres dan exacto: eso confirma el método,
 * porque el desvío que queda es del orden de lo que cambia al recortar las
 * marcas de tiempo de otra manera. Congelar la diferencia impide que crezca sin
 * que nadie lo note, que es distinto de fingir que no existe.
 *
 * `prosa` en `null` es que esa skill no enuncia ningún total: `catedra` escribe
 * sus cantidades con letra y `sekkyoku` solo declara cuántas transcripciones
 * son.
 *
 * han es el caso aparte. Enuncia 1.654 palabras de prosa real del libro y 2.217
 * de otra cuenta; el corpus de fichas mide 2.090. Sus cifras no salen de este
 * corpus, y el dato lo deja dicho.
 */
export const DECLARADO: Record<
  string,
  {
    prosa: number | null;
    medido: number;
    /**
     * Contra qué archivo se compara `prosa`, cuando no es contra el agregado.
     *
     * Casi ninguna skill lo necesita: enuncian el total de su corpus y el
     * agregado cuenta ese mismo total. Hace falta cuando el corpus tiene un
     * archivo entero y otro con el subconjunto que se midió, porque entonces el
     * agregado suma los dos y la prosa habla de uno.
     */
    archivo?: string;
  }
> = {
  // El primero que da exacto porque se midió con este mismo script y su cifra
  // se copió de la salida. Los otros dos exactos lo son por coincidencia: sus
  // skills se escribieron antes y con otro método de conteo.
  'adria-sola-writing': { prosa: 63402, medido: 63402 },
  'atenas-writing': { prosa: 49328, medido: 49379 },
  'bettatech-writing': { prosa: 62652, medido: 62652 },
  'catedra-writing': { prosa: null, medido: 45449 },
  'dotcsv-writing': { prosa: 64830, medido: 64848 },
  'fonda-writing': { prosa: 95038, medido: 95275 },
  'fonseca-writing': { prosa: 114513, medido: 114453 },
  'freddy-writing': { prosa: 99544, medido: 99371 },
  'han-writing': { prosa: 2217, medido: 2090 },
  'kenway-writing': { prosa: 61779, medido: 61892 },
  'medicendai-writing': { prosa: 97907, medido: 98363 },
  'schiavenato-writing': { prosa: 48629, medido: 48629 },
  'sekkyoku-writing': { prosa: null, medido: 54264 },
  'solitario-writing': { prosa: 34118, medido: 34150 },
  // triangulacion es el único que necesita decir contra qué archivo se compara.
  //
  // Su corpus son dos: el informe entero y el subconjunto que se midió. El
  // agregado cuenta los dos, 36.342 palabras, y la skill enuncia 12.239, que es
  // el subconjunto. Comparar una contra otra da un desvío del 197 % sobre dos
  // cifras que las dos son ciertas, y durante un rato este renglón lo declaró
  // así, como excepción, al lado de han. Era esconder el problema en la lista de
  // los que se salen.
  //
  // La cifra comparable estaba en `POR_ARCHIVO` todo el tiempo:
  // «02-informe-medido.md» mide 12.209 palabras contra las 12.239 que la prosa
  // enuncia, un desvío del 0,245 % que cae holgado dentro de la banda del 0,5 %.
  // Lo que faltaba no era el dato sino decir cuál de los dos archivos mira este
  // renglón, y para eso está `archivo`.
  'triangulacion-writing': { prosa: 12239, medido: 36342, archivo: '02-informe-medido.md' },
};

/**
 * Las skills cuya prosa declara un total de minutos de habla.
 *
 * Son las que dan el total del corpus. Varias otras declaran la duración de
 * alguna pieza suelta y esas no entran: lo que se compara es la suma contra la
 * suma.
 */
export const MINUTOS: Record<string, number> = {
  'adria-sola-writing': 380,
  'atenas-writing': 295,
  'schiavenato-writing': 294,
  'sekkyoku-writing': 304,
  'solitario-writing': 254,
};

export type Par = {
  skill: string;
  expresion: string;
  palabras: number;
  prosa: number;
  medido: number;
};

/**
 * Los pares «expresión» seguida de su cifra que la prosa pone pegados.
 *
 * El convenio de la prosa es «X» N, la expresión y después la cifra. Costó dos
 * intentos: el primero admitía ochenta caracteres de holgura y asignaba el
 * mismo número a dos expresiones; el segundo probó N «X», que es el convenio al
 * revés, y en una lista emparejaba cada cifra con la expresión siguiente.
 */
export function pares(): Par[] {
  const E = '«([^»\\n]{1,45})»';
  const N = '(\\d[\\d.]*)';
  const out: Par[] = [];

  for (const skill of skillNames()) {
    const tabla = new Map(
      EXPRESIONES.filter((e) => e.skill === skill).map((e) => [e.expresion, e.veces]),
    );
    if (tabla.size === 0) continue;
    // Se aplanan los espacios: la prosa va a ochenta columnas y un par cae
    // partido entre dos líneas sin que eso cambie lo que dice.
    const src = readSkill(skill).replace(/\s+/gu, ' ');

    for (const m of src.matchAll(new RegExp(`${E}\\s+${N}(?![\\d.,%\\p{L}])`, 'gu'))) {
      const expresion = m[1] as string;
      const prosa = Number((m[2] as string).replace(/\./gu, ''));
      const medido = tabla.get(expresion);
      if (medido === undefined || prosa === 0) continue;
      out.push({ skill, expresion, palabras: expresion.trim().split(/\s+/u).length, prosa, medido });
    }
  }
  return [...new Map(out.map((p) => [`${p.skill}|${p.expresion}|${p.prosa}`, p])).values()];
}

export const PARES = pares();
export const DE_UNA_PALABRA = PARES.filter((p) => p.palabras === 1);
export const DE_VARIAS = PARES.filter((p) => p.palabras > 1);
export const exactos = (ps: readonly Par[]): number =>
  ps.filter((p) => p.prosa === p.medido).length;

/**
 * Las dos proporciones, redondeadas como las escribe la prosa.
 *
 * Se exportan así y no como fracción cruda porque lo que hay que poder comparar
 * es exactamente lo que el documento dice: «siete de cada diez» y «una de cada
 * ocho». El README y `AGENTS.md` las decían de memoria y las dos habían
 * envejecido igual, mientras el archivo que las mide las tenía bien y ningún
 * gate comparaba los tres.
 */
export const PROPORCIONES = {
  /** De cada diez pares de una palabra, cuántos coinciden. */
  unaPalabraDeCadaDiez: Math.round((10 * exactos(DE_UNA_PALABRA)) / DE_UNA_PALABRA.length),
  /** De cada cuántos pares de varias palabras coincide uno. */
  variasUnaDeCada: Math.round(DE_VARIAS.length / exactos(DE_VARIAS)),
};
