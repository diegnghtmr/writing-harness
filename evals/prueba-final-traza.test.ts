// Con qué se probó cada corrida, y si lo publicado sigue describiendo el arnés.
//
// Un veredicto sin el commit del arnés no dice qué probó. Con `--agregar` la
// raíz junta corridas de días distintos, y una celda que pasó con una base
// vieja se lee igual que una que pasó ayer. Cada veredicto anota el commit con
// que se probó, si había cambios sin commit, la huella de las instrucciones de
// mix y la de las skills instaladas. El resumen marca la celda que un cambio
// posterior alcanza y que no se volvió a correr, y la que no anota nada de
// esto no se da por vigente.
//
// Lo que se compara en git se prueba con repositorios temporales de verdad: la
// lógica que decide qué cambió es justo la que un doble podría esconder.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import type { Comprobacion } from '../scripts/prueba-final/comprobaciones.ts';
import { cambiosDesde, commitDe, entornoDeGit, estadoDelArnes } from '../scripts/prueba-final/reales.ts';
import { resumenMarkdown, type Suite, type Veredicto } from '../scripts/prueba-final/resumen.ts';
import {
  cambiosRespectoDe,
  huellasDeMix,
  rutasCambiadas,
  trazaDeLaSerie,
  vigenciaDe,
  type EstadoDelArnes,
  type Traza,
} from '../scripts/prueba-final/traza.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-traza-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

/**
 * git en un repositorio temporal, sin depender de la configuración de quien
 * corre la suite. Va con el entorno limpio de las variables que eligen el
 * repositorio: desde el gate de pre-commit, `GIT_DIR` apunta al repositorio
 * del hook, y un `git init` aquí lo reinicializaba como desnudo.
 */
