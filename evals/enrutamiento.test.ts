// El enrutamiento decide siempre, y decide lo que la tabla §3 dice.
//
// Mismo gate que el de las reglas, aplicado al otro dato que la base declara en
// prosa: cada ruta cita literalmente su celda de la tabla, y cada fila de la
// tabla tiene su ruta. Falla en las dos direcciones, así que reescribir la tabla
// sin tocar el dato rompe, y al revés también.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  RASGOS,
  RUTAS,
  RUTA_IDS,
  type Rasgos,
  assertRutas,
  rasgosSinRuta,
  sugerirTono,
} from '../src/enrutamiento.ts';
import { TONES, TONE_IDS } from '../src/rules.ts';
import { REPO_ROOT, readSkill } from '../src/skills.ts';

const BASE = readSkill('spanish-writing');

/** Las filas de la tabla de §3, por la skill que nombran. */
const FILAS = new Map(
  [...BASE.matchAll(/^\|\s*`([a-z-]+)`\s*\|([^|]+)\|([^|]+)\|\s*$/gmu)].map((m) => [
    (m[1] as string).trim(),
    (m[2] as string).trim(),
  ]),
);

describe('el enrutamiento está bien formado', () => {
  test('cada ruta apunta a un tono que existe, y ningún tono se queda fuera', () => {
    assertRutas();
    assert.deepEqual([...RUTA_IDS].sort(), [...TONE_IDS].sort());
  });

  test('la tabla §3 tiene una fila por tono', () => {
    // Si la tabla pierde una fila, el tono deja de poder elegirse aunque su
    // skill siga en el repositorio.
    assert.equal(FILAS.size, TONE_IDS.length);
  });
});

