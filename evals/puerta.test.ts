// La base es la puerta.
//
// Un anfitrión elige qué skill cargar leyendo solo las descripciones. Con el
// pedido de contar dos experiencias personales, uno cargó `camus-writing` antes
// de leer nada y nunca cargó `spanish-writing`. El tono acertó por casualidad y
// todo lo demás faltó: no hubo enrutamiento, porque vive en la base, y no hubo
// normativa, porque cada tono dice que hereda la de la base «y no la repite».
// Heredar de algo que nadie cargó es no tener nada.
//
// La descripción no podía arreglarlo. Es lo que el anfitrión lee para elegir,
// pero a dos tonos les quedaban nueve y doce caracteres antes del aviso de
// largo, y reescribirlas para decir «cargá primero la otra» se habría llevado
// los disparadores. El arreglo vive donde el anfitrión no puede dejar de leer:
// el primer párrafo del cuerpo, que llega entero en cuanto la skill se carga.
//
// Por eso este gate exige cuatro cosas. Que toda skill que no sea la base abra
// mandando a la base, y que toda skill que no sea la entrada mande además a
// cargar la entrada. Que en los tonos ese bloque sea idéntico en los trece,
// porque son trece copias de una sola decisión, y una copia que se corrige sola
// deja a las otras doce diciendo otra cosa. Y que lo que el bloque cita siga
// siendo cierto: que la entrada exista de verdad y la frase con que se anuncia
// el tono elegido.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TONE_IDS } from '../src/rules.ts';
import { ENTRADA, readSkill, skillNames } from '../src/skills.ts';

const BASE = 'spanish-writing';

/** Cómo abre el bloque en toda skill que no sea la base. */
const CARGA = '**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora';

/** El bloque de los tonos, plegado a una línea. Es el mismo en los trece. */
const BLOQUE_DE_TONO = [
  '**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora:',
  'este tono hereda sus reglas sin repetirlas, y sin ella queda incompleto.',
  'Si «redactar-espanol» no está cargada, se carga también: ella dice cómo se',
  'entrega el texto y, si el usuario no pidió este tono por su nombre, decide',
  'si hay tono y cuál; si decide otro o ninguno, este no se aplica. Elegido el',
  'tono, se dice cuál y por qué en una línea.',
].join(' ');

/** Cómo, en el primer párrafo de toda skill que no sea la entrada, se manda a cargarla. */
const A_LA_ENTRADA = `Si «${ENTRADA}» no está cargada, se carga`;

/**
 * El primer párrafo después del título, con sus líneas unidas por un espacio.
 *
 * Plegar importa: el bloque se envuelve a ochenta columnas y una skill lo puede
 * cortar en otro sitio sin cambiar una palabra. Devuelve `null` si el documento
 * no tiene título, para distinguir «no abre con el bloque» de «no hay dónde
 * abrirlo».
 */
export function primerParrafo(md: string): string | null {
  const cuerpo = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u, '');
  const lineas = cuerpo.split(/\r?\n/u);
  const titulo = lineas.findIndex((l) => l.startsWith('# '));
  if (titulo === -1) return null;
  let i = titulo + 1;
  while (i < lineas.length && (lineas[i] as string).trim() === '') i++;
  const parrafo: string[] = [];
  while (i < lineas.length && (lineas[i] as string).trim() !== '') {
    parrafo.push((lineas[i] as string).trim());
    i++;
  }
  return parrafo.join(' ');
}

const veces = (texto: string, frase: string) => texto.split(frase).length - 1;

describe('toda skill entra por la base', () => {
  test('cada tono abre con el bloque, idéntico en los trece', () => {
    const distintos = TONE_IDS.filter((id) => primerParrafo(readSkill(`${id}-writing`)) !== BLOQUE_DE_TONO);
    assert.deepEqual(distintos, [], 'estos tonos no abren con el bloque, o lo abren con otras palabras');
  });

  test('toda skill que no es la base abre mandando a la base', () => {
    // Cubre a la pasada y a cualquier skill que llegue después sin ser un tono.
    const faltan = skillNames()
      .filter((n) => n !== BASE)
      .filter((n) => !(primerParrafo(readSkill(n)) ?? '').startsWith(CARGA));
    assert.deepEqual(faltan, []);
  });

  test('el bloque aparece una sola vez, y la base no lo lleva', () => {
    for (const n of skillNames().filter((s) => s !== BASE)) {
      assert.equal(veces(readSkill(n), CARGA), 1, `${n}: el bloque está repetido o no está`);
    }
    assert.equal(veces(readSkill(BASE), CARGA), 0, 'la base no puede mandar a cargarse a sí misma');
  });
});

