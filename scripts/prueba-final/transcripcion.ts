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
 * y por toda ruta a un `SKILL.md` que una herramienta o un comando leyó.
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

/**
 * El campo con que una lectura de codex dice que su salida llegó recortada: el
 * tope de tokens de `exec_command` deja fuera lo que pasa de él, y el agente
 * lee solo un tramo aunque el comando imprima el archivo entero (ver
 * `parsearCodex`).
 */
export const CAMPO_DE_SALIDA_TRUNCADA = 'salida_truncada';

/** Los campos con que una herramienta busca dentro de un archivo en vez de leerlo. */
const CAMPOS_DE_BUSQUEDA = ['pattern', 'query', 'regex'];

/** Un comando que busca o recorta en vez de leer entero. */
const COMANDO_PARCIAL = /select-string|\bgrep\b|\brg\b|findstr|select-object\s+-(?:first|last|skip)|-totalcount\b|-tail\b|\bhead\b|\btail\b|\bsed\s+-n\b/iu;

/**
 * Una herramienta que lee el archivo de su ruta: `view` de Copilot,
 * `read_file` de Grok, `view_file` de Antigravity. Una que lo borra, lo mueve o
 * lo lista no lo lee, aunque su ruta sea un `SKILL.md`.
 */
const HERRAMIENTA_DE_LECTURA = /read|view|open|show|^cat$/iu;

/**
 * Un programa que imprime un archivo, o un tramo de él, escrito como comando: al
 * principio del paso o después de una tubería, un paréntesis, una llave o una
 * asignación. `Test-Path`, `ls` o `echo` nombran la ruta sin leerla.
 */
const COMANDO_QUE_LEE =
  /(?:^|[\s(|{=])(?:cat|type|get-content|gc|head|tail|less|more|bat|sed|awk|grep|egrep|rg|select-string|sls|findstr)(?=\s)/iu;

/** Los pasos de un comando: lo que separan `;`, `&&`, `||` o un salto de línea. Una tubería es un solo paso. */
const PASOS = /;|&&|\|\||\r?\n/u;

/**
 * Una asignación de un valor literal que ocupa un paso entero: en PowerShell,
 * `$p='…'` o `$p = "…"`; en un shell POSIX, `p=…`, `p="…"` o `export p='…'`.
 * El valor de una variable de entorno de PowerShell (`$env:p`) no se resuelve.
 */
const ASIGNACION =
  /^\s*(?:\$([a-z_]\w*)\s*=\s*(?:'([^']*)'|"([^"]*)")|(?:export\s+)?([a-z_]\w*)=(?:'([^']*)'|"([^"]*)"|([^\s'"]*)))\s*$/iu;

/**
 * Los pasos de un comando con las variables ya resueltas.
 *
 * En la serie de codex del 2026-10-14, codex guardó la carpeta de skills en una
 * variable y leyó con ella: `$p='…\skills'; Get-Content "$p\freddy-writing\SKILL.md"`.
 * El paso que lee no dice «skills», y la skill no salía leída. Cada asignación
 * de un valor literal vale para los pasos que la siguen, y una referencia,
 * `$p` o `${p}`, se reemplaza por su valor. Una variable que no se asignó en
 * el mismo comando queda como está.
 */
function pasosResueltos(comando: string): string[] {
  const valores = new Map<string, string>();
  return comando.split(PASOS).map((paso) => {
    const resuelto = paso.replace(
      /\$(?:\{([a-z_]\w*)\}|([a-z_]\w*)(?![\w:]))/giu,
      (todo: string, llave?: string, suelta?: string) => valores.get((llave ?? suelta ?? '').toLowerCase()) ?? todo,
    );
    const m = ASIGNACION.exec(resuelto);
    if (m !== null) {
      const nombre = (m[1] ?? m[4] ?? '').toLowerCase();
      valores.set(nombre, m[2] ?? m[3] ?? m[5] ?? m[6] ?? m[7] ?? '');
    }
    return resuelto;
  });
}

/**
 * Un script de node pasado en la línea, con `-e`, `--eval`, `-p` o `--print`,
 * entre comillas dobles o simples. Dentro de las comillas, una barra invertida
 * escapa el carácter que sigue, así que `\\` y `\"` no cierran el script.
 */
