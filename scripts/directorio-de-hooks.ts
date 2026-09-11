// Resuelve el directorio de hooks de git sin asumir que `.git` es siempre
// una carpeta.
//
// `join(raiz, '.git', 'hooks')` (la formula vieja de `instalar-hook.ts`)
// funciona en un clon comun, pero en un worktree enlazado o en un checkout
// con `--separate-git-dir` `.git` es un ARCHIVO que apunta a otro lado: ese
// join arma una ruta que nunca existe, y un hook instalado ahi es peor que
// no tener hook, porque da la sensacion de estar cubierto. La misma formula
// vieja tambien se rompe con un `core.hooksPath` absoluto: `join` concatena
// las dos rutas en vez de reemplazar la primera.
//
// `git rev-parse --git-path hooks` ya resuelve las cuatro combinaciones
// (por defecto, relativo, absoluto, worktree): relativo por defecto,
// absoluto si `core.hooksPath` esta asi configurado, y siempre contra el
// gitdir real, sin importar si `.git` es carpeta o archivo.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Devuelve el directorio de hooks del repositorio git que contiene `raiz`.
 * Lanza si `raiz` no esta dentro de un repositorio git legible.
 */
export function directorioDeHooks(raiz: string, entorno: NodeJS.ProcessEnv = process.env): string {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: raiz,
    env: entorno,
    encoding: 'utf8',
  }).trim();
  const rutaHooks = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
    cwd: top,
    env: entorno,
    encoding: 'utf8',
  }).trim();
  // `resolve` (a diferencia de `join`) descarta `top` en cuanto `rutaHooks`
  // ya es absoluta: eso es lo que arregla el caso de `core.hooksPath`
  // absoluto que `join` rompia.
  return resolve(top, rutaHooks);
}
