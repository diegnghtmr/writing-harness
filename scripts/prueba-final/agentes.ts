// Los agentes: cómo se los llama y cómo se lee lo que dejan.
//
// Todo lo que está acá salió del sondeo de cada CLI, con una sesión real de
// cada una, y no de su documentación. Los formatos son estos:
//
// - Copilot escribe JSONL en la salida estándar. La respuesta es el mensaje con
//   `phase: "final_answer"`, cada herramienta abre con `tool.execution_start` y
//   el código de un comando llega en `tool.execution_complete`. El registro de
//   la sesión, en `~/.copilot/session-state/<id>/events.jsonl`, trae además
//   `skill.invoked` y la versión; el id lo fija el ejecutor.
// - Grok escribe NDJSON con la forma de la API de Mensajes de Anthropic: bloques
//   `tool_use` y `tool_result`, y una línea final `result` con la respuesta, el
//   costo y la duración. El resultado de un comando es un JSON dentro de una
//   cadena, con `exit_code`.
// - Antigravity escribe `init`, una ristra de `step_update` y `result`. El
//   código de salida de un comando no está ahí: está solo en la transcripción
//   completa de la conversación, bajo `~/.gemini/antigravity-cli/brain/`. Su
//   versión sale del registro que escribe con `--log-file`.
//
// - Codex (`codex exec --json`) escribe en la salida estándar `thread.started`
//   con el id del hilo, los `item.completed` y `turn.completed`. El registro
//   completo es su rollout, en `~/.codex/sessions/AAAA/MM/DD/`, con el id del
//   hilo en el nombre: ahí cada comando es un arreglo `[shell, "-Command",
//   interno]` con su carpeta y su código, cada escritura con apply_patch un
//   `FileChange`, y la respuesta y la duración van en `task_complete`. Codex
//   delega a veces en subagentes, y cada uno deja su propio rollout: en la
//   primera corrida de humo, la medición la hizo un subagente. La salida
//   estándar no trae nada de los subagentes, así que la fuente es el rollout,
//   junto con los de sus subagentes, y la salida estándar queda de respaldo.
//
// Las lecturas toleran líneas que no son JSON. Una CLI que mezcla un aviso
// suelto en su salida no puede tirar abajo la lectura de la corrida entera.
//
// Cada lectura saca además el error que informa el propio agente, si lo hay.
// En la segunda corrida de humo, agy agotó su cuota al dar la respuesta final:
// `result` llegó con `status: "ERROR"` y la respuesta vacía, y la salida de
// errores trajo una línea `AGY_ERROR` con el estado y el código. Grok cierra
// con una línea `result` que dice `is_error` y su `subtype`, y Copilot con una
// línea `result` que trae `exitCode`. Ninguna corrida mostró todavía un error
// de Grok o de Copilot, así que esas dos formas salen de sus líneas de
// resultado reales y no de un error visto.

import { copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPO_DE_SALIDA_TRUNCADA, cadenasDe, llamada, motivoDeError, vacia, type Llamada, type Transcripcion } from './transcripcion.ts';

export type Contexto = {
  prompt: string;
  /** El mismo prompt, en un archivo, para el agente que lo lee de ahí. */
  archivoPrompt: string;
  /** El id de sesión que se le fija al agente que lo acepta. */
  sesion: string;
  /** Donde trabaja el agente: la copia de mix sin el código de la prueba, dentro de `staging`. */
  cwd: string;
  limiteMin: number;
  staging: string;
  /** El proyecto de Engram de esta corrida, distinto en cada una. */
  engram: string;
};

export type DefinicionDeAgente = {
  id: string;
  /** El nombre con que se busca en el PATH. */
  ejecutable: string;
  argumentos(ctx: Contexto): string[];
  /** Dónde deja el agente la transcripción de la sesión, o null si no se puede saber. */
  transcripcion(home: string, ctx: Contexto, stdout: string): string | null;
  /** El archivo donde el agente escribe su propio registro, si se le pide uno. */
  log(ctx: Contexto): string | null;
  /** Lee la sesión. `stderr` es la salida de errores del proceso, donde algún agente deja su error. */
  parsear(stdout: string, transcripcion: string | null, log: string | null, stderr: string | null): Transcripcion;
  /**
   * Las carpetas donde el agente guarda su propio estado mientras trabaja.
   * Escribir ahí no es escribir fuera de la corrida. `sesion` es la que leyó la
   * transcripción, o null.
   */
  estadoPropio(home: string, ctx: Contexto, sesion: string | null): string[];
  /** Los argumentos que imprimen la versión, para el agente que no la deja escrita. */
  version: string[] | null;
  /** Las variables de entorno propias de la corrida, que se suman a las del usuario. */
  variables?(ctx: Contexto): Record<string, string>;
  /**
   * Arma antes de lanzar lo que esas variables nombran y devuelve cómo
   * deshacerlo. Se deshace al recoger la sesión, y al salir el proceso si la
   * corrida no llegó a recogerse.
   */
  preparar?(home: string, ctx: Contexto): () => void;
  /**
   * El directorio de skills instaladas que lee el agente. Es una copia que
   * mantiene el usuario, no el repositorio: antes de correr se comprueba que
   * coincida con el arnés (ver `instaladas.ts`).
   */
  skills(home: string): string;
};

