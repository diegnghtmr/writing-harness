// El ejecutor de la prueba final, con un agente falso.
//
// Lo que se prueba acá es lo que el sondeo enseñó a la fuerza: Antigravity
// recorrió la carpeta compartida, leyó lo que habían dejado los otros dos
// agentes y copió una salida byte a byte. Por eso cada corrida trabaja en una
// carpeta temporal propia, y los resultados se publican en la carpeta de la
// prueba recién cuando terminó la serie entera. El agente falso anota, cada vez
// que arranca, si ya había algo publicado; si lo hubo, el aislamiento se rompió.
//
// El agente falso no usa red ni ningún CLI: escribe una salida y devuelve una
// sesión armada a mano. Lo único real son los procesos del final, que prueban
// que el límite de tiempo mata el árbol y no espera.
//
// La primera corrida de humo enseñó otra cosa: un agente leyó el código del
// ejecutor y usó sus comprobaciones para revisar su propia salida. Por eso cada
// corrida trabaja en una copia sin ese código, y el agente falso anota también
// en qué carpeta lo lanzaron y qué archivos había en ella.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import { EXCLUIDOS, excluido, planDeLaCopia } from '../scripts/prueba-final/copia.ts';
import { correrSuite, type Agente, type Dependencias, type Plan } from '../scripts/prueba-final/ejecutor.ts';
import { fragmento } from '../scripts/prueba-final/fragmento.ts';
import { parrafosDelDocx } from '../scripts/prueba-final/docx.ts';
import { correrProceso } from '../scripts/prueba-final/proceso.ts';
import type { EstadoDelArnes } from '../scripts/prueba-final/traza.ts';
import { llamada, vacia, type Llamada } from '../scripts/prueba-final/transcripcion.ts';
import { variantes, type Variante } from '../scripts/prueba-final/variantes.ts';
import type { Contexto } from '../scripts/prueba-final/agentes.ts';
import { CUERPO, construirDocx } from './fixtures/prueba-final/docx.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-test-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const DOCX = construirDocx(CUERPO);
const TEXTO = fragmento(parrafosDelDocx(DOCX));
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Un arnés de mentira: lo que git rastrea, con el código de la prueba adentro. */
const RASTREADOS: Record<string, string> = {
  'AGENTS.md': '# arnés\n',
  'src/cli.ts': 'export {};\n',
  'skills/camus-writing/SKILL.md': '# camus\n',
  'scripts/prueba-final.ts': '// el comando\n',
  'scripts/prueba-final/anclas.ts': '// las anclas\n',
  'evals/prueba-final-ejecutor.test.ts': '// esta prueba\n',
  'evals/fixtures/prueba-final/grok-stdout.jsonl': '{}\n',
};

/** Lo que tiene que encontrar un agente en su carpeta de trabajo. */
const EN_LA_COPIA = [
  'AGENTS.md',
  'CLAUDE.md',
  'open-slide/README.md',
  'writing-harness/AGENTS.md',
  'writing-harness/skills/camus-writing/SKILL.md',
  'writing-harness/src/cli.ts',
];

/** Todos los archivos de una carpeta, relativos a ella y con barras normales. */
function archivosDe(dir: string): string[] {
  const out: string[] = [];
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) recorrer(p);
      else out.push(relative(dir, p).replace(/\\/gu, '/'));
    }
  };
  recorrer(dir);
  return out.sort();
}

let serie = 0;
/** Un mix con sus instrucciones, un arnés, la carpeta de prueba con su base.docx y un directorio temporal aparte. */
function escenario() {
  serie++;
  const cwd = join(raiz, `mix-${serie}`);
  const carpeta = join(cwd, 'test-final');
  const tmp = join(raiz, `tmp-${serie}`);
  const arnes = join(cwd, 'writing-harness');
  mkdirSync(carpeta, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(carpeta, 'base.docx'), DOCX);
  writeFileSync(join(cwd, 'AGENTS.md'), '# mix\n');
  writeFileSync(join(cwd, 'CLAUDE.md'), 'Ver AGENTS.md.\n');
  for (const [r, c] of Object.entries(RASTREADOS)) {
    mkdirSync(dirname(join(arnes, r)), { recursive: true });
    writeFileSync(join(arnes, r), c);
  }
  const copia = planDeLaCopia({ mix: cwd, arnes, rastreados: Object.keys(RASTREADOS) });
  return { cwd, carpeta, tmp, docx: join(carpeta, 'base.docx'), copia };
}

type Registro = {
  agente: string;
  variante: string;
  staging: string;
  publicado: boolean;
  activas: number;
  /** La carpeta de trabajo con que se lanzó el agente. */
  cwd: string;
  /** Los archivos que había en ella al lanzarlo. */
  archivos: string[];
  prompt: string;
  /** El proyecto de Engram que recibió la corrida. */
  engram: string;
};

type OpcionesDelFalso = {
  identica?: boolean;
  antes?: (ctx: Contexto) => void;
  contador?: { activas: number; maximo: number };
  /** Llamadas que el agente suma a su sesión, además de las del flujo. */
  extra?: (ctx: Contexto) => Llamada[];
  /** Las carpetas de su propio estado. */
  propias?: (ctx: Contexto) => string[];
  /** Cómo termina el proceso y qué error informa el agente, para simular una corrida que no terminó. */
  fallo?: { codigo: number | null; vencido?: boolean; error?: string; sinRespuesta?: boolean };
};

/**
 * Un agente que hace lo que piden las skills: carga las suyas, escribe la
 * salida, mide con las opciones de la variante y responde sin repetir el texto.
 */
