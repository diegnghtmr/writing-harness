// Quien pide humanizar acepta ese ritmo por encima del que traiga el tono.
//
// Las dos skills lo decían y el código no lo hacía. `camus-writing` §3.1: «la
// pasada de humanizar-espanol decide el ritmo y puede fundir cadenas de
// oraciones cortas». `humanizar-espanol` §5: «lo único que le está permitido
// sobrescribir es el ritmo». Y sin embargo `--pasada humanizar` sumaba reglas
// sin retirar ninguna, así que humanizar un texto académico devolvía once
// errores de `oracion-maxima` y el arreglo que el propio verificador proponía,
// dividir la oración, deshacía la humanización y reconstruía el patrón que el
// catálogo señala como el que más penaliza.
//
// Lo cazó una prueba real, no una lectura del código: un ensayo humanizado que
// salió con código 1.
//
// Son tres casos y este archivo prueba los tres, porque el defecto vivía en la
// combinación y no en las piezas. Sin pasada, el tono manda entero. Con pasada y
// sin tono, no hay a quién relevar. Con tono y pasada, la pasada gana en su
// dominio y el tono conserva todo lo demás.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check, relevadas, rulesFor } from '../src/check.ts';
import {
  BASE_RULES,
  CLASES_DE_RITMO,
  PASADAS,
  TONES,
  TONE_IDS,
  assertDominios,
} from '../src/rules.ts';

const ids = (rs: { id: string }[]) => rs.map((r) => r.id);
const esDeRitmo = (kind: string) => (CLASES_DE_RITMO as readonly string[]).includes(kind);

/** Texto humanizado de verdad: oraciones largas fundidas, con breves de contraste. */
const HUMANIZADO = [
  'Con una magnitud cercana a 6,2, el sismo apenas destacaba en el catálogo de aquel año, y sin embargo mató a mil personas y dejó decenas de miles de viviendas inservibles en una región entera.',
  'La desproporción entre una cifra modesta y una destrucción grande no se explica por la fuerza del sismo, sino por lo que había entre el foco y las personas, que es lo que conviene mirar.',
  'No fue azar.',
  'El foco estuvo cerca de la superficie, de modo que la energía llegó casi entera y además llegó concentrada en un área pequeña donde vivía mucha gente.',
  'Un sismo profundo gasta su energía en el camino, mientras que uno somero la entrega toda, y esa diferencia decide más que la magnitud.',
  'Fue el subsuelo.',
].join(' ');

describe('los dominios están declarados donde tienen que estarlo', () => {
  test('toda regla de ritmo de un tono lo declara, y ninguna otra', () => {
    assertDominios();
  });

  test('el gate caza una regla de ritmo sin marcar', () => {
    // Sin esta comprobación, el test de arriba pasa aunque la función no mire
    // nada. Se simula el descuido que de verdad puede ocurrir: alguien agrega
    // un techo de oración a un tono y se olvida del dominio.
    const original = TONES.schiavenato?.rules;
    assert.ok(original);
    try {
      TONES.schiavenato.rules = [
        ...original,
        {
          id: 'schiavenato-inventada',
          kind: 'sentence-length',
          severity: 'error',
          max: 30,
          message: 'x',
          fix: 'x',
          source: 'schiavenato-writing §0',
          checklist: [{ skill: 'schiavenato-writing', item: 'x' }],
        },
      ];
      assert.throws(() => assertDominios(), /es de ritmo .* y no lo declara/u);
    } finally {
      TONES.schiavenato.rules = original;
    }
  });

  test('el gate caza un dominio puesto en una regla que no es de ritmo', () => {
    const original = TONES.schiavenato?.rules;
    assert.ok(original);
    try {
      TONES.schiavenato.rules = original.map((r) => ({ ...r, gobierna: 'ritmo' as const }));
      assert.throws(() => assertDominios(), /declara un dominio y no es de esa clase/u);
    } finally {
      TONES.schiavenato.rules = original;
    }
  });

  test('la base no declara ningún dominio: no cede nada', () => {
    assert.deepEqual(BASE_RULES.filter((r) => r.gobierna !== undefined).map((r) => r.id), []);
  });

  test('una pasada que releva el ritmo trae reglas de ritmo', () => {
    // Relevar sin reemplazar dejaría el ritmo sin gobierno, que no es lo que
    // dice ninguna de las dos skills.
    for (const pasada of Object.values(PASADAS)) {
      if (!pasada.anula.includes('ritmo')) continue;
      assert.ok(
        pasada.rules.some((r) => esDeRitmo(r.kind)),
        `${pasada.id} releva el ritmo y no trae con qué gobernarlo`,
      );
    }
  });
});

describe('caso 1: sin pasada, el tono manda entero', () => {
  test('las reglas de ritmo del tono están todas', () => {
    for (const id of TONE_IDS) {
      const puestas = ids(rulesFor(id));
      for (const r of TONES[id]?.rules ?? []) {
        assert.ok(puestas.includes(r.id), `${id}: falta ${r.id}`);
      }
    }
  });

  test('el texto humanizado incumple camus, que es lo correcto sin la pasada', () => {
    const hallazgos = check(HUMANIZADO, { tone: 'camus' });
    assert.ok(
      hallazgos.some((f) => f.rule === 'oracion-maxima'),
      'camus por su cuenta tiene que seguir pidiendo oraciones de 30 palabras o menos',
    );
  });

  test('relevadas no devuelve nada cuando no se pidió ninguna pasada', () => {
    assert.deepEqual(relevadas('camus', []), []);
  });
});

