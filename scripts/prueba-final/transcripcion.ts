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
  /**
   * El error que el propio agente informa, en una frase corta, o null. Es del
   * agente y no de las skills: una cuota agotada, una sesión vencida.
   */
  error: string | null;
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
    error: null,
  };
}

/** Lo más largo que puede ser un motivo: entra en una celda del resumen. */
const LARGO_DE_UN_MOTIVO = 160;

/**
 * Un error de un agente en una frase corta, para la celda del resumen.
 *
 * Los dos que más importan se reconocen por su texto y se dicen igual para los
 * tres agentes: la cuota agotada, con su estado, su código y cuándo vuelve si
 * el agente lo dice, y la sesión vencida, que se arregla iniciándola de nuevo.
 * Cualquier otro queda en su primera línea.
 */
export function motivoDeError(texto: string): string {
  const t = texto.trim();
  if (/quota|RESOURCE_EXHAUSTED|rate.?limit|\b429\b|too many requests/iu.test(t)) {
    const estado = /\b([A-Z]+(?:_[A-Z]+)+)\b/u.exec(t)?.[1];
    const codigo = /\b([45]\d\d)\b/u.exec(t)?.[1];
    const entre = [estado, codigo].filter(Boolean).join(' ');
    const r = /resets?\s+in\s+(\d+h)?\s*(\d+m)?\s*(\d+s)?/iu.exec(t);
    const cuando = r ? (r[1] || r[2] ? `${r[1] ?? ''}${r[2] ?? ''}` : (r[3] ?? '')) : '';
    return `cuota agotada${entre ? ` (${entre})` : ''}${cuando ? `, vuelve en ${cuando}` : ''}`;
  }
  if (/not (?:logged|signed) in|unauthori[sz]ed|\b401\b|authenticat|(?:session|token) (?:has )?expired/iu.test(t)) {
    return 'sesión vencida';
  }
  const linea = t.split(/\r?\n/u)[0]?.trim() ?? '';
  return linea.length <= LARGO_DE_UN_MOTIVO ? linea : `${linea.slice(0, LARGO_DE_UN_MOTIVO - 1)}…`;
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
  const { completas, parciales } = lecturasDeSkills(t);
  return [...completas, ...parciales].sort();
}

/** Un nombre de skill de verdad: un comodín como `*` en una búsqueda no es ninguna. */
const NOMBRE_DE_SKILL = /^[a-z0-9][a-z0-9-]*$/u;

/** Los campos con que una herramienta lee un tramo y no el archivo entero. */
const CAMPOS_DE_TRAMO = ['offset', 'limit', 'view_range', 'StartLine', 'EndLine', 'start_line', 'end_line', 'startLine', 'endLine'];

/** Los campos con que una herramienta busca dentro de un archivo en vez de leerlo. */
const CAMPOS_DE_BUSQUEDA = ['pattern', 'query', 'regex'];

/** Un comando que busca o recorta en vez de leer entero. */
const COMANDO_PARCIAL = /select-string|\bgrep\b|\brg\b|findstr|select-object\s+-(?:first|last|skip)|-totalcount\b|-tail\b|\bhead\b|\btail\b|\bsed\s+-n\b/iu;

function esParcial(l: Llamada): boolean {
  const e = l.entrada !== null && typeof l.entrada === 'object' ? (l.entrada as Record<string, unknown>) : {};
  if (CAMPOS_DE_TRAMO.some((c) => e[c] !== undefined && e[c] !== null)) return true;
  if (CAMPOS_DE_BUSQUEDA.some((c) => typeof e[c] === 'string')) return true;
  return l.comando !== null && COMANDO_PARCIAL.test(l.comando);
}

/**
 * Qué skills se leyeron enteras y cuáles solo en parte.
 *
 * Una lectura con desplazamiento, límite, rango o líneas de inicio y fin es
 * parcial, y una búsqueda dentro de la skill es una consulta. En la corrida
 * completa, Grok leyó spanish-writing con un límite de doscientas o
 * cuatrocientas líneas, y en otra corrida leyó cincuenta líneas de atenas para
 * consultar algo: las dos cosas salían como skills cargadas. La herramienta de
 * skills y el registro del propio agente cargan la skill entera. Una skill
 * leída entera alguna vez no figura entre las parciales.
 */
export function lecturasDeSkills(t: Transcripcion): { completas: string[]; parciales: string[] } {
  const completas = new Set<string>(t.skillsInvocadas);
  const parciales = new Set<string>();
  for (const l of t.llamadas) {
    if (l.skill !== null) completas.add(l.skill);
    const parcial = esParcial(l);
    for (const s of cadenasDe(l.entrada)) {
      for (const m of s.matchAll(RUTA_DE_SKILL)) {
        const nombre = (m[1] as string).toLowerCase();
        if (!NOMBRE_DE_SKILL.test(nombre)) continue;
        (parcial ? parciales : completas).add(nombre);
      }
    }
  }
  return { completas: [...completas].sort(), parciales: [...parciales].filter((n) => !completas.has(n)).sort() };
}

export const comandos = (t: Transcripcion): Llamada[] => t.llamadas.filter((l) => l.clase === 'shell');

export const escrituras = (t: Transcripcion): string[] =>
  t.llamadas.filter((l) => l.clase === 'escritura' && l.ruta !== null).map((l) => l.ruta as string);
