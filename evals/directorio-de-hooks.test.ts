// El instalador de hooks asumia que `.git` es siempre una carpeta
// (`join(raiz, '.git', 'hooks')`). En un worktree enlazado `.git` es un
// ARCHIVO que apunta a otro lado, y esa cuenta a mano arma una ruta que
// nunca existe. La misma formula tambien se rompia con un
// `core.hooksPath` absoluto, porque `join` concatena en vez de
// reemplazar. `directorioDeHooks` (scripts/directorio-de-hooks.ts) le
// pregunta a git en vez de adivinar.
//
// El canario deja la formula VIEJA escrita a mano, inline (no se importa
// nada de la version anterior: ya no existe como funcion propia), y prueba
// que coincide con la nueva en los dos casos donde coincidian por
// casualidad (por defecto, relativo) y que DIFIERE en los dos que el bug
// afectaba de verdad (absoluto, worktree). Ver "Todo gate falla en las dos
// direcciones" en CONTRIBUTING.md.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { directorioDeHooks } from '../scripts/directorio-de-hooks.ts';

// PORQUE: el propio hook de pre-commit corre esta suite (`node --test
// "evals/*.test.ts"`) y exporta GIT_INDEX_FILE y otras variables locales de
// git; heredarlas desviaria en silencio los repos temporales de aca hacia
// el repo real de writing-harness.
let nombresDeEntornoLocalCache: string[] | undefined;
function nombresDeEntornoLocal(): string[] {
  if (nombresDeEntornoLocalCache) return nombresDeEntornoLocalCache;
  const r = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
  nombresDeEntornoLocalCache = (r.stdout ?? '').split(/\r?\n/).filter(Boolean);
  return nombresDeEntornoLocalCache;
}

function git(cwd: string, args: string[], entorno: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, { cwd, env: entorno, encoding: 'utf8' });
}

/**
 * La formula VIEJA de `instalar-hook.ts`, inline: lee `core.hooksPath` a
 * mano y lo `join`ea contra `raiz`, o cae en `raiz/.git/hooks`. Nunca supo
 * de worktrees ni de rutas absolutas.
 */
function formulaVieja(raiz: string, entorno: NodeJS.ProcessEnv): string {
  let configurado = '';
  try {
    configurado = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: raiz,
      env: entorno,
      encoding: 'utf8',
    }).trim();
  } catch {
    configurado = '';
  }
  if (configurado) return join(raiz, configurado);
  return join(raiz, '.git', 'hooks');
}

let base: string;
let entorno: NodeJS.ProcessEnv;

before(() => {
  base = realpathSync.native(mkdtempSync(join(tmpdir(), 'hooks-')));
  const configGlobal = join(base, 'config-global');
  writeFileSync(
    configGlobal,
    '[user]\n\tname = Pruebas\n\temail = pruebas@local\n[init]\n\tdefaultBranch = main\n',
    'utf8',
  );
  entorno = { ...process.env };
  for (const nombre of nombresDeEntornoLocal()) delete entorno[nombre];
  entorno.GIT_CONFIG_NOSYSTEM = '1';
  entorno.GIT_CONFIG_GLOBAL = configGlobal;
});

after(() => {
  rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function repoNuevo(nombre: string): string {
  const ruta = join(base, nombre);
  mkdirSync(ruta, { recursive: true });
  git(ruta, ['init', '-b', 'main'], entorno);
  writeFileSync(join(ruta, 'a.txt'), 'x\n', 'utf8');
  git(ruta, ['add', 'a.txt'], entorno);
  git(ruta, ['commit', '-m', 'x'], entorno);
  return ruta;
}

describe('directorioDeHooks', () => {
  test('hooksPath por defecto: coincide con la formula vieja (caso comun, sin core.hooksPath)', () => {
    const repo = repoNuevo('por-defecto');
    assert.equal(directorioDeHooks(repo, entorno), formulaVieja(repo, entorno));
    assert.equal(directorioDeHooks(repo, entorno), join(repo, '.git', 'hooks'));
  });

  test('core.hooksPath relativo: coincide con la formula vieja (las dos lo resuelven igual)', () => {
    const repo = repoNuevo('relativo');
    git(repo, ['config', 'core.hooksPath', 'mis-hooks'], entorno);
    assert.equal(directorioDeHooks(repo, entorno), formulaVieja(repo, entorno));
    assert.equal(directorioDeHooks(repo, entorno), join(repo, 'mis-hooks'));
  });

  test('core.hooksPath absoluto: la formula vieja lo rompe (lo concatena en vez de reemplazarlo), la nueva no', () => {
    const repo = repoNuevo('absoluto');
    const ganchosAbsolutos = join(base, 'ganchos-fuera-del-repo');
    mkdirSync(ganchosAbsolutos, { recursive: true });
    git(repo, ['config', 'core.hooksPath', ganchosAbsolutos.replace(/\\/g, '/')], entorno);

    const nueva = directorioDeHooks(repo, entorno);
    const vieja = formulaVieja(repo, entorno);

    assert.equal(nueva, ganchosAbsolutos);
    assert.notEqual(nueva, vieja);
  });

  test('worktree enlazado: .git es un archivo, la formula vieja apunta a una ruta que no existe; la nueva resuelve el hooks compartido del checkout principal', () => {
    const principal = repoNuevo('principal-worktree');
    const worktree = join(base, 'wt-worktree');
    git(principal, ['worktree', 'add', worktree], entorno);

    assert.ok(statSync(join(worktree, '.git')).isFile(), '.git del worktree deberia ser un archivo, no una carpeta');

    const nueva = directorioDeHooks(worktree, entorno);
    const vieja = formulaVieja(worktree, entorno);

    assert.equal(nueva, join(principal, '.git', 'hooks'));
    assert.notEqual(nueva, vieja);
  });
});

describe('instalar-hook.ts ya no calcula la ruta a mano', () => {
  test('el instalador importa el resolvedor y ya no tiene el join(".git", "hooks") hardcodeado', () => {
    const fuente = readFileSync(join(import.meta.dirname, '..', 'scripts', 'instalar-hook.ts'), 'utf8');
    assert.match(fuente, /from ['"]\.\/directorio-de-hooks\.ts['"]/);
    assert.doesNotMatch(fuente, /'\.git',\s*'hooks'/);
  });
});