const SCRIPT_DE_NODE = /(?<=^|[\s(|{;&])node(?:\.exe)?\s+(?:-e|--eval|-p|--print)\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/giu;

/** Una función de node que lee el archivo cuya ruta recibe. `existsSync` o `statSync` la nombran sin leerla. */
const NODE_QUE_LEE = /\b(?:readFileSync|readFile|createReadStream)\s*\(/u;

/** Un script que se queda con un tramo de lo que leyó. */
const NODE_PARCIAL = /\.(?:slice|substring|substr)\s*\(/u;

/** Las cadenas literales de un script de JavaScript, sin las plantillas que interpolan. */
const LITERAL_DE_JS = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`([^`$]*)`/gu;

/** `join(…, '<skill>', 'SKILL.md')` o `resolve(…)`, con los dos últimos argumentos literales. */
const JOIN_DE_SKILL = /\b(?:join|resolve)\s*\([^()]*?,\s*['"`]([a-z0-9][a-z0-9-]*)['"`]\s*,\s*['"`]SKILL\.md['"`]\s*\)/giu;

/** El comienzo del primer argumento de una función de node que escribe: la ruta adonde escribe. */
const NODE_QUE_ESCRIBE = /\b(?:writeFileSync|appendFileSync|writeFile|appendFile|createWriteStream)\s*\(\s*/gu;

/**
 * Dónde empiezan, en un script, las rutas a las que escribe. Con un prefijo
 * de objeto delante de la ruta (`path.join(…)`), la ruta empieza después de él.
 */
function rutasEscritas(script: string): (indice: number) => boolean {
  const comienzos = [...script.matchAll(NODE_QUE_ESCRIBE)].map((m) => (m.index ?? 0) + m[0].length);
  return (indice) => comienzos.some((c) => c <= indice && /^[\w$.]*$/u.test(script.slice(c, indice)));
}

/**
 * Los scripts de `node -e` de un comando que leen archivos, cada uno con las
 * rutas que nombra, y el comando sin ellos.
 *
 * En la segunda serie de codex del 2026-10-14, codex leyó las skills con un
 * script que recorre una lista de rutas y las imprime con `readFileSync`. El
 * script tiene sus propios `;` y ninguno de sus pasos empieza con un programa
 * que lee, así que se mira entero y antes de partir el comando: si llama a una
 * función que lee, cada cadena literal suya es una ruta leída, y también
 * `path.join(raiz, '<skill>', 'SKILL.md')` si el script nombra la carpeta
 * `skills`. La ruta que es el primer argumento de una función que escribe,
 * literal o con `join`, no se lee. Es una aproximación: un script que lee un
 * archivo y solo comprueba otro los da a los dos por leídos, y una ruta de
 * escritura guardada antes en una variable también cuenta como leída. Uno que
 * no llama a ninguna función que lee, como el que solo usa `existsSync`, no
 * lee nada.
 */
function scriptsDeNode(comando: string): { lecturas: { rutas: string[]; parcial: boolean }[]; resto: string } {
  const lecturas: { rutas: string[]; parcial: boolean }[] = [];
  const resto = comando.replace(SCRIPT_DE_NODE, (_todo: string, dobles?: string, simples?: string) => {
    const script = dobles ?? simples ?? '';
    if (!NODE_QUE_LEE.test(script)) return 'node -e ""';
    const escrita = rutasEscritas(script);
    const rutas = [...script.matchAll(LITERAL_DE_JS)].filter((m) => !escrita(m.index ?? 0)).map((m) => m[1] ?? m[2] ?? m[3] ?? '');
    if (/skills/iu.test(script)) {
      for (const m of script.matchAll(JOIN_DE_SKILL)) if (!escrita(m.index ?? 0)) rutas.push(`skills/${m[1] as string}/SKILL.md`);
    }
    lecturas.push({ rutas, parcial: NODE_PARCIAL.test(script) });
    // El script ya se leyó: lo que queda del comando se lee por pasos.
    return 'node -e ""';
  });
  return { lecturas, resto };
}

/** Los comodines de un patrón: una ruta que los lleva no es la de un archivo. */
const COMODIN = /[*?]/u;

/**
 * Lo que lee una llamada: el texto donde están las rutas y si lo lee entero.
 * `directa` dice que cada ruta del texto se leyó, sin que haga falta un
 * programa que lee delante (las de un script de node que lee).
 */
type Lectura = { texto: string; parcial: boolean; directa?: boolean };

/** La entrada de una llamada como objeto, o vacía si el agente no dio uno. */
function entradaDe(l: Llamada): Record<string, unknown> {
  return l.entrada !== null && typeof l.entrada === 'object' ? (l.entrada as Record<string, unknown>) : {};
}

function esParcial(l: Llamada): boolean {
  const e = entradaDe(l);
  if (CAMPOS_DE_TRAMO.some((c) => e[c] !== undefined && e[c] !== null)) return true;
  return CAMPOS_DE_BUSQUEDA.some((c) => typeof e[c] === 'string');
}

/**
 * Lo que una llamada lee, para buscar ahí las rutas de skills.
 *
 * Nombrar la ruta no alcanza. Una herramienta de lectura, o una que busca dentro
 * de un archivo, lee la ruta de su campo de ruta, y nada más de su entrada. Un
 * comando lee las rutas de cada paso que empieza a leer antes de nombrarlas: en
 * `Test-Path x; Get-Content y` se lee `y` y no `x`. Lo que escribe una
 * herramienta, ni su ruta ni su contenido, no se lee.
 */
function lecturasDe(l: Llamada): Lectura[] {
  if (l.clase === 'shell' && l.comando !== null) {
    const truncada = entradaDe(l)[CAMPO_DE_SALIDA_TRUNCADA] !== undefined;
    const { lecturas, resto } = scriptsDeNode(l.comando);
    return [
      ...lecturas.map((s) => ({ texto: s.rutas.join(' '), parcial: truncada || s.parcial, directa: true })),
      ...pasosResueltos(resto).map((paso) => ({ texto: paso, parcial: truncada || COMANDO_PARCIAL.test(paso) })),
    ];
  }
  if (l.clase !== 'otra' || l.ruta === null) return [];
  const entrada = entradaDe(l);
  const busca = CAMPOS_DE_BUSQUEDA.some((c) => typeof entrada[c] === 'string');
  if (!busca && !HERRAMIENTA_DE_LECTURA.test(l.herramienta)) return [];
  return [{ texto: l.ruta, parcial: esParcial(l) }];
}

/** Las skills cuya ruta aparece en lo que lee un paso, con la condición de un comando si lo es. */
function skillsLeidas(lectura: Lectura, comando: boolean): string[] {
  const out: string[] = [];
  for (const m of lectura.texto.matchAll(RUTA_DE_SKILL)) {
    const nombre = (m[1] as string).toLowerCase();
    if (!NOMBRE_DE_SKILL.test(nombre)) continue;
    const antes = lectura.texto.slice(0, m.index);
    // La ruta entera, desde el último espacio o comilla: `C:\Users\*\...` es un patrón.
    const ruta = `${/[^\s"'`]*$/u.exec(antes)?.[0] ?? ''}${m[0]}`;
    if (COMODIN.test(ruta)) continue;
    if (comando && lectura.directa !== true) {
      if (!COMANDO_QUE_LEE.test(antes)) continue;
      // `cat > ruta` escribe en la ruta: la redirección la vuelve destino.
      if (/>\s*["'`]?[^\s"'`]*$/u.test(antes)) continue;
    }
    out.push(nombre);
  }
  return out;
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
 *
 * Solo cuenta lo que se leyó (ver `lecturasDe`). En la revisión de la rama, un
 * `Test-Path`, un patrón de búsqueda o el cuerpo de un archivo escrito que
 * nombraban la ruta daban la skill por cargada sin que nadie la abriera.
 */
export function lecturasDeSkills(t: Transcripcion): { completas: string[]; parciales: string[] } {
  const completas = new Set<string>(t.skillsInvocadas);
  const parciales = new Set<string>();
  for (const l of t.llamadas) {
    if (l.skill !== null) completas.add(l.skill);
    for (const lectura of lecturasDe(l)) {
      for (const nombre of skillsLeidas(lectura, l.clase === 'shell')) (lectura.parcial ? parciales : completas).add(nombre);
    }
  }
  return { completas: [...completas].sort(), parciales: [...parciales].filter((n) => !completas.has(n)).sort() };
}

export const comandos = (t: Transcripcion): Llamada[] => t.llamadas.filter((l) => l.clase === 'shell');

export const escrituras = (t: Transcripcion): string[] =>
  t.llamadas.filter((l) => l.clase === 'escritura' && l.ruta !== null).map((l) => l.ruta as string);
