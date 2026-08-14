// El gate. Ata las reglas como datos a la prosa que las enuncia.
//
// Sin esto, `rules.ts` y los SKILL.md divergen. Ya pasó dos veces: la raya
// estaba prohibida en una skill, permitida en otra y marcada como señal de IA
// en una tercera, y la prohibición del punto y coma se perdió al reescribir un
// ítem de checklist. Las dos veces el defecto era invisible porque nadie
// comparaba las dos representaciones.
//
// Esa prohibición del punto y coma ya no existe: se retiró por decisión, y el
// gate obligó a tocar las cinco skills que la repetían por su cuenta.
//
// Falla en las dos direcciones, a propósito. Cubrir un ítem nuevo rompe el
// test hasta que se borra del registro, y cambiar la prosa rompe el test hasta
// que se actualiza el dato.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { TONES, TONE_IDS, allRules, assertRules } from '../src/rules.ts';
import { SKILLS_DIR, allDeclarations, declarations, itemKey, skillNames } from '../src/skills.ts';
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
  // ser deliberado. No queda nada mecanizable sin regla. Las 199 de criterio
  // exigen juicio sobre el contenido: casi todas vienen de los trece tonos que
  // reconstruyen a un autor, y describir cómo argumenta una persona no lo mide
  // ninguna clase de regla que exista hoy.
  //
  // Se regeneran con `node --experimental-strip-types evals/gen.ts`. Nunca a
  // mano: el archivo se escribió a mano una vez y quedó mintiendo en cuanto una
  // skill movió sus ítems.
  //
  // El cero de `mecanizable` no es una ausencia verificada, y conviene no
  // leerlo como tal. El generador nunca asciende un ítem a esa clase: hereda la
  // que tenía o pone `criterio`. Dice que nadie ha clasificado nada como
  // pendiente, no que no quede nada por hacer.
  //
  // Dos jueces lo probaron señalando tres ítems que estaban en `criterio` y se
  // podían medir con clases de regla que ya existían: la nota numérica de
  // `kenway-writing`, y el relleno oral y las marcas de redes de
  // `schiavenato-writing`. Los tres están cubiertos desde entonces. La lección
  // no es que quedaran esos tres, es que el registro no sabe encontrarlos: hay
  // que ir a buscarlos leyendo la prosa.
  const cuenta = (estado: string) => SIN_REGLA.filter((e) => e.estado === estado).length;

  test('235 declaraciones, repartidas como está registrado', () => {
    // Eran 282 con las catorce skills de tono. Retirar kenway, medicendai y
    // sekkyoku se llevó 48 declaraciones, y este gate es el que lo dijo. La 235
    // la agregó `solitario-writing` §19: su §7.4 medía la longitud de oración y
    // la checklist no la pedía, así que la regla no tenía qué reclamar.
    assert.equal(items.length, 235, 'cambió la cantidad de declaraciones en la prosa');
    assert.equal(claimed.size, 89, 'cambió la cantidad de declaraciones cubiertas por reglas');
    assert.equal(cuenta('mecanizable'), 0);
    assert.equal(cuenta('criterio'), 146);
    assert.equal(cuenta('delegado'), 0);
  });

  test('humanizar tiene 31 de sus 37 patrones cubiertos', () => {
    const suyos = declarations('humanizar-espanol');
    const cubiertos = suyos.filter((d) => claimed.has(itemKey(d.skill, d.item)));
    assert.equal(suyos.length, 37);
    assert.equal(cubiertos.length, 31);
  });

  test('todas las skills aportan al recuento', () => {
    assert.equal(skillNames().length, 13);
    // La base y la pasada no son tonos. Los otros catorce sí, y el verificador
    // tiene que aceptarlos todos o la tabla de enrutamiento miente.
    assert.deepEqual(
      skillNames().filter((n) => n !== 'spanish-writing' && n !== 'humanizar-espanol').sort(),
      TONE_IDS.map((t) => TONES[t]!.skill).sort(),
    );
  });

  test('humanizar-espanol ya no queda fuera del gate', () => {
    // Declara sus reglas en el catálogo de `references/`, no en una lista
    // numerada del SKILL.md. Leer solo el SKILL.md la dejaba invisible: era la
    // skill con más reglas y aportaba cero al recuento.
    const decl = declarations('humanizar-espanol');
    assert.equal(decl.filter((d) => d.origen === 'checklist').length, 0);
    assert.equal(decl.filter((d) => d.origen === 'patron').length, 37);
  });

  test('ninguna skill trae raya ni guion largo, salvo las dos que la enuncian', () => {
    // Vive acá y no en el CI a propósito. Se escribió primero como un paso de
    // `grep -P '[\x{2014}]'` y ese escape no es portable: en la máquina donde
    // se probó, grep respondía «character value too large», el paso se lo
    // tragaba y el guardián pasaba sin comprobar nada.
    //
    // Las dos excepciones son las que tienen que mostrar el carácter que
    // prohíben: la base lo enuncia en su §6.6 y el catálogo de señales de IA
    // lo lista como patrón.
    const enuncian = new Set(['spanish-writing', 'humanizar-espanol']);
    const conRaya = skillNames()
      .filter((n) => !enuncian.has(n))
      .filter((n) =>
        /[—–]/u.test(readFileSync(join(SKILLS_DIR, n, 'SKILL.md'), 'utf8')),
      );
    assert.deepEqual(conRaya, []);
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
