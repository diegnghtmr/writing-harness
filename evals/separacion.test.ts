// La separación entre las skills y el verificador.
//
// Ninguna skill nombra al verificador, ni a Node, ni a este repositorio: una
// skill tiene que servir en una máquina donde este verificador no existe. Y
// nada de `src/` nombra el directorio de un anfitrión: el verificador tiene que
// servir sobre un texto escrito sin ninguna skill cargada.
//
// Esto vivía en el CI como dos `grep -r` y se trajo acá después de que uno
// disparara sobre la expresión «Tengo un precursor.», que contiene «cursor».
// Marcaba contenido legítimo, que es la manera más rápida de que un guardián
// deje de leerse. Es la misma disciplina que el repositorio aplica a las
// reglas, y la segunda vez que una comprobación del CI se corrige moviéndola a
// la suite; la primera fue la de la raya.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO_ROOT, SKILLS_DIR } from '../src/skills.ts';

function archivos(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return archivos(p, extension);
    return statSync(p).isFile() && p.endsWith(extension) ? [p] : [];
  });
}

const relativo = (p: string) => p.slice(REPO_ROOT.length).replace(/\\/gu, '/');

describe('las skills y el verificador no se nombran', () => {
  test('ninguna skill nombra al verificador', () => {
    // «node » con el espacio a propósito: una skill puede hablar del nodo de un
    // grafo o de un nodo narrativo sin estar invocando nada.
    const delatores = [/cli\.ts/u, /(?<!\p{L})node\s/iu, /--tono/u, /writing-harness/u];
    const hallazgos = archivos(SKILLS_DIR, '.md').flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return delatores.filter((d) => d.test(src)).map((d) => `${relativo(f)} :: ${d.source}`);
    });
    assert.deepEqual(hallazgos, []);
  });

  test('el verificador no nombra el directorio de ningún anfitrión', () => {
    // Con el punto delante, que es lo que se quería decir: el directorio
    // `.cursor`, no cualquier palabra que termine en «cursor». `copilot` va con
    // frontera de letra por la misma razón.
    const delatores = [/\.claude/u, /\.cursor/u, /(?<!\p{L})copilot(?!\p{L})/iu];
    const hallazgos = archivos(join(REPO_ROOT, 'src'), '.ts').flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return delatores.filter((d) => d.test(src)).map((d) => `${relativo(f)} :: ${d.source}`);
    });
    assert.deepEqual(hallazgos, []);
  });

  test('el guardián sigue disparando sobre lo que tiene que disparar', () => {
    // Una comprobación que se afina corre el riesgo de dejar de comprobar. Estos
    // dos casos prueban que sigue viva, y el tercero, que la afinación funcionó.
    const anfitrion = [/\.claude/u, /\.cursor/u, /(?<!\p{L})copilot(?!\p{L})/iu];
    const dispara = (texto: string) => anfitrion.some((d) => d.test(texto));
    assert.ok(dispara('leer desde .cursor/rules'));
    assert.ok(dispara('el plugin de Copilot'));
    assert.ok(!dispara('Tengo un precursor.'));
  });
});
