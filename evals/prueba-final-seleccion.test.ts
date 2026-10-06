// Correr solo lo que hace falta: lo que falló, o lo que un cambio alcanza.
//
// Una serie completa son quince variantes por agente, y cada corrida de Grok
// tarda unos diez minutos y gasta medio dólar. Volver a correr la serie entera
// para repetir tres corridas que fallaron, o para probar un cambio en un solo
// tono, gasta horas en corridas que no pueden decir nada nuevo. `--fallidas`
// repite lo que falló o no terminó; `--afectadas` corre lo que la tabla de
// impacto dice que un cambio alcanza. Las dos se suman a lo publicado como
// `--agregar`: el resto de la serie queda donde está.
//
// Las pruebas del comando corren el comando de verdad, siempre con
// `--simular` o con algo que lo hace salir antes de lanzar un agente: ninguna
// llama a un CLI real.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { after, describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import type { Comprobacion } from '../scripts/prueba-final/comprobaciones.ts';
import type { EstadoDeCorrida, Veredicto } from '../scripts/prueba-final/resumen.ts';
import { fallidas } from '../scripts/prueba-final/seleccion.ts';
import { variantes } from '../scripts/prueba-final/variantes.ts';
import { CUERPO, construirDocx } from './fixtures/prueba-final/docx.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-seleccion-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const sha = (b: string | Uint8Array) => createHash('sha256').update(b).digest('hex');
const DOCX = construirDocx(CUERPO);
const TODAS = variantes().map((v) => v.id);

const c = (numero: number, estado: Comprobacion['estado']): Comprobacion => ({ numero, nombre: `n${numero}`, estado, motivo: 'm' });

function veredicto(agente: string, variante: string, estado: EstadoDeCorrida): Veredicto {
  const comprobaciones = estado === 'falla' ? [c(7, 'falla')] : estado === 'aviso' ? [c(8, 'aviso')] : [c(1, 'pasa')];
  return {
    agente,
    variante,
    estado,
    error: estado === 'error' ? 'cuota agotada' : null,
    serie: '2026-10-06T00:00:00.000Z',
    comprobaciones,
    metadatos: {
      version: null,
      modelo: null,
      duracionMs: 1,
      duracionAgenteMs: null,
      codigo: 0,
      vencido: false,
      costo: null,
      sesion: null,
      inicio: '2026-10-06T00:00:00.000Z',
      fin: '2026-10-06T00:00:00.000Z',
      copia: { archivos: 1, huella: 'f'.repeat(64) },
      engram: `prueba-final-x-${agente}-${variante}`,
    },
  };
}

const SERIE = [
  veredicto('copilot', 'base', 'falla'),
  veredicto('grok', 'base', 'error'),
  veredicto('copilot', 'camus', 'pasa'),
  veredicto('grok', 'camus', 'aviso'),
  veredicto('falso', 'han', 'falla'),
  veredicto('copilot', 'retirado', 'falla'),
];

const claves = (ps: readonly { agente: string; variante: string }[]) => ps.map((p) => `${p.agente}/${p.variante}`);

describe('qué vuelve a correr --fallidas', () => {
  const todos = { agentes: ['copilot', 'grok', 'agy'], variantes: TODAS };

  test('las corridas con falla o con error, en el orden de la matriz', () => {
    const r = fallidas(SERIE, { conAvisos: false, ...todos });
    assert.deepEqual(claves(r.pares), ['copilot/base', 'grok/base']);
    assert.match(r.pares[0]?.celda ?? '', /^falla: 7/u);
    assert.match(r.pares[1]?.celda ?? '', /^error: cuota agotada/u);
  });

  test('con --con-avisos, también las que pasaron con aviso', () => {
    assert.deepEqual(claves(fallidas(SERIE, { conAvisos: true, ...todos }).pares), ['copilot/base', 'grok/base', 'grok/camus']);
  });

  test('las de un agente o una variante que no se pueden correr quedan fuera, y se dicen', () => {
    const r = fallidas(SERIE, { conAvisos: false, ...todos });
    assert.deepEqual(claves(r.fuera), ['falso/han', 'copilot/retirado']);
  });

  test('--agentes y --variantes acotan', () => {
    assert.deepEqual(claves(fallidas(SERIE, { conAvisos: true, agentes: ['grok'], variantes: TODAS }).pares), ['grok/base', 'grok/camus']);
    assert.deepEqual(claves(fallidas(SERIE, { conAvisos: true, ...todos, variantes: ['camus'] }).pares), ['grok/camus']);
  });

  test('una serie que pasó entera no tiene nada que volver a correr', () => {
    assert.deepEqual(fallidas([veredicto('grok', 'base', 'pasa')], { conAvisos: true, ...todos }).pares, []);
  });
});