type Objeto = Record<string, unknown>;
const obj = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Las líneas que son objetos JSON. Las demás se saltan. */
function lineas(texto: string): Objeto[] {
  return texto.split(/\r?\n/u).flatMap((l) => {
    const s = l.trim();
    if (!s.startsWith('{')) return [];
    try {
      const j: unknown = JSON.parse(s);
      return j !== null && typeof j === 'object' && !Array.isArray(j) ? [j as Objeto] : [];
    } catch {
      return [];
    }
  });
}

/**
 * La sesión de Copilot.
 *
 * Su error es el del evento de error, o el `exitCode` de la línea `result` si
 * no lo hay. Un evento de error cuenta solo si la corrida no terminó bien, con
 * un código distinto de cero o sin respuesta: uno del que Copilot se repuso no
 * es un error de la corrida.
 */
export function parsearCopilot(stdout: string, eventos: string | null): Transcripcion {
  const t = vacia();
  const porId = new Map<string, Llamada>();
  let final: string | null = null;
  let ultimo: string | null = null;
  let informado: string | null = null;
  let codigoInformado: number | null = null;
  for (const j of lineas(stdout)) {
    const d = obj(j.data);
    if (typeof j.type === 'string' && /(?:^|\.)error$/u.test(j.type)) {
      const mensaje = str(d.message) ?? str(d.error) ?? str(d.errorType);
      if (mensaje !== null) informado ??= motivoDeError(mensaje);
    }
    if (j.type === 'session.auto_mode_resolved') t.modelo ??= str(d.chosenModel);
    if (j.type === 'tool.execution_start') {
      const l = llamada(str(d.toolName) ?? '?', d.arguments);
      t.llamadas.push(l);
      const id = str(d.toolCallId);
      if (id !== null) porId.set(id, l);
    }
    if (j.type === 'tool.execution_complete') {
      const l = porId.get(str(d.toolCallId) ?? '');
      const codigo = num(obj(d.shellExecution).exitCode);
      if (l !== undefined && codigo !== null) l.codigo = codigo;
    }
    if (j.type === 'assistant.message') {
      t.modelo = str(d.model) ?? t.modelo;
      const contenido = str(d.content);
      if (contenido !== null && contenido.trim() !== '') {
        if (d.phase === 'final_answer') final = contenido;
        else ultimo = contenido;
      }
    }
    if (j.type === 'result') {
      const uso = obj(j.usage);
      const premium = num(uso.premiumRequests);
      if (premium !== null) t.costo = { valor: premium, unidad: 'solicitudes premium' };
      t.duracionMs = num(uso.sessionDurationMs);
      t.sesion = str(j.sessionId);
      const salida = num(j.exitCode);
      if (salida !== null && salida !== 0) codigoInformado = salida;
    }
  }
  t.respuesta = final ?? ultimo;
  if (codigoInformado !== null) t.error = informado ?? `el agente terminó con código ${codigoInformado}`;
  else if (t.respuesta === null) t.error = informado;
  for (const j of lineas(eventos ?? '')) {
    const d = obj(j.data);
    if (j.type === 'session.start') t.version = str(d.copilotVersion);
    const nombre = str(d.name);
    if (j.type === 'skill.invoked' && nombre !== null && !t.skillsInvocadas.includes(nombre)) {
      t.skillsInvocadas.push(nombre);
    }
  }
  return t;
}

/** El texto de un `tool_result`: una cadena, o bloques de texto. */
function textoDeResultado(contenido: unknown): string {
  if (typeof contenido === 'string') return contenido;
  return arr(contenido)
    .map((b) => str(obj(b).text) ?? '')
    .join('');
}

export function parsearGrok(stdout: string): Transcripcion {
  const t = vacia();
  const porId = new Map<string, Llamada>();
  for (const j of lineas(stdout)) {
    if (j.type === 'system' && j.subtype === 'init') {
      t.modelo = str(j.model);
      t.sesion = str(j.session_id);
    }
    const mensaje = obj(j.message);
    for (const bloque of arr(mensaje.content)) {
      const b = obj(bloque);
      if (j.type === 'assistant' && b.type === 'tool_use') {
        const l = llamada(str(b.name) ?? '?', b.input);
        t.llamadas.push(l);
        porId.set(str(b.id) ?? '', l);
      }
      if (j.type === 'user' && b.type === 'tool_result') {
        const l = porId.get(str(b.tool_use_id) ?? '');
        if (l === undefined || l.clase !== 'shell') continue;
        try {
          l.codigo = num(obj(JSON.parse(textoDeResultado(b.content))).exit_code);
        } catch {
          // Un resultado que no es JSON no trae código, y la llamada queda sin él.
        }
      }
    }
    if (j.type === 'assistant') t.modelo ??= str(mensaje.model);
    if (j.type === 'result') {
      // Con `is_error` o un subtipo que no es `success`, el texto del resultado
      // es el error, no la respuesta.
      const subtipo = str(j.subtype);
      if (j.is_error === true || (subtipo !== null && subtipo !== 'success')) {
        const mensaje = [str(j.result), str(j.error), subtipo].find((x) => x !== null && x.trim() !== '');
        t.error = motivoDeError(mensaje ?? 'error');
      } else {
        t.respuesta = str(j.result);
      }
      const usd = num(j.total_cost_usd);
      if (usd !== null) t.costo = { valor: usd, unidad: 'USD' };
      t.duracionMs = num(j.duration_ms);
      t.sesion ??= str(j.session_id);
    }
  }
  return t;
}

