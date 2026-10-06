// La copia de trabajo de cada corrida de la prueba final.
//
// En la primera corrida de humo, un agente buscó en el ejecutor cómo se
// comprueban los hechos, leyó el módulo de las anclas, lo importó y revisó con
// él su propia salida antes de entregarla. Su «pasa» ya no medía las skills:
// medía que el agente había encontrado el oráculo. Desde entonces cada corrida
// trabaja en una copia con las instrucciones de mix y lo que git rastrea del
// arnés, sin el código de la prueba. Lo que se prueba acá es que la copia lleve
// lo que un agente necesita para usar el arnés y nada de lo que lo juzga, y que
// la huella de cada archivo diga después qué tocó.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { after, describe, test } from 'node:test';
import {
  ARNES_EN_LA_COPIA,
  EXCLUIDOS,
  MARCADOR_DE_OPEN_SLIDE,
  cambiosDeLaCopia,
  construirCopia,
  esCodigoDeLaPrueba,
  excluido,
  huellaDeLaCopia,
  huellasDe,
  planDeLaCopia,
} from '../scripts/prueba-final/copia.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-copia-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const escribir = (ruta: string, contenido: string) => {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
};

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
/**
 * Un mix de mentira: sus instrucciones, lo que no se copia, y un arnés con lo
 * que git rastrea, lo que no rastrea y el código de la prueba.
 */