describe('cada ruta cita la tabla que dice seguir', () => {
  test('el «cuándo» de cada ruta está literal en su fila', () => {
    const huerfanas = RUTAS.filter((r) => !(FILAS.get(r.skill) ?? '').includes(r.cuando)).map(
      (r) => `${r.skill}: «${r.cuando}»`,
    );
    assert.deepEqual(
      huerfanas,
      [],
      'una ruta cita un texto que la tabla de §3 ya no dice. O se reescribió la tabla, o el dato quedó viejo.',
    );
  });

  test('ninguna fila de la tabla se quedó sin ruta', () => {
    const conRuta = new Set(RUTAS.map((r) => r.skill));
    assert.deepEqual([...FILAS.keys()].filter((s) => !conRuta.has(s)), []);
  });

  test('la lista numerada de §3 va en el mismo orden que el dato', () => {
    // El orden ES la mitad del procedimiento, así que tiene que coincidir en las
    // dos representaciones. La prosa la lee el modelo que escribe; el dato lo
    // lee el verificador. Si divergen, uno de los dos elige mal y nadie se
    // entera hasta que el texto sale con la forma equivocada.
    //
    // Se leen los pasos como «N. Si … `skill-writing`», que es como están
    // escritos. A propósito no son preguntas con «¿»: el extractor de
    // declaraciones toma esas por reglas de checklist, y estos pasos no lo son.
    const pasos = [...BASE.matchAll(/^\d+\.\s+(?:Si|En cualquier)[^`]*`([a-z-]+)`\.?$/gmu)].map(
      (m) => m[1] as string,
    );
    assert.deepEqual(pasos, RUTAS.map((r) => r.skill));
  });
});

describe('el motivo por el que no se decide midiendo sigue siendo cierto', () => {
  test('la cuenta de tonos sin regla que dice el comentario es la real', () => {
    // El comentario de `enrutamiento.ts` justifica una decisión de diseño con
    // una cifra, y esa cifra estaba mal: decía seis y son ocho. La escribí sin
    // contarla, en el archivo cuyo comentario empieza diciendo «conviene que
    // conste». Un juez la cazó leyendo `rules.ts`.
    //
    // Así que ahora la cuenta el test. Si algún día esos ocho tonos reciben
    // reglas, esto falla y con ello cae el motivo entero: cuando ningún tono
    // pueda ganar por no poder incumplirse, decidir midiendo vuelve a estar
    // sobre la mesa y habrá que reconsiderarlo.
    const sinReglas = TONE_IDS.filter((id) => TONES[id]?.rules.length === 0);
    const fuente = readFileSync(join(REPO_ROOT, 'src', 'enrutamiento.ts'), 'utf8');
    const dicho = /(\d+) de los (\d+) tonos no tienen ninguna regla/u.exec(fuente);
    assert.ok(dicho, 'el comentario perdió la cifra que justifica la decisión');
    assert.equal(Number(dicho[1]), sinReglas.length, 'tonos sin regla');
    assert.equal(Number(dicho[2]), TONE_IDS.length, 'tonos en total');
    assert.ok(sinReglas.length > 0, 'si ninguno queda sin reglas, el motivo caduca');
  });
});

describe('la lista de rasgos y el tipo que los documenta coinciden', () => {
  test('cada rasgo de la lista está declarado en el tipo, y al revés', () => {
    // `RASGOS` existe porque un tipo no sobrevive a la ejecución y el CLI tiene
    // que validar lo que le pasan. Son dos representaciones del mismo hecho, y
    // este repositorio ya sabe cómo terminan las dos representaciones sin gate.
    const fuente = readFileSync(join(REPO_ROOT, 'src', 'enrutamiento.ts'), 'utf8');
    const cuerpo = /export type Rasgos = \{([\s\S]*?)\n\};/u.exec(fuente);
    assert.ok(cuerpo, 'no se encontró el tipo Rasgos');
    const enElTipo = [...(cuerpo[1] as string).matchAll(/^\s{2}(\w+)\?:/gmu)].map((m) => m[1]);
    assert.deepEqual([...enElTipo].sort(), [...RASGOS].sort());
  });

  test('ningún rasgo es decorativo: alguna ruta lo lee', () => {
    // `academico` estuvo así desde el principio. El CLI lo validaba, el usuario
    // lo escribía, y ninguna condición lo consultaba. El tono que salía era el
    // correcto de casualidad, porque `camus` cierra la lista, y el motivo que se
    // imprimía era falso: «ningún rasgo reclamó el texto», habiendo declarado
    // uno. Lo destapó una prueba de uso, no una lectura del código.
    assert.deepEqual(
      rasgosSinRuta(),
      [],
      'un rasgo que ninguna ruta lee es una opción que el CLI acepta y no hace nada',
    );
  });

  test('el análisis de rasgos muertos falla si alguien lo esquiva', () => {
    // Lee el código de las condiciones, así que hay una forma de escribirlas que
    // no vería. Prefiere romperse a mentir.
    const original = RUTAS[0]?.eligeSi;
    assert.ok(original);
    try {
      (RUTAS[0] as { eligeSi: (r: Rasgos) => boolean }).eligeSi = (r) =>
        Boolean((r as Record<string, boolean>)['personaje']);
      assert.throws(() => rasgosSinRuta(), /notación de corchetes/u);
    } finally {
      (RUTAS[0] as { eligeSi: (r: Rasgos) => boolean }).eligeSi = original;
    }
  });
});

describe('el procedimiento decide, y siempre decide', () => {
  test('sin ningún rasgo elige el de por defecto y lo dice', () => {
    // Lo que antes pasaba acá era que no se elegía nada y la base corría sola.
    // Un texto sin tono no es neutro: es un texto cuya forma no decidió nadie.
    const s = sugerirTono();
    assert.equal(s.tono, 'camus');
    assert.equal(s.reclamado, false);
    assert.match(s.porque, /por defecto/u);
  });

  test('cada tono es alcanzable con algún conjunto de rasgos', () => {
    // Sin esto, una ruta puede quedar tapada por otra que va antes y nadie se
    // entera: seguiría en la lista, con su fila en la tabla, y jamás saldría.
    const CASOS: Record<string, Rasgos> = {
      atenas: { obraDeFiccion: true, personaje: true },
      sekkyoku: { obraDeFiccion: true, serializada: true },
      medicendai: { obraDeFiccion: true, enSuOrden: true },
      kenway: { resena: true },
      solitario: { contraOtraTesis: true, adversarioConNombre: true },
      catedra: { contraOtraTesis: true },
      han: { epocal: true },
      schiavenato: { juridico: true },
      fonseca: { actualidad: true },
      bettatech: { fundamentos: true },
      freddy: { mueveAActuar: true, mecanismo: true },
      dotcsv: { mecanismo: true, divulgacion: true },
      fonda: { humanistico: true, divulgacion: true },
      camus: { academico: true },
    };
    for (const [esperado, rasgos] of Object.entries(CASOS)) {
      assert.equal(sugerirTono(rasgos).tono, esperado, `no se alcanza ${esperado}`);
    }
    assert.equal(Object.keys(CASOS).length, TONE_IDS.length);
  });

  test('lo específico gana a lo general', () => {
    // Un personaje de una obra serializada es análisis de personaje, no de la
    // serie. Un adversario con nombre es solitario, no catedra. Si el orden se
    // invierte, estas dos dejan de cumplirse y las rutas estrechas mueren.
    assert.equal(
      sugerirTono({ obraDeFiccion: true, personaje: true, serializada: true }).tono,
      'atenas',
    );
    assert.equal(
      sugerirTono({ contraOtraTesis: true, adversarioConNombre: true, humanistico: true }).tono,
      'solitario',
    );
    assert.equal(sugerirTono({ mecanismo: true, divulgacion: true, mueveAActuar: true }).tono, 'freddy');
  });

  test('la misma petición da siempre la misma respuesta', () => {
    const rasgos: Rasgos = { divulgacion: true, humanistico: true };
    const a = sugerirTono(rasgos);
    const b = sugerirTono(rasgos);
    assert.deepEqual(a, b);
  });

  test('declarar el rasgo académico cuenta como reclamar, y se nota en el motivo', () => {
    // `camus` cierra la lista aceptando cualquier cosa, y por eso `reclamado` se
    // calculaba mirando si el tono era `camus`. Con eso, pedir el tono académico
    // por su nombre recibía como respuesta que nadie había reclamado el texto.
    const conRasgo = sugerirTono({ academico: true });
    assert.equal(conRasgo.tono, 'camus');
    assert.equal(conRasgo.reclamado, true);
    assert.doesNotMatch(conRasgo.porque, /por defecto/u);

    const sinNada = sugerirTono();
    assert.equal(sinNada.tono, 'camus');
    assert.equal(sinNada.reclamado, false);
    assert.match(sinNada.porque, /por defecto/u);
  });

  test('el motivo se puede leer y discutir', () => {
    // Una decisión sin motivo no se puede rebatir, y entonces no es una
    // decisión: es una imposición con aspecto de cálculo.
    for (const rasgos of [{ juridico: true }, { epocal: true }, { resena: true }]) {
      const s = sugerirTono(rasgos);
      assert.ok(s.porque.length > 20, `${s.tono} decide sin explicar`);
      assert.equal(s.reclamado, true);
    }
  });
});
