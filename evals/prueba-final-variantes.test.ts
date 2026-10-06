// Las variantes de la prueba final y lo que se le pide al agente en cada una.
//
// Las variantes salen del registro de tonos y de pasadas, no de una lista
// escrita a mano: un tono nuevo tiene que entrar a la prueba el día que entra a
// `src/rules.ts`, sin que nadie se acuerde de sumarlo acá. El test lo prueba con
// un registro inventado que trae un tono más.
//
// Los prompts se prueban por lo que dicen y por lo que callan. Son los de un
// usuario: qué hacer y dónde dejarlo. No piden medir, ni anunciar el tono, ni
// dejar de repetir el texto, porque eso es justo lo que la prueba comprueba, y
// tiene que salir de las skills. Un prompt que lo pidiera haría pasar a un
// agente que nunca leyó ninguna.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PASADA_IDS, PASADAS, TONE_IDS, TONES } from '../src/rules.ts';
import { ENTRADA, skillNames } from '../src/skills.ts';
import { ErrorDeUso } from '../scripts/prueba-final/errores.ts';
import { promptDe } from '../scripts/prueba-final/prompts.ts';
import { SKILL_BASE, elegirVariantes, skillsRequeridas, variantes } from '../scripts/prueba-final/variantes.ts';

describe('las variantes salen del registro', () => {
  const todas = variantes();

  test('la base, cada tono y cada pasada, en ese orden', () => {
    assert.deepEqual(
      todas.map((v) => v.id),
      ['base', ...TONE_IDS, ...PASADA_IDS],
    );
  });

  test('cada una mide con las opciones de su capa', () => {
    const por = (id: string) => todas.find((v) => v.id === id);
    assert.deepEqual(por('base'), { id: 'base', clase: 'base', skill: null, banderas: [] });
    for (const id of TONE_IDS) {
      assert.deepEqual(por(id), { id, clase: 'tono', skill: TONES[id]?.skill, banderas: ['--tono', id] });
    }
    assert.deepEqual(por('humanizar'), {
      id: 'humanizar',
      clase: 'pasada',
      skill: 'humanizar-espanol',
      banderas: ['--pasada', 'humanizar'],
    });
  });

  test('un tono nuevo en el registro entra solo', () => {
    const conUnoMas = { ...TONES, nuevo: { skill: 'nuevo-writing' } };
    const v = variantes(conUnoMas, PASADAS).find((x) => x.id === 'nuevo');
    assert.deepEqual(v, { id: 'nuevo', clase: 'tono', skill: 'nuevo-writing', banderas: ['--tono', 'nuevo'] });
  });

  test('las skills que se exigen existen en el repositorio', () => {
    // La otra dirección: un nombre escrito acá que no es una skill haría fallar
    // a todos los agentes por una errata del ejecutor.
    const existentes = new Set(skillNames());
    assert.ok(existentes.has(SKILL_BASE), `${SKILL_BASE} no es una skill`);
    assert.ok(existentes.has(ENTRADA));
    for (const v of todas) {
      for (const s of skillsRequeridas(v)) assert.ok(existentes.has(s), `${v.id} exige ${s}, que no existe`);
    }
  });

  test('la entrada y la base siempre; la del tono o la pasada cuando la hay', () => {
    const por = (id: string) => todas.find((v) => v.id === id) ?? assert.fail(id);
    assert.deepEqual(skillsRequeridas(por('base')), [ENTRADA, SKILL_BASE]);
    assert.deepEqual(skillsRequeridas(por('camus')), [ENTRADA, SKILL_BASE, 'camus-writing']);
    assert.deepEqual(skillsRequeridas(por('humanizar')), [ENTRADA, SKILL_BASE, 'humanizar-espanol']);
  });
});

describe('elegir variantes', () => {
  const todas = variantes();

  test('sin lista, todas', () => {
    assert.deepEqual(elegirVariantes(undefined, todas), todas);
  });

  test('por identificador o por nombre de skill, en el orden del registro', () => {
    assert.deepEqual(
      elegirVariantes('humanizar-espanol,camus-writing,base', todas).map((v) => v.id),
      ['base', 'camus', 'humanizar'],
    );
  });

  test('una que no existe es un error de uso que lista las que hay', () => {
    assert.throws(
      () => elegirVariantes('base,inventado', todas),
      (e: unknown) => e instanceof ErrorDeUso && /inventado/u.test(e.message) && /camus/u.test(e.message),
    );
  });
});

describe('los prompts', () => {
  const E = 'C:\\temp\\pf-x\\entrada.md';
  const S = 'C:\\temp\\pf-x\\salida.md';
  const por = (id: string) => variantes().find((v) => v.id === id) ?? assert.fail(id);

  test('corregir, sin tono', () => {
    assert.equal(promptDe(por('base'), E, S), `Corrige el texto de \`${E}\` y guarda el resultado en \`${S}\`.`);
  });

  test('reescribir con el tono, nombrado por su skill', () => {
    assert.equal(
      promptDe(por('camus'), E, S),
      `Reescribe el texto de \`${E}\` con el tono \`camus-writing\` y guarda el resultado en \`${S}\`.`,
    );
  });

  test('humanizar', () => {
    assert.equal(promptDe(por('humanizar'), E, S), `Humaniza el texto de \`${E}\` y guarda el resultado en \`${S}\`.`);
  });

  test('ninguno dicta lo que la prueba comprueba', () => {
    const dictado = /\bmid|\bmedir|verific|anunci|repit|no lo |tono aplicado|di(?:me|ga) (?:qué|cuál)/iu;
    for (const v of variantes()) {
      assert.doesNotMatch(promptDe(v, E, S), dictado, `el prompt de ${v.id} dicta un comportamiento`);
    }
  });

  test('cada pasada del registro tiene su prompt, y una sin él se nombra', () => {
    for (const v of variantes().filter((x) => x.clase === 'pasada')) assert.ok(promptDe(v, E, S));
    const huerfana = { id: 'otra', clase: 'pasada' as const, skill: 'otra-espanol', banderas: ['--pasada', 'otra'] };
    assert.throws(() => promptDe(huerfana, E, S), /otra/u);
  });
});
