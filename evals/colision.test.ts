// Un tono no puede pedir con una regla lo que la base castiga con otra.
//
// El defecto ocurrió. `triangulacion-conectores-variados` exige cinco enlaces
// distintos de un repertorio de veintiséis, y dos de esos veintiséis eran «en
// síntesis» y «en definitiva», que la base rechaza como `cierres-anunciados`
// con severidad error. El corpus medido los usa, así que entraron al repertorio
// por la vía correcta (se midieron) y nadie los cruzó contra la base.
//
// Quien escribiera un texto de ese tono podía cumplir la regla del tono y
// ganarse dos errores de la base por hacerlo. No es una contradicción que
// bloquee nada (había veinticuatro alternativas más), pero sí una instrucción
// que se contradice a sí misma, que es peor: el que la lee no sabe cuál obedecer.
//
// El censo que lo encontró es el que corre acá, y encontró exactamente esos dos
// casos en las once listas de tono. Ahora corre siempre.
//
// **Por qué la base gana y no el tono.** Un tono se suma a la base y no la
// corrige; está escrito en la sección 2 de cada skill de tono. De modo que
// cuando el corpus de un tono trae un rasgo que la base prohíbe, lo que se hace
// es sacarlo del tono y decir en la prosa que se sacó, no abrirle una excepción.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check, rulesFor } from '../src/check.ts';
import { TONE_IDS, TONES } from '../src/rules.ts';

/**
 * Las alternativas literales de un `must-contain`.
 *
 * Solo se quedan las que son texto llano. Una alternativa con clases o
 * cuantificadores no se puede convertir en frase de prueba sin inventarle un
 * ejemplo, y un ejemplo inventado probaría lo que uno quisiera.
 */
function alternativasLiterales(re: RegExp): string[] {
  const cuerpo = re.source.replace(/^\\b\(\?:/u, '').replace(/\)\\b$/u, '');
  return cuerpo.split('|').filter((a) => /^[a-záéíóúñü ]+$/iu.test(a));
}

/** Los errores que la capa base sola le pone a una frase. */
function erroresDeLaBase(frase: string): string[] {
  return check(frase, { rules: rulesFor() })
    .filter((h) => h.severity === 'error')
    .map((h) => h.rule);
}

/** La frase mínima en que probar una alternativa: el enlace y algo detrás. */
const enFrase = (a: string) => `${a[0]?.toUpperCase()}${a.slice(1)}, el asunto quedó dicho.`;

describe('ningún tono premia lo que la base prohíbe', () => {
  test('cada alternativa de un must-contain pasa la capa base', () => {
    const colisiones = TONE_IDS.flatMap((id) => {
      const tono = TONES[id];
      if (!tono) return [];
      return tono.rules.flatMap((r) =>
        r.kind !== 'must-contain'
          ? []
          : alternativasLiterales(r.pattern).flatMap((a) => {
              const errores = erroresDeLaBase(enFrase(a));
              return errores.length ? [`${r.id}: «${a}» choca con ${errores.join(', ')}`] : [];
            }),
      );
    });
    assert.deepEqual(
      colisiones,
      [],
      'estas reglas de tono exigen usar algo que la base rechaza con severidad error',
    );
  });

  test('el censo encuentra la colisión cuando la hay', () => {
    // El canario, y hace falta: un test que solo diga «no hay colisiones» pasa
    // igual de verde si el detector dejó de detectar. Se planta la que había.
    assert.deepEqual(erroresDeLaBase(enFrase('en síntesis')), ['cierres-anunciados']);
    assert.deepEqual(erroresDeLaBase(enFrase('en definitiva')), ['cierres-anunciados']);
  });

  test('el censo no marca un enlace que la base sí acepta', () => {
    // La otra dirección. Si `erroresDeLaBase` empezara a marcar cualquier cosa,
    // el primer test fallaría por todos lados y nadie sabría por qué.
    for (const a of ['no obstante', 'de manera que', 'en suma', 'por consiguiente']) {
      assert.deepEqual(erroresDeLaBase(enFrase(a)), [], a);
    }
  });

  test('el lector de alternativas lee de verdad el patrón', () => {
    // Si esta función devolviera una lista vacía, el primer test pasaría en
    // verde sin haber comprobado nada. Se ata a un patrón real.
    const conectores = TONES['triangulacion']?.rules.find(
      (r) => r.id === 'triangulacion-conectores-variados',
    );
    assert.ok(conectores && conectores.kind === 'must-contain');
    const alts = alternativasLiterales(conectores.pattern);
    assert.ok(alts.length > 15, `solo leyó ${alts.length} alternativas`);
    assert.ok(alts.includes('no obstante'));
    assert.ok(!alts.includes('en síntesis'), 'se quitó del repertorio y no puede volver');
  });
});
