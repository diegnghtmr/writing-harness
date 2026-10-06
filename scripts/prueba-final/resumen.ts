// El resumen de una serie de corridas, en Markdown para leer y en JSON para
// procesar.
//
// La matriz va con una fila por variante y una columna por agente, porque son
// quince variantes y tres agentes: al revés no cabría en una pantalla. Cada
// celda dice su estado y los números de las comprobaciones que lo causaron, y
// la leyenda de esos números va debajo, salida de los mismos nombres que usan
// los veredictos.
//
// Una corrida que el agente no terminó, por una cuota agotada, una sesión
// vencida o el límite de tiempo, no es una falla de las skills y no se cuenta
// como tal: tiene su propio estado, `error`, con el motivo en la celda, su
// sección y su cuenta. La serie sigue saliendo con 1, porque no fue limpia.

import { NOMBRES, type Comprobacion, type Juicio } from './comprobaciones.ts';
import type { Costo } from './transcripcion.ts';

/** El estado de una corrida: el de sus comprobaciones, o `error` si el agente no la terminó. */
export type EstadoDeCorrida = Juicio | 'error';

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
  /** Cuántos archivos tenía la copia en que trabajó el agente, y su huella: dice qué arnés vio. */
  copia: { archivos: number; huella: string };
};

export type Veredicto = {
  agente: string;
  variante: string;
  estado: EstadoDeCorrida;
  /** Por qué el agente no terminó la corrida, en una frase corta, o null si la terminó. */
  error: string | null;
  comprobaciones: Comprobacion[];
  metadatos: Metadatos;
};

export type Suite = {
  fecha: string;
  carpeta: string;
  texto: { modo: 'fragmento' | 'completo'; palabras: number; secciones: { titulo: string; palabras: number }[] };
  docx: { antes: string; despues: string };
  agentes: string[];
  /** Los agentes conocidos que no corrieron esta vez, porque `--agentes` no los pidió. */
  omitidos: string[];
  variantes: string[];
  veredictos: Veredicto[];
};

const numerosCon = (v: Veredicto, estado: Juicio) =>
  v.comprobaciones
    .filter((c) => c.estado === estado)
    .map((c) => c.numero)
    .sort((a, b) => a - b);

/**
 * Una celda: el estado y los números de las comprobaciones de ese estado. Un
 * error del agente va con su motivo, y con las fallas de lo que sí se evaluó.
 */
export function celda(v: Veredicto | undefined): string {
  if (v === undefined) return 'sin correr';
  if (v.estado === 'error') {
    const fallas = numerosCon(v, 'falla');
    const motivo = (v.error ?? 'sin motivo').replace(/\|/gu, '\\|');
    return `error: ${motivo}${fallas.length > 0 ? `; falla: ${fallas.join(', ')}` : ''}`;
  }
  const numeros = v.estado === 'pasa' ? [] : numerosCon(v, v.estado);
  const partes = numeros.length > 0 ? [`${v.estado}: ${numeros.join(', ')}`] : [v.estado];
  if (v.metadatos.vencido) partes.push('tiempo agotado');
  return partes.join(', ');
}

/** 1 si alguna corrida falló o no terminó; 0 si todas pasaron, aunque sea con avisos. */
export const codigoDeSalida = (veredictos: readonly Veredicto[]): 0 | 1 =>
  veredictos.some((v) => v.estado === 'falla' || v.estado === 'error') ? 1 : 0;

function totales(veredictos: readonly Veredicto[]): Record<EstadoDeCorrida, number> {
  const t: Record<EstadoDeCorrida, number> = { pasa: 0, aviso: 0, falla: 0, error: 0 };
  for (const v of veredictos) t[v.estado]++;
  return t;
}

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** La línea de la consola al terminar la serie, con los errores del agente aparte. */
export function lineaDeTotales(veredictos: readonly Veredicto[]): string {
  const t = totales(veredictos);
  return `${cuenta(veredictos.length, 'corrida', 'corridas')}: ${cuenta(t.pasa, 'pasa', 'pasan')}, ${cuenta(t.aviso, 'aviso', 'avisos')}, ${cuenta(t.falla, 'falla', 'fallas')}, ${cuenta(t.error, 'error del agente', 'errores del agente')}`;
}

function lista(veredictos: readonly Veredicto[], estado: Juicio): string[] {
  const filas = veredictos.flatMap((v) =>
    v.comprobaciones
      .filter((c) => c.estado === estado)
      .map((c) => `- ${v.agente}, ${v.variante}, ${c.numero} (${c.nombre}): ${c.motivo}`),
  );
  return filas.length > 0 ? filas : [estado === 'falla' ? 'Ninguna.' : 'Ninguno.'];
}

function errores(veredictos: readonly Veredicto[]): string[] {
  const filas = veredictos.filter((v) => v.estado === 'error').map((v) => `- ${v.agente}, ${v.variante}: ${v.error ?? 'sin motivo'}`);
  return filas.length > 0 ? filas : ['Ninguno.'];
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
    `- Agentes: ${s.agentes.join(', ')}.${s.omitidos.length > 0 ? ` Quedaron fuera: ${s.omitidos.join(', ')}.` : ''}`,
    `- Corridas: ${s.veredictos.length}. Pasan ${t.pasa}, con aviso ${t.aviso}, con falla ${t.falla}, con error del agente ${t.error}.`,
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
    '## Errores del agente',
    '',
    ...errores(s.veredictos),
    '',
  ].join('\n');
}

export function resumenJson(s: Suite) {
  return { ...s, totales: totales(s.veredictos), codigo: codigoDeSalida(s.veredictos) };
}
