// El gate. Ata las reglas como datos a la prosa que las enuncia.
//
// Sin esto, `rules.ts` y los SKILL.md divergen. Ya pasó dos veces: la raya
// estaba prohibida en una skill, permitida en otra y marcada como señal de IA
// en una tercera; y la prohibición del punto y coma se perdió al reescribir un
// ítem de checklist. Las dos veces el defecto era invisible porque nadie
// comparaba las dos representaciones.
//
// Falla en las dos direcciones, a propósito. Cubrir un ítem nuevo rompe el
// test hasta que se borra del registro, y cambiar la prosa rompe el test hasta
// que se actualiza el dato.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { allRules, assertRules } from '../src/rules.ts';
import { allDeclarations, declarations, itemKey, skillNames } from '../src/skills.ts';
import { SIN_REGLA } from './cobertura.ts';

const items = allDeclarations();
const itemKeys = new Set(items.map((i) => itemKey(i.skill, i.item)));

const claimed = new Set(
  allRules().flatMap((r) => r.checklist.map((c) => itemKey(c.skill, c.item))),
);
const recorded = new Set(SIN_REGLA.map((e) => itemKey(e.skill, e.item)));

describe('las reglas están bien formadas', () => {
  test('sin duplicados, con flags correctos y todas reclaman un ítem', () => {
    assertRules();
  });
});

describe('correspondencia entre las reglas y la prosa', () => {
  test('cada regla reclama un ítem de checklist que existe de verdad', () => {
    const huerfanas = allRules().flatMap((r) =>
      r.checklist
        .filter((c) => !itemKeys.has(itemKey(c.skill, c.item)))
        .map((c) => `${r.id} -> ${itemKey(c.skill, c.item)}`),
    );
    assert.deepEqual(
      huerfanas,
      [],
      'una regla apunta a un ítem que ya no está en el SKILL.md. O se borró la prosa, o se reescribió sin actualizar el dato.',
    );
  });

  test('cada ítem de checklist está cubierto por una regla o registrado sin ella', () => {
    const sueltos = items
      .map((i) => itemKey(i.skill, i.item))
      .filter((k) => !claimed.has(k) && !recorded.has(k));
    assert.deepEqual(
      sueltos,
      [],
      'hay ítems en la prosa que ninguna regla cubre y que tampoco están en evals/cobertura.ts.',
    );
  });

  test('ningún ítem está a la vez cubierto y registrado como sin regla', () => {
    const dobles = [...claimed].filter((k) => recorded.has(k));
    assert.deepEqual(
      dobles,
      [],
      'una regla nueva cubrió un ítem que sigue listado en evals/cobertura.ts. Hay que borrarlo de ahí.',
    );
  });

  test('el registro no menciona ítems que ya no existen', () => {
    const fantasmas = [...recorded].filter((k) => !itemKeys.has(k));
    assert.deepEqual(
      fantasmas,
      [],
      'evals/cobertura.ts menciona ítems que la prosa ya no tiene. Hay que regenerarlo.',
    );
  });
});

describe('el techo de cobertura está declarado', () => {
  // Estos números son el registro, no una meta. Si cambian, el cambio tiene que
  // ser deliberado. El techo real del verificador son 62 de 95, o sea las 34 ya
  // cubiertas más las 28 mecanizables: las 31 de criterio exigen juicio sobre
  // el contenido y ninguna regla las cubrirá nunca.
  const cuenta = (estado: string) => SIN_REGLA.filter((e) => e.estado === estado).length;

  test('95 declaraciones, repartidas como está registrado', () => {
    assert.equal(items.length, 95, 'cambió la cantidad de declaraciones en la prosa');
    assert.equal(claimed.size, 34, 'cambió la cantidad de declaraciones cubiertas por reglas');
    assert.equal(cuenta('mecanizable'), 28);
    assert.equal(cuenta('criterio'), 31);
    assert.equal(cuenta('delegado'), 2);
  });

  test('humanizar tiene 26 de sus 37 patrones cubiertos', () => {
    const suyos = declarations('humanizar-espanol');
    const cubiertos = suyos.filter((d) => claimed.has(itemKey(d.skill, d.item)));
    assert.equal(suyos.length, 37);
    assert.equal(cubiertos.length, 26);
  });

  test('todas las skills aportan al recuento', () => {
    assert.deepEqual(skillNames(), [
      'camus-writing',
      'catedra-writing',
      'fonda-writing',
      'humanizar-espanol',
      'spanish-writing',
    ]);
  });

  test('humanizar-espanol ya no queda fuera del gate', () => {
    // Declara sus reglas en el catálogo de `references/`, no en una lista
    // numerada del SKILL.md. Leer solo el SKILL.md la dejaba invisible: era la
    // skill con más reglas y aportaba cero al recuento.
    const decl = declarations('humanizar-espanol');
    assert.equal(decl.filter((d) => d.origen === 'checklist').length, 0);
    assert.equal(decl.filter((d) => d.origen === 'patron').length, 37);
  });

  test('una regla puede reclamar en dos skills a la vez', () => {
    // La base y el catálogo describen la misma prohibición desde lados
    // distintos. Reclamarlas juntas es lo que prueba que hay una sola casa.
    const raya = allRules().find((r) => r.id === 'no-raya');
    assert.deepEqual(
      raya?.checklist.map((c) => c.skill).sort(),
      ['humanizar-espanol', 'spanish-writing'],
    );
  });
});
