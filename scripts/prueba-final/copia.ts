// La copia de trabajo de cada corrida.
//
// En la primera corrida de humo, Grok buscó en el ejecutor cómo se comprueban
// los hechos, leyó el módulo de las anclas, lo importó y revisó con él su propia
// salida antes de entregarla. Su «pasa» en los datos conservados ya no medía lo
// que hacen las skills, sino que el agente había encontrado el oráculo. Trabajaba
// en mix, donde el código de la prueba estaba a un `grep` de distancia.
//
// Desde entonces cada corrida trabaja en una copia, dentro de su propia carpeta
// temporal, con lo que necesita quien usa el arnés y nada de lo que lo juzga:
//
// - las instrucciones de mix, `AGENTS.md` y `CLAUDE.md`, que son por donde
//   entra un agente;
// - lo que git rastrea de writing-harness, sin el código de la prueba, sus
//   pruebas, sus fixtures ni `odd/`. Sin `.git`, sin `node_modules` y sin nada
//   que git no rastree, para que la copia sea la misma en cada corrida y su
//   huella diga cuál fue.
//
// La huella de cada archivo copiado se toma antes de lanzar al agente y se
// vuelve a tomar al final: así se sabe qué tocó dentro de la copia, cosa que el
// `git status` de los repositorios reales ya no puede ver.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** La carpeta de la copia dentro de la carpeta de cada corrida. Es la carpeta de trabajo del agente. */
export const CARPETA_DE_LA_COPIA = 'mix';

/** Dónde queda el arnés dentro de la copia: el mismo lugar que ocupa en mix. */
export const ARNES_EN_LA_COPIA = 'writing-harness';

/** Lo que se toma de mix: las instrucciones por donde entra un agente. */
export const DE_MIX = ['AGENTS.md', 'CLAUDE.md'] as const;

/**
 * Lo que no se copia del arnés, relativo a su raíz: el código de esta prueba,
 * sus pruebas, sus fixtures y el documento de la tarea.
 *
 * La comprobación de aislamiento lee esta misma lista para decidir qué rutas no
 * puede tocar un agente. Un archivo nuevo de la prueba que quede fuera de estos
 * patrones entra a la copia y queda al alcance de las corridas.
 */
export const EXCLUIDOS = [
  'scripts/prueba-final.ts',
  'scripts/prueba-final/**',
  'evals/prueba-final*',
  'evals/fixtures/prueba-final/**',
  'odd/**',
] as const;

/**
 * Un archivo en `open-slide/`, para que la carpeta no quede vacía.
 *
 * El prefacio de las instrucciones de mix dice que, si `writing-harness/` u
 * `open-slide/` están vacías, la sesión está en un worktree y hay que poblarlas
 * con `npm run worktree`. En la copia no hay `package.json` de mix ni sus
 * scripts, así que un agente que obedeciera gastaría la corrida en un comando
 * que no puede andar. Ninguna variante usa open-slide, y copiarlo entero no
 * aporta nada. La ausencia no se puede probar inofensiva, porque depende de cómo
 * lea cada agente esa frase; un marcador sí se puede probar. Su texto repite lo
 * que mix ya dice de open-slide y no menciona ninguna prueba.
 */
export const MARCADOR_DE_OPEN_SLIDE = {
  ruta: 'open-slide/README.md',
  contenido: '# open-slide\n\nFramework de presentaciones hecho para agentes.\n',
} as const;

export type Archivo = { ruta: string; desde: string } | { ruta: string; contenido: string };

export type PlanDeLaCopia = {
  /** Cada archivo de la copia, con su ruta relativa a ella y barras normales. */
  archivos: Archivo[];
  /** Las instrucciones de mix que se copian. */
  deMix: string[];
  /** Cuántos archivos del arnés entran. */
  delArnes: number;
  /** Los archivos rastreados del arnés que quedan fuera, relativos a su raíz. */
  excluidos: string[];
  /** Lo que tendría que estar y no está en disco, relativo a la copia. */
  faltan: string[];
};

/** La huella sha256 de cada archivo, por su ruta relativa con barras normales. */
export type Huellas = Record<string, string>;

export type CambiosDeLaCopia = { modificados: string[]; borrados: string[]; nuevos: string[] };

/** Un patrón de `EXCLUIDOS` como expresión regular, sin anclas. */
function aRegex(patron: string): string {
  const carpeta = patron.endsWith('/**');
  const cuerpo = (carpeta ? patron.slice(0, -3) : patron).replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '[^/]*');
  return carpeta ? `${cuerpo}(?:/.*)?` : cuerpo;
}

const ALTERNATIVAS = EXCLUIDOS.map(aRegex).join('|');
const DESDE_LA_RAIZ = new RegExp(`^(?:${ALTERNATIVAS})$`, 'iu');
/** En cualquier ruta: el patrón empieza en un segmento, con lo que sea delante. */
const EN_CUALQUIER_RUTA = new RegExp(`(?:^|/)(?:${ALTERNATIVAS})$`, 'iu');

