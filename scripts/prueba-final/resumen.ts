// El resumen de una serie de corridas, en Markdown para leer y en JSON para
// procesar.
//
// La matriz va con una fila por variante y una columna por agente, porque son
// quince variantes y tres agentes: al revés no cabría en una pantalla. Cada
// celda dice su estado y los números de las comprobaciones que lo causaron, y
// la leyenda de esos números va debajo, salida de los mismos nombres que usan
// los veredictos.

import { NOMBRES, type Comprobacion, type Estado } from './comprobaciones.ts';
import type { Costo } from './transcripcion.ts';

export type Metadatos = {
  version: string | null;
  modelo: string | null;
  /** Lo que tardó la corrida, medido por el ejecutor. */
  duracionMs: number;
  /** Lo que el agente dice que tardó, si lo dice. */
  duracionAgenteMs: number | null;
  /** El código con que salió el proceso del agente. */
  codigo: number | null;
  /** Si el ejecutor lo cortó al llegar al límite. */
  vencido: boolean;
  costo: Costo | null;
  sesion: string | null;
  inicio: string;
  fin: string;
};

export type Veredicto = {
  agente: string;
  variante: string;
  estado: Estado;
  comprobaciones: Comprobacion[];
  metadatos: Metadatos;
};

export type Suite = {
  fecha: string;
  carpeta: string;
  texto: { modo: 'fragmento' | 'completo'; palabras: number; secciones: { titulo: string; palabras: number }[] };
  docx: { antes: string; despues: string };
  agentes: string[];
  variantes: string[];
  veredictos: Veredicto[];
};

/** Una celda: el estado y los números de las comprobaciones de ese estado. */
export function celda(v: Veredicto | undefined): string {
  if (v === undefined) return 'sin correr';
  const numeros = v.comprobaciones
    .filter((c) => c.estado === v.estado && v.estado !== 'pasa')
    .map((c) => c.numero)
    .sort((a, b) => a - b);
  const partes = numeros.length > 0 ? [`${v.estado}: ${numeros.join(', ')}`] : [v.estado];
  if (v.metadatos.vencido) partes.push('tiempo agotado');
  return partes.join(', ');
}

export const codigoDeSalida = (veredictos: readonly Veredicto[]): 0 | 1 =>
  veredictos.some((v) => v.estado === 'falla') ? 1 : 0;

function totales(veredictos: readonly Veredicto[]): Record<Estado, number> {
  const t: Record<Estado, number> = { pasa: 0, aviso: 0, falla: 0 };
  for (const v of veredictos) t[v.estado]++;
  return t;
}

function lista(veredictos: readonly Veredicto[], estado: Estado): string[] {
  const filas = veredictos.flatMap((v) =>
    v.comprobaciones
      .filter((c) => c.estado === estado)
      .map((c) => `- ${v.agente}, ${v.variante}, ${c.numero} (${c.nombre}): ${c.motivo}`),
  );
  return filas.length > 0 ? filas : [estado === 'falla' ? 'Ninguna.' : 'Ninguno.'];
}

export function resumenMarkdown(s: Suite): string {
  const t = totales(s.veredictos);
  const secciones = s.texto.secciones.map((x) => `${x.titulo} ${x.palabras}`).join(', ');
  const docx =
    s.docx.antes === s.docx.despues
      ? `no cambió (sha256 ${s.docx.antes})`
      : `cambió: sha256 ${s.docx.antes} antes y ${s.docx.despues} después`;
  const buscar = (agente: string, variante: string) =>
    s.veredictos.find((v) => v.agente === agente && v.variante === variante);
  return [
    '# Prueba final con agentes',
    '',
    `- Fecha: ${s.fecha}`,
    `- Carpeta: ${s.carpeta}`,
    `- Texto: ${s.texto.modo}, ${s.texto.palabras} palabras (${secciones})`,
    `- base.docx: ${docx}`,
    `- Corridas: ${s.veredictos.length}. Pasan ${t.pasa}, con aviso ${t.aviso}, con falla ${t.falla}.`,
    '',
    `| Variante | ${s.agentes.join(' | ')} |`,
    `|---|${s.agentes.map(() => '---').join('|')}|`,
    ...s.variantes.map((variante) => `| ${variante} | ${s.agentes.map((a) => celda(buscar(a, variante))).join(' | ')} |`),
    '',
    'Los números de cada celda son las comprobaciones que causaron su estado:',
    '',
    ...Object.entries(NOMBRES).map(([n, nombre]) => `${n}. ${nombre}`),
    '',
    '## Fallas',
    '',
    ...lista(s.veredictos, 'falla'),
    '',
    '## Avisos',
    '',
    ...lista(s.veredictos, 'aviso'),
    '',
  ].join('\n');
}

export function resumenJson(s: Suite) {
  return { ...s, totales: totales(s.veredictos), codigo: codigoDeSalida(s.veredictos) };
}
