// La carpeta de la prueba: lo que hay publicado en ella y su resumen.
//
// La raíz guarda una serie, con una carpeta por agente y una por variante
// dentro, y el resumen de lo que hay. En la corrida completa eso dejó de ser
// cierto: publicar movía al historial solo los pares que acababan de correr, y
// un agy/fonda de una serie anterior quedó en la raíz mientras el resumen del
// historial contaba una corrida que ya no estaba ahí. Lo que se lee y se mueve
// de la carpeta vive acá, para que publicar, sumar agentes y volver a juzgar
// lo hagan de una sola manera.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resumenJson, resumenMarkdown, type Suite, type Veredicto } from './resumen.ts';
import { variantes } from './variantes.ts';

/** La carpeta del historial dentro de la de la prueba. No es un agente. */
export const HISTORIAL = 'historial';

/** Una fecha como nombre de carpeta: sin dos puntos ni puntos. */
export const marca = (fecha: string): string => fecha.replace(/[:.]/gu, '-');

/** La fecha de la serie que hay en la raíz, según su resumen, o null si no hay. */
export function fechaPrevia(carpeta: string): string | null {
  try {
    const previo = JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8')) as { fecha?: unknown };
    return typeof previo.fecha === 'string' ? previo.fecha : null;
  } catch {
    return null;
  }
}

/** El resumen anterior entero, o null. Sirve para heredar el texto y la huella del documento. */
export function resumenPrevio(carpeta: string): Partial<Suite> | null {
  try {
    return JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8')) as Partial<Suite>;
  } catch {
    return null;
  }
}

const subcarpetas = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

/** Las corridas publicadas en la raíz: cada par de agente y variante con su veredicto. */
export function corridasPublicadas(carpeta: string): { agente: string; variante: string; dir: string }[] {
  const out: { agente: string; variante: string; dir: string }[] = [];
  for (const agente of subcarpetas(carpeta)) {
    if (agente === HISTORIAL) continue;
    for (const variante of subcarpetas(join(carpeta, agente))) {
      const dir = join(carpeta, agente, variante);
      if (existsSync(join(dir, 'veredicto.json'))) out.push({ agente, variante, dir });
    }
  }
  return out;
}

/** Las carpetas de agente de la raíz: las que tienen alguna corrida publicada. */
export const carpetasDeAgentes = (carpeta: string): string[] => [...new Set(corridasPublicadas(carpeta).map((c) => c.agente))];

/**
 * Un veredicto leído de disco, con lo que un ejecutor anterior no anotaba.
 * `serie` cae en la fecha de la serie que había en la raíz, que es la mejor
 * aproximación que queda.
 */
export function leerVeredicto(archivo: string, serieAnterior: string | null): Veredicto {
  const v = JSON.parse(readFileSync(archivo, 'utf8')) as Veredicto & Partial<Pick<Veredicto, 'error' | 'serie'>>;
  return {
    ...v,
    error: v.error ?? null,
    serie: v.serie ?? serieAnterior ?? (v.metadatos as { inicio?: string } | undefined)?.inicio ?? '',
  };
}

/** Mueve un archivo o una carpeta, creando lo que haga falta. No hace nada si no existe. */
export function mover(desde: string, hasta: string): void {
  if (!existsSync(desde)) return;
  mkdirSync(dirname(hasta), { recursive: true });
  renameSync(desde, hasta);
}

/** El orden de las variantes del registro, para ordenar la matriz. */
const ORDEN_DE_VARIANTES = variantes().map((v) => v.id);

const posicion = (xs: readonly string[], x: string) => {
  const i = xs.indexOf(x);
  return i < 0 ? xs.length : i;
};

/**
 * El resumen de todo lo que hay en la raíz, armado desde los veredictos.
 *
 * `conocidos` da el orden de las columnas y dice cuáles faltan; un agente que
 * no está entre ellos va al final. Cada agente lleva la fecha de su serie, que
 * es lo que deja leer una matriz armada con series distintas.
 */
export function suiteDeLaCarpeta(
  carpeta: string,
  base: Pick<Suite, 'fecha' | 'texto' | 'docx'>,
  conocidos: readonly string[],
  serieAnterior: string | null,
): Suite {
  const veredictos = corridasPublicadas(carpeta).map((c) => leerVeredicto(join(c.dir, 'veredicto.json'), serieAnterior));
  const presentes = [...new Set(veredictos.map((v) => v.agente))];
  const agentes = presentes.sort((a, b) => posicion(conocidos, a) - posicion(conocidos, b) || a.localeCompare(b));
  const variantesDeLaCarpeta = [...new Set(veredictos.map((v) => v.variante))].sort(
    (a, b) => posicion(ORDEN_DE_VARIANTES, a) - posicion(ORDEN_DE_VARIANTES, b) || a.localeCompare(b),
  );
  const series: Record<string, string> = {};
  for (const v of veredictos) if ((series[v.agente] ?? '') < v.serie) series[v.agente] = v.serie;
  veredictos.sort(
    (a, b) => posicion(variantesDeLaCarpeta, a.variante) - posicion(variantesDeLaCarpeta, b.variante) || posicion(agentes, a.agente) - posicion(agentes, b.agente),
  );
  return {
    ...base,
    carpeta,
    agentes,
    omitidos: conocidos.filter((a) => !presentes.includes(a)),
    series,
    variantes: variantesDeLaCarpeta,
    veredictos,
  };
}

export function escribirResumen(carpeta: string, suite: Suite): void {
  writeFileSync(join(carpeta, 'resumen.md'), resumenMarkdown(suite));
  writeFileSync(join(carpeta, 'resumen.json'), `${JSON.stringify(resumenJson(suite), null, 2)}\n`);
}