describe('caso 2: pasada sin tono, no hay a quién relevar', () => {
  test('corren la base y la pasada, y nada más', () => {
    const puestas = ids(rulesFor(undefined, ['humanizar']));
    const esperadas = [...ids(BASE_RULES), ...ids(PASADAS.humanizar?.rules ?? [])];
    assert.deepEqual([...puestas].sort(), [...esperadas].sort());
  });

  test('relevadas no devuelve nada sin tono', () => {
    assert.deepEqual(relevadas(undefined, ['humanizar']), []);
  });
});

describe('caso 3: tono y pasada, la pasada gana en su dominio', () => {
  test('el texto que rompía ahora pasa, y la razón es la pasada', () => {
    // Este es el caso que lo destapó. Con la pasada no hay hallazgos; sin ella,
    // los mismos bytes dan errores de longitud. La diferencia es la precedencia.
    assert.deepEqual(check(HUMANIZADO, { tone: 'camus', pasadas: ['humanizar'] }), []);
    assert.ok(check(HUMANIZADO, { tone: 'camus' }).length > 0);
  });

  test('se retiran las reglas de ritmo del tono y solo esas', () => {
    for (const id of TONE_IDS) {
      const conPasada = new Set(ids(rulesFor(id, ['humanizar'])));
      for (const r of TONES[id]?.rules ?? []) {
        if (r.gobierna === 'ritmo') {
          assert.ok(!conPasada.has(r.id), `${id}: ${r.id} tenía que retirarse`);
        } else {
          assert.ok(conPasada.has(r.id), `${id}: ${r.id} no es de ritmo y se retiró`);
        }
      }
    }
  });

  test('lo que no es ritmo del tono sigue mandando', () => {
    // Un texto humanizado de fonda sigue teniendo que interpelar al lector: la
    // pasada gobierna el ritmo, no la persona.
    const puestas = ids(rulesFor('fonda', ['humanizar']));
    assert.ok(puestas.includes('fonda-interpela'));
    assert.ok(puestas.includes('fonda-primera-persona'));
    assert.ok(!puestas.includes('fonda-varia-longitud'));
  });

  test('ninguna regla de la base se retira jamás', () => {
    for (const id of [...TONE_IDS, undefined]) {
      const puestas = new Set(ids(rulesFor(id, ['humanizar'])));
      for (const r of BASE_RULES) {
        assert.ok(puestas.has(r.id), `se retiró ${r.id}, que es de la base`);
      }
    }
  });

  test('la pasada pone su propio ritmo en el lugar del que retiró', () => {
    const puestas = ids(rulesFor('camus', ['humanizar']));
    assert.ok(puestas.includes('staccato'), 'sin esto, el ritmo queda sin gobierno');
    assert.ok(puestas.includes('humanizar-varia-longitud'));
  });

  test('el ritmo de la pasada se hace cumplir de verdad', () => {
    // Relevar no es indultar. Una cadena de oraciones cortas sigue siendo un
    // hallazgo, y ahora lo pone la pasada en vez del tono.
    const staccato = 'El sismo llegó. No fue grande. Nadie lo esperaba. La ciudad cayó. Nada quedó en pie. Todo se perdió.';
    const hallazgos = check(staccato, { tone: 'camus', pasadas: ['humanizar'] });
    assert.ok(hallazgos.some((f) => f.rule === 'staccato'), 'la pasada tiene que cazar la racha');
  });

  test('relevadas dice qué se retiró y quién lo hizo', () => {
    const cedidas = relevadas('camus', ['humanizar']);
    assert.deepEqual(cedidas.map((c) => c.regla).sort(), [
      'camus-varia-longitud',
      'oracion-maxima',
      'parrafo-maximo',
      'parrafo-minimo',
    ]);
    assert.deepEqual([...new Set(cedidas.map((c) => c.por))], ['humanizar']);
  });
});

describe('fonda reconoce la primera persona cuando la hay', () => {
  // El caso mínimo que destapó el defecto: seis marcas inequívocas de primera
  // persona y la regla decía que el texto no tenía voz de autor, porque su lista
  // de ocho frases no las incluía. «me parece» estaba en la lista y aun así
  // «me parecería» no contaba, por el límite de palabra.
  const CON_VOZ =
    'Yo pienso que el asunto es otro. Me di cuenta de que la casa no es el edificio. ' +
    'No estoy seguro de que se pueda medir. Me parecería deshonesto callarlo. ' +
    'A mi modo de ver, la cosa cambia. Lo digo porque me consta y lo sostengo.';

  const SIN_VOZ =
    'El estudio analiza tres factores del sismo. La profundidad del foco fue somera. ' +
    'El suelo de la ciudad amplifica la onda. La construcción predominante era mampostería sin confinar. ' +
    'La norma existía desde antes. El control no alcanzaba a quien construía sin licencia.';

  test('no dispara sobre un texto lleno de primera persona', () => {
    const hallazgos = check(CON_VOZ, { tone: 'fonda' });
    assert.deepEqual(hallazgos.filter((f) => f.rule === 'fonda-primera-persona'), []);
  });

  test('sigue disparando sobre un texto que de verdad no tiene voz de autor', () => {
    const hallazgos = check(SIN_VOZ, { tone: 'fonda' });
    assert.ok(
      hallazgos.some((f) => f.rule === 'fonda-primera-persona'),
      'ensanchar el patrón no puede dejarlo sin morder',
    );
  });
});
