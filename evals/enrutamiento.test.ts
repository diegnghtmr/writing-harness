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
  rasgosQueAbren,
  rasgosQueCompletan,
  rasgosSinRuta,
  rutasQueLeen,
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

  test('--enrutar comunidadAfectada nombra a la entrada y nunca a spanish-writing §3', () => {
    const r = spawnSync(process.execPath, [cli, '--enrutar', 'comunidadAfectada'], {
      encoding: 'utf8',
      shell: false,
    });
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

describe('la ayuda dice qué paso lee cada rasgo y con qué motivo', () => {
  // La ayuda listaba los rasgos por su nombre y nada más, y quien enrutaba
  // adivinaba por el nombre qué quería decir cada uno. Así un pedido para la
  // universidad declaraba `academico` y caía en el último paso sin aviso. Cada
  // rasgo sale ahora con los pasos que lo leen y el motivo que da cada paso,
  // sacados de `RUTAS`: la ayuda no tiene prosa propia que pueda
  // desincronizarse de la lista.
  const cli = join(REPO_ROOT, 'src', 'cli.ts');
  const ayuda = () => {
    const r = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.split(/\r?\n/u);
  };
  const paso = (tono: string) => RUTA_IDS.indexOf(tono) + 1;
  const cuando = (tono: string) => RUTAS.find((r) => r.tono === tono)?.cuando;

  test('divulgacion la leen tres pasos, y dos de ellos piden otro rasgo', () => {
    assert.deepEqual(rutasQueLeen('divulgacion'), [
      { tono: 'freddy', skill: 'freddy-writing', paso: paso('freddy'), cuando: cuando('freddy'), con: ['mueveAActuar'] },
      { tono: 'dotcsv', skill: 'dotcsv-writing', paso: paso('dotcsv'), cuando: cuando('dotcsv'), con: ['mecanismo'] },
      { tono: 'fonda', skill: 'fonda-writing', paso: paso('fonda'), cuando: cuando('fonda'), con: [] },
    ]);
  });

  test('relatoPropio lo lee el último paso, con el motivo de su reclamo', () => {
    const ultima = RUTAS[RUTAS.length - 1];
    assert.deepEqual(rutasQueLeen('relatoPropio'), [
      { tono: 'camus', skill: 'camus-writing', paso: RUTAS.length, cuando: ultima?.reclamos?.[0]?.cuando, con: [] },
    ]);
  });

  test('obraDeFiccion sola no abre nada, y la ayuda dice que pide personaje', () => {
    assert.deepEqual(rutasQueLeen('obraDeFiccion'), [
      { tono: 'atenas', skill: 'atenas-writing', paso: paso('atenas'), cuando: cuando('atenas'), con: ['personaje'] },
    ]);
  });

  test('todo motivo que la ayuda da es un cuando de RUTAS, literal', () => {
    const citas = new Set(RUTAS.flatMap((r) => [r.cuando, ...(r.reclamos ?? []).flatMap((c) => c.cuando ?? [])]));
    for (const rasgo of RASGOS) {
      const lecturas = rutasQueLeen(rasgo);
      assert.ok(lecturas.length > 0, `${rasgo} no lo lee ningún paso`);
      for (const l of lecturas) assert.ok(citas.has(l.cuando), `${rasgo}: «${l.cuando}» no está en RUTAS`);
    }
  });

  test('los rasgos van en el orden de la lista, y el último es el del último paso', () => {
    // La ayuda los imprime en este orden. El primero que mostraba era
    // `academico`, que reclamaba el último paso: el orden también dice algo, y
    // un rasgo agregado al final saldría fuera de su sitio.
    const primero = (rasgo: string) => Math.min(...rutasQueLeen(rasgo).map((l) => l.paso));
    const pasos = RASGOS.map(primero);
    assert.deepEqual(pasos, [...pasos].sort((a, b) => a - b), 'RASGOS no va en el orden de la lista');
    assert.equal(RASGOS[RASGOS.length - 1], 'relatoPropio');
  });

  test('--help imprime cada rasgo con sus pasos y sus motivos', () => {
    const lineas = ayuda();
    for (const rasgo of RASGOS) {
      const titulo = lineas.indexOf(`  ${rasgo}`);
      assert.notEqual(titulo, -1, `la ayuda no tiene la línea de ${rasgo}`);
      const esperadas = rutasQueLeen(rasgo).map(
        (l) => `    paso ${l.paso}, ${l.skill}${l.con.length > 0 ? `, con ${l.con.join(' o ')}` : ''}: ${l.cuando}.`,
      );
      assert.ok(esperadas.length > 0, `${rasgo} no lo lee ningún paso`);
      assert.deepEqual(
        lineas.slice(titulo + 1, titulo + 1 + esperadas.length),
        esperadas,
        `${rasgo}: la ayuda dice otra cosa que RUTAS`,
      );
    }
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
  schiavenato: { comunidadAfectada: true },
  fonseca: { actualidad: true },
  bettatech: { fundamentos: true },
  'adria-sola': { metodoPersonal: true },
  freddy: { mueveAActuar: true, mecanismo: true },
  dotcsv: { mecanismo: true, divulgacion: true },
  fonda: { divulgacion: true },
  triangulacion: { evidenciaCruzada: true },
  // El último paso no pide ningún rasgo: recoge lo que ningún paso anterior
  // reclamó.
  camus: {},
};

describe('el procedimiento decide, y siempre decide', () => {
  test('sin ningún rasgo elige el último paso y lo dice', () => {
    // Lo que antes pasaba acá era que no se elegía nada y la base corría sola.
    // Un texto sin tono no es neutro: es un texto cuya forma no decidió nadie.
    const s = sugerirTono();
    assert.equal(s.tono, 'camus');
    assert.equal(s.reclamado, false);
    assert.match(s.porque, /último paso/u);
    assert.doesNotMatch(s.porque, /por defecto/u);
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
      sugerirTono({ contraOtraTesis: true, adversarioConNombre: true, divulgacion: true }).tono,
      'solitario',
    );
    assert.equal(sugerirTono({ mecanismo: true, divulgacion: true, mueveAActuar: true }).tono, 'freddy');
  });

  test('la misma petición da siempre la misma respuesta', () => {
    const rasgos: Rasgos = { divulgacion: true, comunidadAfectada: true };
    const a = sugerirTono(rasgos);
    const b = sugerirTono(rasgos);
    assert.deepEqual(a, b);
  });

  test('academico ya no es un rasgo: nombraba el ámbito del pedido y no la forma', () => {
    // Reclamaba el último paso sin ningún aviso, y era el primer rasgo que la
    // ayuda imprimía. Para quien escribe desde una universidad, «académico»
    // describe dónde estudia, no qué hace el texto por su lector, así que casi
    // cualquier pedido lo declaraba y todos salían con la misma forma.
    assert.ok(!(RASGOS as readonly string[]).includes('academico'), 'academico sigue siendo un rasgo');
    const fuente = readFileSync(join(REPO_ROOT, 'src', 'enrutamiento.ts'), 'utf8');
    assert.doesNotMatch(fuente, /r\.academico/u, 'una condición sigue leyendo academico');
  });

  test('el motivo se puede leer y discutir', () => {
    // Una decisión sin motivo no se puede rebatir, y entonces no es una
    // decisión: es una imposición con aspecto de cálculo.
    for (const rasgos of [{ comunidadAfectada: true }, { epocal: true }, { actualidad: true }]) {
      const s = sugerirTono(rasgos);
      assert.ok(s.porque.length > 20, `${s.tono} decide sin explicar`);
      assert.equal(s.reclamado, true);
    }
  });
});

describe('tres rutas acotan por forma, y por eso bajan en la lista', () => {
  // `schiavenato`, `fonseca` y `fonda` acotaban por materia: derecho,
  // actualidad internacional, filosofía. Sus propias skills dicen que eso es de
  // dónde se midió y no lo que la forma exige, y la lista era más estrecha que
  // ellas: un correo, un discurso o un resumen de clase no nombran ninguna de
  // esas materias y caían en el último paso.

  test('la lista va en este orden, de lo más estrecho a lo más amplio', () => {
    assert.deepEqual(RUTA_IDS, [
      'atenas',
      'solitario',
      'catedra',
      'han',
      'bettatech',
      'adria-sola',
      'freddy',
      'dotcsv',
      'triangulacion',
      'fonseca',
      'schiavenato',
      'fonda',
      'camus',
    ]);
  });

  test('cada una se abre con un solo rasgo de forma, y lo reclama', () => {
    for (const [rasgo, tono] of [
      ['actualidad', 'fonseca'],
      ['comunidadAfectada', 'schiavenato'],
      ['divulgacion', 'fonda'],
    ] as const) {
      const s = sugerirTono({ [rasgo]: true });
      assert.equal(s.tono, tono, `${rasgo} no abre ${tono}`);
      assert.equal(s.reclamado, true, `${rasgo} abre ${tono} sin reclamarlo`);
    }
  });

  test('su motivo describe la forma y no nombra la materia de donde se midió', () => {
    const cuando = (tono: string) => RUTAS.find((r) => r.tono === tono)?.cuando ?? '';
    assert.doesNotMatch(cuando('schiavenato'), /jur[íi]dic|pol[íi]tic|derecho/iu);
    assert.doesNotMatch(cuando('fonseca'), /internacional|geopol[íi]tic|econom/iu);
    assert.doesNotMatch(cuando('fonda'), /filos[óo]f|human[íi]stic|cultural/iu);
  });

  test('lo estrecho sigue ganándoles a las tres rutas ensanchadas', () => {
    // Ensanchadas y puestas donde estaban, se llevaban lo que otras formas
    // resuelven mejor. Cada caso es un pedido que cumple las dos condiciones, y
    // la forma que tiene que decidir.
    const casos: [Rasgos, string][] = [
      // Una guía de estudio escrita a raíz de un hecho reciente sigue siendo un
      // procedimiento en pasos.
      [{ metodoPersonal: true, actualidad: true }, 'adria-sola'],
      [{ metodoPersonal: true, comunidadAfectada: true }, 'adria-sola'],
      [{ evidenciaCruzada: true, actualidad: true }, 'triangulacion'],
      [{ evidenciaCruzada: true, comunidadAfectada: true }, 'triangulacion'],
      [{ mecanismo: true, divulgacion: true, actualidad: true }, 'dotcsv'],
      // La inflación después de una subida de tasas afecta a una comunidad, y
      // sigue entrando por el hecho.
      [{ actualidad: true, comunidadAfectada: true }, 'fonseca'],
      [{ actualidad: true, divulgacion: true }, 'fonseca'],
      // Una comunidad afectada es un caso particular de lector que no es del
      // oficio.
      [{ comunidadAfectada: true, divulgacion: true }, 'schiavenato'],
    ];
    for (const [rasgos, esperado] of casos) {
      assert.equal(sugerirTono(rasgos).tono, esperado, `${JSON.stringify(rasgos)} no dio ${esperado}`);
    }
  });

  test('los rasgos de materia se retiraron o cambiaron de nombre', () => {
    // `juridico` nombraba una materia, y la ruta pide ahora una comunidad a la
    // que el asunto afecta. `humanistico` solo lo leía `fonda`, que ya no lo
    // pide.
    const rasgos = RASGOS as readonly string[];
    assert.ok(!rasgos.includes('juridico'), 'juridico sigue siendo un rasgo');
    assert.ok(!rasgos.includes('humanistico'), 'humanistico sigue siendo un rasgo');
    assert.ok(rasgos.includes('comunidadAfectada'), 'comunidadAfectada no es un rasgo');
  });
});

describe('ningún mensaje del enrutamiento habla de un tono por defecto', () => {
  // Todo empujaba a `camus` como el tono de siempre: el motivo que daba el
  // enrutador, el mensaje de su invariante y su fila al tope de la tabla. No
  // hay tono por defecto: hay una lista, y su último paso recoge lo que ningún
  // paso anterior reclamó.
  const cli = join(REPO_ROOT, 'src', 'cli.ts');
  const salida = (args: string[]) => {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };

  test('el motivo de ninguna respuesta lo dice', () => {
    for (const rasgos of [{}, ...RASGOS.map((r) => ({ [r]: true }))] as Rasgos[]) {
      assert.doesNotMatch(sugerirTono(rasgos).porque, /por defecto/u, JSON.stringify(rasgos));
    }
  });

  test('ni la salida del CLI ni su ayuda lo dicen', () => {
    for (const args of [['--enrutar', ''], ['--enrutar', 'mueveAActuar'], ['--enrutar', 'relatoPropio'], ['--help']]) {
      assert.doesNotMatch(salida(args), /por defecto/u, args.join(' '));
    }
  });

  test('el invariante dice que la última ruta es el último paso', () => {
    // Se invierten las dos últimas rutas para que salte, y se restauran.
    const rutas = RUTAS as unknown as unknown[];
    const n = rutas.length;
    [rutas[n - 2], rutas[n - 1]] = [rutas[n - 1], rutas[n - 2]];
    try {
      assert.throws(
        () => assertRutas(),
        (e: Error) => /último paso/u.test(e.message) && !/por defecto/u.test(e.message),
      );
    } finally {
      [rutas[n - 2], rutas[n - 1]] = [rutas[n - 1], rutas[n - 2]];
    }
    assert.doesNotThrow(() => assertRutas());
  });

  test('la tabla no abre con camus: su fila es la última', () => {
    const filas = [...FILAS.keys()];
    assert.notEqual(filas[0], 'camus-writing', 'la tabla vuelve a abrir con camus');
    assert.equal(filas[filas.length - 1], 'camus-writing');
  });
});

describe('cuando los rasgos no completan ninguna ruta, se dice qué rasgo la completaría', () => {
  // Cinco rutas piden dos rasgos. Pasar uno solo caía en el último paso sin
  // decir nada, y quien consultaba recibía el caso general como si fuese una
  // decisión: ocho de los quince rasgos, pasados solos, respondían lo mismo.
  const paso = (tono: string) => RUTA_IDS.indexOf(tono) + 1;

  test('mecanismo solo se completa con mueveAActuar o divulgacion, en ese orden', () => {
    const completan = rasgosQueCompletan({ mecanismo: true });
    assert.deepEqual(completan, [
      { rasgo: 'mueveAActuar', tono: 'freddy', paso: paso('freddy') },
      { rasgo: 'divulgacion', tono: 'dotcsv', paso: paso('dotcsv') },
    ]);
    // `actualidad` cambiaría la respuesta, pero no por `mecanismo`: elige
    // `fonseca` también sola. Nombrarla sería sugerir lo que ya se sabía.
    assert.ok(!completan.some((c) => c.rasgo === 'actualidad'), 'se coló un rasgo que enruta solo');
  });

  test('un rasgo que ya eligió una ruta concreta no recibe sugerencias', () => {
    // `comunidadAfectada` elige `schiavenato` solo. Sin esta condición,
    // sumarle `obraDeFiccion` también daba `schiavenato`, y se listaba como si
    // hiciera falta: un aviso sobre una decisión que ya estaba tomada.
    assert.deepEqual(rasgosQueCompletan({ comunidadAfectada: true }), []);
    assert.deepEqual(rasgosQueCompletan({ divulgacion: true }), []);
  });

  test('obraDeFiccion sola se completa con personaje, y adversarioConNombre con contraOtraTesis', () => {
    assert.deepEqual(rasgosQueCompletan({ obraDeFiccion: true }), [
      { rasgo: 'personaje', tono: 'atenas', paso: paso('atenas') },
    ]);
    assert.deepEqual(rasgosQueCompletan({ adversarioConNombre: true }), [
      { rasgo: 'contraOtraTesis', tono: 'solitario', paso: paso('solitario') },
    ]);
  });
});

describe('cuando la respuesta es el último paso sin reclamo, se nombran también las rutas de un rasgo', () => {
  // El aviso solo nombraba los rasgos que completan una ruta de dos. Sin ningún
  // rasgo, o con uno que no completa nada, no nombraba ninguno, y el último
  // paso volvía a parecer una decisión: quien consultaba no se enteraba de que
  // una comunidad afectada o un hecho reciente abren un paso por sí solos.
  const paso = (tono: string) => RUTA_IDS.indexOf(tono) + 1;

  test('sin rasgos, nombra cada rasgo que abre una ruta por sí solo, en el orden de la lista', () => {
    assert.deepEqual(rasgosQueAbren({}), [
      { rasgo: 'contraOtraTesis', tono: 'catedra', paso: paso('catedra') },
      { rasgo: 'epocal', tono: 'han', paso: paso('han') },
      { rasgo: 'fundamentos', tono: 'bettatech', paso: paso('bettatech') },
      { rasgo: 'metodoPersonal', tono: 'adria-sola', paso: paso('adria-sola') },
      { rasgo: 'evidenciaCruzada', tono: 'triangulacion', paso: paso('triangulacion') },
      { rasgo: 'actualidad', tono: 'fonseca', paso: paso('fonseca') },
      { rasgo: 'comunidadAfectada', tono: 'schiavenato', paso: paso('schiavenato') },
      { rasgo: 'divulgacion', tono: 'fonda', paso: paso('fonda') },
    ]);
  });

  test('un rasgo que completa una ruta de dos no se repite como ruta de un rasgo', () => {
    // Con `adversarioConNombre`, sumar `contraOtraTesis` da `solitario` y no
    // `catedra`: ese rasgo ya sale entre los que completan, y nombrarlo dos
    // veces con dos tonos distintos sería contradecirse.
    const abren = rasgosQueAbren({ adversarioConNombre: true });
    assert.ok(!abren.some((c) => c.rasgo === 'contraOtraTesis'), 'contraOtraTesis sale dos veces');
    assert.ok(rasgosQueCompletan({ adversarioConNombre: true }).some((c) => c.rasgo === 'contraOtraTesis'));
    assert.ok(abren.some((c) => c.rasgo === 'comunidadAfectada'));
  });

  test('una ruta elegida, o el último paso reclamado, no reciben la lista', () => {
    assert.deepEqual(rasgosQueAbren({ comunidadAfectada: true }), []);
    assert.deepEqual(rasgosQueAbren({ relatoPropio: true }), []);
  });

  test('cada rasgo nombrado abre de verdad su ruta, y la abre solo', () => {
    // La otra dirección: la lista no puede prometer una ruta que el
    // procedimiento no elige.
    for (const rasgos of [{}, { mueveAActuar: true }, { obraDeFiccion: true }] as Rasgos[]) {
      for (const c of rasgosQueAbren(rasgos)) {
        assert.equal(sugerirTono({ ...rasgos, [c.rasgo]: true }).tono, c.tono, `${c.rasgo} no abre ${c.tono}`);
        assert.ok(
          (RUTAS[c.paso - 1] as { eligeSi: (r: Rasgos) => boolean }).eligeSi({ [c.rasgo]: true }),
          `${c.rasgo} no abre ${c.tono} por sí solo`,
        );
      }
    }
  });
});

describe('el último paso dice qué forma recoge', () => {
  // La fila de `camus` abría con «Textos académicos, técnicos y formales», que
  // para quien escribe desde una universidad nombra el ámbito del pedido y no
  // la forma. Su precondición decía además que el texto no interpela a nadie,
  // y la correspondencia formal, que se dirige a alguien, caía ahí igual.
  test('su motivo nombra las voces que admite y no el ámbito', () => {
    const ultima = RUTAS[RUTAS.length - 1];
    assert.equal(ultima?.tono, 'camus');
    const cuando = ultima?.cuando ?? '';
    assert.match(cuando, /impersonal/u);
    assert.match(cuando, /sin tuteo ni complicidad/u);
    assert.doesNotMatch(cuando, /acad[ée]mic/iu);
  });
});

describe('el relato propio reclama el último paso', () => {
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

  test('--enrutar mecanismo conserva su respuesta y agrega el aviso con cada rasgo que la completa', () => {
    const lineas = enrutar('mecanismo');
    const aviso = lineas.findIndex((l) => AVISO.test(l));
    assert.notEqual(aviso, -1, 'no hay aviso: el último paso vuelve a parecer una decisión');
    // Lo que ya se imprimía no cambia, y el aviso va después.
    const s = sugerirTono({ mecanismo: true });
    assert.deepEqual(lineas.slice(0, aviso), [
      s.skill,
      `  ${s.porque}`,
      '  Ningún rasgo de los dados es más estrecho que el caso general.',
      lineaDePaso('camus'),
    ]);
    const despues = lineas.slice(aviso + 1);
    for (const c of rasgosQueCompletan({ mecanismo: true })) {
      const skill = RUTAS[c.paso - 1]?.skill;
      assert.ok(
        despues.some((l) => l.includes(`${c.rasgo}: ${skill}, paso ${c.paso}`)),
        `el aviso no nombra ${c.rasgo}`,
      );
    }
    assert.ok(despues.some((l) => l.includes('dotcsv-writing')));
  });

  test('--enrutar sin rasgos avisa y nombra cada ruta que un rasgo abre por sí solo', () => {
    const lineas = enrutar('');
    const s = sugerirTono({});
    assert.deepEqual(lineas.slice(0, 4), [
      s.skill,
      `  ${s.porque}`,
      '  Ningún rasgo de los dados es más estrecho que el caso general.',
      lineaDePaso('camus'),
    ]);
    assert.ok(
      lineas.some((l) => /Aviso: no se dio ningún rasgo, así que la respuesta es el último paso/u.test(l)),
      'sin rasgos no hay aviso',
    );
    const titulo = lineas.indexOf('  Estos rasgos abren una ruta por sí solos:');
    assert.notEqual(titulo, -1, 'no se nombran las rutas de un rasgo');
    const despues = lineas.slice(titulo + 1);
    for (const c of rasgosQueAbren({})) {
      assert.ok(despues.includes(`    + ${c.rasgo}: ${RUTAS[c.paso - 1]?.skill}, paso ${c.paso}`), `falta ${c.rasgo}`);
    }
  });

  test('--enrutar mueveAActuar nombra lo que lo completa y, aparte, las rutas de un rasgo', () => {
    const lineas = enrutar('mueveAActuar');
    const completan = lineas.indexOf('  Con uno de estos rasgos más, la ruta sería otra:');
    const abren = lineas.indexOf('  Estos rasgos abren una ruta por sí solos:');
    assert.ok(completan !== -1 && abren > completan, 'faltan los dos bloques del aviso, o van al revés');
    const linea = (c: { rasgo: string; paso: number }) => `    + ${c.rasgo}: ${RUTAS[c.paso - 1]?.skill}, paso ${c.paso}`;
    const bloqueCompletan = lineas.slice(completan + 1, abren);
    const bloqueAbren = lineas.slice(abren + 1);
    assert.deepEqual(bloqueCompletan, rasgosQueCompletan({ mueveAActuar: true }).map(linea));
    assert.deepEqual(bloqueAbren, rasgosQueAbren({ mueveAActuar: true }).map(linea));
    assert.ok(bloqueCompletan.some((l) => l.includes('mecanismo: freddy-writing')));
    assert.ok(bloqueAbren.some((l) => l.includes('comunidadAfectada: schiavenato-writing')));
  });

  test('--enrutar comunidadAfectada responde schiavenato-writing y sin aviso', () => {
    const s = sugerirTono({ comunidadAfectada: true });
    assert.deepEqual(enrutar('comunidadAfectada'), [s.skill, `  ${s.porque}`, lineaDePaso('schiavenato')]);
  });

  test('--enrutar juridico falla: la ruta de schiavenato se pide ahora con comunidadAfectada', () => {
    const r = spawnSync(process.execPath, [cli, '--enrutar', 'juridico'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /rasgo desconocido: juridico/u);
  });

  test('--enrutar academico falla como rasgo desconocido', () => {
    // Se retiró, y un rasgo retirado no puede seguir aceptándose en silencio:
    // quien lo escriba tiene que enterarse de que ya no decide nada.
    const r = spawnSync(process.execPath, [cli, '--enrutar', 'academico'], { encoding: 'utf8', shell: false });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /rasgo desconocido: academico/u);
  });

  test('--enrutar relatoPropio responde camus-writing en el último paso, y sin aviso', () => {
    // Reclama el último paso: la respuesta es una decisión, así que no hay
    // nada que avisar ni ningún rasgo que sugerir.
    const lineas = enrutar('relatoPropio');
    const s = sugerirTono({ relatoPropio: true });
    assert.equal(RUTA_IDS.indexOf('camus') + 1, RUTAS.length, 'camus dejó de ser el último paso');
    assert.deepEqual(lineas, ['camus-writing', `  ${s.porque}`, lineaDePaso('camus')]);
    assert.ok(!lineas.some((l) => /Aviso/u.test(l)), 'el último paso, reclamado, no lleva aviso');
  });
});