/** Todos los archivos de una carpeta, relativos a ella. */
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

let n = 0;
/** Un mix con sus instrucciones y una carpeta con base.docx. */
function escenario() {
  const mix = join(raiz, `mix-${++n}`);
  const carpeta = join(mix, 'test-final');
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'base.docx'), DOCX);
  writeFileSync(join(mix, 'AGENTS.md'), '# mix\n');
  writeFileSync(join(mix, 'CLAUDE.md'), 'Ver AGENTS.md.\n');
  return { mix, carpeta };
}

/** Publica a mano una serie en la raíz, con su resumen. */
function publicar(carpeta: string, vs: readonly Veredicto[], traza: unknown = undefined): void {
  for (const v of vs) {
    const dir = join(carpeta, v.agente, v.variante);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'veredicto.json'), JSON.stringify(v));
  }
  const resumen = { fecha: '2026-10-06T00:00:00.000Z', texto: { modo: 'fragmento', palabras: 39, secciones: [] }, docx: { antes: sha(DOCX), despues: sha(DOCX) } };
  writeFileSync(join(carpeta, 'resumen.json'), JSON.stringify(traza === undefined ? resumen : { ...resumen, traza }));
}

const comando = join(REPO_ROOT, 'scripts', 'prueba-final.ts');
const correr = (...args: string[]) => spawnSync(process.execPath, [comando, ...args], { encoding: 'utf8' });

/** Corre el comando y comprueba que no escribió nada en la carpeta. */
function sinEscribir(carpeta: string, ...args: string[]) {
  const antes = archivosDe(carpeta);
  const r = correr('--dir', carpeta, ...args);
  assert.deepEqual(archivosDe(carpeta), antes, 'escribió en la carpeta');
  assert.equal(sha(readFileSync(join(carpeta, 'base.docx'))), sha(DOCX));
  return r;
}

describe('el comando con --fallidas', () => {
  test('sin una serie en la raíz sale con 2 y lo dice', () => {
    const e = escenario();
    const r = correr('--dir', e.carpeta, '--fallidas', '--simular');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no hay ninguna serie publicada/u);
  });

  test('--simular lista lo que vuelve a correr y no escribe nada', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE);
    const r = sinEscribir(e.carpeta, '--fallidas', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^ {2}copilot\/base: falla: 7$/mu);
    assert.match(r.stdout, /^ {2}grok\/base: error: cuota agotada$/mu);
    assert.doesNotMatch(r.stdout, /^ {2}grok\/camus:/mu);
    assert.doesNotMatch(r.stdout, /^ {2}copilot\/camus:/mu);
    assert.match(r.stdout, /falso\/han/u, 'lo que no puede volver a correr también se dice');
    assert.match(r.stdout, /^Corridas: 2, solo los pares elegidos\.$/mu);
  });

  test('con --con-avisos suma las que pasaron con aviso, y --agentes acota', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE);
    assert.match(sinEscribir(e.carpeta, '--fallidas', '--con-avisos', '--simular').stdout, /^ {2}grok\/camus: aviso: 8$/mu);
    const solo = sinEscribir(e.carpeta, '--fallidas', '--agentes', 'grok', '--simular');
    assert.match(solo.stdout, /^ {2}grok\/base:/mu);
    assert.doesNotMatch(solo.stdout, /^ {2}copilot\/base:/mu);
  });

  test('una serie que pasó entera sale con 0 sin correr nada', () => {
    const e = escenario();
    publicar(e.carpeta, [veredicto('grok', 'base', 'pasa')]);
    const r = sinEscribir(e.carpeta, '--fallidas', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Nada que volver a correr/u);
  });

  test('las opciones que no se combinan salen con 2', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE);
    for (const args of [
      ['--con-avisos', '--simular'],
      ['--fallidas', '--afectadas', '--simular'],
      ['--fallidas', '--reevaluar'],
      ['--afectadas', '--reevaluar'],
      ['--desde', 'HEAD', '--simular'],
    ]) {
      assert.equal(sinEscribir(e.carpeta, ...args).status, 2, args.join(' '));
    }
  });
});

