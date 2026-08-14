// Las tres clases de regla que miden el ritmo por números.
//
// Existen porque seis de los once tonos declaraban su forma en cifras y ninguna
// clase anterior las medía. La prueba cruzada lo dijo en números: nueve columnas
// planas sobre catorce, y despues seis sobre once. Un tono sin reglas no
// discrimina, y un enrutamiento que lleva a un tono que no discrimina reparte
// texto entre skills que dan todas el mismo veredicto.
//
// Cada clase se prueba en las dos direcciones, que es lo único que separa una
// regla de una decoración: dispara sobre lo que dice cazar y calla sobre lo que
// no. Una regla estadística sin la segunda mitad marca todo y se deja de leer al
// segundo aviso.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check } from '../src/check.ts';
import { TONES } from '../src/rules.ts';
import { readSkill } from '../src/skills.ts';

/** Arma un texto con las longitudes pedidas, en un solo párrafo. */
function conLongitudes(largos: readonly number[]): string {
  return largos.map((n) => `${Array.from({ length: n }, () => 'palabra').join(' ')}.`).join(' ');
}

const solo = (texto: string, tone: string, regla: string) =>
  check(texto, { tone }).filter((f) => f.rule === regla);

describe('sentence-length-band: qué proporción del texto cae en una banda', () => {
  test('dispara cuando faltan las breves que el tono declara', () => {
    // freddy pide una de cada tres entre 3 y 10 palabras. Doce oraciones de
    // veinte no tienen ninguna.
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 20)), 'freddy', 'freddy-banda-corta');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 12 oraciones \(0 %\)/u);
    assert.match(f[0]!.message, /al menos el 33 %/u);
  });

  test('calla cuando la proporción se cumple', () => {
    const mezcla = [5, 20, 6, 22, 8, 25, 7, 21, 9, 24, 4, 19];
    assert.deepEqual(solo(conLongitudes(mezcla), 'freddy', 'freddy-banda-corta'), []);
  });

  test('el piso de oraciones impide el falso positivo sobre un texto corto', () => {
    // Cuatro oraciones largas no son un perfil, son cuatro oraciones. Sin piso,
    // cualquier párrafo suelto quedaría marcado.
    assert.deepEqual(solo(conLongitudes([20, 20, 20, 20]), 'freddy', 'freddy-banda-corta'), []);
  });

  test('la banda sin techo cuenta de su mínimo en adelante', () => {
    // bettatech pide un cuarto del texto por encima de 31 palabras.
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 22)), 'bettatech', 'bettatech-cuartil-largo');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /de 32 en adelante palabras/u);
  });
});

describe('sentence-length-mean: la media dentro de la banda declarada', () => {
  test('dispara por debajo de la banda', () => {
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 10)), 'bettatech', 'bettatech-media-oracion');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /La media es 10\.0 y la banda declarada va de 20 a 26/u);
  });

  test('dispara por encima de la banda', () => {
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 40)), 'bettatech', 'bettatech-media-oracion');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /La media es 40\.0/u);
  });

  test('calla dentro de la banda', () => {
    assert.deepEqual(
      solo(conLongitudes(Array.from({ length: 12 }, () => 23)), 'bettatech', 'bettatech-media-oracion'),
      [],
    );
  });
});

describe('long-sentence-run: la cadena de oraciones largas', () => {
  test('dispara con cuatro largas seguidas, que fonseca prohíbe', () => {
    const f = solo(conLongitudes([35, 35, 35, 35]), 'fonseca', 'fonseca-cuatro-largas');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Hay 4 de 30 palabras o más/u);
  });

  test('calla con tres, que es lo que tolera', () => {
    assert.deepEqual(solo(conLongitudes([35, 35, 35, 8]), 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('una breve en medio corta la racha', () => {
    assert.deepEqual(solo(conLongitudes([35, 35, 8, 35, 35]), 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('la racha no cruza el corte de párrafo', () => {
    // Un punto y aparte reinicia el ritmo, igual que en la racha corta. Sin
    // esto, dos párrafos que abren y cierran largo se marcarían como cadena.
    const dos = `${conLongitudes([35, 35])}\n\n${conLongitudes([35, 35])}`;
    assert.deepEqual(solo(dos, 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('dotcsv tolera menos: dos largas seguidas ya exigen una corta', () => {
    assert.equal(solo(conLongitudes([35, 35, 35]), 'dotcsv', 'dotcsv-largas-seguidas').length, 1);
    assert.deepEqual(solo(conLongitudes([35, 35, 8]), 'dotcsv', 'dotcsv-largas-seguidas'), []);
  });
});

describe('ahora los once tonos discriminan', () => {
  test('ninguno se queda sin reglas', () => {
    // Es la condición que hacía caducar el motivo del enrutamiento, y por eso
    // se comprueba también acá: es el hecho que estas reglas vinieron a cambiar.
    const sinReglas = Object.values(TONES).filter((t) => t.rules.length === 0).map((t) => t.id);
    assert.deepEqual(sinReglas, []);
  });

  test('atenas se queda con una sola regla de ritmo, y es correcto', () => {
    // Es el único que casi no dispara sobre prosa real, y no es un hueco. Su
    // §6.5 dice que su corpus no permite medir oraciones: «Cualquier cifra de
    // oración o de párrafo extraída de ahí sería un artefacto del
    // transcriptor», y añade que «no hay techo fijo de oración».
    //
    // Lo único que declara es cualitativo, la alternancia de tramos largos con
    // golpes cortos, y eso es exactamente lo que su regla mide. Ponerle una
    // banda o una media sería inventar una medición que la skill se niega a
    // hacer, que es peor que no tener regla.
    const reglas = TONES.atenas?.rules ?? [];
    assert.deepEqual(reglas.map((r) => r.kind), ['sentence-length-spread']);
    const fuente = readSkill('atenas-writing');
    assert.match(fuente, /sería un artefacto del\s+transcriptor/u);
    assert.match(fuente, /no hay\s+techo fijo de oración/u);
  });

  test('cada tono marca algo sobre un texto plano que no es de nadie', () => {
    // Doce oraciones iguales de quince palabras: sin breves, sin largas, sin
    // alternancia. Ningún tono declara esa forma, así que ninguno debería
    // certificarla en silencio.
    const plano = conLongitudes(Array.from({ length: 12 }, () => 15));
    const mudos = Object.keys(TONES).filter((id) => {
      const propias = new Set(TONES[id]?.rules.map((r) => r.id));
      return !check(plano, { tone: id }).some((f) => propias.has(f.rule));
    });
    assert.deepEqual(
      mudos,
      [],
      'estos tonos no dijeron nada sobre un texto sin forma, así que su capa no está midiendo',
    );
  });
});