function mixDePrueba() {
  serie++;
  const mix = join(raiz, `mix-${serie}`);
  const arnes = join(mix, 'writing-harness');
  escribir(join(mix, 'AGENTS.md'), '# mix\n');
  escribir(join(mix, 'CLAUDE.md'), 'Ver AGENTS.md.\n');
  escribir(join(mix, 'package.json'), '{}\n');
  const rastreados: Record<string, string> = {
    'AGENTS.md': '# arnés\n',
    'src/cli.ts': 'export {};\n',
    'skills/camus-writing/SKILL.md': '# camus\n',
    'evals/docs.test.ts': '// docs\n',
    'evals/fixtures/otra/g.txt': 'g\n',
    'scripts/instalar.ts': '// instalar\n',
    'scripts/prueba-final.ts': '// el comando\n',
    'scripts/prueba-final/anclas.ts': '// las anclas\n',
    'evals/prueba-final-ejecutor.test.ts': '// la prueba del ejecutor\n',
    'evals/fixtures/prueba-final/grok-stdout.jsonl': '{}\n',
    'odd/notas.md': 'notas\n',
  };
  for (const [r, c] of Object.entries(rastreados)) escribir(join(arnes, r), c);
  escribir(join(arnes, 'sin-rastrear.md'), 'no está en git\n');
  escribir(join(arnes, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  escribir(join(arnes, 'node_modules', 'x', 'index.js'), '');
  escribir(join(arnes, 'odd', 'tasks', 'local.md'), 'excluido por git\n');
  return { mix, arnes, rastreados: [...Object.keys(rastreados), 'borrado.md'] };
}

const COPIADOS = [
  'AGENTS.md',
  'CLAUDE.md',
  'open-slide/README.md',
  'writing-harness/AGENTS.md',
  'writing-harness/evals/docs.test.ts',
  'writing-harness/evals/fixtures/otra/g.txt',
  'writing-harness/scripts/instalar.ts',
  'writing-harness/skills/camus-writing/SKILL.md',
  'writing-harness/src/cli.ts',
];

describe('lo que queda fuera de la copia', () => {
  test('el comando, su carpeta, sus pruebas, sus fixtures y odd/', () => {
    for (const r of [
      'scripts/prueba-final.ts',
      'scripts/prueba-final/anclas.ts',
      'scripts/prueba-final/copia.ts',
      'evals/prueba-final-ejecutor.test.ts',
      'evals/prueba-final-copia.test.ts',
      'evals/fixtures/prueba-final/docx.ts',
      'odd/tasks/prueba-final-agentes.md',
    ]) {
      assert.ok(excluido(r), r);
    }
  });

  test('el resto del arnés entra, incluidos los vecinos de nombre parecido', () => {
    for (const r of ['src/cli.ts', 'AGENTS.md', 'CONTRIBUTING.md', 'scripts/instalar.ts', 'scripts/prueba-finalista.ts', 'src/odd/x.ts', 'evals/fixtures/otra/g.txt']) {
      assert.equal(excluido(r), false, r);
    }
  });

  test('los patrones son los del encargo, escritos una sola vez', () => {
    assert.deepEqual(EXCLUIDOS, [
      'scripts/prueba-final.ts',
      'scripts/prueba-final/**',
      'evals/prueba-final*',
      'evals/fixtures/prueba-final/**',
      'odd/**',
    ]);
  });
});

describe('el código de la prueba en cualquier forma de ruta', () => {
  test('relativa, absoluta, con barras de cualquier lado o dobles, y la carpeta sola', () => {
    for (const r of [
      'writing-harness/scripts/prueba-final/anclas.ts',
      './writing-harness/scripts/prueba-final/anclas.ts',
      'C:\\Users\\p\\mix\\writing-harness\\scripts\\prueba-final\\comprobaciones.ts',
      'C:\\\\Users\\\\p\\\\mix\\\\writing-harness\\\\scripts\\\\prueba-final.ts',
      'c:/users/p/mix/writing-harness/evals/prueba-final-ejecutor.test.ts',
      '/home/p/writing-harness/evals/fixtures/prueba-final/grok-stdout.jsonl',
      // Así buscó Grok: la carpeta entera, sin archivo.
      'C:\\Users\\p\\mix\\writing-harness\\scripts\\prueba-final',
      'writing-harness/odd/tasks/x.md',
      'odd/',
    ]) {
      assert.ok(esCodigoDeLaPrueba(r), r);
    }
  });

  test('lo demás no, y una palabra suelta tampoco', () => {
    for (const r of [
      'writing-harness/src/cli.ts',
      'C:\\x\\writing-harness\\scripts\\instalar.ts',
      'scripts/prueba-finalista.ts',
      'evals/docs.test.ts',
      'odd',
      'methodd/x.md',
    ]) {
      assert.equal(esCodigoDeLaPrueba(r), false, r);
    }
  });
});

describe('el plan de la copia', () => {
  const m = mixDePrueba();
  const plan = planDeLaCopia({ mix: m.mix, arnes: m.arnes, rastreados: m.rastreados });

  test('lleva las instrucciones de mix, el marcador de open-slide y lo rastreado del arnés', () => {
    assert.deepEqual(plan.archivos.map((a) => a.ruta).sort(), COPIADOS);
    assert.deepEqual(plan.deMix, ['AGENTS.md', 'CLAUDE.md']);
    assert.equal(plan.delArnes, COPIADOS.filter((r) => r.startsWith(`${ARNES_EN_LA_COPIA}/`)).length);
  });

  test('dice qué dejó fuera y qué no encontró', () => {
    assert.deepEqual(plan.excluidos, [
      'evals/fixtures/prueba-final/grok-stdout.jsonl',
      'evals/prueba-final-ejecutor.test.ts',
      'odd/notas.md',
      'scripts/prueba-final.ts',
      'scripts/prueba-final/anclas.ts',
    ]);
    assert.deepEqual(plan.faltan, ['writing-harness/borrado.md']);
  });

  test('sin AGENTS.md en mix, lo anota como faltante y sigue', () => {
    const otro = mixDePrueba();
    rmSync(join(otro.mix, 'AGENTS.md'));
    const p = planDeLaCopia({ mix: otro.mix, arnes: otro.arnes, rastreados: otro.rastreados });
    assert.deepEqual(p.deMix, ['CLAUDE.md']);
    assert.ok(p.faltan.includes('AGENTS.md'));
  });
});

describe('la copia en disco', () => {
  const m = mixDePrueba();
  const plan = planDeLaCopia({ mix: m.mix, arnes: m.arnes, rastreados: m.rastreados });
  const destino = join(raiz, 'copia-a', 'mix');
  const huellas = construirCopia(plan, destino);

  test('tiene exactamente lo del plan: sin .git, sin node_modules y sin lo que git no rastrea', () => {
    assert.deepEqual(archivosDe(destino), COPIADOS);
    assert.equal(readFileSync(join(destino, 'writing-harness', 'src', 'cli.ts'), 'utf8'), 'export {};\n');
    assert.equal(readFileSync(join(destino, 'AGENTS.md'), 'utf8'), '# mix\n');
  });

  test('writing-harness/ y open-slide/ no quedan vacías, así que nadie corre npm run worktree', () => {
    // El prefacio de mix manda a poblarlas si están vacías. En la copia no hay
    // package.json ni scripts de mix, y ese comando no tendría dónde correr.
    for (const carpeta of ['writing-harness', 'open-slide']) {
      assert.ok(readdirSync(join(destino, carpeta)).length > 0, carpeta);
    }
    assert.equal(readFileSync(join(destino, MARCADOR_DE_OPEN_SLIDE.ruta), 'utf8'), MARCADOR_DE_OPEN_SLIDE.contenido);
    assert.doesNotMatch(MARCADOR_DE_OPEN_SLIDE.contenido, /prueba|copia|test|agente falso/iu, 'el marcador no dice que es una prueba');
  });

  test('las huellas que devuelve son las del disco', () => {
    assert.deepEqual(huellas, huellasDe(destino));
    assert.equal(Object.keys(huellas).length, COPIADOS.length);
  });

  test('la huella de la copia es la misma con el mismo contenido, y cambia con un byte', () => {
    const otra = join(raiz, 'copia-b', 'mix');
    const h = construirCopia(plan, otra);
    assert.match(huellaDeLaCopia(h), /^[0-9a-f]{64}$/u);
    assert.equal(huellaDeLaCopia(h), huellaDeLaCopia(huellas));
    writeFileSync(join(otra, 'CLAUDE.md'), 'Ver AGENTS.md!\n');
    assert.notEqual(huellaDeLaCopia(huellasDe(otra)), huellaDeLaCopia(huellas));
  });

  test('lo que cambió: modificado, borrado y nuevo, cada uno con su ruta', () => {
    const otra = join(raiz, 'copia-c', 'mix');
    const antes = construirCopia(plan, otra);
    writeFileSync(join(otra, 'writing-harness', 'src', 'cli.ts'), 'otra cosa\n');
    rmSync(join(otra, 'CLAUDE.md'));
    escribir(join(otra, 'notas', 'borrador.md'), 'nuevo\n');
    assert.ok(statSync(join(otra, 'AGENTS.md')).isFile());
    assert.deepEqual(cambiosDeLaCopia(antes, huellasDe(otra)), {
      modificados: ['writing-harness/src/cli.ts'],
      borrados: ['CLAUDE.md'],
      nuevos: ['notas/borrador.md'],
    });
    assert.deepEqual(cambiosDeLaCopia(antes, antes), { modificados: [], borrados: [], nuevos: [] });
  });
});