describe('el comando con --afectadas', () => {
  const head = spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const mixDe = (e: ReturnType<typeof escenario>) => ({
    'AGENTS.md': sha(readFileSync(join(e.mix, 'AGENTS.md'))),
    'CLAUDE.md': sha(readFileSync(join(e.mix, 'CLAUDE.md'))),
  });

  test('sin --desde y sin un commit registrado para la serie sale con 2 y pide --desde', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE);
    const r = sinEscribir(e.carpeta, '--afectadas', '--simular');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--desde/u);
  });

  test('una referencia que git no conoce sale con 2 y la nombra', () => {
    const e = escenario();
    const r = sinEscribir(e.carpeta, '--afectadas', '--desde', 'no-existe-esta-referencia', '--simular');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no-existe-esta-referencia/u);
  });

  test('sin huellas registradas de mix, sus instrucciones cuentan como cambio y corre todo', () => {
    const e = escenario();
    const r = sinEscribir(e.carpeta, '--afectadas', '--desde', 'HEAD', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /AGENTS\.md de mix/u);
    assert.match(r.stdout, /^Variantes: todas \(\d+\)/mu);
    assert.match(r.stdout, new RegExp(`^Corridas: 3 agentes por ${TODAS.length} variantes`, 'mu'));
  });

  test('--variantes acota lo que la tabla eligió', () => {
    const e = escenario();
    const r = sinEscribir(e.carpeta, '--afectadas', '--desde', 'HEAD', '--variantes', 'camus', '--agentes', 'grok', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^Corridas: 1 agentes por 1 variantes/mu);
  });

  test('con las huellas registradas iguales, ni mix ni base.docx cuentan como cambio', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE, { arnes: { commit: head, sucio: false, sucios: {} }, mix: mixDe(e), docx: sha(DOCX) });
    const r = sinEscribir(e.carpeta, '--afectadas', '--desde', 'HEAD', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /de mix/u);
    assert.doesNotMatch(r.stdout, /base\.docx de la carpeta/u);
  });

  test('una instrucción de mix cambiada desde la serie corre todo', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE, { arnes: { commit: head, sucio: false, sucios: {} }, mix: mixDe(e), docx: sha(DOCX) });
    writeFileSync(join(e.mix, 'CLAUDE.md'), 'Ver AGENTS.md, y algo más.\n');
    const r = sinEscribir(e.carpeta, '--afectadas', '--desde', 'HEAD', '--simular');
    assert.match(r.stdout, /CLAUDE\.md de mix/u);
    assert.match(r.stdout, /^Variantes: todas/mu);
  });

  test('sin --desde, compara desde el commit registrado para la serie', () => {
    const e = escenario();
    publicar(e.carpeta, SERIE, { arnes: { commit: head, sucio: false, sucios: {} }, mix: mixDe(e), docx: sha(DOCX) });
    const r = sinEscribir(e.carpeta, '--afectadas', '--simular');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(head.slice(0, 7)), r.stdout);
  });
});