/** El id de la conversación de agy, que viene en su primera línea. */
export function conversacionDeAgy(stdout: string): string | null {
  for (const j of lineas(stdout)) if (j.event === 'init') return str(j.conversation_id);
  return null;
}

/**
 * Las llamadas de la transcripción completa de agy, con el código de cada comando.
 *
 * Cada `PLANNER_RESPONSE` pide herramientas y cada `GENERIC` que sigue trae el
 * resultado de una, en el orden en que se pidieron. Los mensajes del sistema van
 * intercalados y no son resultado de nada: si contaran, cada código quedaría
 * pegado al comando equivocado.
 */
function llamadasDeAgy(transcripcion: string): { llamadas: Llamada[]; respuesta: string | null } {
  const llamadas: Llamada[] = [];
  const pendientes: Llamada[] = [];
  let respuesta: string | null = null;
  for (const j of lineas(transcripcion)) {
    if (j.type === 'PLANNER_RESPONSE') {
      const pedidas = arr(j.tool_calls);
      for (const p of pedidas) {
        const l = llamada(str(obj(p).name) ?? '?', obj(p).args);
        llamadas.push(l);
        pendientes.push(l);
      }
      if (pedidas.length === 0) respuesta = str(j.content) ?? respuesta;
    }
    if (j.type === 'GENERIC') {
      const l = pendientes.shift();
      const m = /The command exited with code (-?\d+)/u.exec(str(j.content) ?? '');
      if (l !== undefined && l.clase === 'shell' && m) l.codigo = Number(m[1]);
    }
  }
  return { llamadas, respuesta };
}

type ErrorDeAgy = { mensaje: string; reintentable: boolean };

/**
 * Las líneas `AGY_ERROR` de la salida de errores, cada una con su `short_error`,
 * que trae el estado y el código, y con si agy la marca `retryable`.
 */
function erroresDeAgy(stderr: string | null): ErrorDeAgy[] {
  const out: ErrorDeAgy[] = [];
  for (const l of (stderr ?? '').split(/\r?\n/u)) {
    const m = /^AGY_ERROR:\s*(\{.*\})\s*$/u.exec(l.trim());
    if (m === null) continue;
    try {
      const j = obj(JSON.parse(m[1] as string));
      const mensaje = str(j.short_error) ?? str(j.status);
      if (mensaje !== null) out.push({ mensaje, reintentable: j.retryable === true });
    } catch {
      // Una línea rota no tapa el error del resultado.
    }
  }
  return out;
}

export function parsearAgy(stdout: string, transcripcion: string | null, log: string | null, stderr: string | null = null): Transcripcion {
  const t = vacia();
  const pasos = new Set<number>();
  let delResultado: string | null = null;
  let terminoBien = false;
  for (const j of lineas(stdout)) {
    if (j.event === 'init') t.sesion = str(j.conversation_id);
    if (j.event === 'step_update') {
      const u = obj(j.step_update);
      const indice = num(u.step_index);
      // Cada herramienta sale dos veces, ACTIVE y DONE, con los mismos parámetros.
      if (u.step_type !== 'tool' || indice === null || pasos.has(indice)) continue;
      pasos.add(indice);
      const info = obj(u.tool_info);
      t.llamadas.push(llamada(str(info.name) ?? str(u.tool_name) ?? '?', info.parameters));
    }
    if (j.event === 'result') {
      const r = obj(j.result);
      t.respuesta = str(r.response);
      if (r.status === 'ERROR') delResultado = str(r.error) ?? 'ERROR';
      else terminoBien = true;
      const segundos = num(r.duration_seconds);
      if (segundos !== null) t.duracionMs = Math.round(segundos * 1000);
      t.sesion ??= str(r.conversation_id);
    }
  }
  if (transcripcion !== null) {
    const completa = llamadasDeAgy(transcripcion);
    if (completa.llamadas.length > 0) t.llamadas = completa.llamadas;
    t.respuesta ??= completa.respuesta;
  }
  t.version = /Language server version:\s*(\S+)/u.exec(log ?? '')?.[1] ?? null;
  // agy deja en la salida de errores también los errores de los que se repone.
  // Uno marcado reintentable, en una sesión que terminó con un resultado
  // exitoso y una respuesta, no es un error de la corrida. Uno que no se
  // reintenta lo es siempre, y uno reintentable sin ese final también.
  const errores = erroresDeAgy(stderr);
  // Un resultado con estado ERROR quita el éxito aunque antes haya llegado otro bueno.
  const exito = terminoBien && delResultado === null && t.respuesta !== null && t.respuesta.trim() !== '';
  const fatal = errores.find((e) => !e.reintentable)?.mensaje;
  const reintentado = errores.find((e) => e.reintentable)?.mensaje;
  const error = fatal ?? (exito ? null : (reintentado ?? delResultado));
  t.error = error === null ? null : motivoDeError(error);
  return t;
}

