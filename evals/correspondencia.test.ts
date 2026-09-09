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
import {
  SKILLS_DIR,
  allDeclarations,
  cataloguePatterns,
  declarations,
  itemKey,
  readSkill,
  skillNames,
} from '../src/skills.ts';
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

/**
 * Citas de `source` que no resuelven a nada que se pueda leer.
 *
 * Un juicio encontró tres rotas: `fonda-writing §4.1` no existe,
 * `fonda-varia-longitud` citaba §5.3 cuando la prosa que mide está en §7, y
 * `schiavenato-palabra-repetida` citaba la checklist en vez de §5.5. Ninguna la
 * veía nadie, porque el gate de correspondencia ata la regla al ÍTEM y no a la
 * sección. El `source` sale impreso en cada hallazgo: mandar a alguien a leer
 * una sección que no está es peor que no citarla.
 *
 * La primera versión de esta comprobación se saltaba veinticinco de las setenta
 * y cinco reglas, porque solo entendía la forma `skill §N`. Los dos jueces de la
 * segunda ronda lo cazaron. Ahora entiende las tres formas que el repositorio
 * usa: la sección, la sección compuesta, y el patrón numerado del catálogo.
 */
export function citasRotas(reglas: readonly { id: string; source: string }[]): string[] {
  const vivas = new Set(skillNames());
  const rotas: string[] = [];

  for (const r of reglas) {
    const patron = /^([a-z-]+), patrón (\d+)$/u.exec(r.source);
    if (patron) {
      const skill = patron[1] as string;
      if (!vivas.has(skill)) {
        rotas.push(`${r.id} apunta a la skill ${skill}, que no existe`);
        continue;
      }
      const numeros = new Set(cataloguePatterns(skill).map((d) => d.number));
      if (!numeros.has(Number(patron[2]))) rotas.push(`${r.id} -> ${r.source}`);
      continue;
    }

    const secciones = [...r.source.matchAll(/§([\d.]+)/gu)].map((m) => m[1] as string);
    const skill = /^([a-z-]+)\s/u.exec(r.source)?.[1];
    if (secciones.length === 0 || skill === undefined) {
      rotas.push(`${r.id} -> ${r.source} no tiene forma de cita`);
      continue;
    }
    if (!vivas.has(skill)) {
      rotas.push(`${r.id} apunta a la skill ${skill}, que no existe`);
      continue;
    }
    const prosa = readSkill(skill).replace(/\r\n/gu, '\n');
    for (const seccion of secciones) {
      // El punto final del encabezado impide que «§7» resuelva contra «7.5».
      const marca = seccion.includes('.') ? `\n### ${seccion}.` : `\n## ${seccion}.`;
      if (!prosa.includes(marca)) rotas.push(`${r.id} -> ${skill} §${seccion}`);
    }
  }
  return rotas;
}

describe('cada regla cita una sección que existe', () => {
  test('todas resuelven, y ninguna se salta', () => {
    assert.deepEqual(citasRotas(allRules()), [], 'estas reglas mandan a leer algo que no está');
  });

  test('ninguna forma de cita queda fuera del análisis', () => {
    // La versión anterior se saltaba en silencio lo que no entendía, y por eso
    // veinticinco reglas pasaban sin comprobar. Ahora lo que no tiene forma de
    // cita se reporta como roto, y esto lo prueba.
    assert.deepEqual(citasRotas([{ id: 'inventada', source: 'sin forma de cita' }]), [
      'inventada -> sin forma de cita no tiene forma de cita',
    ]);
  });

  test('el gate caza cada clase de cita rota', () => {
    // Sin esto, los dos de arriba pasan aunque la función no mire nada. El
    // canario anterior comprobaba que un encabezado inventado no estuviera en
    // una skill, que es una afirmación sobre el archivo y no sobre el gate.
    const casos: [string, string][] = [
      ['seccion-inexistente', 'camus-writing §99'],
      ['subseccion-inexistente', 'camus-writing §99.1'],
      ['skill-inexistente', 'inventada-writing §1'],
      ['patron-inexistente', 'humanizar-espanol, patrón 999'],
      ['compuesta-con-una-rota', 'spanish-writing §5.5 y §99.9'],
    ];
    for (const [id, source] of casos) {
      assert.equal(citasRotas([{ id, source }]).length, 1, `${source} tenía que caer`);
    }
    // Y las buenas de cada forma no caen.
    for (const source of ['camus-writing §5.1', 'humanizar-espanol, patrón 32', 'spanish-writing §5.5 y §5.6']) {
      assert.deepEqual(citasRotas([{ id: 'buena', source }]), [], source);
    }
  });
});

describe('el techo de cobertura está declarado', () => {
  // Estos números son el registro, no una meta. Si cambian, el cambio tiene que
  // ser deliberado. No queda nada mecanizable sin regla. Las de criterio exigen
  // juicio sobre el contenido: casi todas vienen de los tonos que reconstruyen a
  // un autor, y describir cómo argumenta una persona no lo mide ninguna clase de
  // regla que exista hoy.
  //
  // La cifra no se escribe en este comentario a propósito. Vivía aquí y en la
  // aserción de más abajo, y la de aquí envejeció dos veces mientras la otra
  // seguía siendo cierta. Un número que nadie comprueba miente antes que uno
  // que sí.
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

  test('299 declaraciones, repartidas como está registrado', () => {
    // Eran 282 con las catorce skills de tono. Retirar kenway, medicendai y
    // sekkyoku se llevó 48 declaraciones, y este gate es el que lo dijo. La 235
    // la agregó `solitario-writing` §19: su §7.4 medía la longitud de oración y
    // la checklist no la pedía, así que la regla no tenía qué reclamar.
    //
    // Las últimas seis las agregó `triangulacion-writing` al medir lo que la
    // primera versión no había medido: la subordinación, los pares donde el
    // registro elige, los verbos con que la evidencia habla y el andamiaje que
    // nunca usa. Dos de las seis salieron cubiertas el mismo día, y las otras
    // cuatro entraron a `criterio` después de comprobar que no se separan de
    // otros registros por medición.
    assert.equal(items.length, 299, 'cambió la cantidad de declaraciones en la prosa');
    assert.equal(claimed.size, 110, 'cambió la cantidad de declaraciones cubiertas por reglas');
    assert.equal(cuenta('mecanizable'), 0);
    assert.equal(cuenta('criterio'), 189);
    assert.equal(cuenta('delegado'), 0);
  });

  test('humanizar tiene 32 de sus 38 patrones cubiertos', () => {
    const suyos = declarations('humanizar-espanol');
    const cubiertos = suyos.filter((d) => claimed.has(itemKey(d.skill, d.item)));
    assert.equal(suyos.length, 38);
    assert.equal(cubiertos.length, 32);
  });

  test('todas las skills aportan al recuento', () => {
    assert.equal(skillNames().length, 15);
    // La base y la pasada no son tonos. Los demás sí, y el verificador tiene que
    // aceptarlos todos o la tabla de enrutamiento miente.
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
    assert.equal(decl.filter((d) => d.origen === 'patron').length, 38);
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
