// El enrutamiento decide siempre, y decide lo que la tabla de la entrada dice.
//
// Mismo gate que el de las reglas, aplicado al otro dato que la entrada declara
// en prosa: cada ruta cita literalmente su celda de la tabla, y cada fila de la
// tabla tiene su ruta. Falla en las dos direcciones, así que reescribir la tabla
// sin tocar el dato rompe, y al revés también.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  RASGOS,
  RUTAS,
  RUTA_IDS,
  type Rasgos,
  assertRutas,
  rasgosQueCompletan,
  rasgosSinRuta,
  sugerirTono,
} from '../src/enrutamiento.ts';
import { TONES, TONE_IDS } from '../src/rules.ts';
import { ENTRADA, REPO_ROOT, readSkill, skillNames } from '../src/skills.ts';

const TEXTO_ENTRADA = readSkill(ENTRADA);

/** Una fila de la tabla del tono: solo la entrada tiene celdas con backtick. */
const FILA = /^\|\s*`([a-z-]+)`\s*\|([^|]+)\|([^|]+)\|\s*$/gmu;

/** Un paso de la lista numerada: solo la entrada los tiene. */
const PASO = /^\d+\.\s+(?:Si|En cualquier)[^`]*`([a-z-]+)`\.?$/gmu;

/** Las filas de la tabla, por la skill que nombran. */
const FILAS = new Map(
  [...TEXTO_ENTRADA.matchAll(FILA)].map((m) => [(m[1] as string).trim(), (m[2] as string).trim()]),
);

describe('el enrutamiento está bien formado', () => {
  test('cada ruta apunta a un tono que existe, y ningún tono se queda fuera', () => {
    assertRutas();
    assert.deepEqual([...RUTA_IDS].sort(), [...TONE_IDS].sort());
  });

  test('la tabla de la entrada tiene una fila por tono', () => {
    // Si la tabla pierde una fila, el tono deja de poder elegirse aunque su
    // skill siga en el repositorio.
    assert.equal(FILAS.size, TONE_IDS.length);
  });
});

describe('cada ruta cita la tabla que dice seguir', () => {
  test('el «cuándo» de cada ruta, y el de cada reclamo, está literal en su fila', () => {
    // Un reclamo con motivo propio también cita la tabla. Sin esto, el motivo
    // que imprime el enrutamiento podría afirmar algo que la fila no dice.
    const citas = RUTAS.flatMap((r) =>
      [r.cuando, ...(r.reclamos ?? []).flatMap((c) => c.cuando ?? [])].map((cuando) => ({
        skill: r.skill,
        cuando,
      })),
    );
    const huerfanas = citas
      .filter(({ skill, cuando }) => !(FILAS.get(skill) ?? '').includes(cuando))
      .map(({ skill, cuando }) => `${skill}: «${cuando}»`);
    assert.deepEqual(
      huerfanas,
      [],
      'una ruta cita un texto que la tabla de la entrada ya no dice. O se reescribió la tabla, o el dato quedó viejo.',
    );
  });

  test('ninguna fila de la tabla se quedó sin ruta', () => {
    const conRuta = new Set(RUTAS.map((r) => r.skill));
    assert.deepEqual([...FILAS.keys()].filter((s) => !conRuta.has(s)), []);
  });

  test('la lista numerada de la entrada va en el mismo orden que el dato', () => {
    // El orden ES la mitad del procedimiento, así que tiene que coincidir en las
    // dos representaciones. La prosa la lee el modelo que escribe; el dato lo
    // lee el verificador. Si divergen, uno de los dos elige mal y nadie se
    // entera hasta que el texto sale con la forma equivocada.
    //
    // Se leen los pasos como «N. Si … `skill-writing`», que es como están
    // escritos. A propósito no son preguntas con «¿»: el extractor de
    // declaraciones toma esas por reglas de checklist, y estos pasos no lo son.
    const pasos = [...TEXTO_ENTRADA.matchAll(PASO)].map((m) => m[1] as string);
    assert.deepEqual(pasos, RUTAS.map((r) => r.skill));
  });
});

describe('la tabla y la lista viven solo en la entrada', () => {
  test('ninguna otra skill tiene una fila de la tabla ni un paso de la lista', () => {
    const otras = skillNames().filter((n) => n !== ENTRADA);
    const conFila = otras.filter((n) => [...readSkill(n).matchAll(FILA)].length > 0);
    const conPaso = otras.filter((n) => [...readSkill(n).matchAll(PASO)].length > 0);
    assert.deepEqual(conFila, [], 'estas skills tienen una fila con la forma de la tabla');
    assert.deepEqual(conPaso, [], 'estas skills tienen un paso con la forma de la lista');
  });
});

describe('el CLI nombra la skill donde vive la lista', () => {
  const cli = join(REPO_ROOT, 'src', 'cli.ts');

  test('--enrutar juridico nombra a la entrada y nunca a spanish-writing §3', () => {
    const r = spawnSync(process.execPath, [cli, '--enrutar', 'juridico'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(ENTRADA, 'u'));
    assert.doesNotMatch(r.stdout, /spanish-writing §3/u);
  });

  test('--help nombra a la entrada y nunca a spanish-writing §3', () => {
    const r = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(ENTRADA, 'u'));
    assert.doesNotMatch(r.stdout, /spanish-writing §3/u);
  });

  test('--help nombra cada rasgo que --enrutar acepta, incluido relatoPropio', () => {
    // La ayuda es donde quien enruta descubre los rasgos. Un rasgo que no
    // aparece ahí no lo declara nadie, y la petición cae en el último paso
    // por descarte, que es como un relato propio terminó llamado académico.
    const r = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /relatoPropio/u);
    for (const rasgo of RASGOS) assert.ok(r.stdout.includes(rasgo), `la ayuda no nombra ${rasgo}`);
  });
});

describe('el motivo por el que no se decide midiendo sigue siendo cierto', () => {
  // La versión anterior de este bloque comprobaba una cifra: cuántos tonos no
  // tenían ninguna regla mecanizada, que era el motivo que daba el comentario
  // para no enrutar midiendo. Lo escribí con una condición de caducidad puesta:
  // «si algún día los que quedan sin regla la reciben, esto falla y con ello cae
  // el motivo entero».
  //
  // Ese día llegó. Se mecanizó el ritmo de los seis tonos que no tenían nada, el
  // gate falló, y el motivo hubo que rehacerlo. Lo que sigue vigila el motivo
  // nuevo, que es estructural en vez de contingente.

  test('ningún tono queda sin reglas, así que el motivo viejo ya no vale', () => {
    // Se deja escrito como comprobación y no como comentario, porque el
    // comentario de `enrutamiento.ts` afirma que ese argumento caducó. Si
    // volviera a haber un tono sin reglas, la afirmación sería falsa.
    assert.deepEqual(
      TONE_IDS.filter((id) => TONES[id]?.rules.length === 0),
      [],
      'volvió a haber un tono sin reglas: el comentario dice que eso ya no pasa',
    );
  });

  test('la entrada del enrutamiento son rasgos y no un texto', () => {
    // Este es el motivo que no caduca: el enrutamiento decide antes de que
    // exista la prosa. Medir para enrutar exigiría escribir primero en algún
    // tono, que es justo la decisión que se quería tomar.
    //
    // Se comprueba sobre el tipo, que es donde entraría el texto si alguien lo
    // metiera. Un campo que no sea booleano abre la puerta a pasarle prosa, y
    // ese día la decisión de diseño vuelve a estar en discusión.
    const fuente = readFileSync(join(REPO_ROOT, 'src', 'enrutamiento.ts'), 'utf8');
    const cuerpo = /export type Rasgos = \{([\s\S]*?)\n\};/u.exec(fuente);
    assert.ok(cuerpo, 'no se encontró el tipo Rasgos');
    const campos = [...(cuerpo[1] as string).matchAll(/^\s{2}(\w+)\?:\s*([^;]+);/gmu)];
    assert.ok(campos.length > 0);
    assert.deepEqual(
      campos.filter((m) => (m[2] as string).trim() !== 'boolean').map((m) => m[1]),
      [],
      'un rasgo dejó de ser booleano: si por ahí entra un texto, enrutar midiendo vuelve a estar sobre la mesa',
    );
    assert.match(fuente, /el enrutamiento decide antes\n\/\/ de que exista el texto/u);
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

/**
 * Un conjunto de rasgos que alcanza cada tono.
 *
 * Vive fuera de los tests porque lo usan dos: el que comprueba que cada tono se
 * alcanza, y el que comprueba que el relato propio no le quita el texto a
 * ninguno.
 */
const UN_CASO_POR_TONO: Record<string, Rasgos> = {
  atenas: { obraDeFiccion: true, personaje: true },
  solitario: { contraOtraTesis: true, adversarioConNombre: true },
  catedra: { contraOtraTesis: true },
  han: { epocal: true },
  schiavenato: { juridico: true },
  fonseca: { actualidad: true },
  bettatech: { fundamentos: true },
  'adria-sola': { metodoPersonal: true },
  freddy: { mueveAActuar: true, mecanismo: true },
  dotcsv: { mecanismo: true, divulgacion: true },
  fonda: { humanistico: true, divulgacion: true },
  triangulacion: { evidenciaCruzada: true },
  camus: { academico: true },
};

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
    for (const [esperado, rasgos] of Object.entries(UN_CASO_POR_TONO)) {
      assert.equal(sugerirTono(rasgos).tono, esperado, `no se alcanza ${esperado}`);
    }
    assert.equal(Object.keys(UN_CASO_POR_TONO).length, TONE_IDS.length);
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
    for (const rasgos of [{ juridico: true }, { epocal: true }, { actualidad: true }]) {
      const s = sugerirTono(rasgos);
      assert.ok(s.porque.length > 20, `${s.tono} decide sin explicar`);
      assert.equal(s.reclamado, true);
    }
  });
});

describe('cuando los rasgos no completan ninguna ruta, se dice qué rasgo la completaría', () => {
  // Cinco rutas piden dos rasgos. Pasar uno solo caía en el último paso sin
  // decir nada, y quien consultaba recibía el caso general como si fuese una
  // decisión: ocho de los quince rasgos, pasados solos, respondían lo mismo.
  const paso = (tono: string) => RUTA_IDS.indexOf(tono) + 1;

  test('divulgacion sola se completa con mueveAActuar, mecanismo o humanistico, en ese orden', () => {
    const completan = rasgosQueCompletan({ divulgacion: true });
    assert.deepEqual(completan, [
      { rasgo: 'mueveAActuar', tono: 'freddy', paso: paso('freddy') },
      { rasgo: 'mecanismo', tono: 'dotcsv', paso: paso('dotcsv') },
      { rasgo: 'humanistico', tono: 'fonda', paso: paso('fonda') },
    ]);
    // `actualidad` cambiaría la respuesta, pero no por `divulgacion`: elige
    // `fonseca` también sola. Nombrarla sería sugerir lo que ya se sabía.
    assert.ok(!completan.some((c) => c.rasgo === 'actualidad'), 'se coló un rasgo que enruta solo');
  });

  test('un rasgo que ya eligió una ruta concreta no recibe sugerencias', () => {
    // `juridico` elige `schiavenato` solo. Sin esta condición, sumarle
    // `academico` u `obraDeFiccion` también daba `schiavenato`, y se listaban
    // como si hicieran falta: un aviso sobre una decisión que ya estaba tomada.
    assert.deepEqual(rasgosQueCompletan({ juridico: true }), []);
  });

  test('obraDeFiccion sola se completa con personaje, y adversarioConNombre con contraOtraTesis', () => {
    assert.deepEqual(rasgosQueCompletan({ obraDeFiccion: true }), [
      { rasgo: 'personaje', tono: 'atenas', paso: paso('atenas') },
    ]);
    assert.deepEqual(rasgosQueCompletan({ adversarioConNombre: true }), [
      { rasgo: 'contraOtraTesis', tono: 'solitario', paso: paso('solitario') },
    ]);
  });

  test('academico no recibe sugerencias: ninguna ruta de dos rasgos lo lee', () => {
    // Cae en el último paso, pero porque lo reclama y no por falta de un rasgo.
    // Solo `camus` lo consulta, para saber que alguien lo pidió, y ninguna ruta
    // lo combina con otro. Los rasgos que a su lado cambian la respuesta, como
    // `juridico`, la cambian igual solos, así que no hay nada que le falte.
    assert.equal(sugerirTono({ academico: true }).reclamado, true);
    assert.deepEqual(rasgosQueCompletan({ academico: true }), []);
  });
});

describe('el relato propio reclama el último paso, igual que lo académico', () => {
  // Un texto en que el usuario cuenta lo que le pasó no encajaba en ningún
  // paso y caía en el último por descarte. El motivo que salía era el de lo
  // académico, y un agente justificó el tono de un relato diciendo que
  // correspondía a una redacción académica, que era falso.

  test('relatoPropio cae en el último paso porque lo reclama, y no recibe sugerencias', () => {
    assert.ok((RASGOS as readonly string[]).includes('relatoPropio'), 'relatoPropio no es un rasgo');
    const s = sugerirTono({ relatoPropio: true });
    assert.equal(s.tono, 'camus');
    assert.equal(s.reclamado, true);
    assert.doesNotMatch(s.porque, /por defecto/u);
    assert.deepEqual(rasgosQueCompletan({ relatoPropio: true }), []);
  });

  test('su motivo dice que el relato va en primera persona del singular, y no lo llama académico', () => {
    const { porque } = sugerirTono({ relatoPropio: true });
    assert.match(porque, /primera persona del singular/u);
    assert.doesNotMatch(porque, /acad[ée]mic/iu);
    // Lo académico conserva su motivo: el reclamo nuevo no se lo quita.
    assert.match(sugerirTono({ academico: true }).porque, /^Textos académicos/u);
  });

  test('no le quita el texto a ningún paso más estrecho', () => {
    // Reclama el último paso, así que no adelanta a nadie: un relato sobre un
    // hecho reciente sigue siendo de `fonseca`. Si alguien lo leyera en la ruta
    // de `metodoPersonal`, que va antes, `freddy` perdería lo suyo y esto
    // fallaría.
    assert.equal(sugerirTono({ relatoPropio: true, actualidad: true }).tono, 'fonseca');
    for (const [tono, rasgos] of Object.entries(UN_CASO_POR_TONO)) {
      assert.equal(
        sugerirTono({ ...rasgos, relatoPropio: true }).tono,
        tono,
        `relatoPropio le quitó el texto a ${tono}`,
      );
    }
  });
});

describe('el CLI avisa cuando los rasgos no completan ninguna ruta', () => {
  const cli = join(REPO_ROOT, 'src', 'cli.ts');
  const enrutar = (rasgo: string): string[] => {
    const r = spawnSync(process.execPath, [cli, '--enrutar', rasgo], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split(/\r?\n/u).filter((l) => l !== '');
  };
  const lineaDePaso = (tono: string) =>
    `  Paso ${RUTA_IDS.indexOf(tono) + 1} de ${RUTAS.length} de la lista de ${ENTRADA}.`;
  const AVISO = /no completan ninguna ruta de la lista, así que la respuesta es el último paso/u;

  test('--enrutar divulgacion conserva su respuesta y agrega el aviso con cada rasgo que la completa', () => {
    const lineas = enrutar('divulgacion');
    const aviso = lineas.findIndex((l) => AVISO.test(l));
    assert.notEqual(aviso, -1, 'no hay aviso: el último paso vuelve a parecer una decisión');
    // Lo que ya se imprimía no cambia, y el aviso va después.
    const s = sugerirTono({ divulgacion: true });
    assert.deepEqual(lineas.slice(0, aviso), [
      s.skill,
      `  ${s.porque}`,
      '  Ningún rasgo de los dados es más estrecho que el caso general.',
      lineaDePaso('camus'),
    ]);
    const despues = lineas.slice(aviso + 1);
    for (const c of rasgosQueCompletan({ divulgacion: true })) {
      const skill = RUTAS[c.paso - 1]?.skill;
      assert.ok(
        despues.some((l) => l.includes(`${c.rasgo}: ${skill}, paso ${c.paso}`)),
        `el aviso no nombra ${c.rasgo}`,
      );
    }
    assert.ok(despues.some((l) => l.includes('fonda-writing')));
  });

  test('--enrutar juridico responde lo mismo que antes y sin aviso', () => {
    const s = sugerirTono({ juridico: true });
    assert.deepEqual(enrutar('juridico'), [s.skill, `  ${s.porque}`, lineaDePaso('schiavenato')]);
  });

  test('--enrutar relatoPropio responde camus-writing en el último paso, y sin aviso', () => {
    // Reclama el último paso, igual que `academico`: la respuesta es una
    // decisión, así que no hay nada que avisar ni ningún rasgo que sugerir.
    const lineas = enrutar('relatoPropio');
    const s = sugerirTono({ relatoPropio: true });
    assert.equal(RUTA_IDS.indexOf('camus') + 1, RUTAS.length, 'camus dejó de ser el último paso');
    assert.deepEqual(lineas, ['camus-writing', `  ${s.porque}`, lineaDePaso('camus')]);
    assert.ok(!lineas.some((l) => /Aviso/u.test(l)), 'el último paso, reclamado, no lleva aviso');
  });
});
