// Las piezas de la prueba de verdad: los agentes instalados, el verificador del
// arnés y git. La suite las reemplaza por dobles; esto es lo que corre cuando
// se llama al comando.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { constants } from 'node:os';
import { join } from 'node:path';
import { REPO_ROOT } from '../../src/skills.ts';
import type { DefinicionDeAgente } from './agentes.ts';
import type { Agente } from './ejecutor.ts';
import { correrProceso, matarVivos } from './proceso.ts';
import type { Ejecutable } from './resolver.ts';
import { rutasCambiadas, type EstadoDelArnes } from './traza.ts';

/**
 * El entorno de una corrida: el del usuario, con su propio proyecto de Engram.
 *
 * Grok y Antigravity cargan las instrucciones globales del usuario, y esas
 * instrucciones mandan a guardar y a buscar memorias. El proyecto sale de
 * `proyectoDeEngram`, uno por corrida: ver el porqué ahí.
 */
export const entornoDeLaCorrida = (proyecto: string): NodeJS.ProcessEnv => ({ ...process.env, ENGRAM_PROJECT: proyecto });

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

/** Lo preparado por todos los agentes que todavía no se deshizo. */
const pendientes = new Set<() => void>();

/** Deshace todo lo pendiente. Uno que falla no frena a los demás. */
function deshacerPendientes(): void {
  for (const limpiar of [...pendientes]) {
    pendientes.delete(limpiar);
    try {
      limpiar();
    } catch {
      // Lo que quedó lo barre la serie siguiente (ver `DefinicionDeAgente.barrer`).
    }
  }
}

/**
 * Las señales que terminan la serie. SIGINT es Ctrl+C; SIGBREAK, Ctrl+Pausa en
 * Windows; SIGHUP, cerrar la ventana de la consola.
 */
const SENALES = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK'] as const;
type Senal = (typeof SENALES)[number];

/**
 * Lo que hace la serie al recibir una señal que la termina: mata los procesos
 * de las corridas que siguen vivos, deshace lo que prepararon y devuelve el
 * código de salida de costumbre, 128 más el número de la señal.
 *
 * Con un manejador, la señal deja de terminar el proceso por sí sola: lo
 * termina quien lo instala, con este código.
 */
export function alRecibirSenal(senal: Senal): number {
  matarVivos();
  deshacerPendientes();
  return 128 + constants.signals[senal];
}

let alSalir = false;
/** Deshace lo pendiente al salir el proceso o al recibir una señal. Se instala una vez, con la primera preparación. */
function deshacerAlTerminar(): void {
  if (alSalir) return;
  alSalir = true;
  process.once('exit', deshacerPendientes);
  for (const senal of SENALES) process.once(senal, () => process.exit(alRecibirSenal(senal)));
}

/**
 * Un agente instalado: lanza su CLI, copia su transcripción y la lee.
 *
 * Lo que el agente prepara antes de lanzar, como el CODEX_HOME de codex, se
 * deshace al recoger, después de copiar la transcripción y aunque leerla falle.
 * Si la corrida no llega a recogerse, se deshace al salir el proceso o al
 * recibir una señal que lo termina: es lo que promete `preparar`, y vale para
 * cualquier agente. Lo que ni eso alcanza a deshacer, un proceso matado en
 * seco, lo borra `barrer` al empezar la serie siguiente.
 */
