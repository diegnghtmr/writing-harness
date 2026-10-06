// Los tres agentes: cómo se los llama y cómo se lee lo que dejan.
//
// Todo lo que está acá salió del sondeo de las tres CLI, con una sesión real de
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
// Las tres lecturas toleran líneas que no son JSON. Una CLI que mezcla un aviso
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

import { join } from 'node:path';
import { llamada, motivoDeError, vacia, type Llamada, type Transcripcion } from './transcripcion.ts';

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

/** El `short_error` de la línea `AGY_ERROR` de la salida de errores, que trae el estado y el código. */
function errorDeAgy(stderr: string | null): string | null {
  for (const l of (stderr ?? '').split(/\r?\n/u)) {
    const m = /^AGY_ERROR:\s*(\{.*\})\s*$/u.exec(l.trim());
    if (m === null) continue;
    try {
      const j = obj(JSON.parse(m[1] as string));
      return str(j.short_error) ?? str(j.status);
    } catch {
      // Una línea rota no tapa el error del resultado.
    }
  }
  return null;
}

export function parsearAgy(stdout: string, transcripcion: string | null, log: string | null, stderr: string | null = null): Transcripcion {
  const t = vacia();
  const pasos = new Set<number>();
  let delResultado: string | null = null;
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
  const error = errorDeAgy(stderr) ?? delResultado;
  t.error = error === null ? null : motivoDeError(error);
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
  },
};
