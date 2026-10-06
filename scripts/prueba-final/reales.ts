// Las piezas de la prueba de verdad: los agentes instalados, el verificador del
// arnés y git. La suite las reemplaza por dobles; esto es lo que corre cuando
// se llama al comando.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../../src/skills.ts';
import type { DefinicionDeAgente } from './agentes.ts';
import type { Agente } from './ejecutor.ts';
import { correrProceso } from './proceso.ts';
import type { Ejecutable } from './resolver.ts';

/**
 * El proyecto de Engram de las corridas.
 *
 * Grok y Antigravity cargan las instrucciones globales del usuario, y esas
 * instrucciones mandan a guardar memorias. Sin esto, cada corrida escribía en el
 * proyecto real del usuario.
 */
export const PROYECTO_DE_ENGRAM = 'prueba-final';

export const entornoDeLasCorridas = (): NodeJS.ProcessEnv => ({ ...process.env, ENGRAM_PROJECT: PROYECTO_DE_ENGRAM });

/** La primera línea que imprime un CLI con sus argumentos de versión, o null. */
export function versionPorArgumentos(e: Ejecutable, args: readonly string[]): string | null {
  const r = spawnSync(e.comando, [...e.prefijo, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return `${r.stdout ?? ''}`.split(/\r?\n/u).find((l) => l.trim() !== '')?.trim() ?? null;
}

const leerSiHay = (ruta: string | null): string | null => (ruta !== null && existsSync(ruta) ? readFileSync(ruta, 'utf8') : null);

/** Un agente instalado: lanza su CLI, copia su transcripción y la lee. */
export function agenteReal(def: DefinicionDeAgente, e: Ejecutable, o: { home: string; version: string | null }): Agente {
  const env = entornoDeLasCorridas();
  return {
    id: def.id,
    lanzar: (ctx) =>
      correrProceso(e.comando, [...e.prefijo, ...def.argumentos(ctx)], {
        cwd: ctx.cwd,
        env,
        limiteMs: ctx.limiteMin * 60_000,
      }),
    recoger: (ctx, l) => {
      const origen = def.transcripcion(o.home, ctx, l.stdout);
      let transcripcion: string | null = null;
      if (origen !== null && existsSync(origen)) {
        copyFileSync(origen, join(ctx.staging, 'transcripcion.jsonl'));
        transcripcion = readFileSync(origen, 'utf8');
      }
      const t = def.parsear(l.stdout, transcripcion, leerSiHay(def.log(ctx)));
      t.version ??= o.version;
      return t;
    },
    estadoPropio: (ctx, t) => def.estadoPropio(o.home, ctx, t.sesion),
  };
}

/**
 * El verificador del arnés real, como lo correría una persona: node con el
 * archivo y las opciones. No el de la copia, que el agente pudo tocar.
 */
export function verificarConElArnes(archivo: string, banderas: readonly string[]): { codigo: number | null; salida: string } {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'src', 'cli.ts'), archivo, ...banderas], { encoding: 'utf8' });
  return { codigo: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

export function estadoGit(raiz: string): string | null {
  const r = spawnSync('git', ['-C', raiz, 'status', '--porcelain'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? r.stdout : null;
}

/** Lo que git rastrea en un repositorio, relativo a su raíz, o null si git no respondió. */
export function archivosRastreados(raiz: string): string[] | null {
  const r = spawnSync('git', ['-C', raiz, 'ls-files', '-z'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null;
}
