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

export type OpcionesDeProceso = { cwd: string; env: NodeJS.ProcessEnv; limiteMs: number };

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

/** Lanza el comando sin shell, con los argumentos como lista, y espera a que termine o venza. */
export function correrProceso(comando: string, args: readonly string[], o: OpcionesDeProceso): Promise<Lanzamiento> {
  return new Promise((resolver) => {
    const inicio = Date.now();
    const salida: Buffer[] = [];
    const errores: Buffer[] = [];
    let vencido = false;
    let terminado = false;
    const terminar = (codigo: number | null) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
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
    const reloj = setTimeout(() => {
      vencido = true;
      matarArbol(hijo);
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
