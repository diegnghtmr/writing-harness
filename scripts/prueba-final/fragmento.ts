// El texto que reciben los agentes: el fragmento, o el documento completo.
//
// El fragmento es el «Resumen» en español y el apartado «1. Introducción»
// entero, y se elige por título, no por posición. Una selección por número de
// párrafo se corre en cuanto alguien agrega una línea al documento, y entonces
// los agentes reciben otra cosa sin que nadie se entere. Por eso, si los títulos
// no están, la prueba no corre: no adivina.
//
// Los títulos van como líneas llanas, sin `#`. El verificador rechaza el
// Markdown en el texto entregado con severidad error, así que un `#` en la
// entrada haría fallar al agente que conserva la forma que recibió, y la falla
// sería del ejecutor.

import { countWords } from '../../src/text.ts';
import type { Parrafo } from './docx.ts';
import { ErrorDeUso } from './errores.ts';

export type Seccion = { titulo: string; palabras: number; parrafos: Parrafo[] };

export type Texto = {
  modo: 'fragmento' | 'completo';
  secciones: Seccion[];
  texto: string;
  palabras: number;
};

/** Un título sin mayúsculas, sin tildes y sin su numeración: «1. Introducción» es «introduccion». */
export function normalizarTitulo(t: string): string {
  return t
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/^\s*\d+(?:\.\d+)*\.?\s*/u, '')
    .trim();
}

/** Las secciones del fragmento: la clave con que se busca y el nombre con que se dice. */
export const SECCIONES_DEL_FRAGMENTO = [
  { clave: 'resumen', nombre: 'Resumen' },
  { clave: 'introduccion', nombre: 'Introducción' },
] as const;

// Una tabla no corta una sección: el rótulo de una celda puede ir en negrita y
// parecer un título.
const corta = (p: Parrafo, nivel: number) => !p.enTabla && p.nivel > 0 && p.nivel <= nivel;

/**
 * Una sección: su título y lo que sigue hasta el próximo título de su nivel o de
 * uno más alto. Los subtítulos de adentro quedan dentro.
 */
export function seccion(parrafos: readonly Parrafo[], clave: string, nombre: string): Seccion {
  const i = parrafos.findIndex((p) => !p.enTabla && p.nivel > 0 && normalizarTitulo(p.texto) === clave);
  const titulo = parrafos[i];
  if (titulo === undefined) {
    throw new ErrorDeUso(
      `el documento no tiene un título «${nombre}». El fragmento se elige por título y no por posición; ` +
        'con --completo se usa el documento entero.',
    );
  }
  let fin = i + 1;
  while (fin < parrafos.length && !corta(parrafos[fin] as Parrafo, titulo.nivel)) fin++;
  const propios = parrafos.slice(i, fin).filter((p) => !p.enTabla);
  return { titulo: titulo.texto, parrafos: propios, palabras: countWords(propios.map((p) => p.texto).join(' ')) };
}

/** Los párrafos como texto: uno por bloque, separados por una línea en blanco. */
export function comoTexto(parrafos: readonly Parrafo[]): string {
  return `${parrafos.map((p) => p.texto.trim()).join('\n\n')}\n`;
}

function armar(modo: Texto['modo'], secciones: Seccion[]): Texto {
  const texto = comoTexto(secciones.flatMap((s) => s.parrafos));
  return { modo, secciones, texto, palabras: countWords(texto) };
}

/** El Resumen y la Introducción, sin el Abstract que va entre los dos. */
export function fragmento(parrafos: readonly Parrafo[]): Texto {
  return armar(
    'fragmento',
    SECCIONES_DEL_FRAGMENTO.map((s) => seccion(parrafos, s.clave, s.nombre)),
  );
}

/**
 * El documento entero menos las tablas.
 *
 * En el documento de la prueba las tablas son el diagrama del apartado 2, y lo
 * que tienen escrito son rótulos sueltos, no prosa. El texto de los cuadros de
 * un dibujo ya no llega hasta acá. Las referencias sí entran: son parte del
 * documento que una persona pegaría entero.
 */
export function completo(parrafos: readonly Parrafo[]): Texto {
  const propios = parrafos.filter((p) => !p.enTabla);
  return armar('completo', [
    { titulo: 'Documento completo', parrafos: propios, palabras: countWords(propios.map((p) => p.texto).join(' ')) },
  ]);
}
