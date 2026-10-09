// Antes de correr, las skills instaladas tienen que ser las del repositorio.
//
// Cada agente lee su propia copia de las skills, no la del repositorio:
// Copilot la de `~/.agents/skills`, Grok la de `~/.grok/skills` y Antigravity
// la de `~/.gemini/config/skills`. Una serie corrida con una copia vieja prueba
// las skills de antes y publica el resultado como si fuera de las de ahora, y
// nada en el veredicto lo delata. Por eso, antes de lanzar un agente, cada
// archivo de cada skill del arnés se compara byte a byte con la copia de cada
// agente elegido. Si algo falta o difiere, la serie no corre. La prueba no
// sincroniza nada: esos directorios son del usuario.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import { AGENTES } from '../scripts/prueba-final/agentes.ts';
import { compararInstaladas, errorDeInstaladas, lineasDeInstaladas, skillsDelArnes } from '../scripts/prueba-final/instaladas.ts';
import { resolverEjecutable } from '../scripts/prueba-final/resolver.ts';
import { CUERPO, construirDocx } from './fixtures/prueba-final/docx.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-instaladas-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const ARCHIVOS: Record<string, string> = {
  'camus-writing/SKILL.md': '# camus\n',
  'camus-writing/references/ejemplos.md': 'ejemplos\n',
  'spanish-writing/SKILL.md': '# base\n',
};

let n = 0;
/** Un arnés con sus skills y un directorio instalado idéntico. */
function escenario() {
  const dir = join(raiz, `e-${++n}`);
  const arnes = join(dir, 'arnes');
  const instaladas = join(dir, 'instaladas');
  for (const [r, contenido] of Object.entries(ARCHIVOS)) {
    for (const base of [join(arnes, 'skills'), instaladas]) {
      mkdirSync(dirname(join(base, r)), { recursive: true });
      writeFileSync(join(base, r), contenido);
    }
  }
  return { dir, arnes, instaladas };
}

const SKILLS = Object.keys(ARCHIVOS);

describe('la comparación con las skills instaladas', () => {
  test('las del arnés salen de lo que git rastrea bajo skills/', () => {
    assert.deepEqual(skillsDelArnes(['README.md', 'skills/camus-writing/SKILL.md', 'src/cli.ts', 'skills/a/b/c.md']), [
      'a/b/c.md',
      'camus-writing/SKILL.md',
    ]);
  });

  test('iguales byte a byte: nada falta, nada difiere, nada sobra', () => {
    const e = escenario();
    const r = compararInstaladas(e.arnes, SKILLS, e.instaladas);
    assert.deepEqual([r.faltan, r.distintos, r.sobran], [[], [], []]);
    assert.match(r.huella, /^[0-9a-f]{64}$/u);
    assert.equal(errorDeInstaladas([{ agente: 'grok', comparacion: r }]), null);
  });

  test('un archivo con otros finales de línea es distinto', () => {
    const e = escenario();
    writeFileSync(join(e.instaladas, 'camus-writing', 'SKILL.md'), '# camus\r\n');
    const r = compararInstaladas(e.arnes, SKILLS, e.instaladas);
    assert.deepEqual(r.distintos, ['camus-writing/SKILL.md']);
    assert.notEqual(r.huella, compararInstaladas(e.arnes, SKILLS, join(escenario().instaladas)).huella);
  });

  test('lo que falta, una skill entera incluida, y lo que sobra dentro de una skill del arnés', () => {
    const e = escenario();
    rmSync(join(e.instaladas, 'camus-writing'), { recursive: true });
    writeFileSync(join(e.instaladas, 'spanish-writing', 'viejo.md'), 'de una versión anterior\n');
    mkdirSync(join(e.instaladas, 'otra-skill'), { recursive: true });
    writeFileSync(join(e.instaladas, 'otra-skill', 'SKILL.md'), 'no es del arnés\n');
    const r = compararInstaladas(e.arnes, SKILLS, e.instaladas);
    assert.deepEqual(r.faltan, ['camus-writing/SKILL.md', 'camus-writing/references/ejemplos.md']);
    assert.deepEqual(r.sobran, ['spanish-writing/viejo.md'], 'una skill que no es del arnés no se mira');
  });

  test('un directorio que no existe: falta todo', () => {
    const e = escenario();
    assert.deepEqual(compararInstaladas(e.arnes, SKILLS, join(e.dir, 'no-existe')).faltan, SKILLS);
  });

  test('una skill instalada como enlace se compara a través del enlace', () => {
    const e = escenario();
    const enlazadas = join(e.dir, 'enlazadas');
    mkdirSync(enlazadas, { recursive: true });
    for (const skill of ['camus-writing', 'spanish-writing']) symlinkSync(join(e.instaladas, skill), join(enlazadas, skill), 'junction');
    const r = compararInstaladas(e.arnes, SKILLS, enlazadas);
    assert.deepEqual([r.faltan, r.distintos, r.sobran], [[], [], []]);
    assert.equal(r.huella, compararInstaladas(e.arnes, SKILLS, e.instaladas).huella);
  });

  test('el error lista cada archivo por agente y pide sincronizar primero', () => {
    const e = escenario();
    writeFileSync(join(e.instaladas, 'spanish-writing', 'SKILL.md'), '# base vieja\n');
    const mal = compararInstaladas(e.arnes, SKILLS, e.instaladas);
    const bien = compararInstaladas(e.arnes, SKILLS, escenario().instaladas);
    const error = errorDeInstaladas([
      { agente: 'copilot', comparacion: bien },
      { agente: 'grok', comparacion: mal },
    ]);
    assert.ok(error !== null);
    assert.match(error, /grok/u);
    assert.match(error, /distinto: spanish-writing\/SKILL\.md/u);
    assert.doesNotMatch(error, /copilot/u);
    assert.match(error, /sincroniz/u);
    const lineas = lineasDeInstaladas([
      { agente: 'copilot', comparacion: bien },
      { agente: 'grok', comparacion: mal },
    ]).join('\n');
    assert.match(lineas, /copilot: .*iguales/u);
    assert.match(lineas, /grok: .*1 distinto/u);
  });
});