function git(dir: string, ...args: string[]): string {
  const r = spawnSync(
    'git',
    ['-c', 'user.name=prueba', '-c', 'user.email=prueba@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-C', dir, ...args],
    { encoding: 'utf8', env: entornoDeGit() },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

let n = 0;
/** Un repositorio con dos archivos y un patrón ignorado, en su primer commit. */
function repo(): string {
  const dir = join(raiz, `repo-${++n}`);
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  writeFileSync(join(dir, 'a.md'), 'a\n');
  writeFileSync(join(dir, 'b.md'), 'b\n');
  writeFileSync(join(dir, '.gitignore'), '*.log\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'inicio');
  return dir;
}

const commit = (dir: string, mensaje: string) => {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', mensaje);
};

describe('el estado del arnés en git', () => {
  test('limpio: el commit de HEAD, y nada sin commit', () => {
    const dir = repo();
    assert.deepEqual(estadoDelArnes(dir), { commit: git(dir, 'rev-parse', 'HEAD'), sucio: false, sucios: {} });
  });

  test('con cambios: sucio, con la huella de cada ruta cambiada, nueva o borrada, y sin lo ignorado', () => {
    const dir = repo();
    writeFileSync(join(dir, 'a.md'), 'a cambiado\n');
    unlinkSync(join(dir, 'b.md'));
    writeFileSync(join(dir, 'ñandú.md'), 'nuevo\n');
    writeFileSync(join(dir, 'registro.log'), 'ignorado\n');
    const e = estadoDelArnes(dir);
    assert.equal(e.commit, git(dir, 'rev-parse', 'HEAD'));
    assert.equal(e.sucio, true);
    assert.deepEqual(e.sucios, { 'a.md': sha('a cambiado\n'), 'b.md': null, 'ñandú.md': sha('nuevo\n') });
  });

  test('desde un estado limpio cuenta los commits nuevos, los cambios sin commit y los archivos nuevos', () => {
    const dir = repo();
    const antes = estadoDelArnes(dir);
    writeFileSync(join(dir, 'a.md'), 'a dos\n');
    commit(dir, 'segundo');
    writeFileSync(join(dir, 'b.md'), 'b sin commit\n');
    writeFileSync(join(dir, 'c.md'), 'c\n');
    writeFileSync(join(dir, 'otro.log'), 'ignorado\n');
    assert.deepEqual(cambiosDesde(dir, antes), ['a.md', 'b.md', 'c.md']);
  });

  test('desde un estado sucio, lo que ya estaba al probar no cuenta, y lo que volvió atrás sí', () => {
    const dir = repo();
    writeFileSync(join(dir, 'a.md'), 'a probado\n');
    writeFileSync(join(dir, 'c.md'), 'c probado\n');
    const probado = estadoDelArnes(dir);
    assert.deepEqual(cambiosDesde(dir, probado), [], 'nada cambió desde la corrida');
    writeFileSync(join(dir, 'a.md'), 'a\n');
    assert.deepEqual(cambiosDesde(dir, probado), ['a.md'], 'a.md volvió a lo del commit, que no es lo que se probó');
    unlinkSync(join(dir, 'c.md'));
    assert.deepEqual(cambiosDesde(dir, probado), ['a.md', 'c.md']);
  });

  test('un commit que git no conoce, o ninguno, da null', () => {
    const dir = repo();
    assert.equal(cambiosDesde(dir, { commit: 'f'.repeat(40), sucio: false, sucios: {} }), null);
    assert.equal(cambiosDesde(dir, { commit: null, sucio: false, sucios: {} }), null);
  });

  test('una referencia que existe da su commit completo, y una que no, null', () => {
    const dir = repo();
    assert.equal(commitDe(dir, 'HEAD'), git(dir, 'rev-parse', 'HEAD'));
    assert.equal(commitDe(dir, git(dir, 'rev-parse', '--short', 'HEAD')), git(dir, 'rev-parse', 'HEAD'));
    assert.equal(commitDe(dir, 'no-existe'), null);
  });

  test('el entorno de git deja fuera las variables que eligen el repositorio, y nada más', () => {
    const env = entornoDeGit({ GIT_DIR: 'x', GIT_INDEX_FILE: 'y', GIT_WORK_TREE: 'z', PATH: 'p', GIT_AUTHOR_NAME: 'a' });
    assert.deepEqual(env, { PATH: 'p', GIT_AUTHOR_NAME: 'a' });
  });

  test('con el GIT_DIR de un hook apuntando a otro repositorio, se habla con la raíz nombrada y el otro queda intacto', () => {
    // Es lo que pasa cuando la suite corre desde el gate de pre-commit.
    const nombrado = repo();
    const delHook = repo();
    const head = git(nombrado, 'rev-parse', 'HEAD');
    const configDelHook = readFileSync(join(delHook, '.git', 'config'), 'utf8');
    const previas = { GIT_DIR: process.env.GIT_DIR, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE };
    process.env.GIT_DIR = join(delHook, '.git');
    process.env.GIT_INDEX_FILE = join(delHook, '.git', 'index');
    try {
      writeFileSync(join(nombrado, 'c.md'), 'c\n');
      assert.equal(estadoDelArnes(nombrado).commit, head);
      assert.equal(commitDe(nombrado, 'HEAD'), head);
      assert.deepEqual(cambiosDesde(nombrado, { commit: head, sucio: false, sucios: {} }), ['c.md']);
      git(nombrado, 'add', '-A');
      repo();
    } finally {
      for (const [k, v] of Object.entries(previas)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
    assert.equal(readFileSync(join(delHook, '.git', 'config'), 'utf8'), configDelHook, 'el config del otro repositorio cambió');
    assert.equal(git(delHook, 'status', '--porcelain'), '', 'el índice del otro repositorio cambió');
    assert.equal(git(nombrado, 'diff', '--cached', '--name-only'), 'c.md');
  });

  test('la corrección por lo sucio, sin git', () => {
    const actual: Record<string, string | null> = { 'a.md': 'h-a', 'b.md': 'h-b2', 'c.md': null };
    const sucios = { 'a.md': 'h-a', 'b.md': 'h-b', 'd.md': 'h-d' };
    // a: igual que al probar. b: cambió. c: nueva desde entonces. d: estaba sucia y volvió al commit.
    assert.deepEqual(rutasCambiadas(['a.md', 'b.md', 'c.md'], sucios, (r) => actual[r] ?? null), ['b.md', 'c.md', 'd.md']);
  });
});

const ESTADO: EstadoDelArnes = { commit: 'a'.repeat(40), sucio: false, sucios: {} };
const MIX = { 'AGENTS.md': 'h-agents', 'CLAUDE.md': 'h-claude' };

const traza = (o: Partial<Traza> = {}): Traza => ({
  arnes: ESTADO,
  mix: MIX,
  docx: 'h-docx',
  instaladas: { directorio: '/home/x/.grok/skills', huella: 'h-instaladas' },
  ...o,
});

const c = (numero: number, estado: Comprobacion['estado']): Comprobacion => ({ numero, nombre: `n${numero}`, estado, motivo: 'm' });

function veredicto(agente: string, variante: string, t: Traza | undefined, serie = '2026-10-06T00:00:00.000Z'): Veredicto {
  return {
    agente,
    variante,
    estado: 'pasa',
    error: null,
    serie,
    comprobaciones: [c(1, 'pasa')],
    metadatos: {
      version: null,
      modelo: null,
      duracionMs: 1,
      duracionAgenteMs: null,
      codigo: 0,
      vencido: false,
      costo: null,
      sesion: null,
      inicio: serie,
      fin: serie,
      copia: { archivos: 1, huella: 'f'.repeat(64) },
      engram: `prueba-final-x-${agente}-${variante}`,
      ...(t === undefined ? {} : { traza: t }),
    },
  };
}

describe('la traza de la serie', () => {
  test('la de la serie más antigua de la raíz, sin las instaladas, que son de cada agente', () => {
    const vieja = traza({ arnes: { commit: 'b'.repeat(40), sucio: true, sucios: { 'x.md': 'h' } } });
    const s = trazaDeLaSerie([veredicto('grok', 'base', traza(), '2026-10-07T00:00:00.000Z'), veredicto('copilot', 'base', vieja, '2026-10-06T00:00:00.000Z')]);
    assert.deepEqual(s, { arnes: vieja.arnes, mix: vieja.mix, docx: vieja.docx });
  });

  test('si alguna corrida no la anota, la serie no tiene traza', () => {
    assert.equal(trazaDeLaSerie([veredicto('grok', 'base', traza()), veredicto('agy', 'fonda', undefined)]), null);
    assert.equal(trazaDeLaSerie([]), null);
  });

  test('las huellas de las instrucciones de mix, las que haya', () => {
    const mix = join(raiz, 'mix-huellas');
    mkdirSync(mix, { recursive: true });
    writeFileSync(join(mix, 'AGENTS.md'), '# mix\n');
    assert.deepEqual(huellasDeMix(mix), { 'AGENTS.md': sha('# mix\n') });
  });
});

describe('lo que cambió respecto de lo registrado', () => {
  const actual = { mix: MIX, docx: 'h-docx' };

  test('igual que al probar: solo las rutas del arnés', () => {
    assert.deepEqual(cambiosRespectoDe({ mix: MIX, docx: 'h-docx' }, actual, ['src/check.ts']), [{ origen: 'arnes', ruta: 'src/check.ts' }]);
  });

  test('una instrucción de mix o base.docx distintos cuentan como cambio', () => {
    const cs = cambiosRespectoDe({ mix: { ...MIX, 'CLAUDE.md': 'otra' }, docx: 'otro' }, actual, []);
    assert.deepEqual(cs, [
      { origen: 'mix', ruta: 'CLAUDE.md' },
      { origen: 'carpeta', ruta: 'base.docx' },
    ]);
  });

  test('lo que no se registró cuenta como cambio, con la nota de por qué', () => {
    const cs = cambiosRespectoDe({ mix: null, docx: null }, actual, []);
    assert.deepEqual(
      cs.map((x) => [x.origen, x.ruta]),
      [
        ['mix', 'AGENTS.md'],
        ['mix', 'CLAUDE.md'],
        ['carpeta', 'base.docx'],
      ],
    );
    for (const x of cs) assert.match(x.nota ?? '', /no registra/u);
  });
});

describe('la vigencia de cada celda', () => {
  const actual = { mix: MIX, docx: 'h-docx' };
  const vig = (vs: Veredicto[], cambios: string[] | null) => vigenciaDe(vs, actual, () => cambios);

  test('una corrida sin traza no se da por vigente', () => {
    const v = vig([veredicto('copilot', 'base', undefined)], [])['copilot/base'];
    assert.equal(v?.estado, 'desconocida');
    assert.match(v?.motivo ?? '', /no registra/u);
  });

  test('un commit que git no reconoce tampoco', () => {
    assert.equal(vig([veredicto('grok', 'camus', traza())], null)['grok/camus']?.estado, 'desconocida');
  });

  test('un cambio en su tono la deja desactualizada, con la ruta en el motivo', () => {
    const v = vig([veredicto('grok', 'camus', traza())], ['skills/camus-writing/SKILL.md'])['grok/camus'];
    assert.equal(v?.estado, 'desactualizada');
    assert.match(v?.motivo ?? '', /skills\/camus-writing\/SKILL\.md/u);
  });

  test('un cambio en otro tono, en lo que solo juzga o en lo que no cambia el uso la deja vigente', () => {
    const r = vig([veredicto('grok', 'camus', traza())], ['skills/han-writing/SKILL.md', 'scripts/prueba-final/comprobaciones.ts', 'README.md']);
    assert.equal(r['grok/camus']?.estado, 'vigente');
  });

  test('un cambio en las instrucciones de mix las deja a todas desactualizadas', () => {
    const r = vigenciaDe([veredicto('grok', 'camus', traza()), veredicto('grok', 'base', traza())], { mix: { ...MIX, 'AGENTS.md': 'otra' }, docx: 'h-docx' }, () => []);
    assert.equal(r['grok/camus']?.estado, 'desactualizada');
    assert.equal(r['grok/base']?.estado, 'desactualizada');
    assert.match(r['grok/base']?.motivo ?? '', /AGENTS\.md de mix/u);
  });

  test('git se consulta una vez por estado del arnés, no una por celda', () => {
    let llamadas = 0;
    vigenciaDe([veredicto('grok', 'camus', traza()), veredicto('grok', 'base', traza()), veredicto('agy', 'base', traza())], actual, () => {
      llamadas++;
      return [];
    });
    assert.equal(llamadas, 1);
  });
});

describe('las marcas en la matriz', () => {
  const suite = (vs: Veredicto[], extra: Partial<Suite> = {}): Suite => ({
    fecha: '2026-10-06T00:00:00.000Z',
    carpeta: 'C:\\r\\mix\\test-final',
    texto: { modo: 'fragmento', palabras: 10, secciones: [] },
    docx: { antes: 'h-docx', despues: 'h-docx' },
    agentes: ['grok', 'copilot'],
    omitidos: [],
    series: { grok: '2026-10-06T00:00:00.000Z', copilot: '2026-10-06T00:00:00.000Z' },
    variantes: ['base', 'camus'],
    veredictos: vs,
    ...extra,
  });
  const vs = [veredicto('grok', 'base', traza()), veredicto('grok', 'camus', traza()), veredicto('copilot', 'base', undefined)];

  test('sin vigencia calculada, la matriz queda como antes', () => {
    const md = resumenMarkdown(suite(vs));
    assert.match(md, /^\| camus \| pasa \| sin correr \|$/mu);
    assert.doesNotMatch(md, /desactualizada|sin traza/u);
  });

  test('cada celda lleva su marca, y el motivo va en su sección', () => {
    const vigencia = vigenciaDe(vs, { mix: MIX, docx: 'h-docx' }, () => ['skills/camus-writing/SKILL.md']);
    const md = resumenMarkdown(suite(vs, { vigencia, traza: trazaDeLaSerie(vs) }));
    assert.match(md, /^\| base \| pasa \| pasa \[sin traza\] \|$/mu);
    assert.match(md, /^\| camus \| pasa \[desactualizada\] \| sin correr \|$/mu);
    assert.match(md, /^## Vigencia$/mu);
    assert.match(md, /^- grok, camus: desactualizada: .*skills\/camus-writing\/SKILL\.md/mu);
    assert.match(md, /^- Sin traza \(.*\): copilot\/base\.$/mu);
    assert.match(md, /^- Arnés: sin traza/mu, 'una corrida sin traza deja a la serie sin traza');
  });

  test('la línea del arnés dice el commit de la serie y si tenía cambios sin commit', () => {
    const t = traza({ arnes: { commit: '1234567890'.repeat(4), sucio: true, sucios: { 'a.md': 'h', 'b.md': null } } });
    const md = resumenMarkdown(suite([veredicto('grok', 'base', t)], { traza: trazaDeLaSerie([veredicto('grok', 'base', t)]) }));
    assert.match(md, /^- Arnés: commit 1234567, con cambios sin commit en 2 rutas\.$/mu);
  });
});