export function agenteReal(def: DefinicionDeAgente, e: Ejecutable, o: { home: string; version: string | null }): Agente {
  const preparados = new Map<string, () => void>();
  const deshacer = (sesion: string) => {
    const limpiar = preparados.get(sesion);
    preparados.delete(sesion);
    if (limpiar === undefined) return;
    pendientes.delete(limpiar);
    limpiar();
  };
  return {
    id: def.id,
    lanzar: (ctx) => {
      deshacer(ctx.sesion);
      const preparado = def.preparar?.(o.home, ctx);
      if (preparado !== undefined) {
        // Una sola vez, la deshaga quien la deshaga primero.
        let hecho = false;
        const limpiar = () => {
          if (hecho) return;
          hecho = true;
          preparado();
        };
        preparados.set(ctx.sesion, limpiar);
        pendientes.add(limpiar);
        deshacerAlTerminar();
      }
      return correrProceso(e.comando, [...e.prefijo, ...def.argumentos(ctx)], {
        cwd: ctx.cwd,
        env: { ...entornoDeLaCorrida(ctx.engram), ...def.variables?.(o.home, ctx) },
        limiteMs: ctx.limiteMin * 60_000,
      });
    },
    recoger: (ctx, l) => {
      try {
        const origen = def.transcripcion(o.home, ctx, l.stdout);
        let transcripcion: string | null = null;
        if (origen !== null && existsSync(origen)) {
          copyFileSync(origen, join(ctx.staging, 'transcripcion.jsonl'));
          transcripcion = readFileSync(origen, 'utf8');
        }
        const t = def.parsear(l.stdout, transcripcion, leerSiHay(def.log(ctx)), l.stderr);
        t.version ??= o.version;
        return t;
      } finally {
        deshacer(ctx.sesion);
      }
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

/**
 * Las variables con que git elige el repositorio por encima de `-C`. Es el
 * piso: se suman las que git declara con `git rev-parse --local-env-vars`,
 * como hace `evals/directorio-de-hooks.test.ts` con el mismo peligro.
 */
const VARIABLES_DE_REPOSITORIO = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
  'GIT_NAMESPACE',
];

/**
 * El entorno con que se llama a git: el del proceso, sin las variables que
 * eligen el repositorio.
 *
 * Dentro de un hook, git exporta `GIT_DIR` y `GIT_INDEX_FILE`, y con ellas
 * `-C <raíz>` deja de decidir a qué repositorio se habla. Ya pasó: la suite,
 * corrida desde el gate de pre-commit de un worktree, armó un repositorio
 * temporal con `git init` y reinicializó como desnudo el repositorio del hook,
 * y su `git add` agregó archivos al índice del worktree. Sin esas variables,
 * cada llamada habla con la raíz que nombra.
 */
export function entornoDeGit(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const locales = variablesLocales();
  return Object.fromEntries(Object.entries(env).filter(([k]) => !locales.includes(k.toUpperCase())));
}

let locales: string[] | undefined;
/** Las variables locales al repositorio: las del piso y las que git declara, leídas una vez. */
function variablesLocales(): string[] {
  if (locales === undefined) {
    const r = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8', windowsHide: true });
    const deGit = r.status === 0 ? r.stdout.split(/\r?\n/u).filter(Boolean) : [];
    locales = [...new Set([...VARIABLES_DE_REPOSITORIO, ...deGit])];
  }
  return locales;
}

/** git en una raíz dada, con la salida como texto. */
const git = (raiz: string, args: readonly string[]) =>
  spawnSync('git', ['-C', raiz, ...args], { encoding: 'utf8', windowsHide: true, env: entornoDeGit() });

export function estadoGit(raiz: string): string | null {
  const r = git(raiz, ['status', '--porcelain']);
  return r.status === 0 ? r.stdout : null;
}

/** Lo que git rastrea en un repositorio, relativo a su raíz, o null si git no respondió. */
export function archivosRastreados(raiz: string): string[] | null {
  const r = git(raiz, ['ls-files', '-z']);
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null;
}

/** Una salida de git separada por NUL, o null si git no respondió. Con NUL, una ruta con eñe o tilde sale tal cual. */
function listaDeGit(raiz: string, args: readonly string[]): string[] | null {
  const r = git(raiz, args);
  return r.status === 0 ? r.stdout.split('\0').filter(Boolean) : null;
}

/**
 * Las rutas que hoy difieren de un commit: lo que cambió en commits
 * posteriores, lo que cambió sin commit y los archivos nuevos que git no
 * ignora. Sin detectar renombres, para que salgan la ruta vieja y la nueva.
 */
function rutasDistintas(raiz: string, commit: string): string[] | null {
  const cambiadas = listaDeGit(raiz, ['diff', '--name-only', '--no-renames', '-z', commit, '--']);
  const nuevas = listaDeGit(raiz, ['ls-files', '--others', '--exclude-standard', '-z']);
  return cambiadas === null || nuevas === null ? null : [...new Set([...cambiadas, ...nuevas])].sort();
}

/** El commit completo de una referencia, o null si git no la reconoce. */
export function commitDe(raiz: string, ref: string): string | null {
  const r = git(raiz, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return r.status === 0 ? r.stdout.trim() : null;
}

/** La huella de un archivo del repositorio, o null si ya no está. */
const huellaEn = (raiz: string, ruta: string): string | null => {
  try {
    return createHash('sha256').update(readFileSync(join(raiz, ...ruta.split('/')))).digest('hex');
  } catch {
    return null;
  }
};

/** El arnés al empezar una serie: HEAD y la huella de lo que difiere de él. */
export function estadoDelArnes(raiz: string): EstadoDelArnes {
  const commit = commitDe(raiz, 'HEAD');
  const distintas = commit === null ? null : rutasDistintas(raiz, commit);
  const sucios: Record<string, string | null> = {};
  for (const r of distintas ?? []) sucios[r] = huellaEn(raiz, r);
  return { commit, sucio: (distintas ?? []).length > 0, sucios };
}

/** Las rutas del arnés que cambiaron desde un estado anotado, o null si git no reconoce su commit. */
export function cambiosDesde(raiz: string, arnes: EstadoDelArnes): string[] | null {
  if (arnes.commit === null || commitDe(raiz, arnes.commit) === null) return null;
  const distintas = rutasDistintas(raiz, arnes.commit);
  return distintas === null ? null : rutasCambiadas(distintas, arnes.sucios, (r) => huellaEn(raiz, r));
}