describe('toda skill que no es la entrada manda además a cargarla', () => {
  test('A_LA_ENTRADA aparece en el primer párrafo, en toda skill salvo la entrada', () => {
    const faltan = skillNames()
      .filter((n) => n !== ENTRADA)
      .filter((n) => !(primerParrafo(readSkill(n)) ?? '').includes(A_LA_ENTRADA));
    assert.deepEqual(faltan, []);
  });

  test('nunca aparece dos veces, y la entrada no se manda a cargar a sí misma', () => {
    for (const n of skillNames().filter((s) => s !== ENTRADA)) {
      assert.equal(veces(readSkill(n), A_LA_ENTRADA), 1, `${n}: A_LA_ENTRADA está repetida o no está`);
    }
    assert.equal(veces(readSkill(ENTRADA), A_LA_ENTRADA), 0, 'la entrada no puede mandar a cargarse a sí misma');
  });
});

describe('lo que el bloque cita sigue siendo cierto', () => {
  const base = readSkill(BASE);

  test('la entrada que el bloque manda a cargar existe de verdad', () => {
    assert.ok(
      BLOQUE_DE_TONO.includes(`Si «${ENTRADA}» no está cargada`),
      'el bloque de tono no manda a cargar la entrada',
    );
    assert.doesNotThrow(() => readSkill(ENTRADA), 'la entrada que el bloque nombra no existe');
  });

  test('la entrada anuncia el tono con la frase que los tonos repiten, y la base ya no', () => {
    const frase = 'Elegido el tono, se dice cuál y por qué en una línea.';
    const entrada = readSkill(ENTRADA);
    assert.ok(entrada.includes(frase), 'la entrada dejó de pedir que se anuncie el tono elegido');
    assert.ok(!base.includes(frase), 'la base no anuncia el tono: eso lo dice la entrada');
    assert.ok(BLOQUE_DE_TONO.endsWith(frase));
  });

  test('la descripción de la base dice que se carga antes que cualquier tono', () => {
    // Es la mitad que sí cabe en una descripción: la de la base tenía margen.
    const fm = (/^---\r?\n([\s\S]*?)\r?\n---/u.exec(base)?.[1] ?? '').replace(/\s+/gu, ' ');
    assert.match(fm, /cárguese antes que cualquier skill de tono/u);
  });

  test('la descripción de la base ya no invoca, y cita a la entrada', () => {
    const fm = (/^---\r?\n([\s\S]*?)\r?\n---/u.exec(base)?.[1] ?? '').replace(/\s+/gu, ' ');
    assert.doesNotMatch(fm, /Úsese|Disparar|También con/u);
    assert.match(fm, new RegExp(`«${ENTRADA}»`, 'u'));
  });

  test('la descripción de la entrada se carga antes que cualquier otra skill de redacción', () => {
    const fmEntrada = (/^---\r?\n([\s\S]*?)\r?\n---/u.exec(readSkill(ENTRADA))?.[1] ?? '').replace(
      /\s+/gu,
      ' ',
    );
    assert.match(fmEntrada, /cárguese antes que cualquier otra skill de redacción/u);
  });
});

describe('el gate falla cuando tiene que fallar', () => {
  // Sin esto, los tests de arriba pasan aunque `primerParrafo` no mire nada.
  const doc = (cuerpo: string) => `---\nname: x\ndescription: y\n---\n\n# Título\n\n${cuerpo}`;

  test('encuentra el bloque aunque esté envuelto en otro sitio', () => {
    const envuelto = BLOQUE_DE_TONO.replace('ahora: este', 'ahora:\neste').replace(
      'se carga también:',
      'se carga\ntambién:',
    );
    assert.equal(primerParrafo(doc(`${envuelto}\n\n## 1. Rol\n`)), BLOQUE_DE_TONO);
  });

  test('caza a la que no lo lleva', () => {
    assert.equal(primerParrafo(doc('## 1. Rol\n\nprosa\n')), '## 1. Rol');
  });

  test('caza a la que lo lleva debajo de la sección 1', () => {
    assert.notEqual(primerParrafo(doc(`## 1. Rol\n\n${BLOQUE_DE_TONO}\n`)), BLOQUE_DE_TONO);
  });

  test('caza a la que le cambió una palabra', () => {
    assert.notEqual(primerParrafo(doc(`${BLOQUE_DE_TONO.replace('incompleto', 'cojo')}\n`)), BLOQUE_DE_TONO);
  });

  test('distingue no abrir con el bloque de no tener título', () => {
    assert.equal(primerParrafo('prosa sin título'), null);
  });

  test('no toma una línea del frontmatter por el título', () => {
    const md = `---\nname: x\ndescription: >\n  algo\n# no es el título\n---\n\n# Título\n\n${BLOQUE_DE_TONO}\n`;
    assert.equal(primerParrafo(md), BLOQUE_DE_TONO);
  });

  test('caza a la que manda a cargar la entrada recién en el segundo párrafo', () => {
    const soloEnElSegundo = doc(`${CARGA}: prosa que no menciona a la entrada.\n\n${A_LA_ENTRADA} también.\n`);
    assert.ok(!(primerParrafo(soloEnElSegundo) ?? '').includes(A_LA_ENTRADA));
  });
});
