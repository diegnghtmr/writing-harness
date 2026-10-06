// Lo que cada agente deja escrito, leído de la misma manera para los tres.
//
// Copilot, Grok y Antigravity cuentan su sesión en tres formatos distintos, y la
// prueba final necesita lo mismo de los tres: la respuesta, las skills que
// cargó, los comandos que corrió con su código de salida y lo que escribió. Las
// transcripciones de `evals/fixtures/prueba-final/` son sintéticas, con rutas
// inventadas, pero tienen la forma exacta de las que dejó cada CLI en el sondeo:
// las reales traen rutas y nombres de una persona y no se publican.
//
// Hay una trampa que este archivo fija a propósito. El registro de Copilot
// guarda el contenido entero de cada skill que carga, y la skill de entrada
// nombra a las demás; si la detección leyera ese contenido, toda corrida
// «cargaría» todos los tonos. Se leen solo las entradas de las herramientas.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, posix, win32 } from 'node:path';
import { describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import { AGENTES, parsearAgy, parsearCopilot, parsearGrok } from '../scripts/prueba-final/agentes.ts';
import { entornoDeLaCorrida } from '../scripts/prueba-final/reales.ts';
import { resolverEjecutable } from '../scripts/prueba-final/resolver.ts';
import { cadenasDe, comandos, escrituras, llamada, motivoDeError, skillsCargadas } from '../scripts/prueba-final/transcripcion.ts';

const fixture = (nombre: string) => readFileSync(join(REPO_ROOT, 'evals', 'fixtures', 'prueba-final', nombre), 'utf8');
const SALIDA = 'C:\\temp\\pf-00000000-0000-4000-8000-000000000001\\salida.md';

describe('copilot', () => {
  const t = parsearCopilot(fixture('copilot-stdout.jsonl'), fixture('copilot-eventos.jsonl'));

  test('la respuesta es el mensaje final, no el primero con contenido', () => {
    assert.match(t.respuesta ?? '', /^Quedó en `C:\\temp\\pf-/u);
  });

  test('cada herramienta, en orden, con su clase', () => {
    assert.deepEqual(
      t.llamadas.map((l) => [l.herramienta, l.clase]),
      [
        ['skill', 'skill'],
        ['skill', 'skill'],
        ['view', 'otra'],
        ['powershell', 'shell'],
        ['create', 'escritura'],
      ],
    );
  });

  test('el código de salida del comando sale de su ejecución completa', () => {
    const [shell] = comandos(t);
    assert.match(shell?.comando ?? '', /node writing-harness\/src\/cli\.ts \$p/u);
    assert.equal(shell?.codigo, 1);
  });

  test('las skills: las de la herramienta, las del registro y las rutas leídas', () => {
    assert.deepEqual(skillsCargadas(t), ['camus-writing', 'redactar-espanol', 'spanish-writing']);
    assert.deepEqual(t.skillsInvocadas, ['redactar-espanol', 'spanish-writing']);
  });

  test('el contenido de una skill cargada no cuenta como carga de otra', () => {
    assert.ok(!skillsCargadas(t).includes('fonda-writing'));
  });

  test('los metadatos: modelo, costo, duración y versión', () => {
    assert.equal(t.modelo, 'modelo-de-prueba');
    assert.deepEqual(t.costo, { valor: 1, unidad: 'solicitudes premium' });
    assert.equal(t.duracionMs, 15890);
    assert.equal(t.version, '1.0.92');
  });

  test('sin el registro de la sesión, la salida estándar alcanza para lo demás', () => {
    const solo = parsearCopilot(fixture('copilot-stdout.jsonl'), null);
    assert.deepEqual(solo.skillsInvocadas, []);
    assert.equal(solo.version, null);
    assert.equal(solo.llamadas.length, 5);
  });

  test('lo que escribió con una herramienta propia', () => {
    assert.deepEqual(escrituras(t), ['C:\\Users\\prueba\\notas.md']);
  });
});

describe('grok', () => {
  const t = parsearGrok(fixture('grok-stdout.jsonl'));

  test('la respuesta es el campo result de la última línea', () => {
    assert.match(t.respuesta ?? '', /^Quedó en/u);
  });

  test('lee las skills con read_file y escribe con write', () => {
    assert.deepEqual(skillsCargadas(t), ['redactar-espanol', 'spanish-writing']);
    assert.deepEqual(escrituras(t), [SALIDA]);
  });

  test('el código de salida viene en el JSON del resultado, como exit_code', () => {
    const [shell] = comandos(t);
    assert.match(shell?.comando ?? '', /--tono camus/u);
    assert.equal(shell?.codigo, 0);
  });

  test('los metadatos', () => {
    assert.equal(t.modelo, 'grok-de-prueba');
    assert.deepEqual(t.costo, { valor: 0.17912696, unidad: 'USD' });
    assert.equal(t.duracionMs, 110046);
    assert.equal(t.sesion, 'sesion-grok');
  });
});

describe('agy', () => {
  const completa = parsearAgy(fixture('agy-stdout.jsonl'), fixture('agy-transcripcion.jsonl'), fixture('agy-log.txt'));

  test('con la transcripción completa, cada comando trae su código', () => {
    assert.deepEqual(
      comandos(completa).map((c) => [c.comando?.replace(/^.*cli\.ts \S+/u, ''), c.codigo]),
      [
        [' --tono camus-writing', 1],
        [' --tono camus', 0],
      ],
    );
  });

  test('un mensaje del sistema no se come el resultado de una herramienta', () => {
    assert.deepEqual(
      completa.llamadas.map((l) => l.herramienta),
      ['view_file', 'view_file', 'run_command', 'write_to_file', 'run_command'],
    );
  });

  test('las skills, la escritura, la respuesta y los metadatos', () => {
    assert.deepEqual(skillsCargadas(completa), ['redactar-espanol', 'spanish-writing']);
    assert.deepEqual(escrituras(completa), [SALIDA]);
    assert.match(completa.respuesta ?? '', /^Quedó en/u);
    assert.equal(completa.sesion, 'conv-agy');
    assert.equal(completa.version, '1.1.14');
    assert.equal(completa.duracionMs, 351500);
    assert.equal(completa.costo, null);
  });

  test('sin la transcripción, sale de la salida estándar sin códigos y sin pasos repetidos', () => {
    const solo = parsearAgy(fixture('agy-stdout.jsonl'), null, null);
    assert.deepEqual(
      solo.llamadas.map((l) => [l.herramienta, l.codigo]),
      [
        ['view_file', null],
        ['run_command', null],
        ['write_to_file', null],
      ],
    );
    assert.equal(solo.version, null);
  });
});

describe('las líneas de comando', () => {
  const ctx = {
    prompt: 'Corrige el texto de `a` y guarda el resultado en `b`.',
    archivoPrompt: join('staging', 'prompt.txt'),
    sesion: '11111111-2222-4333-8444-555555555555',
    cwd: join('repos', 'mix'),
    limiteMin: 40,
    staging: 'staging',
    engram: 'prueba-final-20261006-000000-copilot-base',
  };

  test('cada corrida lleva su proyecto de Engram en el entorno', () => {
    const env = entornoDeLaCorrida(ctx.engram);
    assert.equal(env.ENGRAM_PROJECT, ctx.engram);
    assert.equal(env.PATH, process.env.PATH, 'el resto del entorno sigue igual');
  });

  test('copilot recibe el prompt como argumento y la sesión que se le fija', () => {
    assert.deepEqual(AGENTES.copilot?.argumentos(ctx), [
      '-p',
      ctx.prompt,
      '--allow-all-tools',
      '--allow-all-paths',
      '--no-ask-user',
      '--output-format',
      'json',
      '--session-id',
      ctx.sesion,
    ]);
  });

  test('grok lee el prompt de un archivo', () => {
    assert.deepEqual(AGENTES.grok?.argumentos(ctx), [
      '--prompt-file',
      ctx.archivoPrompt,
      '--cwd',
      ctx.cwd,
      '--always-approve',
      '--output-format',
      'streaming-messages-json',
      '--session-id',
      ctx.sesion,
    ]);
  });

  test('agy lleva el límite como su propio tiempo de espera, y el prompt al final', () => {
    // El analizador de opciones de agy deja de leer opciones en el primer
    // argumento que no lo es, así que el prompt va último.
    const args = AGENTES.agy?.argumentos(ctx) ?? [];
    assert.deepEqual(args.slice(0, 5), ['--output-format', 'stream-json', '--dangerously-skip-permissions', '--print-timeout', '40m']);
    assert.deepEqual(args.slice(-2), ['-p', ctx.prompt]);
    assert.deepEqual(args.slice(5, 7), ['--log-file', join('staging', 'agy.log')]);
  });

  test('dónde deja cada uno su transcripción', () => {
    const home = join('home', 'prueba');
    assert.equal(
      AGENTES.copilot?.transcripcion(home, ctx, ''),
      join(home, '.copilot', 'session-state', ctx.sesion, 'events.jsonl'),
    );
    assert.equal(
      AGENTES.grok?.transcripcion(home, ctx, ''),
      join(home, '.grok', 'sessions', encodeURIComponent(ctx.cwd), ctx.sesion, 'events.jsonl'),
    );
    assert.equal(
      AGENTES.agy?.transcripcion(home, ctx, fixture('agy-stdout.jsonl')),
      join(home, '.gemini', 'antigravity-cli', 'brain', 'conv-agy', '.system_generated', 'logs', 'transcript_full.jsonl'),
    );
    assert.equal(AGENTES.agy?.transcripcion(home, ctx, ''), null, 'sin la línea init no hay conversación que buscar');
  });

  test('dónde guarda cada uno su propio estado, que no cuenta como escribir fuera', () => {
    const home = join('home', 'prueba');
    assert.deepEqual(AGENTES.copilot?.estadoPropio(home, ctx, null), [join(home, '.copilot', 'session-state', ctx.sesion)]);
    assert.deepEqual(AGENTES.grok?.estadoPropio(home, ctx, 'sesion-grok'), [join(home, '.grok', 'sessions')]);
    assert.deepEqual(AGENTES.agy?.estadoPropio(home, ctx, 'conv-agy'), [
      join(home, '.gemini', 'antigravity-cli', 'brain', 'conv-agy'),
    ]);
    assert.deepEqual(AGENTES.agy?.estadoPropio(home, ctx, null), [], 'sin conversación no hay carpeta propia que reconocer');
  });
});

describe('los errores del propio agente', () => {
  // En la segunda corrida de humo, agy agotó su cuota al dar la respuesta final:
  // la salida quedó escrita, la respuesta vacía, y la comprobación de la
  // respuesta lo contó como una falla de las skills. Cada lectura saca ahora el
  // error que el agente informa, en una frase corta. Las transcripciones de
  // error de grok y de copilot tienen la forma de sus líneas de resultado
  // reales; el texto del error es inventado, porque ninguna corrida lo mostró.

  test('agy: el error de la salida de errores, que trae el estado y el código', () => {
    const t = parsearAgy(fixture('agy-error-stdout.jsonl'), null, null, fixture('agy-error-stderr.txt'));
    assert.equal(t.error, 'cuota agotada (RESOURCE_EXHAUSTED 429), vuelve en 156h37m');
    assert.equal(t.respuesta, '');
    assert.deepEqual(escrituras(t), ['C:\\Users\\prueba\\tmp\\pf-1\\salida.md'], 'lo que hizo antes del error se sigue leyendo');
  });

  test('agy: sin salida de errores, el del resultado', () => {
    assert.equal(parsearAgy(fixture('agy-error-stdout.jsonl'), null, null).error, 'cuota agotada, vuelve en 156h37m');
  });

  test('grok: un resultado con is_error da el error, y no es la respuesta', () => {
    const t = parsearGrok(fixture('grok-error-stdout.jsonl'));
    assert.equal(t.error, 'sesión vencida');
    assert.equal(t.respuesta, null);
    assert.equal(t.sesion, 'sesion-grok-error');
  });

  test('grok: un subtipo que no es success también es un error, aunque no traiga texto', () => {
    const t = parsearGrok('{"type":"result","subtype":"error_max_turns","is_error":false,"num_turns":50}\n');
    assert.equal(t.error, 'error_max_turns');
  });

  test('copilot: el evento de error, y si no hay, el código del resultado', () => {
    assert.equal(parsearCopilot(fixture('copilot-error-stdout.jsonl'), null).error, 'cuota agotada (429), vuelve en 3h20m');
    assert.equal(parsearCopilot('{"type":"result","sessionId":"s","exitCode":2}\n', null).error, 'el agente terminó con código 2');
  });

  test('las sesiones que terminaron bien no traen error', () => {
    assert.equal(parsearCopilot(fixture('copilot-stdout.jsonl'), fixture('copilot-eventos.jsonl')).error, null);
    assert.equal(parsearGrok(fixture('grok-stdout.jsonl')).error, null);
    assert.equal(parsearAgy(fixture('agy-stdout.jsonl'), fixture('agy-transcripcion.jsonl'), fixture('agy-log.txt'), '').error, null);
  });

  test('la definición de agy le pasa la salida de errores a su lectura', () => {
    const t = AGENTES.agy?.parsear(fixture('agy-error-stdout.jsonl'), null, null, fixture('agy-error-stderr.txt'));
    assert.match(t?.error ?? '', /RESOURCE_EXHAUSTED 429/u);
  });

  test('el motivo corto: cuota, sesión vencida o la primera línea, sin desbordar', () => {
    assert.equal(motivoDeError('Rate limit exceeded, try later'), 'cuota agotada');
    assert.equal(motivoDeError('Error: 401 Unauthorized'), 'sesión vencida');
    assert.equal(motivoDeError('  algo se rompió\n    at main (x.js:1)'), 'algo se rompió');
    const largo = motivoDeError('x'.repeat(500));
    assert.ok(largo.length <= 160, String(largo.length));
    assert.match(largo, /…$/u);
  });
});

describe('qué se puede lanzar sin shell', () => {
  // El shim de npm, tal cual lo escribe npm en Windows.
  const SHIM = [
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\@github\\copilot\\npm-loader.js" %*',
  ].join('\r\n');
  const windows = (existentes: string[]) => ({
    ruta: 'C:\\npm;C:\\grok\\bin',
    plataforma: 'win32' as const,
    existe: (p: string) => existentes.includes(p),
    leer: () => SHIM,
    node: 'C:\\node\\node.exe',
  });

  test('un shim .cmd de npm se lanza como node con su script', () => {
    assert.deepEqual(resolverEjecutable('copilot', windows(['C:\\npm\\copilot', 'C:\\npm\\copilot.cmd'])), {
      comando: 'C:\\node\\node.exe',
      prefijo: [win32.join('C:\\npm', 'node_modules', '@github', 'copilot', 'npm-loader.js')],
    });
  });

  test('un .exe se lanza directo, y gana al .cmd del mismo directorio', () => {
    assert.deepEqual(resolverEjecutable('grok', windows(['C:\\grok\\bin\\grok.exe'])), {
      comando: 'C:\\grok\\bin\\grok.exe',
      prefijo: [],
    });
    assert.deepEqual(resolverEjecutable('x', windows(['C:\\npm\\x.cmd', 'C:\\npm\\x.exe'])), {
      comando: 'C:\\npm\\x.exe',
      prefijo: [],
    });
  });

  test('lo que no está, o un .cmd que no se entiende, no se resuelve', () => {
    assert.equal(resolverEjecutable('agy', windows([])), null);
    const raro = { ...windows(['C:\\npm\\raro.cmd']), leer: () => '@echo hola' };
    assert.equal(resolverEjecutable('raro', raro), null);
  });

  test('fuera de Windows, el primero del PATH', () => {
    const r = resolverEjecutable('grok', {
      ruta: '/usr/bin:/opt/grok',
      plataforma: 'linux',
      existe: (p) => p === posix.join('/opt/grok', 'grok'),
      leer: () => '',
      node: '/usr/bin/node',
    });
    assert.deepEqual(r, { comando: '/opt/grok/grok', prefijo: [] });
  });
});

describe('la lectura genérica de una llamada', () => {
  test('se clasifica por lo que trae, no por quién la hizo', () => {
    assert.equal(llamada('run_terminal_command', { command: 'ls' }).clase, 'shell');
    assert.equal(llamada('run_command', { CommandLine: 'dir' }).clase, 'shell');
    assert.equal(llamada('write_to_file', { TargetFile: 'a.md' }).ruta, 'a.md');
    assert.equal(llamada('search_replace', { file_path: 'b.md' }).clase, 'escritura');
    assert.equal(llamada('read_file', { target_file: 'c.md' }).clase, 'otra');
    assert.equal(llamada('skill', { skill: 'camus-writing' }).skill, 'camus-writing');
  });

  test('las cadenas de una entrada, a cualquier profundidad', () => {
    assert.deepEqual(cadenasDe({ a: 'x', b: [1, 'y', { c: 'z' }], d: null }), ['x', 'y', 'z']);
  });

  test('una ruta de skill se reconoce con cualquier separador y sin importar mayúsculas', () => {
    const t = {
      respuesta: null,
      llamadas: [llamada('cat', { path: '/home/p/.agents/Skills/fonda-writing/skill.md' })],
      skillsInvocadas: [],
      modelo: null,
      costo: null,
      duracionMs: null,
      sesion: null,
      version: null,
    };
    assert.deepEqual(skillsCargadas(t), ['fonda-writing']);
  });
});
