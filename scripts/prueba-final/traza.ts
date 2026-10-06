// Con qué se probó cada corrida, y si lo publicado sigue describiendo el arnés.
//
// Un veredicto sin el commit del arnés no dice qué probó. Con `--agregar` la
// raíz junta corridas de días distintos, y una celda que pasó con la base de
// la semana anterior se leía igual que una corrida ayer. Por eso cada veredicto
// anota el estado del arnés al empezar su serie, la huella de las instrucciones
// de mix que entraron a la copia, la de base.docx y la de las skills
// instaladas que leyó su agente. Con eso, el resumen marca la celda que un
// cambio posterior alcanza, según la tabla de `impacto.ts`, y que no se volvió
// a correr.
//
// Un veredicto que no anota nada de esto es de un ejecutor anterior a la traza.
// No se sabe con qué se probó, y por eso no se da por vigente.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DE_MIX } from './copia.ts';
import { afecta, clasificar, nombreDelCambio, type Cambio } from './impacto.ts';
import type { Veredicto } from './resumen.ts';
import { variantes, type Variante } from './variantes.ts';

/** El arnés al empezar una serie, según git. */
export type EstadoDelArnes = {
  /** El commit de HEAD, o null si git no respondió. */
  commit: string | null;
  /** Si había cambios sin commit, archivos nuevos incluidos. */
  sucio: boolean;
  /**
   * La huella de cada ruta que difería del commit, o null si estaba borrada.
   * Sirve para saber, después, si lo que se probó sin commit sigue igual.
   */
  sucios: Record<string, string | null>;
};

export type Traza = {
  arnes: EstadoDelArnes;
  /** La huella de cada instrucción de mix que entró a la copia de la corrida. */
  mix: Record<string, string>;
  /** La huella de base.docx al empezar la serie: de ahí salió el texto de la corrida. */
  docx: string;
  /** Las skills instaladas que lee el agente: dónde están y la huella de las del arnés. */
  instaladas: { directorio: string; huella: string } | null;
};

/** La traza de una serie entera: la de sus corridas, sin las instaladas, que son de cada agente. */
export type TrazaDeLaSerie = Omit<Traza, 'instaladas'>;

export type Vigencia = { estado: 'vigente' | 'desactualizada' | 'desconocida'; motivo: string };

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** La huella de cada instrucción de mix que existe. */
export function huellasDeMix(mix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const nombre of DE_MIX) {
    const ruta = join(mix, nombre);
    if (existsSync(ruta)) out[nombre] = sha256(readFileSync(ruta));
  }
  return out;
}

/**
 * Las rutas que cambiaron desde lo que se probó.
 *
 * `distintas` son las que hoy difieren del commit de la corrida. Una que ya
 * difería al probar y sigue con la misma huella no cambió: es lo que se probó.
 * Una que difería al probar y hoy ya no difiere volvió a lo del commit, que no
 * es lo que se probó, y cuenta como cambio.
 */
export function rutasCambiadas(
  distintas: readonly string[],
  sucios: Readonly<Record<string, string | null>>,
  huellaActual: (ruta: string) => string | null,
): string[] {
  const hoy = new Set(distintas);
  const cambiadas = distintas.filter((r) => !Object.hasOwn(sucios, r) || sucios[r] !== huellaActual(r));
  const devueltas = Object.keys(sucios).filter((r) => !hoy.has(r));
  return [...new Set([...cambiadas, ...devueltas])].sort();
}

/**
 * La traza de lo que hay en la raíz: la de la serie más antigua, o null si
 * alguna corrida no la anota. Lo que cambió desde la más antigua incluye lo que
 * cambió desde las demás, así que comparar desde ahí no deja nada afuera.
 */
export function trazaDeLaSerie(veredictos: readonly Veredicto[]): TrazaDeLaSerie | null {
  if (veredictos.length === 0 || veredictos.some((v) => v.metadatos.traza === undefined)) return null;
  const vieja = [...veredictos].sort((a, b) => a.serie.localeCompare(b.serie))[0] as Veredicto;
  const { arnes, mix, docx } = vieja.metadatos.traza as Traza;
  return { arnes, mix, docx };
}

/**
 * Los cambios respecto de lo registrado: las rutas del arnés, las
 * instrucciones de mix y base.docx. Lo que no se registró cuenta como cambio,
 * con una nota: lo desconocido no se da por igual.
 */
export function cambiosRespectoDe(
  registrado: { mix: Readonly<Record<string, string>> | null; docx: string | null },
  actual: { mix: Readonly<Record<string, string>>; docx: string },
  arnes: readonly string[],
): Cambio[] {
  const cambios: Cambio[] = arnes.map((ruta) => ({ origen: 'arnes', ruta }));
  for (const nombre of DE_MIX) {
    if (registrado.mix === null) cambios.push({ origen: 'mix', ruta: nombre, nota: 'la serie no registra su huella' });
    else if (registrado.mix[nombre] !== actual.mix[nombre]) cambios.push({ origen: 'mix', ruta: nombre });
  }
  if (registrado.docx === null) cambios.push({ origen: 'carpeta', ruta: 'base.docx', nota: 'la serie no registra su huella' });
  else if (registrado.docx !== actual.docx) cambios.push({ origen: 'carpeta', ruta: 'base.docx' });
  return cambios;
}

/** Hasta cinco nombres, y cuántos más. */
function enumerar(nombres: readonly string[]): string {
  const primeros = nombres.slice(0, 5).join(', ');
  return nombres.length > 5 ? `${primeros} y ${nombres.length - 5} más` : primeros;
}

/**
 * Si cada celda sigue describiendo el arnés de hoy.
 *
 * Una celda está desactualizada si, desde su corrida, cambió algo que la tabla
 * de impacto manda a correr de nuevo para su variante. Lo que solo juzga no
 * cuenta: eso se arregla con `--reevaluar`, sin correr. `cambiosDesde` es git,
 * y se consulta una vez por estado del arnés, no una por celda.
 */
export function vigenciaDe(
  veredictos: readonly Veredicto[],
  actual: { mix: Readonly<Record<string, string>>; docx: string },
  cambiosDesde: (arnes: EstadoDelArnes) => string[] | null,
  vs: readonly Variante[] = variantes(),
): Record<string, Vigencia> {
  const memoria = new Map<string, string[] | null>();
  const desde = (a: EstadoDelArnes) => {
    const clave = JSON.stringify(a);
    if (!memoria.has(clave)) memoria.set(clave, cambiosDesde(a));
    return memoria.get(clave) ?? null;
  };
  const out: Record<string, Vigencia> = {};
  for (const v of veredictos) {
    const clave = `${v.agente}/${v.variante}`;
    const t = v.metadatos.traza;
    if (t === undefined) {
      out[clave] = { estado: 'desconocida', motivo: 'no registra con qué arnés se probó' };
      continue;
    }
    const rutas = desde(t.arnes);
    if (rutas === null) {
      out[clave] = { estado: 'desconocida', motivo: `git no reconoce el commit ${t.arnes.commit?.slice(0, 7) ?? '(ninguno)'}` };
      continue;
    }
    const alcanzan = cambiosRespectoDe({ mix: t.mix, docx: t.docx }, actual, rutas)
      .map((c) => clasificar(c, vs))
      .filter((c) => afecta(c, v.variante));
    out[clave] =
      alcanzan.length === 0
        ? { estado: 'vigente', motivo: 'ningún cambio posterior la alcanza' }
        : { estado: 'desactualizada', motivo: `cambió después de la corrida: ${enumerar(alcanzan.map(nombreDelCambio))}` };
  }
  return out;
}
