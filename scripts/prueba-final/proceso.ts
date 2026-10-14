// Un proceso con límite de tiempo, que al vencer se lleva el árbol entero.
//
// Un agente lanza sus propios procesos: un shell por cada comando, un servidor
// de lenguaje, a veces un subagente. Matar solo al primero deja vivos a los
// demás, y uno que tenga abierta la salida estándar impide que la corrida
// termine. En Windows se usa `taskkill /T /F`, que baja por el árbol; en el
// resto, el proceso arranca como líder de su grupo y se mata el grupo.
//
// El vencimiento se informa como tal, no como un fallo del agente: un agente que
// tarda más que el límite y uno que se cae son dos cosas distintas en el
// resumen.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

export type Lanzamiento = {
  stdout: string;
  stderr: string;
  /** El código de salida, o null si el proceso no llegó a terminar por sí solo. */
  codigo: number | null;
  vencido: boolean;
  duracionMs: number;
};

export type OpcionesDeProceso = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  limiteMs: number;
  /** Cuánto se espera el cierre de las tuberías después de matar el árbol. Ver `correrProceso`. */
  graciaMs?: number;
};

/** El plazo de gracia por defecto: sobra para que cierre un árbol que se mató entero. */
export const GRACIA_MS = 10_000;

/** Los procesos lanzados que todavía no cerraron. */
const vivos = new Set<ChildProcess>();

/**
 * Mata el árbol de cada proceso lanzado que sigue vivo. Es para cuando la
 * serie termina por una señal: sin esto, un agente seguiría corriendo después
 * de ella, con su hogar borrado debajo (ver `reales.ts`).
 */
export function matarVivos(): void {
  for (const hijo of vivos) matarArbol(hijo);
}

export function matarArbol(hijo: ChildProcess): void {
  if (hijo.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/T', '/F', '/PID', String(hijo.pid)], { windowsHide: true });
    return;
  }
  try {
    process.kill(-hijo.pid, 'SIGKILL');
  } catch {
    hijo.kill('SIGKILL');
  }
}

/**
 * Lanza el comando sin shell, con los argumentos como lista, y espera a que
 * termine o venza.
 *
 * Al vencer, matar el árbol no alcanza para cerrar la corrida: el proceso se
 * da por terminado cuando se cierran sus tuberías, y un descendiente que no
 * cuelga del árbol, porque se desprendió o porque su padre ya había salido,
 * las hereda y las retiene. Por eso hay un plazo de gracia después de matar:
 * si las tuberías no se cerraron, se cierran desde este lado y la corrida
 * termina vencida con lo que se alcanzó a leer.
 */
export function correrProceso(comando: string, args: readonly string[], o: OpcionesDeProceso): Promise<Lanzamiento> {
  return new Promise((resolver) => {
    const inicio = Date.now();
    const salida: Buffer[] = [];
    const errores: Buffer[] = [];
    let vencido = false;
    let terminado = false;
    let gracia: NodeJS.Timeout | undefined;
    const terminar = (codigo: number | null) => {
      if (terminado) return;
      terminado = true;
      vivos.delete(hijo);
      clearTimeout(reloj);
      clearTimeout(gracia);
      resolver({
        stdout: Buffer.concat(salida).toString('utf8'),
        stderr: Buffer.concat(errores).toString('utf8'),
        codigo: vencido ? null : codigo,
        vencido,
        duracionMs: Date.now() - inicio,
      });
    };
    let hijo: ChildProcess;
    try {
      hijo = spawn(comando, [...args], {
        cwd: o.cwd,
        env: o.env,
        // Sin entrada: un agente que espera algo por la entrada estándar
        // quedaría colgado hasta el límite.
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        detached: process.platform !== 'win32',
      });
    } catch (e) {
      // Un ejecutable que no se puede lanzar es una corrida fallida, no una
      // serie que se cae.
      resolver({ stdout: '', stderr: String(e), codigo: null, vencido: false, duracionMs: Date.now() - inicio });
      return;
    }
    vivos.add(hijo);
    const reloj = setTimeout(() => {
      vencido = true;
      matarArbol(hijo);
      gracia = setTimeout(() => {
        hijo.stdout?.destroy();
        hijo.stderr?.destroy();
        terminar(null);
      }, o.graciaMs ?? GRACIA_MS);
    }, o.limiteMs);
    hijo.stdout?.on('data', (b: Buffer) => salida.push(b));
    hijo.stderr?.on('data', (b: Buffer) => errores.push(b));
    hijo.on('error', (e) => {
      errores.push(Buffer.from(`${e.message}\n`));
      terminar(null);
    });
    hijo.on('close', (codigo) => terminar(codigo));
  });
}