/** El modelo con que corre codex en la prueba. */
const MODELO_DE_CODEX = 'gpt-6-luna';

/** El id del hilo de codex, que viene en la primera línea de su salida `--json`. */
export function hiloDeCodex(stdout: string): string | null {
  for (const j of lineas(stdout)) if (j.type === 'thread.started') return str(j.thread_id);
  return null;
}

/**
 * Los shells con que codex corre un comando, y la bandera con que cada uno lo
 * recibe. Las dos listas sirven igual para el arreglo del rollout y para la
 * línea de la salida `--json`. Solo un programa de esta lista es un shell: en la
 * revisión de T2, cualquiera terminado en «sh», como `ssh` o `push`, seguido de
 * `-c`, pasaba por uno y perdía la mitad del comando.
 */
const SHELLS = new Set(['pwsh', 'powershell', 'bash', 'sh', 'zsh', 'cmd']);
const BANDERAS_DE_COMANDO = new Set(['-command', '-c', '-lc', '/c']);

/** Si un programa es uno de los shells, por su nombre sin carpeta ni `.exe`. */
const esShell = (programa: string) => SHELLS.has(programa.replace(/^.*[\\/]/u, '').replace(/\.exe$/iu, '').toLowerCase());

/**
 * Las palabras de una línea escrita con las comillas de un shell POSIX, como
 * la escribe la salida `--json` de codex: entre comillas simples todo es
 * literal, y entre dobles `\\`, `\"`, `\$` y `` \` `` valen por el carácter que
 * escapan. Una palabra puede juntar tramos con comillas de los dos tipos. Null
 * si una comilla queda abierta.
 */
function palabrasDeShell(linea: string): string[] | null {
  const out: string[] = [];
  let actual = '';
  let hay = false;
  for (let i = 0; i < linea.length; ) {
    const c = linea[i] as string;
    if (/\s/u.test(c)) {
      if (hay) out.push(actual);
      actual = '';
      hay = false;
      i++;
      continue;
    }
    hay = true;
    if (c === "'") {
      const fin = linea.indexOf("'", i + 1);
      if (fin === -1) return null;
      actual += linea.slice(i + 1, fin);
      i = fin + 1;
    } else if (c === '"') {
      i++;
      while (i < linea.length && linea[i] !== '"') {
        const escapado = linea[i] === '\\' && '\\"$`'.includes(linea[i + 1] ?? '');
        actual += escapado ? linea[i + 1] : linea[i];
        i += escapado ? 2 : 1;
      }
      if (i >= linea.length) return null;
      i++;
    } else if (c === '\\' && i + 1 < linea.length) {
      actual += linea[i + 1];
      i += 2;
    } else {
      actual += c;
      i++;
    }
  }
  if (hay) out.push(actual);
  return out;
}

/** Lo que sigue a la bandera del comando, si las partes son las de un shell. */
function dentroDelShell(partes: readonly string[]): string | null {
  if (!esShell(partes[0] ?? '')) return null;
  const i = partes.findIndex((p, k) => k > 0 && BANDERAS_DE_COMANDO.has(p.toLowerCase()));
  return i === -1 ? null : partes.slice(i + 1).join(' ');
}

/**
 * El comando que corrió codex: el de dentro del shell, no la línea del shell.
 *
 * El rollout lo guarda como arreglo, `[shell, "-Command", interno]`, y la
 * salida `--json` como una sola línea con el shell adelante y las comillas de
 * un shell POSIX. Las comprobaciones buscan en el comando lo que se leyó y lo
 * que se midió, y con el shell adelante una lectura dejaría de empezar el paso.
 * Lo que no es un shell queda entero.
 */
export function comandoDeCodex(comando: unknown): string | null {
  if (typeof comando === 'string') {
    const palabras = palabrasDeShell(comando.trim());
    return (palabras === null ? null : dentroDelShell(palabras)) ?? comando;
  }
  const partes = arr(comando).filter((p): p is string => typeof p === 'string');
  if (partes.length === 0) return null;
  return dentroDelShell(partes) ?? partes.join(' ');
}

/** La carpeta de un comando, que el rollout guarda como URL `file:///C:/…`. */
function carpetaDeCodex(v: unknown): string | null {
  const s = str(v);
  if (s === null || !s.startsWith('file://')) return s;
  const ruta = decodeURIComponent(s.slice('file://'.length));
  return /^\/[a-z]:\//iu.test(ruta) ? ruta.slice(1).replaceAll('/', '\\') : ruta;
}

/**
 * El mensaje de un error de codex. Llega con el JSON de la API dentro de una
 * cadena: se saca el mensaje de adentro y se le agrega el estado HTTP, que es
 * con lo que `motivoDeError` reconoce una cuota agotada.
 */