function agenteFalso(id: string, carpeta: string, registro: Registro[], opciones: OpcionesDelFalso = {}): Agente {
  const porStaging = new Map<string, Variante>();
  const propias = opciones.propias;
  return {
    id,
    ...(propias ? { estadoPropio: (ctx: Contexto) => propias(ctx) } : {}),
    async lanzar(ctx) {
      // La variante sale del prompt, que es lo único que recibe un agente de verdad.
      const variante =
        variantes().find((v) => v.clase === 'tono' && ctx.prompt.includes(`\`${v.skill}\``)) ??
        variantes().find(
          (v) =>
            (v.clase === 'base' && ctx.prompt.startsWith('Corrige')) ||
            (v.clase === 'pasada' && ctx.prompt.startsWith('Humaniza')),
        );
      porStaging.set(ctx.staging, variante as Variante);
      const c = opciones.contador;
      if (c) c.maximo = Math.max(c.maximo, ++c.activas);
      registro.push({
        agente: id,
        variante: (variante as Variante).id,
        staging: ctx.staging,
        publicado: existsSync(join(carpeta, id)),
        activas: c?.activas ?? 0,
        cwd: ctx.cwd,
        archivos: existsSync(ctx.cwd) ? archivosDe(ctx.cwd) : [],
        prompt: ctx.prompt,
        engram: ctx.engram,
      });
      opciones.antes?.(ctx);
      await new Promise((r) => setTimeout(r, 15));
      const entrada = readFileSync(join(ctx.staging, 'entrada.md'), 'utf8');
      const marca = opciones.identica ? '' : `\n\nVersión de ${id} para ${(variante as Variante).id}.\n`;
      writeFileSync(join(ctx.staging, 'salida.md'), entrada + marca);
      writeFileSync(join(ctx.staging, 'transcripcion.jsonl'), '{"falso":true}\n');
      if (c) c.activas--;
      const f = opciones.fallo;
      return { stdout: '{"tipo":"falso"}\n', stderr: '', codigo: f ? f.codigo : 0, vencido: f?.vencido ?? false, duracionMs: 15 };
    },
    recoger(ctx) {
      const v = porStaging.get(ctx.staging) as Variante;
      const salida = join(ctx.staging, 'salida.md');
      const skills = ['redactar-espanol', 'spanish-writing', ...(v.skill ? [v.skill] : [])];
      const linea =
        v.clase === 'base'
          ? 'No se aplicó ningún tono, porque el pedido es corregir.'
          : v.clase === 'tono'
            ? `Tono \`${v.skill}\`, porque se pidió.`
            : `Pasada \`${v.skill}\`; no se aplicó ningún tono, porque la forma es del autor.`;
      return {
        ...vacia(),
        respuesta: opciones.fallo?.sinRespuesta ? '' : `Quedó en \`${salida}\`. ${linea}`,
        error: opciones.fallo?.error ?? null,
        llamadas: [
          ...skills.map((s) => llamada('skill', { skill: s })),
          llamada('powershell', { command: `node writing-harness/src/cli.ts ${salida} ${v.banderas.join(' ')}` }, 0),
          ...(opciones.extra?.(ctx) ?? []),
        ],
      };
    },
  };
}

const depsFalsas = (tmp: string, extra: Partial<Dependencias> = {}): Dependencias => {
  let n = 0;
  return {
    tmp,
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    estadoGit: () => '',
    verificar: () => ({ codigo: 0, salida: 'salida.md: sin hallazgos' }),
    ahora: () => new Date('2026-10-06T00:00:00.000Z'),
    avisar: () => {},
    cambiosDesde: () => [],
    ...extra,
  };
};

/** El estado del arnés que anota una serie: un commit inventado, sin cambios sin commit. */
const arnesEn = (commit: string): EstadoDelArnes => ({ commit: commit.repeat(40).slice(0, 40), sucio: false, sucios: {} });

const plan = (
  e: ReturnType<typeof escenario>,
  agentes: Agente[],
  vs: Variante[],
  paralelo = 1,
  omitidos: string[] = [],
  extra: Partial<Plan> = {},
): Plan => ({
  carpeta: e.carpeta,
  docx: e.docx,
  mix: e.cwd,
  copia: e.copia,
  raicesGit: [e.cwd],
  texto: TEXTO,
  agentes,
  omitidos,
  variantes: vs,
  paralelo,
  limiteMin: 1,
  agregar: false,
  traza: { arnes: arnesEn('a'), instaladas: {} },
  ...extra,
});

const algunas = () => variantes().filter((v) => ['base', 'camus', 'humanizar'].includes(v.id));

