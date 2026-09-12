// Un tono acota por forma, no por materia.
//
// Cinco skills de tono acotaban su alcance por el objeto del texto. Dos siguen
// en el repositorio: `atenas` exigía una obra de ficción y `bettatech` un
// mecanismo de cómputo. Las otras tres se retiraron después, por otro motivo.
// Eso contradecía a la base: la lista de `redactar-espanol` se recorre solo
// «si el usuario no indica el tono», y `spanish-writing` §3.1 dice que
// ninguna skill de tono puede contradecirla. Con la redacción vieja, un
// usuario que pidiera `atenas` para un asunto real se topaba con una skill
// que se negaba a existir para él.
//
// Un tono es una forma. Lo que puede exigir es lo que su forma necesita para
// funcionar: una figura que corregir, unidades que citar, un orden que
// recorrer, algo con mérito y defecto, un mecanismo que el lector usa a ciegas.
// Nada de eso es un tema.
//
// Qué prueba este gate y qué no. Prueba que todas declaran su precondición
// y que la declaran donde la entrada dice que está, en las dos direcciones: si
// la entrada cambia el número de sección, el gate va a buscarla al lugar nuevo
// y falla. Lo que NO prueba es que la precondición esté bien escrita. Leer una
// frase y decidir si acota por forma o por materia es trabajo de una persona;
// una expresión regular que lo intentara daría falsos verdes, que es peor que
// no tenerla. El gate obliga a responder la pregunta. La calidad de la
// respuesta se revisa leyendo.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TONE_IDS } from '../src/rules.ts';
import { ENTRADA, readSkill, skillNames } from '../src/skills.ts';

const MARCA = '**Precondición de forma:**';
/** Plegado a espacios simples: el texto de la entrada se envuelve a ochenta columnas. */
const TEXTO_ENTRADA = readSkill(ENTRADA).replace(/\s+/gu, ' ');

/**
 * En qué sección de cada tono dice la entrada que vive la precondición.
 *
 * Se lee de la prosa en vez de fijarse en 1, porque es la mitad del gate: la
 * entrada afirma dónde está y el test comprueba que esté ahí. Si alguien mueve
 * la afirmación sin mover el bloque, o al revés, esto falla.
 */
function seccionQueApuntaLaEntrada(texto: string): number {
  const m = /precondición, que cada skill de tono declara\s+al final de su sección (\d+)/u.exec(texto);
  assert.ok(m, 'la entrada dejó de decir dónde declara cada tono su precondición');
  return Number(m[1]);
}

/**
 * Cuántas veces aparece la marca dentro de esa sección.
 *
 * Devuelve -1 cuando el documento no tiene esa sección, para distinguir «no la
 * declara» de «no hay dónde declararla».
 */
function marcasEnSeccion(texto: string, n: number): number {
  const desde = texto.indexOf(`\n## ${n}.`);
  const hasta = texto.indexOf(`\n## ${n + 1}.`);
  if (desde === -1 || hasta <= desde) return -1;
  return texto.slice(desde, hasta).split(MARCA).length - 1;
}

const SECCION = seccionQueApuntaLaEntrada(TEXTO_ENTRADA);

describe('cada tono declara qué necesita su forma', () => {
  test('todas lo declaran, y una sola vez', () => {
    const faltan = TONE_IDS.filter((id) => marcasEnSeccion(readSkill(`${id}-writing`), SECCION) !== 1);
    assert.deepEqual(
      faltan,
      [],
      `estos tonos no declaran su precondición de forma en la sección ${SECCION}. ` +
        'Un tono que no dice qué necesita su forma termina acotando por tema, que es el defecto que esto vigila.',
    );
  });

  test('no la declaran dos veces ni la sueltan por otra sección', () => {
    for (const id of TONE_IDS) {
      const texto = readSkill(`${id}-writing`);
      assert.equal(texto.split(MARCA).length - 1, 1, `${id}: la marca aparece fuera de su sitio o repetida`);
    }
  });

  test('son trece, las mismas que enruta la entrada', () => {
    assert.equal(TONE_IDS.length, 13);
  });
});

describe('la entrada dice que la tabla enruta y no cerca', () => {
  test('lo dice, y no solo lo da por sabido', () => {
    // Sin esta frase, la tabla se lee como una lista de temas permitidos, que
    // es exactamente como se leyó hasta ahora.
    assert.match(TEXTO_ENTRADA, /\*\*La lista enruta, no cerca\.\*\*/u);
    assert.match(TEXTO_ENTRADA, /Si el usuario pide un tono, ese tono se aplica/u);
  });

  test('la precondición vive donde la entrada dice, y no en el número que a este test le convenga', () => {
    assert.equal(SECCION, 1);
  });
});

describe('ninguna skill se presenta como el tono por defecto', () => {
  // Nueve tonos abrían su alcance diciendo que no eran el tono por defecto, y
  // `camus` decía serlo. Cada una de esas frases daba por hecho que hay un tono
  // que gana cuando nadie elige, y no lo hay: hay una lista, y su último paso
  // recoge lo que ningún paso anterior reclamó.
  const POR_DEFECTO = /(?:tono|skill)\s+por\s+defecto/iu;

  test('ninguna lo dice', () => {
    const conFrase = skillNames().filter((n) => POR_DEFECTO.test(readSkill(n)));
    assert.deepEqual(conFrase, [], 'estas skills hablan de un tono por defecto');
  });

  test('el patrón caza la frase, partida o no, y deja pasar otros «por defecto»', () => {
    assert.ok(POR_DEFECTO.test('No es el tono por defecto.'));
    assert.ok(POR_DEFECTO.test('Es el tono\npor defecto.'));
    assert.ok(!POR_DEFECTO.test('El orden por defecto tiene cinco movimientos.'));
    assert.ok(!POR_DEFECTO.test('El plural es el tratamiento por defecto.'));
  });
});

describe('el gate falla cuando tiene que fallar', () => {
  // Sin esto, los tres tests de arriba pasan aunque la función no mire nada.
  const conMarca = `\n## 1. Rol\n\n${MARCA} algo.\n\n## 2. Otra\n`;

  test('caza a la que no la declara', () => {
    assert.equal(marcasEnSeccion('\n## 1. Rol\n\nprosa sin marca\n\n## 2. Otra\n', 1), 0);
  });

  test('caza a la que la declara fuera de la sección', () => {
    const fuera = `\n## 1. Rol\n\nprosa\n\n## 2. Otra\n\n${MARCA} tarde.\n`;
    assert.equal(marcasEnSeccion(fuera, 1), 0);
    assert.equal(fuera.split(MARCA).length - 1, 1, 'la marca está en el archivo, pero no donde toca');
  });

  test('caza a la que la declara dos veces', () => {
    assert.equal(marcasEnSeccion(`\n## 1. Rol\n\n${MARCA} a.\n\n${MARCA} b.\n\n## 2. Otra\n`, 1), 2);
  });

  test('distingue no declararla de no tener dónde', () => {
    assert.equal(marcasEnSeccion('texto suelto sin secciones', 1), -1);
    assert.equal(marcasEnSeccion(conMarca, 1), 1);
  });

  test('si la entrada apunta a otra sección, se busca ahí', () => {
    const otra = TEXTO_ENTRADA.replace('al final de su sección 1', 'al final de su sección 7');
    assert.equal(seccionQueApuntaLaEntrada(otra), 7);
    assert.equal(marcasEnSeccion(conMarca, 7), -1);
  });
});