function mensajeDeCodex(texto: string): string {
  try {
    const j = obj(JSON.parse(texto));
    const mensaje = str(obj(j.error).message) ?? str(j.message);
    const estado = num(j.status);
    if (mensaje !== null) return estado === null ? mensaje : `${mensaje} (${estado})`;
  } catch {
    // No es JSON: el texto ya es el mensaje.
  }
  return texto;
}

/**
 * El CODEX_HOME propio de una corrida: al lado de su carpeta y fuera de ella,
 * porque lo de la carpeta se publica y el hogar lleva la sesión del usuario.
 */
export const hogarDeCodex = (ctx: Pick<Contexto, 'staging'>): string => `${ctx.staging}-codex`;

/**
 * Lo que el hogar de una corrida toma del ~/.codex del usuario. Con nada más,
 * codex no inicia sesión o no puede correr comandos; con todo, trae lo que la
 * prueba tiene que dejar afuera (ver `prepararHogarDeCodex`).
 *
 * - `auth.json`, la sesión. Enlazada y no copiada: si codex la renueva
 *   escribiéndola, la renueva para el usuario, igual que si corriera en su
 *   hogar. Una copia renovada aparte dejaría vieja la del usuario.
 * - `cap_sid` y las carpetas de la sandbox elevada de Windows. Sin ellas, codex
 *   pide armarla de nuevo, con permisos de administrador. La sandbox sin
 *   elevar no sirve: no puede lanzar el pwsh de la Tienda, y en la prueba de
 *   humo del 2026-10-14 ningún comando llegó a correr.
 */
const ARCHIVOS_DEL_HOGAR = ['auth.json', 'cap_sid'];
const CARPETAS_DEL_HOGAR = ['.sandbox', '.sandbox-bin', '.sandbox-secrets'];

/** Los hogares armados que todavía no se deshicieron, para deshacerlos al salir. */
const hogaresAbiertos = new Set<() => void>();
let alSalir = false;

const leerSiHay = (ruta: string): Buffer | null => {
  try {
    return readFileSync(ruta);
  } catch {
    return null;
  }
};

/**
 * Arma un CODEX_HOME aislado en `hogar` a partir del real, y devuelve cómo
 * deshacerlo.
 *
 * En la serie del 2026-10-14, codex corría con el ~/.codex del usuario: su
 * AGENTS.md global y su `model_instructions_file` le pedían cerrar cada
 * respuesta con «Key Learnings», y su servidor de Engram guardaba memorias de la
 * prueba en el Engram real. En el hogar aislado no hay AGENTS.md, ni
 * config.toml, ni servidores MCP, ni hooks, ni skills propias de codex: las
 * skills que lee la prueba son las de `~/.agents/skills`, que no dependen del
 * CODEX_HOME.
 *
 * Deshacerlo borra el hogar entero. Antes quita los enlaces a las carpetas de
 * la sandbox, para que el borrado no entre en las del usuario. Si codex
 * reemplazó la sesión en vez de sobrescribirla, el enlace se rompió y la
 * renovada quedó solo en el hogar: vuelve al usuario, salvo que la del usuario
 * haya cambiado mientras tanto. Deshacerlo dos veces no hace nada.
 */
export function prepararHogarDeCodex(real: string, hogar: string): () => void {
  const auth = join(real, 'auth.json');
  const antes = leerSiHay(auth);
  let hecho = false;
  const limpiar = () => {
    if (hecho) return;
    hecho = true;
    hogaresAbiertos.delete(limpiar);
    try {
      const renovada = leerSiHay(join(hogar, 'auth.json'));
      const actual = leerSiHay(auth);
      if (antes !== null && renovada !== null && actual !== null && !renovada.equals(antes) && actual.equals(antes)) {
        writeFileSync(auth, renovada);
      }
    } finally {
      for (const nombre of CARPETAS_DEL_HOGAR) {
        const ruta = join(hogar, nombre);
        try {
          if (lstatSync(ruta).isSymbolicLink()) unlinkSync(ruta);
        } catch {
          // No estaba.
        }
      }
      rmSync(hogar, { recursive: true, force: true });
    }
  };
  hogaresAbiertos.add(limpiar);
  if (!alSalir) {
    alSalir = true;
    process.once('exit', () => {
      for (const l of [...hogaresAbiertos]) l();
    });
  }
  try {
    mkdirSync(hogar, { recursive: true });
    for (const nombre of ARCHIVOS_DEL_HOGAR) {
      const desde = join(real, nombre);
      if (!existsSync(desde)) continue;
      try {
        linkSync(desde, join(hogar, nombre));
      } catch {
        // Otro volumen: una copia, que `limpiar` devuelve si codex la renueva.
        copyFileSync(desde, join(hogar, nombre));
      }
    }
    for (const nombre of CARPETAS_DEL_HOGAR) {
      const desde = join(real, nombre);
      if (existsSync(desde)) symlinkSync(desde, join(hogar, nombre), 'junction');
    }
  } catch (e) {
    limpiar();
    throw e;
  }
  return limpiar;
}