describe('una serie con un agente falso', () => {
  const e = escenario();
  const registro: Registro[] = [];
  let r: Awaited<ReturnType<typeof correrSuite>>;
  before(async () => {
    r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, registro)], algunas()), depsFalsas(e.tmp));
  });

  test('todas las corridas pasan y la serie sale con 0', () => {
    assert.equal(r.codigo, 0, JSON.stringify(r.suite.veredictos.flatMap((v) => v.comprobaciones.filter((c) => c.estado !== 'pasa'))));
    assert.deepEqual(r.suite.veredictos.map((v) => [v.variante, v.estado]), [
      ['base', 'pasa'],
      ['camus', 'pasa'],
      ['humanizar', 'pasa'],
    ]);
  });

  test('nada se publicó mientras corrían: cada arranque vio la carpeta vacía', () => {
    assert.equal(registro.length, 3);
    assert.deepEqual(registro.map((x) => x.publicado), [false, false, false]);
  });

  test('cada corrida tuvo su carpeta temporal, fuera de la de la prueba, y se borró al publicar', () => {
    const stagings = registro.map((x) => x.staging);
    assert.equal(new Set(stagings).size, 3);
    for (const s of stagings) {
      assert.ok(s.startsWith(e.tmp), s);
      assert.ok(!s.startsWith(e.carpeta), s);
      assert.match(s, /pf-[0-9a-f-]{36}$/u);
      assert.ok(!existsSync(s), `${s} quedó sin borrar`);
    }
  });

  test('cada carpeta publicada tiene todo lo de la corrida y su veredicto', () => {
    const publicados = readdirSync(join(e.carpeta, 'falso', 'camus')).sort();
    assert.deepEqual(publicados, [
      'entrada.md',
      'prompt.txt',
      'respuesta.txt',
      'salida.md',
      'stderr.txt',
      'stdout.txt',
      'transcripcion.jsonl',
      'veredicto.json',
      'verificador.txt',
    ]);
    const v = JSON.parse(readFileSync(join(e.carpeta, 'falso', 'camus', 'veredicto.json'), 'utf8'));
    assert.equal(v.comprobaciones.length, 11);
    assert.equal(v.metadatos.vencido, false);
    assert.match(readFileSync(join(e.carpeta, 'falso', 'camus', 'prompt.txt'), 'utf8'), /^Reescribe el texto de `/u);
  });

  test('el resumen queda en la carpeta, en Markdown y en JSON, y base.docx no se tocó', () => {
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /^\| camus \| pasa \|$/mu);
    assert.equal(JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8')).codigo, 0);
    assert.equal(sha(readFileSync(e.docx)), sha(DOCX));
  });

  test('cada agente trabaja en una copia propia, dentro de la carpeta de su corrida', () => {
    for (const x of registro) assert.equal(x.cwd, join(x.staging, 'mix'));
    assert.equal(new Set(registro.map((x) => x.cwd)).size, 3);
  });

  test('la copia tiene las instrucciones de mix y lo rastreado del arnés, sin el código de la prueba', () => {
    for (const x of registro) {
      assert.deepEqual(x.archivos, EN_LA_COPIA);
      for (const a of x.archivos) assert.doesNotMatch(a, /prueba-final|\.git\//u, a);
    }
  });

  test('entrada.md y salida.md quedan en la carpeta de la corrida, fuera de la copia', () => {
    for (const x of registro) {
      assert.ok(x.prompt.includes(join(x.staging, 'entrada.md')), x.prompt);
      assert.ok(x.prompt.includes(join(x.staging, 'salida.md')), x.prompt);
      assert.ok(!x.archivos.includes('entrada.md'));
    }
  });

  test('el veredicto registra cuántos archivos tiene la copia y su huella, la misma en cada corrida', () => {
    const copias = ['base', 'camus', 'humanizar'].map(
      (v) => JSON.parse(readFileSync(join(e.carpeta, 'falso', v, 'veredicto.json'), 'utf8')).metadatos.copia,
    );
    for (const c of copias) {
      assert.equal(c.archivos, EN_LA_COPIA.length);
      assert.match(c.huella, /^[0-9a-f]{64}$/u);
    }
    assert.equal(new Set(copias.map((c) => c.huella)).size, 1);
  });

  test('lo publicado no lleva la copia', () => {
    for (const v of ['base', 'camus', 'humanizar']) assert.ok(!existsSync(join(e.carpeta, 'falso', v, 'mix')), v);
  });
});

describe('lo que el ejecutor tiene que cazar', () => {
  test('dos salidas idénticas fallan en el aislamiento, y la serie sale con 1', async () => {
    const e = escenario();
    const vs = variantes().filter((v) => ['camus', 'fonda'].includes(v.id));
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [], { identica: true })], vs), depsFalsas(e.tmp));
    assert.equal(r.codigo, 1);
    for (const v of r.suite.veredictos) {
      const c10 = v.comprobaciones.find((c) => c.numero === 10);
      assert.equal(c10?.estado, 'falla');
      assert.match(c10?.motivo ?? '', /idéntica/u);
    }
  });

  test('un base.docx tocado durante una corrida falla en esa corrida', async () => {
    const e = escenario();
    const tocar = () => writeFileSync(e.docx, 'otra cosa');
    const r = await correrSuite(
      plan(e, [agenteFalso('falso', e.carpeta, [], { antes: tocar })], algunas().slice(0, 1)),
      depsFalsas(e.tmp),
    );
    assert.equal(r.suite.veredictos[0]?.comprobaciones[0]?.estado, 'falla');
    assert.notEqual(r.suite.docx.antes, r.suite.docx.despues);
  });

  test('un cambio en git durante la corrida falla en los repositorios', async () => {
    const e = escenario();
    let llamadas = 0;
    const estadoGit = () => (++llamadas > 1 ? '?? basura.md\n' : '');
    const r = await correrSuite(
      plan(e, [agenteFalso('falso', e.carpeta, [])], algunas().slice(0, 1)),
      depsFalsas(e.tmp, { estadoGit }),
    );
    const c9 = r.suite.veredictos[0]?.comprobaciones.find((c) => c.numero === 9);
    assert.equal(c9?.estado, 'falla');
    assert.match(c9?.motivo ?? '', /basura\.md/u);
  });

  const comprobacion = (r: Awaited<ReturnType<typeof correrSuite>>, numero: number) =>
    r.suite.veredictos[0]?.comprobaciones.find((c) => c.numero === numero);

  test('un archivo de la copia cambiado o borrado falla en los repositorios, con su ruta', async () => {
    const e = escenario();
    const tocar = (ctx: Contexto) => {
      writeFileSync(join(ctx.cwd, 'writing-harness', 'src', 'cli.ts'), 'otra cosa\n');
      rmSync(join(ctx.cwd, 'CLAUDE.md'));
    };
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [], { antes: tocar })], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const c9 = comprobacion(r, 9);
    assert.equal(c9?.estado, 'falla');
    assert.match(c9?.motivo ?? '', /writing-harness\/src\/cli\.ts/u);
    assert.match(c9?.motivo ?? '', /CLAUDE\.md/u);
  });

  test('un archivo nuevo en la copia avisa, con su ruta', async () => {
    const e = escenario();
    const crear = (ctx: Contexto) => writeFileSync(join(ctx.cwd, 'borrador.md'), 'nuevo\n');
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [], { antes: crear })], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const c9 = comprobacion(r, 9);
    assert.equal(c9?.estado, 'aviso');
    assert.match(c9?.motivo ?? '', /borrador\.md/u);
  });

  test('lo que el agente escribe en su propio estado no cuenta como escribir fuera', async () => {
    const e = escenario();
    const propia = join(raiz, `home-${serie}`, '.gemini', 'antigravity-cli', 'brain', 'conv-1');
    const borrador = join(propia, 'scratch', 'borrador.md');
    const agente = agenteFalso('falso', e.carpeta, [], {
      propias: () => [propia],
      extra: () => [llamada('write_to_file', { TargetFile: borrador }), llamada('write_to_file', { TargetFile: borrador })],
    });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    assert.equal(comprobacion(r, 9)?.estado, 'pasa', comprobacion(r, 9)?.motivo);
  });

  test('leer o importar el código de la prueba falla en el aislamiento, con la ruta', async () => {
    const e = escenario();
    const agente = agenteFalso('falso', e.carpeta, [], {
      extra: () => [
        llamada('read_file', { target_file: join(REPO_ROOT, 'scripts', 'prueba-final', 'anclas.ts') }),
        llamada('run_terminal_command', { command: "node -e \"import('./writing-harness/scripts/prueba-final/anclas.ts')\"" }),
      ],
    });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const c10 = comprobacion(r, 10);
    assert.equal(c10?.estado, 'falla');
    assert.match(c10?.motivo ?? '', /scripts\/prueba-final\/anclas\.ts/u);
    assert.equal(r.codigo, 1);
  });

  test('una búsqueda sobre un repositorio real del plan avisa en el aislamiento, con la ruta', async () => {
    const e = escenario();
    const agente = agenteFalso('falso', e.carpeta, [], {
      extra: () => [llamada('grep', { pattern: 'conserv', path: e.cwd })],
    });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const c10 = comprobacion(r, 10);
    assert.equal(c10?.estado, 'aviso', c10?.motivo);
    assert.ok(c10?.motivo.includes(e.cwd.replace(/\\/gu, '/')), c10?.motivo);
  });

  test('el verificador del ejecutor mide la salida con las opciones de la variante, y la respuesta con la base', async () => {
    const e = escenario();
    const medidos: [string, readonly string[]][] = [];
    const registro: Registro[] = [];
    const verificar = (archivo: string, banderas: readonly string[]) => {
      medidos.push([archivo, banderas]);
      return { codigo: 0, salida: 'sin hallazgos' };
    };
    const camus = variantes().filter((x) => x.id === 'camus');
    await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, registro)], camus), depsFalsas(e.tmp, { verificar }));
    const staging = registro[0]?.staging ?? '';
    assert.deepEqual(medidos, [
      [join(staging, 'salida.md'), camus[0]?.banderas],
      [join(staging, 'respuesta.txt'), []],
    ]);
  });

  test('un error de la base en la respuesta avisa en la respuesta, con la regla', async () => {
    const e = escenario();
    const verificar = (archivo: string) =>
      archivo.endsWith('respuesta.txt')
        ? { codigo: 1, salida: 'respuesta.txt:1:1  error  tuteo  [spanish-writing §9.2]\n\n1 error(es), 0 advertencia(s)' }
        : { codigo: 0, salida: 'sin hallazgos' };
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [])], algunas().slice(0, 1)), depsFalsas(e.tmp, { verificar }));
    const c6 = comprobacion(r, 6);
    assert.equal(c6?.estado, 'aviso');
    assert.match(c6?.motivo ?? '', /tuteo/u);
  });

  test('volver a correr mueve lo anterior a historial/ en vez de mezclarlo o borrarlo', async () => {
    const e = escenario();
    const vs = algunas().slice(0, 1);
    await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [])], vs), depsFalsas(e.tmp));
    writeFileSync(join(e.carpeta, 'falso', 'base', 'marca.txt'), 'de la primera serie');
    await correrSuite(
      plan(e, [agenteFalso('falso', e.carpeta, [])], vs),
      depsFalsas(e.tmp, { ahora: () => new Date('2026-10-07T00:00:00.000Z') }),
    );
    assert.ok(!existsSync(join(e.carpeta, 'falso', 'base', 'marca.txt')), 'la serie nueva se mezcló con la vieja');
    const historial = readdirSync(join(e.carpeta, 'historial'));
    assert.equal(historial.length, 1);
    const viejo = join(e.carpeta, 'historial', historial[0] as string);
    assert.ok(existsSync(join(viejo, 'falso', 'base', 'marca.txt')));
    assert.ok(existsSync(join(viejo, 'resumen.md')));
  });
});

describe('los errores del propio agente', () => {
  // En la segunda corrida de humo, agy agotó su cuota al dar la respuesta final.
  // La salida estaba escrita y medida; la respuesta, vacía. Contarlo como una
  // falla de las skills decía algo falso sobre las skills.
  const CUOTA = 'cuota agotada (RESOURCE_EXHAUSTED 429), vuelve en 156h37m';
  const estados = (v: { comprobaciones: { numero: number; estado: string }[] } | undefined) =>
    Object.fromEntries((v?.comprobaciones ?? []).map((c) => [c.numero, c.estado]));

  test('una cuota agotada es un error del agente, con su motivo, y no una falla', async () => {
    const e = escenario();
    const avisos: string[] = [];
    const agente = agenteFalso('agy', e.carpeta, [], { fallo: { codigo: 3, error: CUOTA, sinRespuesta: true } });
    const r = await correrSuite(plan(e, [agente], algunas().slice(1, 2)), depsFalsas(e.tmp, { avisar: (l) => avisos.push(l) }));
    const v = r.suite.veredictos[0];
    assert.equal(v?.estado, 'error');
    assert.equal(v?.error, CUOTA);
    assert.deepEqual(estados(v), {
      1: 'pasa',
      2: 'sin evaluar',
      3: 'sin evaluar',
      4: 'sin evaluar',
      5: 'sin evaluar',
      6: 'sin evaluar',
      7: 'sin evaluar',
      8: 'sin evaluar',
      9: 'pasa',
      10: 'pasa',
      11: 'sin evaluar',
    });
    assert.equal(r.codigo, 1, 'una corrida que no terminó no es una serie limpia');
    const md = readFileSync(join(e.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /## Errores del agente\n\n- agy, camus: cuota agotada \(RESOURCE_EXHAUSTED 429\)/u);
    assert.match(md, /## Fallas\n\nNinguna\./u);
    assert.ok(avisos.includes(`agy/camus: error: ${CUOTA}`), avisos.join('\n'));
    const publicado = JSON.parse(readFileSync(join(e.carpeta, 'agy', 'camus', 'veredicto.json'), 'utf8'));
    assert.equal(publicado.estado, 'error');
    assert.equal(publicado.error, CUOTA);
  });

  test('el límite de tiempo del ejecutor es un error del agente: tiempo agotado', async () => {
    const e = escenario();
    const agente = agenteFalso('falso', e.carpeta, [], { fallo: { codigo: null, vencido: true, sinRespuesta: true } });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    assert.equal(r.suite.veredictos[0]?.estado, 'error');
    assert.equal(r.suite.veredictos[0]?.error, 'tiempo agotado');
  });

  test('un proceso que sale con código distinto de cero sin responder es un error del agente', async () => {
    const e = escenario();
    const agente = agenteFalso('falso', e.carpeta, [], { fallo: { codigo: 2, sinRespuesta: true } });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    assert.equal(r.suite.veredictos[0]?.error, 'el proceso terminó con código 2');
  });

  test('una falla en lo que sí se evalúa sigue a la vista en una corrida con error', async () => {
    const e = escenario();
    const tocar = (ctx: Contexto) => rmSync(join(ctx.cwd, 'CLAUDE.md'));
    const agente = agenteFalso('falso', e.carpeta, [], { antes: tocar, fallo: { codigo: 3, error: CUOTA, sinRespuesta: true } });
    const r = await correrSuite(plan(e, [agente], algunas().slice(0, 1)), depsFalsas(e.tmp));
    assert.equal(r.suite.veredictos[0]?.estado, 'error');
    assert.equal(estados(r.suite.veredictos[0])[9], 'falla');
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /## Fallas\n\n- falso, base, 9/u);
  });
});

describe('las fallas del propio ejecutor', () => {
  // La revisión de la rama: fuera de lanzar y recoger, cualquier excepción de
  // una corrida rechazaba la serie entera, y como se publica al final, no se
  // publicaba nada. Un base.docx borrado durante una corrida bastaba.
  const estados = (r: Awaited<ReturnType<typeof correrSuite>>) => r.suite.veredictos.map((v) => [v.variante, v.estado]);

  test('base.docx borrado durante una corrida falla en la 1, con su motivo, y la serie publica', async () => {
    const e = escenario();
    const borrar = () => rmSync(e.docx, { force: true });
    const vs = algunas().slice(0, 2);
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [], { antes: borrar })], vs), depsFalsas(e.tmp));
    assert.deepEqual(estados(r), [
      ['base', 'falla'],
      ['camus', 'falla'],
    ]);
    const [primera, segunda] = r.suite.veredictos.map((v) => v.comprobaciones[0]);
    assert.equal(primera?.estado, 'falla');
    assert.match(primera?.motivo ?? '', /no se pudo leer base\.docx después de la corrida \(ENOENT\)/u);
    assert.match(segunda?.motivo ?? '', /no se pudo leer base\.docx antes de la corrida \(ENOENT\)/u);
    assert.equal(r.codigo, 1);
    assert.match(r.suite.docx.despues, /no se pudo leer/u);
    assert.ok(existsSync(join(e.carpeta, 'resumen.md')));
    assert.ok(existsSync(join(e.carpeta, 'falso', 'camus', 'veredicto.json')));
  });

  test('una excepción del ejecutor en una corrida la deja con su motivo, y las demás siguen y se publican', async () => {
    const e = escenario();
    const propias = (ctx: Contexto) => {
      if (ctx.prompt.includes('`camus-writing`')) throw new Error('estado ilegible');
      return [];
    };
    const avisos: string[] = [];
    const r = await correrSuite(
      plan(e, [agenteFalso('falso', e.carpeta, [], { propias })], algunas()),
      depsFalsas(e.tmp, { avisar: (l) => avisos.push(l) }),
    );
    assert.deepEqual(estados(r), [
      ['base', 'pasa'],
      ['camus', 'error'],
      ['humanizar', 'pasa'],
    ]);
    const camus = r.suite.veredictos[1];
    assert.equal(camus?.error, 'falla del ejecutor: estado ilegible');
    assert.equal(camus?.comprobaciones[0]?.estado, 'pasa', 'la huella de base.docx se comprueba igual');
    for (const c of camus?.comprobaciones.slice(1) ?? []) {
      assert.equal(c.estado, 'sin evaluar', String(c.numero));
      assert.match(c.motivo, /falla del ejecutor: estado ilegible/u);
    }
    assert.equal(camus?.comprobaciones.length, 11);
    assert.equal(r.codigo, 1);
    assert.ok(avisos.includes('falso/camus: error: falla del ejecutor: estado ilegible'), avisos.join('\n'));
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /- falso, camus: falla del ejecutor: estado ilegible/u);
    const publicado = JSON.parse(readFileSync(join(e.carpeta, 'falso', 'camus', 'veredicto.json'), 'utf8'));
    assert.equal(publicado.estado, 'error');
    assert.ok(existsSync(join(e.carpeta, 'falso', 'camus', 'salida.md')), 'lo que dejó la corrida se publica igual');
    assert.ok(existsSync(join(e.carpeta, 'falso', 'humanizar', 'veredicto.json')));
  });

  test('si no se puede armar la carpeta de una corrida, esa corrida es un error y las demás siguen', async () => {
    const e = escenario();
    const deps = depsFalsas(e.tmp);
    const uuid = deps.uuid;
    let n = 0;
    // Un byte nulo en la ruta hace fallar la creación de la carpeta.
    deps.uuid = () => (++n === 2 ? 'roto\0' : uuid());
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [])], algunas()), deps);
    assert.deepEqual(estados(r), [
      ['base', 'pasa'],
      ['camus', 'error'],
      ['humanizar', 'pasa'],
    ]);
    assert.match(r.suite.veredictos[1]?.error ?? '', /^falla del ejecutor: /u);
    assert.ok(existsSync(join(e.carpeta, 'falso', 'camus', 'veredicto.json')));
    assert.ok(existsSync(join(e.carpeta, 'resumen.json')));
  });
});

describe('la memoria de cada corrida', () => {
  test('cada corrida tiene su propio proyecto de Engram, y el veredicto lo anota', async () => {
    // En la corrida completa, Grok leyó en el proyecto compartido lo que había
    // guardado otra corrida: dejaron de ser independientes.
    const e = escenario();
    const registro: Registro[] = [];
    const r = await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, registro)], algunas()), depsFalsas(e.tmp));
    const proyectos = registro.map((x) => x.engram);
    assert.equal(new Set(proyectos).size, 3);
    for (const x of registro) assert.equal(x.engram, `prueba-final-20261006-000000-falso-${x.variante}`);
    for (const v of r.suite.veredictos) {
      const publicado = JSON.parse(readFileSync(join(e.carpeta, 'falso', v.variante, 'veredicto.json'), 'utf8'));
      assert.equal(publicado.metadatos.engram, `prueba-final-20261006-000000-falso-${v.variante}`);
    }
  });
});

describe('qué queda en la carpeta de la prueba', () => {
  const un = (v: string) => variantes().filter((x) => x.id === v);
  const fecha = (dia: number) => () => new Date(`2026-10-0${dia}T00:00:00.000Z`);
  const carpetas = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

  test('por defecto, una sola serie: todo lo anterior pasa al historial, también lo de agentes que no corrieron', async () => {
    // En la corrida completa, un agy/fonda de una serie anterior quedó en la
    // raíz, y el resumen del historial contaba una corrida que no estaba ahí.
    const e = escenario();
    await correrSuite(plan(e, [agenteFalso('uno', e.carpeta, []), agenteFalso('dos', e.carpeta, [])], un('base')), depsFalsas(e.tmp, { ahora: fecha(6) }));
    await correrSuite(plan(e, [agenteFalso('uno', e.carpeta, [])], un('camus')), depsFalsas(e.tmp, { ahora: fecha(7) }));
    assert.deepEqual(carpetas(e.carpeta), ['historial', 'uno']);
    assert.deepEqual(readdirSync(join(e.carpeta, 'uno')), ['camus']);
    const viejo = join(e.carpeta, 'historial', '2026-10-06T00-00-00-000Z');
    assert.deepEqual(carpetas(viejo), ['dos', 'uno']);
    const previo = JSON.parse(readFileSync(join(viejo, 'resumen.json'), 'utf8'));
    assert.equal(previo.veredictos.length, 2);
    for (const v of previo.veredictos) assert.ok(existsSync(join(viejo, v.agente, v.variante, 'veredicto.json')), `${v.agente}/${v.variante}`);
  });

  test('con --agregar, quedan los agentes que no corrieron y se reemplazan solo los pares que corrieron', async () => {
    const e = escenario();
    await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, []), agenteFalso('dos', e.carpeta, [])], un('base')),
      depsFalsas(e.tmp, { ahora: fecha(6) }),
    );
    writeFileSync(join(e.carpeta, 'uno', 'base', 'marca.txt'), 'de la primera serie');
    const r = await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, []), agenteFalso('tres', e.carpeta, [])], un('base'), 1, [], { agregar: true }),
      depsFalsas(e.tmp, { ahora: fecha(8) }),
    );
    assert.deepEqual(carpetas(e.carpeta), ['dos', 'historial', 'tres', 'uno']);
    assert.ok(!existsSync(join(e.carpeta, 'uno', 'base', 'marca.txt')), 'el par que corrió se reemplazó');
    assert.ok(existsSync(join(e.carpeta, 'historial', '2026-10-06T00-00-00-000Z', 'uno', 'base', 'marca.txt')), 'y el viejo pasó al historial');
    const resumen = JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8'));
    assert.deepEqual(resumen.veredictos.map((v: { agente: string }) => v.agente).sort(), ['dos', 'tres', 'uno']);
    assert.deepEqual(resumen.series, { uno: '2026-10-08T00:00:00.000Z', dos: '2026-10-06T00:00:00.000Z', tres: '2026-10-08T00:00:00.000Z' });
    assert.equal(r.suite.veredictos.length, 3, 'el resumen junta todo lo que hay en la raíz');
    const md = readFileSync(join(e.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /\| dos \(serie 2026-10-06 00:00\) \|/u);
  });
});

describe('con qué se probó cada corrida', () => {
  test('el veredicto anota el commit del arnés, las instrucciones de mix, base.docx y las skills instaladas', async () => {
    const e = escenario();
    const instaladas = { directorio: join('home', '.grok', 'skills'), huella: 'c'.repeat(64) };
    const sucio: EstadoDelArnes = { commit: 'b'.repeat(40), sucio: true, sucios: { 'src/check.ts': 'd'.repeat(64) } };
    await correrSuite(
      plan(e, [agenteFalso('falso', e.carpeta, [])], algunas().slice(0, 1), 1, [], { traza: { arnes: sucio, instaladas: { falso: instaladas } } }),
      depsFalsas(e.tmp),
    );
    const t = JSON.parse(readFileSync(join(e.carpeta, 'falso', 'base', 'veredicto.json'), 'utf8')).metadatos.traza;
    assert.deepEqual(t, {
      arnes: sucio,
      mix: { 'AGENTS.md': sha(Buffer.from('# mix\n')), 'CLAUDE.md': sha(Buffer.from('Ver AGENTS.md.\n')) },
      docx: sha(DOCX),
      instaladas,
    });
  });

  test('resumen.json anota la traza de la serie', async () => {
    const e = escenario();
    await correrSuite(plan(e, [agenteFalso('falso', e.carpeta, [])], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const resumen = JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8'));
    assert.equal(resumen.traza.arnes.commit, 'a'.repeat(40));
    assert.equal(resumen.traza.docx, sha(DOCX));
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /^- Arnés: commit aaaaaaa\.$/mu);
  });
});

describe('volver a correr solo algunos pares', () => {
  const un = (v: string) => variantes().filter((x) => x.id === v);

  test('corren solo los pares pedidos, el viejo pasa al historial y el resto queda', async () => {
    const e = escenario();
    const vs = variantes().filter((v) => ['base', 'camus'].includes(v.id));
    await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, []), agenteFalso('dos', e.carpeta, [])], vs),
      depsFalsas(e.tmp, { ahora: () => new Date('2026-10-06T00:00:00.000Z') }),
    );
    writeFileSync(join(e.carpeta, 'uno', 'base', 'marca.txt'), 'de la primera serie');
    writeFileSync(join(e.carpeta, 'dos', 'camus', 'marca.txt'), 'de la primera serie');
    const registro: Registro[] = [];
    const r = await correrSuite(
      plan(e, [agenteFalso('dos', e.carpeta, registro)], un('camus'), 1, [], { agregar: true, pares: new Set(['dos/camus']) }),
      depsFalsas(e.tmp, { ahora: () => new Date('2026-10-08T00:00:00.000Z') }),
    );
    assert.deepEqual(registro.map((x) => `${x.agente}/${x.variante}`), ['dos/camus']);
    assert.ok(existsSync(join(e.carpeta, 'uno', 'base', 'marca.txt')), 'lo que no corrió quedó donde estaba');
    assert.ok(!existsSync(join(e.carpeta, 'dos', 'camus', 'marca.txt')), 'el par que corrió se reemplazó');
    assert.ok(existsSync(join(e.carpeta, 'historial', '2026-10-06T00-00-00-000Z', 'dos', 'camus', 'marca.txt')));
    assert.equal(r.suite.veredictos.length, 4, 'el resumen junta los cuatro pares');
  });

  test('con varios agentes y variantes, solo el cruce pedido', async () => {
    const e = escenario();
    const registro: Registro[] = [];
    const vs = variantes().filter((v) => ['base', 'camus'].includes(v.id));
    await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, registro), agenteFalso('dos', e.carpeta, registro)], vs, 1, [], {
        agregar: true,
        pares: new Set(['uno/camus', 'dos/base']),
      }),
      depsFalsas(e.tmp),
    );
    assert.deepEqual(registro.map((x) => `${x.agente}/${x.variante}`).sort(), ['dos/base', 'uno/camus']);
  });
});

describe('las celdas que un cambio posterior dejó desactualizadas', () => {
  test('una corrida vieja que un cambio alcanza queda marcada; la recién corrida, no', async () => {
    const e = escenario();
    const vs = variantes().filter((v) => ['base', 'camus'].includes(v.id));
    // Después de la primera serie, en el commit a, cambió el tono camus. La
    // segunda serie, en el commit b, vuelve a correr solo base.
    const cambiosDesde = (a: EstadoDelArnes) => (a.commit === 'a'.repeat(40) ? ['skills/camus-writing/SKILL.md'] : []);
    await correrSuite(plan(e, [agenteFalso('uno', e.carpeta, [])], vs), depsFalsas(e.tmp, { cambiosDesde }));
    const r = await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, [])], vs.slice(0, 1), 1, [], { agregar: true, traza: { arnes: arnesEn('b'), instaladas: {} } }),
      depsFalsas(e.tmp, { cambiosDesde, ahora: () => new Date('2026-10-08T00:00:00.000Z') }),
    );
    const md = readFileSync(join(e.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /^\| base \| pasa \|$/mu);
    assert.match(md, /^\| camus \| pasa \[desactualizada\] \|$/mu);
    assert.match(md, /^- uno, camus: desactualizada: .*skills\/camus-writing\/SKILL\.md/mu);
    assert.equal(r.suite.vigencia?.['uno/camus']?.estado, 'desactualizada');
    assert.equal(JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8')).vigencia['uno/base'].estado, 'vigente');
  });

  test('un veredicto de un ejecutor anterior, sin traza, no se da por vigente', async () => {
    const e = escenario();
    await correrSuite(plan(e, [agenteFalso('uno', e.carpeta, [])], algunas().slice(0, 1)), depsFalsas(e.tmp));
    const viejo = join(e.carpeta, 'otro', 'base');
    mkdirSync(viejo, { recursive: true });
    const v = JSON.parse(readFileSync(join(e.carpeta, 'uno', 'base', 'veredicto.json'), 'utf8'));
    delete v.metadatos.traza;
    writeFileSync(join(viejo, 'veredicto.json'), JSON.stringify({ ...v, agente: 'otro' }));
    await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, [])], algunas().slice(0, 1), 1, [], { agregar: true }),
      depsFalsas(e.tmp, { ahora: () => new Date('2026-10-08T00:00:00.000Z') }),
    );
    const md = readFileSync(join(e.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /^\| base \| pasa \| pasa \[sin traza\] \|$/mu);
    assert.match(md, /^- Arnés: sin traza/mu);
  });
});

describe('correr solo algunos agentes', () => {
  test('el resumen dice qué agentes quedaron fuera', async () => {
    const e = escenario();
    const r = await correrSuite(plan(e, [agenteFalso('copilot', e.carpeta, [])], algunas().slice(0, 1), 1, ['grok', 'agy']), depsFalsas(e.tmp));
    assert.deepEqual(r.suite.omitidos, ['grok', 'agy']);
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /^- Agentes: copilot\. Quedaron fuera: grok, agy\.$/mu);
    assert.deepEqual(JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8')).omitidos, ['grok', 'agy']);
  });
});

describe('el paralelismo', () => {
  test('agentes distintos corren a la vez; dentro de uno, hasta --paralelo', async () => {
    const e = escenario();
    const vs = algunas();
    const contador = { activas: 0, maximo: 0 };
    await correrSuite(
      plan(e, [agenteFalso('uno', e.carpeta, [], { contador }), agenteFalso('dos', e.carpeta, [], { contador })], vs, 1),
      depsFalsas(e.tmp),
    );
    assert.equal(contador.maximo, 2, 'con --paralelo 1, uno por agente y los dos agentes a la vez');

    const e2 = escenario();
    const solo = { activas: 0, maximo: 0 };
    await correrSuite(plan(e2, [agenteFalso('uno', e2.carpeta, [], { contador: solo })], vs, 3), depsFalsas(e2.tmp));
    assert.equal(solo.maximo, 3);
  });
});

describe('el proceso de una corrida', () => {
  test('captura la salida y el código', async () => {
    const r = await correrProceso(process.execPath, ['-e', 'process.stdout.write("hola ñandú"); process.exit(3)'], {
      cwd: raiz,
      env: process.env,
      limiteMs: 20_000,
    });
    assert.equal(r.stdout, 'hola ñandú');
    assert.equal(r.codigo, 3);
    assert.equal(r.vencido, false);
  });

  test('al vencer el límite mata el árbol y lo dice, sin esperar al proceso', async () => {
    // El hijo lanza un nieto que vive más que él. Si solo se matara al hijo, el
    // nieto seguiría escribiendo en la tubería y la corrida no terminaría.
    const nieto = 'setTimeout(() => {}, 60000)';
    const hijo = `require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(nieto)}], { stdio: "inherit" }); setTimeout(() => {}, 60000)`;
    const inicio = Date.now();
    const r = await correrProceso(process.execPath, ['-e', hijo], { cwd: raiz, env: process.env, limiteMs: 500 });
    assert.equal(r.vencido, true);
    assert.ok(Date.now() - inicio < 15_000, 'esperó al proceso en vez de matarlo');
  });

  test('si un descendiente suelto retiene la salida, la corrida cierra igual al vencer el plazo de gracia', { timeout: 20_000 }, async () => {
    // La revisión de la rama: tras matar el árbol, la corrida esperaba el cierre
    // de las tuberías. Un nieto desprendido, que no cuelga del árbol del hijo
    // porque el hijo ya salió, las hereda y las retiene: sin un plazo duro la
    // serie no terminaba nunca. El hijo escribe el pid del nieto para limpiarlo.
    const nieto = 'setTimeout(() => {}, 30000)';
    const hijo = [
      'const n = require("child_process").spawn(process.execPath, ["-e", ' + JSON.stringify(nieto) + '],',
      '{ stdio: ["ignore", "inherit", "inherit"], detached: true, windowsHide: true });',
      'process.stdout.write(String(n.pid) + "\\n"); n.unref();',
    ].join(' ');
    const inicio = Date.now();
    const r = await correrProceso(process.execPath, ['-e', hijo], { cwd: tmpdir(), env: process.env, limiteMs: 500, graciaMs: 300 });
    const pid = Number(r.stdout.trim());
    try {
      assert.equal(r.vencido, true);
      assert.equal(r.codigo, null);
      assert.ok(Date.now() - inicio < 10_000, 'esperó al nieto en vez de cerrar la corrida');
    } finally {
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid);
        } catch {
          // Ya no estaba.
        }
      }
    }
  });

  test('un proceso que termina antes del límite no espera el plazo de gracia', async () => {
    const inicio = Date.now();
    const r = await correrProceso(process.execPath, ['-e', 'process.stdout.write("listo")'], {
      cwd: raiz,
      env: process.env,
      limiteMs: 20_000,
      graciaMs: 15_000,
    });
    assert.equal(r.vencido, false);
    assert.equal(r.codigo, 0);
    assert.equal(r.stdout, 'listo');
    assert.ok(Date.now() - inicio < 10_000);
  });

  test('un ejecutable que no existe no tira abajo la serie', async () => {
    const r = await correrProceso(join(raiz, 'no-existe.exe'), [], { cwd: raiz, env: process.env, limiteMs: 5_000 });
    assert.equal(r.codigo, null);
    assert.match(r.stderr, /ENOENT|no-existe/u);
  });
});

describe('el comando', () => {
  const comando = join(REPO_ROOT, 'scripts', 'prueba-final.ts');
  const correr = (...args: string[]) => spawnSync(process.execPath, [comando, ...args], { encoding: 'utf8' });

  test('package.json lo declara', () => {
    const paquete = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    assert.equal(paquete.scripts['prueba-final'], 'node scripts/prueba-final.ts');
    assert.doesNotMatch(paquete.scripts.test ?? '', /prueba-final\.ts/u, 'la prueba con agentes no entra en npm test');
  });

  test('--help sale con 0 y muestra las opciones', () => {
    const r = correr('--help');
    assert.equal(r.status, 0);
    for (const o of [
      '--dir',
      '--agentes',
      '--variantes',
      '--completo',
      '--paralelo',
      '--limite',
      '--simular',
      '--agregar',
      '--reevaluar',
      '--fallidas',
      '--con-avisos',
      '--afectadas',
      '--desde',
    ]) {
      assert.ok(r.stdout.includes(o), o);
    }
  });

  test('--reevaluar sin corridas publicadas, o junto con --simular o --agregar, sale con 2', () => {
    const e = escenario();
    const vacia = correr('--dir', e.carpeta, '--reevaluar');
    assert.equal(vacia.status, 2);
    assert.match(vacia.stderr, /veredicto\.json/u);
    assert.equal(correr('--dir', e.carpeta, '--reevaluar', '--simular').status, 2);
    assert.equal(correr('--dir', e.carpeta, '--reevaluar', '--agregar').status, 2);
  });

  test('sin carpeta, sin base.docx o con una opción mal escrita, sale con 2', () => {
    assert.equal(correr().status, 2);
    const vacia = join(raiz, 'vacia');
    mkdirSync(vacia, { recursive: true });
    const sinDocx = correr('--dir', vacia, '--simular');
    assert.equal(sinDocx.status, 2);
    assert.match(sinDocx.stderr, /base\.docx/u);
    const e = escenario();
    assert.equal(correr('--dir', e.carpeta, '--agentes', 'inventado', '--simular').status, 2);
    assert.equal(correr('--dir', e.carpeta, '--paralelo', 'cero', '--simular').status, 2);
    assert.equal(correr('--dir', e.carpeta, '--inventada').status, 2);
  });

  test('un documento sin los títulos del fragmento sale con 2 y lo dice', () => {
    const e = escenario();
    writeFileSync(e.docx, construirDocx('<w:p><w:r><w:t>Solo un párrafo.</w:t></w:r></w:p>'));
    const r = correr('--dir', e.carpeta, '--simular');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Resumen/u);
  });

  test('--simular imprime el plan y las cuentas, y no escribe nada', () => {
    const e = escenario();
    const antes = readdirSync(e.carpeta);
    const r = correr('--dir', e.carpeta, '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Resumen: 17 palabras/u);
    assert.match(r.stdout, /1\. Introducción: 22 palabras/u);
    assert.match(r.stdout, /39 palabras/u);
    for (const v of variantes()) assert.ok(r.stdout.includes(`${v.id}: `), `falta la variante ${v.id}`);
    for (const a of ['copilot', 'grok', 'agy', 'codex']) assert.ok(r.stdout.includes(a), a);
    // Codex corre con un CODEX_HOME propio, con el nombre de la carpeta de la
    // corrida pero fuera de ella y del directorio temporal.
    assert.match(r.stdout, /^ {4}con CODEX_HOME=\S*[\\/]\.cache[\\/]prueba-final[\\/]codex[\\/]pf-<uuid>$/mu);
    assert.deepEqual(readdirSync(e.carpeta), antes);
    assert.equal(sha(readFileSync(e.docx)), sha(DOCX));
  });

  test('--agentes con una parte simula solo esa parte y dice cuáles no corren', () => {
    const e = escenario();
    const r = correr('--dir', e.carpeta, '--agentes', 'copilot', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Corridas: 1 agentes por \d+ variantes/u);
    assert.match(r.stdout, /^No corren esta vez: grok, agy, codex\.$/mu);
  });

  test('--simular imprime el plan de la copia: qué entra, cuántos archivos y qué queda fuera', () => {
    const e = escenario();
    const r = correr('--dir', e.carpeta, '--simular');
    assert.equal(r.status, 0, r.stderr);
    const rastreados = spawnSync('git', ['-C', REPO_ROOT, 'ls-files', '-z'], { encoding: 'utf8' })
      .stdout.split('\0')
      .filter(Boolean);
    const delArnes = rastreados.filter((x) => !excluido(x) && existsSync(join(REPO_ROOT, x))).length;
    const fuera = rastreados.filter((x) => excluido(x)).length;
    assert.match(r.stdout, /^Copia de trabajo de cada corrida/mu);
    assert.ok(r.stdout.includes(`AGENTS.md, CLAUDE.md`), 'las instrucciones de mix');
    assert.ok(r.stdout.includes('open-slide/README.md'), 'el marcador de open-slide');
    assert.ok(r.stdout.includes(`${delArnes} archivos que git rastrea`), r.stdout);
    assert.ok(r.stdout.includes(`${delArnes + 3} archivos en total`), r.stdout);
    assert.ok(r.stdout.includes(`fuera, ${fuera} archivos`), r.stdout);
    for (const p of EXCLUIDOS) assert.ok(r.stdout.includes(p), p);
    // El agente que recibe la carpeta por opción la recibe apuntando a la copia.
    assert.match(r.stdout, /--cwd \S*pf-<uuid>[\\/]mix\b/u);
  });
});
