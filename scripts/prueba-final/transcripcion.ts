// Una sesión de agente, leída igual para todos.
//
// Cada CLI cuenta su sesión en su formato, y `agentes.ts` traduce cada uno a
// esta forma: la respuesta, las llamadas a herramientas en orden y unos pocos
// metadatos. Lo que se deduce de las llamadas, como qué skills se cargaron o qué
// comandos corrieron, se deduce acá y de una sola manera, para que la misma
// comprobación no dé distinto según quién la mire.

export type Clase = 'shell' | 'escritura' | 'skill' | 'otra';

export type Llamada = {
  herramienta: string;
  /** La entrada tal cual la dio el agente. */
  entrada: unknown;
  clase: Clase;
  comando: string | null;
  ruta: string | null;
  skill: string | null;
  /** El código de salida de un comando, si el agente lo deja escrito. */
  codigo: number | null;
};

export type Costo = { valor: number; unidad: string };

export type Transcripcion = {
  respuesta: string | null;
  llamadas: Llamada[];
  /** Las skills que el propio agente registra como cargadas, si lleva ese registro. */
  skillsInvocadas: string[];
  modelo: string | null;
  costo: Costo | null;
  /** La duración que informa el agente, que no es la que mide el ejecutor. */
  duracionMs: number | null;
  sesion: string | null;
  version: string | null;
};

export function vacia(): Transcripcion {
  return {
    respuesta: null,
    llamadas: [],
    skillsInvocadas: [],
    modelo: null,
    costo: null,
    duracionMs: null,
    sesion: null,
    version: null,
  };
}

const CAMPOS_DE_COMANDO = ['command', 'CommandLine', 'cmd'];
const CAMPOS_DE_RUTA = ['file_path', 'TargetFile', 'path', 'target_file', 'filePath', 'AbsolutePath'];
const CAMPOS_DE_SKILL = ['skill', 'skill_name', 'name'];

const campo = (entrada: unknown, nombres: readonly string[]): string | null => {
  if (entrada === null || typeof entrada !== 'object') return null;
  for (const n of nombres) {
    const v = (entrada as Record<string, unknown>)[n];
    if (typeof v === 'string') return v;
  }
  return null;
};

/**
 * Una llamada clasificada por lo que trae.
 *
 * Los nombres de las herramientas cambian de un agente a otro y de una versión a
 * otra: `powershell`, `run_terminal_command`, `run_command`. Lo que trae la
 * entrada cambia menos. Un comando es una llamada con un campo de comando; una
 * escritura, una herramienta que escribe, crea, edita o reemplaza, con una ruta.
 */
export function llamada(herramienta: string, entrada: unknown, codigo: number | null = null): Llamada {
  const comando = campo(entrada, CAMPOS_DE_COMANDO);
  const ruta = campo(entrada, CAMPOS_DE_RUTA);
  const skill = /skill/iu.test(herramienta) ? campo(entrada, CAMPOS_DE_SKILL) : null;
  let clase: Clase = 'otra';
  if (skill !== null) clase = 'skill';
  else if (comando !== null) clase = 'shell';
  else if (ruta !== null && /write|create|edit|replace|patch/iu.test(herramienta)) clase = 'escritura';
  return { herramienta, entrada, clase, comando, ruta, skill, codigo };
}

/** Todas las cadenas de una entrada, a cualquier profundidad. */
export function cadenasDe(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(cadenasDe);
  if (valor !== null && typeof valor === 'object') return Object.values(valor).flatMap(cadenasDe);
  return [];
}

/** Una ruta a un `SKILL.md`, con cualquier separador y sin importar mayúsculas. */
const RUTA_DE_SKILL = /skills[\\/]+([^\\/\s"'`]+)[\\/]+SKILL\.md/giu;

/**
 * Las skills cargadas: por la herramienta de skills, por el registro del agente
 * y por toda ruta a un `SKILL.md` en la entrada de cualquier herramienta.
 *
 * Solo las entradas. La salida de una herramienta puede listar skills que nadie
 * leyó, y el contenido de una skill cargada nombra a otras.
 */
export function skillsCargadas(t: Transcripcion): string[] {
  const nombres = new Set<string>(t.skillsInvocadas);
  for (const l of t.llamadas) {
    if (l.skill !== null) nombres.add(l.skill);
    for (const s of cadenasDe(l.entrada)) {
      for (const m of s.matchAll(RUTA_DE_SKILL)) nombres.add((m[1] as string).toLowerCase());
    }
  }
  return [...nombres].sort();
}

export const comandos = (t: Transcripcion): Llamada[] => t.llamadas.filter((l) => l.clase === 'shell');

export const escrituras = (t: Transcripcion): string[] =>
  t.llamadas.filter((l) => l.clase === 'escritura' && l.ruta !== null).map((l) => l.ruta as string);