/** Si un archivo del arnés, por su ruta relativa a la raíz, queda fuera de la copia. */
export const excluido = (ruta: string): boolean => DESDE_LA_RAIZ.test(ruta.replace(/\\/gu, '/'));

/**
 * Si una ruta, escrita como sea, es del código de la prueba.
 *
 * Relativa o absoluta, con barras de cualquier lado, con barras dobles como
 * quedan dentro de una cadena escapada, y también la carpeta sola, que es como
 * la buscó Grok. Una palabra suelta sin ninguna barra no cuenta: «odd» puede ser
 * cualquier cosa en un comando.
 */
export function esCodigoDeLaPrueba(ruta: string): boolean {
  const n = ruta.replace(/[\\/]+/gu, '/');
  if (!n.includes('/')) return false;
  return EN_CUALQUIER_RUTA.test(n.replace(/\/$/u, ''));
}

const esArchivo = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * Qué lleva la copia.
 *
 * `rastreados` es la salida de `git ls-files` del arnés. Un archivo rastreado que
 * falta en disco se anota y no se inventa; uno de mix que falta, también.
 */
export function planDeLaCopia(o: {
  mix: string;
  arnes: string;
  rastreados: readonly string[];
  existe?: (p: string) => boolean;
}): PlanDeLaCopia {
  const existe = o.existe ?? esArchivo;
  const archivos: Archivo[] = [];
  const faltan: string[] = [];
  const deMix: string[] = [];
  for (const nombre of DE_MIX) {
    const desde = join(o.mix, nombre);
    if (existe(desde)) {
      archivos.push({ ruta: nombre, desde });
      deMix.push(nombre);
    } else {
      faltan.push(nombre);
    }
  }
  archivos.push({ ruta: MARCADOR_DE_OPEN_SLIDE.ruta, contenido: MARCADOR_DE_OPEN_SLIDE.contenido });
  const excluidos: string[] = [];
  let delArnes = 0;
  for (const r of [...new Set(o.rastreados.map((x) => x.replace(/\\/gu, '/')))].sort()) {
    if (excluido(r)) {
      excluidos.push(r);
      continue;
    }
    const desde = join(o.arnes, ...r.split('/'));
    if (!existe(desde)) {
      faltan.push(`${ARNES_EN_LA_COPIA}/${r}`);
      continue;
    }
    archivos.push({ ruta: `${ARNES_EN_LA_COPIA}/${r}`, desde });
    delArnes++;
  }
  return { archivos, deMix, delArnes, excluidos, faltan };
}

const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

/** Arma la copia en `destino` y devuelve la huella de cada archivo. */
export function construirCopia(plan: PlanDeLaCopia, destino: string): Huellas {
  const huellas: Huellas = {};
  for (const a of plan.archivos) {
    const hacia = join(destino, ...a.ruta.split('/'));
    mkdirSync(dirname(hacia), { recursive: true });
    if ('desde' in a) copyFileSync(a.desde, hacia);
    else writeFileSync(hacia, a.contenido);
    huellas[a.ruta] = sha256(readFileSync(hacia));
  }
  return huellas;
}

/**
 * La huella de cada archivo de una carpeta, a cualquier profundidad.
 *
 * Un enlace no se sigue: se registra a dónde apunta. Seguirlo podría sacar la
 * lectura de la copia, y un enlace nuevo ya es un cambio que se informa.
 */
export function huellasDe(dir: string): Huellas {
  const huellas: Huellas = {};
  if (!existsSync(dir)) return huellas;
  const recorrer = (d: string) => {
    for (const nombre of readdirSync(d)) {
      const p = join(d, nombre);
      const st = lstatSync(p);
      const ruta = relative(dir, p).replace(/\\/gu, '/');
      if (st.isSymbolicLink()) huellas[ruta] = sha256(`enlace:${readlinkSync(p)}`);
      else if (st.isDirectory()) recorrer(p);
      else if (st.isFile()) huellas[ruta] = sha256(readFileSync(p));
    }
  };
  recorrer(dir);
  return huellas;
}

/** Una sola huella para la copia entera: la de cada ruta con la de su contenido, en orden. */
export function huellaDeLaCopia(h: Huellas): string {
  const lineas = Object.keys(h)
    .sort()
    .map((r) => `${r}\t${h[r]}\n`);
  return sha256(lineas.join(''));
}

/** Lo que cambió entre dos tomas de huellas, cada lista en orden. */
export function cambiosDeLaCopia(antes: Huellas, despues: Huellas): CambiosDeLaCopia {
  const modificados: string[] = [];
  const borrados: string[] = [];
  for (const [r, h] of Object.entries(antes)) {
    if (!Object.hasOwn(despues, r)) borrados.push(r);
    else if (despues[r] !== h) modificados.push(r);
  }
  const nuevos = Object.keys(despues).filter((r) => !Object.hasOwn(antes, r));
  return { modificados: modificados.sort(), borrados: borrados.sort(), nuevos: nuevos.sort() };
}