/** El rollout de un hilo, buscado por su id en las carpetas de días, de la más nueva a la más vieja. */
function rolloutDeCodex(sesiones: string, hilo: string): string | null {
  const hijos = (dir: string) => {
    try {
      return readdirSync(dir).sort().reverse();
    } catch {
      return [];
    }
  };
  const sufijo = `-${hilo}.jsonl`;
  for (const anio of hijos(sesiones)) {
    for (const mes of hijos(join(sesiones, anio))) {
      for (const dia of hijos(join(sesiones, anio, mes))) {
        const carpeta = join(sesiones, anio, mes, dia);
        const archivo = hijos(carpeta).find((a) => a.startsWith('rollout-') && a.endsWith(sufijo));
        if (archivo !== undefined) return join(carpeta, archivo);
      }
    }
  }
  return null;
}

/** Los hilos que un rollout abrió como subagentes. */
function subagentesDeCodex(rollout: string): string[] {
  const out: string[] = [];
  for (const j of lineas(rollout)) {
    const item = obj(obj(j.payload).item);
    const id = item.type === 'SubAgentActivity' ? str(item.agent_thread_id) : null;
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * La transcripción de una corrida de codex: el rollout del hilo principal, o,
 * si delegó, ese rollout seguido de los de sus subagentes, a cualquier
 * profundidad, juntos en `codex-sesiones.jsonl` dentro de la carpeta de la
 * corrida. Cada rollout empieza con su `session_meta`, que dice de qué hilo es.
 * Los rollouts están en `sessions` del CODEX_HOME de la corrida.
 */
export function transcripcionDeCodex(hogar: string, staging: string, stdout: string): string | null {
  const hilo = hiloDeCodex(stdout);
  if (hilo === null) return null;
  const sesiones = join(hogar, 'sessions');
  const principal = rolloutDeCodex(sesiones, hilo);
  if (principal === null) return null;
  const textos: string[] = [];
  const vistos = new Set<string>([hilo]);
  const pendientes = [principal];
  for (let ruta = pendientes.shift(); ruta !== undefined; ruta = pendientes.shift()) {
    const texto = readFileSync(ruta, 'utf8');
    textos.push(texto.endsWith('\n') ? texto : `${texto}\n`);
    for (const sub of subagentesDeCodex(texto)) {
      if (vistos.has(sub)) continue;
      vistos.add(sub);
      const suyo = rolloutDeCodex(sesiones, sub);
      if (suyo !== null) pendientes.push(suyo);
    }
  }
  if (textos.length === 1) return principal;
  const junta = join(staging, 'codex-sesiones.jsonl');
  writeFileSync(junta, textos.join(''));
  return junta;
}

/** Una llamada de codex, sea del rollout o de la salida `--json`. */
function llamadasDeCodex(item: Objeto): Llamada[] {
  const tipo = str(item.type);
  if (tipo === 'CommandExecution' || tipo === 'command_execution') {
    const l = llamada('shell', { command: comandoDeCodex(item.command), workdir: carpetaDeCodex(item.cwd) });
    l.codigo = num(item.exit_code);
    return [l];
  }
  if (tipo === 'FileChange' || tipo === 'file_change') {
    // El rollout guarda los cambios como objeto por ruta; la salida, como lista.
    const rutas = Array.isArray(item.changes)
      ? item.changes.map((c) => str(obj(c).path)).filter((r): r is string => r !== null)
      : Object.keys(obj(item.changes));
    return rutas.map((ruta) => llamada('apply_patch', { path: ruta }));
  }
  if (tipo === 'McpToolCall' || tipo === 'mcp_tool_call') {
    return [llamada(`${str(item.server) ?? '?'}.${str(item.tool) ?? '?'}`, item.arguments)];
  }
  return [];
}

/** El aviso con que codex dice que recortó una salida al tope de tokens. */
const AVISO_DE_RECORTE = /Warning: truncated output \(original token count: (\d+)\)/u;

/** Los tokens que tenía una salida recortada, según su aviso, o null si llegó entera. */
function recorte(salida: unknown): number | null {
  for (const s of cadenasDe(salida)) {
    const m = AVISO_DE_RECORTE.exec(s);
    if (m !== null) return Number(m[1]);
  }
  return null;
}

/** Marca un comando cuya salida le llegó recortada al modelo: lo que leyó es un tramo. */
function marcarRecorte(l: Llamada, tokensOriginales: number): void {
  if (l.entrada !== null && typeof l.entrada === 'object') {
    const e = l.entrada as Objeto;
    e[CAMPO_DE_SALIDA_TRUNCADA] ??= tokensOriginales;
  }
}

/**
 * La sesión de codex.
 *
 * Con el rollout, la respuesta, el modelo, la duración y el error son los del
 * hilo principal, el primero; las llamadas son las de todos los hilos, porque
 * lo que hizo un subagente lo hizo la corrida, y el costo, en tokens, es la
 * suma de los de cada hilo. Sin el rollout, se lee la salida `--json`, que
 * solo trae el hilo principal y no dice el modelo ni la versión.
 *
 * El error es el de la tarea (`task_complete` con `error`, o `turn.failed`). Un
 * aviso de error suelto, como un reintento de conexión, cuenta solo si la
 * corrida no dio respuesta.
 *
 * Codex lee con `exec_command` y un tope de tokens, `max_output_tokens`, y lo
 * que pasa del tope no le llega al modelo: en la serie del 2026-10-14 leyó
 * adria-sola-writing con un tope de 3000 tokens y la salida tenía 8227. El aviso
 * del recorte está en la salida que vio el modelo, la de la llamada
 * (`custom_tool_call_output`) o la de la espera que la completa
 * (`function_call_output`), y a veces también en el registro del comando. Un
 * comando que terminó antes de una salida recortada queda marcado como lectura
 * parcial (ver `CAMPO_DE_SALIDA_TRUNCADA`). Si una sola llamada corrió varios
 * comandos, el recorte de uno los marca a todos: es lo que se puede saber.
 */
export function parsearCodex(stdout: string, sesiones: string | null): Transcripcion {
  const t = vacia();
  const registro = lineas(sesiones ?? '');
  let fallo: string | null = null;
  let aviso: string | null = null;
  if (registro.some((j) => j.type === 'session_meta')) {
    let principal: string | null = null;
    let hilo: string | null = null;
    const vistas = new Set<string>();
    const tokens = new Map<string, number>();
    // Los comandos que terminaron desde la última salida que vio el modelo.
    let pendientes: Llamada[] = [];
    for (const j of registro) {
      const p = obj(j.payload);
      if (j.type === 'session_meta') {
        hilo = str(p.id);
        pendientes = [];
        if (principal === null) {
          principal = hilo;
          t.sesion = hilo;
          t.version = str(p.cli_version);
        }
        continue;
      }
      const delPrincipal = hilo === principal;
      if (j.type === 'turn_context' && delPrincipal) t.modelo ??= str(p.model);
      if (j.type === 'response_item' && (p.type === 'custom_tool_call_output' || p.type === 'function_call_output')) {
        const tokensOriginales = recorte(p.output);
        if (tokensOriginales !== null) for (const l of pendientes) marcarRecorte(l, tokensOriginales);
        pendientes = [];
        continue;
      }
      if (j.type !== 'event_msg') continue;
      if (p.type === 'token_count') {
        // El total de cada hilo es acumulado: cada token_count trae lo gastado
        // desde que empezó el hilo, así que vale el último y no la suma.
        const total = num(obj(obj(p.info).total_token_usage).total_tokens);
        if (total !== null) tokens.set(hilo ?? '', total);
      }
      if (p.type === 'error' && delPrincipal) aviso ??= str(p.message);
      if (p.type === 'task_complete' && delPrincipal) {
        t.respuesta = str(p.last_agent_message);
        t.duracionMs = num(p.duration_ms);
        fallo = str(obj(p.error).message);
      }
      if (p.type !== 'item_completed') continue;
      const item = obj(p.item);
      // Un rollout que se lee dos veces no repite sus llamadas.
      const id = str(item.id);
      if (id !== null) {
        if (vistas.has(id)) continue;
        vistas.add(id);
      }
      const nuevas = llamadasDeCodex(item);
      for (const l of nuevas.filter((x) => x.clase === 'shell')) {
        const tokensOriginales = recorte(item.formatted_output);
        if (tokensOriginales !== null) marcarRecorte(l, tokensOriginales);
        pendientes.push(l);
      }
      t.llamadas.push(...nuevas);
    }
    if (tokens.size > 0) t.costo = { valor: [...tokens.values()].reduce((a, b) => a + b, 0), unidad: 'tokens' };
  } else {
    let ultimo: string | null = null;
    for (const j of lineas(stdout)) {
      const item = obj(j.item);
      if (j.type === 'item.completed') {
        if (item.type === 'agent_message') ultimo = str(item.text) ?? ultimo;
        t.llamadas.push(...llamadasDeCodex(item));
      }
      if (j.type === 'turn.completed') {
        const uso = obj(j.usage);
        const entrada = num(uso.input_tokens);
        const salida = num(uso.output_tokens);
        if (entrada !== null || salida !== null) t.costo = { valor: (entrada ?? 0) + (salida ?? 0), unidad: 'tokens' };
      }
    }
    t.respuesta = ultimo;
  }
  for (const j of lineas(stdout)) {
    if (j.type === 'turn.failed') fallo ??= str(obj(j.error).message);
    if (j.type === 'error') aviso ??= str(j.message);
  }
  t.sesion ??= hiloDeCodex(stdout);
  const respondio = t.respuesta !== null && t.respuesta.trim() !== '';
  const error = fallo ?? (respondio ? null : aviso);
  t.error = error === null ? null : motivoDeError(mensajeDeCodex(error));
  return t;
}

export const AGENTES: Record<string, DefinicionDeAgente> = {
  copilot: {
    id: 'copilot',
    ejecutable: 'copilot',
    argumentos: (ctx) => [
      '-p',
      ctx.prompt,
      '--allow-all-tools',
      '--allow-all-paths',
      '--no-ask-user',
      '--output-format',
      'json',
      '--session-id',
      ctx.sesion,
    ],
    transcripcion: (home, ctx) => join(home, '.copilot', 'session-state', ctx.sesion, 'events.jsonl'),
    log: () => null,
    estadoPropio: (home, ctx) => [join(home, '.copilot', 'session-state', ctx.sesion)],
    parsear: (stdout, transcripcion) => parsearCopilot(stdout, transcripcion),
    version: null,
    skills: (home) => join(home, '.agents', 'skills'),
  },
  grok: {
    id: 'grok',
    ejecutable: 'grok',
    // `--prompt-file` y no `-p`: el prompt no pasa por la línea de comandos.
    // Ojo con `-s`, que en grok es `--session-id` y no «silencioso».
    argumentos: (ctx) => [
      '--prompt-file',
      ctx.archivoPrompt,
      '--cwd',
      ctx.cwd,
      '--always-approve',
      '--output-format',
      'streaming-messages-json',
      '--session-id',
      ctx.sesion,
    ],
    // La salida estándar ya es la sesión entera. Esto es el registro propio de
    // grok, que se guarda como respaldo.
    transcripcion: (home, ctx) => join(home, '.grok', 'sessions', encodeURIComponent(ctx.cwd), ctx.sesion, 'events.jsonl'),
    log: () => null,
    // Grok ordena sus sesiones por la carpeta de trabajo, y esa carpeta cambia en
    // cada corrida: se reconoce la raíz entera.
    estadoPropio: (home) => [join(home, '.grok', 'sessions')],
    parsear: (stdout) => parsearGrok(stdout),
    version: ['--version'],
    skills: (home) => join(home, '.grok', 'skills'),
  },
  agy: {
    id: 'agy',
    ejecutable: 'agy',
    // Su tiempo de espera por defecto es de cinco minutos, y en el sondeo una
    // corrección de dos oraciones tardó seis. Se le da el mismo límite que el
    // ejecutor le pone a la corrida.
    argumentos: (ctx) => [
      '--output-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '--print-timeout',
      `${ctx.limiteMin}m`,
      '--log-file',
      join(ctx.staging, 'agy.log'),
      '-p',
      ctx.prompt,
    ],
    transcripcion: (home, _ctx, stdout) => {
      const id = conversacionDeAgy(stdout);
      if (id === null) return null;
      return join(home, '.gemini', 'antigravity-cli', 'brain', id, '.system_generated', 'logs', 'transcript_full.jsonl');
    },
    log: (ctx) => join(ctx.staging, 'agy.log'),
    // La carpeta de la conversación: ahí guarda sus borradores y su transcripción.
    estadoPropio: (home, _ctx, sesion) =>
      sesion === null ? [] : [join(home, '.gemini', 'antigravity-cli', 'brain', sesion)],
    parsear: (stdout, transcripcion, log, stderr) => parsearAgy(stdout, transcripcion, log, stderr),
    version: null,
    skills: (home) => join(home, '.gemini', 'config', 'skills'),
  },
  codex: {
    id: 'codex',
    ejecutable: 'codex',
    // La entrada estándar está cerrada (ver `proceso.ts`), así que el prompt va
    // como argumento, al final. La copia de mix no tiene `.git`, y sin
    // `--skip-git-repo-check` codex no arranca. La sandbox es la de escribir en
    // la carpeta de trabajo, más la carpeta de la corrida con `--add-dir`, que
    // es donde va la salida: en la corrida de humo, con esta sandbox, codex
    // leyó una skill, corrió el verificador con node y escribió con apply_patch
    // fuera de su copia. No hizo falta saltarse la sandbox.
    //
    // Sin `--disable multi_agent`, codex delega en subagentes que corren con el
    // modelo de la configuración del usuario y no con el de `-m`: en la corrida
    // de humo, el subagente que midió fue gpt-6.1-sol. La prueba es de un
    // modelo, así que todo corre en él.
    //
    // Corre con un CODEX_HOME propio (ver `prepararHogarDeCodex`), sin la
    // configuración del usuario. De ella se repone solo la sandbox elevada de
    // Windows, que es la que deja lanzar el pwsh de la Tienda. `--disable apps`
    // quita los conectores de la cuenta, que no son de la prueba.
    argumentos: (ctx) => [
      'exec',
      '-m',
      MODELO_DE_CODEX,
      '--disable',
      'multi_agent',
      '--disable',
      'apps',
      '--json',
      '--skip-git-repo-check',
      '-C',
      ctx.cwd,
      '--add-dir',
      ctx.staging,
      '-s',
      'workspace-write',
      '-c',
      'approval_policy="never"',
      '-c',
      'windows.sandbox="elevated"',
      ctx.prompt,
    ],
    variables: (ctx) => ({ CODEX_HOME: hogarDeCodex(ctx) }),
    preparar: (home, ctx) => prepararHogarDeCodex(process.env.CODEX_HOME ?? join(home, '.codex'), hogarDeCodex(ctx)),
    transcripcion: (_home, ctx, stdout) => transcripcionDeCodex(hogarDeCodex(ctx), ctx.staging, stdout),
    log: () => null,
    // Su hogar de la corrida entero: ahí guarda sus rollouts, su caché y sus bases.
    estadoPropio: (_home, ctx) => [hogarDeCodex(ctx)],
    parsear: (stdout, transcripcion) => parsearCodex(stdout, transcripcion),
    version: ['--version'],
    // Lee las skills del usuario del mismo directorio que Copilot.
    skills: (home) => join(home, '.agents', 'skills'),
  },
};
