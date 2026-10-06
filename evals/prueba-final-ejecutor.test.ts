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

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import { correrSuite, type Agente, type Dependencias, type Plan } from '../scripts/prueba-final/ejecutor.ts';
import { fragmento } from '../scripts/prueba-final/fragmento.ts';
import { parrafosDelDocx } from '../scripts/prueba-final/docx.ts';
import { correrProceso } from '../scripts/prueba-final/proceso.ts';
import { llamada, vacia } from '../scripts/prueba-final/transcripcion.ts';
import { variantes, type Variante } from '../scripts/prueba-final/variantes.ts';
import type { Contexto } from '../scripts/prueba-final/agentes.ts';
import { CUERPO, construirDocx } from './fixtures/prueba-final/docx.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-test-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const DOCX = construirDocx(CUERPO);
const TEXTO = fragmento(parrafosDelDocx(DOCX));
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

let serie = 0;
/** Una carpeta de prueba con su base.docx y un directorio temporal aparte. */
function escenario() {
  serie++;
  const cwd = join(raiz, `mix-${serie}`);
  const carpeta = join(cwd, 'test-final');
  const tmp = join(raiz, `tmp-${serie}`);
  mkdirSync(carpeta, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(carpeta, 'base.docx'), DOCX);
  return { cwd, carpeta, tmp, docx: join(carpeta, 'base.docx') };
}

type Registro = { agente: string; variante: string; staging: string; publicado: boolean; activas: number };

/**
 * Un agente que hace lo que piden las skills: carga las suyas, escribe la
 * salida, mide con las opciones de la variante y responde sin repetir el texto.
 */
function agenteFalso(
  id: string,
  carpeta: string,
  registro: Registro[],
  opciones: { identica?: boolean; antes?: (ctx: Contexto) => void; contador?: { activas: number; maximo: number } } = {},
): Agente {
  const porStaging = new Map<string, Variante>();
  return {
    id,
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
      });
      opciones.antes?.(ctx);
      await new Promise((r) => setTimeout(r, 15));
      const entrada = readFileSync(join(ctx.staging, 'entrada.md'), 'utf8');
      const marca = opciones.identica ? '' : `\n\nVersión de ${id} para ${(variante as Variante).id}.\n`;
      writeFileSync(join(ctx.staging, 'salida.md'), entrada + marca);
      writeFileSync(join(ctx.staging, 'transcripcion.jsonl'), '{"falso":true}\n');
      if (c) c.activas--;
      return { stdout: '{"tipo":"falso"}\n', stderr: '', codigo: 0, vencido: false, duracionMs: 15 };
    },
    recoger(ctx) {
      const v = porStaging.get(ctx.staging) as Variante;
      const salida = join(ctx.staging, 'salida.md');
      const skills = ['redactar-espanol', 'spanish-writing', ...(v.skill ? [v.skill] : [])];
      const linea = v.clase === 'base' ? 'No se aplicó ningún tono.' : `Capa: \`${v.skill}\`.`;
      return {
        ...vacia(),
        respuesta: `Quedó en \`${salida}\`. ${linea}`,
        llamadas: [
          ...skills.map((s) => llamada('skill', { skill: s })),
          llamada('powershell', { command: `node writing-harness/src/cli.ts ${salida} ${v.banderas.join(' ')}` }, 0),
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
    ...extra,
  };
};

const plan = (e: ReturnType<typeof escenario>, agentes: Agente[], vs: Variante[], paralelo = 1): Plan => ({
  carpeta: e.carpeta,
  docx: e.docx,
  cwd: e.cwd,
  raicesGit: [e.cwd],
  texto: TEXTO,
  agentes,
  variantes: vs,
  paralelo,
  limiteMin: 1,
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
    assert.equal(v.comprobaciones.length, 10);
    assert.equal(v.metadatos.vencido, false);
    assert.match(readFileSync(join(e.carpeta, 'falso', 'camus', 'prompt.txt'), 'utf8'), /^Reescribe el texto de `/u);
  });

  test('el resumen queda en la carpeta, en Markdown y en JSON, y base.docx no se tocó', () => {
    assert.match(readFileSync(join(e.carpeta, 'resumen.md'), 'utf8'), /^\| camus \| pasa \|$/mu);
    assert.equal(JSON.parse(readFileSync(join(e.carpeta, 'resumen.json'), 'utf8')).codigo, 0);
    assert.equal(sha(readFileSync(e.docx)), sha(DOCX));
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
    for (const o of ['--dir', '--agentes', '--variantes', '--completo', '--paralelo', '--limite', '--simular']) {
      assert.ok(r.stdout.includes(o), o);
    }
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
    for (const a of ['copilot', 'grok', 'agy']) assert.ok(r.stdout.includes(a), a);
    assert.deepEqual(readdirSync(e.carpeta), antes);
    assert.equal(sha(readFileSync(e.docx)), sha(DOCX));
  });
});