describe('dónde lee cada agente sus skills', () => {
  test('copilot, grok, agy y codex, cada uno en su directorio', () => {
    const home = join('home', 'prueba');
    assert.equal(AGENTES.copilot?.skills(home), join(home, '.agents', 'skills'));
    assert.equal(AGENTES.grok?.skills(home), join(home, '.grok', 'skills'));
    assert.equal(AGENTES.agy?.skills(home), join(home, '.gemini', 'config', 'skills'));
    // Codex lee las skills del usuario del mismo directorio que Copilot.
    assert.equal(AGENTES.codex?.skills(home), join(home, '.agents', 'skills'));
  });
});

describe('el comando, antes de correr', () => {
  const comando = join(REPO_ROOT, 'scripts', 'prueba-final.ts');

  /** Un home vacío, sin ninguna skill instalada, y una carpeta con base.docx. */
  function sinInstalar() {
    const dir = join(raiz, `cli-${++n}`);
    const home = join(dir, 'home');
    const carpeta = join(dir, 'mix', 'test-final');
    mkdirSync(home, { recursive: true });
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(join(carpeta, 'base.docx'), construirDocx(CUERPO));
    return { home, carpeta };
  }

  /**
   * El entorno del comando con otro home. El PATH queda reducido a la carpeta
   * de git: si la verificación previa dejara pasar algo, el comando no
   * encontraría ningún agente que lanzar.
   */
  function entorno(home: string): NodeJS.ProcessEnv {
    const git = resolverEjecutable('git', {
      ruta: process.env.PATH ?? process.env.Path ?? '',
      plataforma: process.platform,
      existe: (p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      },
      leer: (p) => readFileSync(p, 'utf8'),
      node: process.execPath,
    });
    assert.ok(git !== null, 'git no está en el PATH');
    const carpetaDeGit = dirname(git.comando);
    for (const agente of ['copilot', 'grok', 'agy', 'codex']) {
      assert.ok(!readdirSync(carpetaDeGit).some((f) => f.toLowerCase().startsWith(`${agente}.`) || f === agente), `${agente} está junto a git`);
    }
    const env: NodeJS.ProcessEnv = {};
    for (const [k, v] of Object.entries(process.env)) if (!/^(?:path|home|userprofile)$/iu.test(k)) env[k] = v;
    return { ...env, PATH: carpetaDeGit, HOME: home, USERPROFILE: home };
  }

  const correr = (home: string, ...args: string[]) => spawnSync(process.execPath, [comando, ...args], { encoding: 'utf8', env: entorno(home) });

  test('con las skills sin instalar, no corre: sale con 2 y lista lo que falta', () => {
    const e = sinInstalar();
    const r = correr(e.home, '--dir', e.carpeta, '--agentes', 'copilot', '--variantes', 'base');
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stderr, /copilot/u);
    assert.match(r.stderr, /falta: spanish-writing\/SKILL\.md/u);
    assert.match(r.stderr, /sincroniz/u);
    assert.deepEqual(readdirSync(e.carpeta), ['base.docx']);
  });

  test('--simular informa la misma comparación, sin fallar', () => {
    const e = sinInstalar();
    const r = correr(e.home, '--dir', e.carpeta, '--simular');
    assert.equal(r.status, 0, r.stderr);
    for (const agente of ['copilot', 'grok', 'agy']) assert.match(r.stdout, new RegExp(`^ {2}${agente}: .*faltan \\d+`, 'mu'), agente);
    assert.deepEqual(readdirSync(e.carpeta), ['base.docx']);
  });
});
