// Qué se lanza, de verdad, cuando se pide un agente por su nombre.
//
// En Windows, una CLI instalada con npm es un `.cmd` que llama a node. Node se
// niega a lanzar un `.cmd` sin shell, y con shell el prompt pasa por el
// intérprete de cmd, que parte en pedazos un texto largo en español con
// comillas. Así que se lanza lo que el `.cmd` lanzaría: node con el script que
// nombra. Un `.exe` se lanza directo. Nunca se arma una línea de shell.

import { posix, win32 } from 'node:path';

export type Ejecutable = { comando: string; prefijo: string[] };

export type Entorno = {
  /** El PATH. */
  ruta: string;
  plataforma: NodeJS.Platform;
  existe(p: string): boolean;
  leer(p: string): string;
  /** El node con que se lanza un shim de npm: el mismo que corre la prueba. */
  node: string;
};

// La línea que lanza el script en el shim que escribe npm:
// "%_prog%"  "%dp0%\node_modules\@github\copilot\npm-loader.js" %*
const SCRIPT_DEL_SHIM = /"%dp0%\\?([^"%]+?\.[cm]?js)"/iu;

export function resolverEjecutable(nombre: string, e: Entorno): Ejecutable | null {
  const windows = e.plataforma === 'win32';
  const ruta = windows ? win32 : posix;
  const directorios = e.ruta
    .split(windows ? ';' : ':')
    .map((d) => d.trim().replace(/^"|"$/gu, ''))
    .filter(Boolean);
  for (const dir of directorios) {
    if (!windows) {
      const binario = ruta.join(dir, nombre);
      if (e.existe(binario)) return { comando: binario, prefijo: [] };
      continue;
    }
    const exe = ruta.join(dir, `${nombre}.exe`);
    if (e.existe(exe)) return { comando: exe, prefijo: [] };
    const cmd = ruta.join(dir, `${nombre}.cmd`);
    if (e.existe(cmd)) {
      const m = SCRIPT_DEL_SHIM.exec(e.leer(cmd));
      if (m) return { comando: e.node, prefijo: [ruta.join(dir, m[1] as string)] };
    }
  }
  return null;
}
