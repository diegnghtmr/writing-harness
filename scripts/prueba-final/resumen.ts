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
import type { Traza, TrazaDeLaSerie, Vigencia } from './traza.ts';
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
  /** El proyecto de Engram de la corrida, para encontrar y borrar lo que guardó. */
  engram: string;
  /** Con qué se probó: el arnés, las instrucciones de mix, base.docx y las skills instaladas. Falta en las corridas de un ejecutor anterior. */
  traza?: Traza;
};

export type Veredicto = {
  agente: string;
  variante: string;
  estado: EstadoDeCorrida;
  /** Por qué el agente no terminó la corrida, en una frase corta, o null si la terminó. */
  error: string | null;
  /** La fecha de la serie a la que pertenece la corrida. Con `--agregar`, una raíz junta series distintas. */
  serie: string;
  /** Cuándo se volvió a juzgar con `--reevaluar`, si se volvió a juzgar. */
  reevaluado?: string;
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
  /** La fecha de la serie de cada agente. */
  series: Record<string, string>;
  variantes: string[];
  veredictos: Veredicto[];
  /** Con qué se probó la serie; null si alguna corrida no lo registra. */
  traza?: TrazaDeLaSerie | null;
  /** Si cada celda, por `agente/variante`, sigue describiendo el arnés de hoy. */
  vigencia?: Record<string, Vigencia>;
};

/** Una fecha de serie corta, para la cabecera de una columna. */
const corta = (fecha: string) => fecha.slice(0, 16).replace('T', ' ');

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

/** Con qué empieza el motivo de una corrida en que falló el ejecutor y no el agente. */
export const PREFIJO_DEL_EJECUTOR = 'falla del ejecutor: ';

/** Si la corrida quedó en error por el ejecutor y no por el agente. */
const delEjecutor = (v: Veredicto) => v.estado === 'error' && (v.error ?? '').startsWith(PREFIJO_DEL_EJECUTOR);

/** Las cuentas por estado. `error` cuenta solo los del agente; `ejecutor`, los del ejecutor. */
function totales(veredictos: readonly Veredicto[]): Record<EstadoDeCorrida | 'ejecutor', number> {
  const t: Record<EstadoDeCorrida | 'ejecutor', number> = { pasa: 0, aviso: 0, falla: 0, error: 0, ejecutor: 0 };
  for (const v of veredictos) t[delEjecutor(v) ? 'ejecutor' : v.estado]++;
  return t;
}

const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * La línea de la consola al terminar la serie, con los errores del agente aparte,
 * y los del ejecutor aparte también cuando hay alguno.
 */
export function lineaDeTotales(veredictos: readonly Veredicto[]): string {
  const t = totales(veredictos);
  const ejecutor = t.ejecutor > 0 ? `, ${cuenta(t.ejecutor, 'error del ejecutor', 'errores del ejecutor')}` : '';
  return `${cuenta(veredictos.length, 'corrida', 'corridas')}: ${cuenta(t.pasa, 'pasa', 'pasan')}, ${cuenta(t.aviso, 'aviso', 'avisos')}, ${cuenta(t.falla, 'falla', 'fallas')}, ${cuenta(t.error, 'error del agente', 'errores del agente')}${ejecutor}`;
}

function lista(veredictos: readonly Veredicto[], estado: Juicio): string[] {
  const filas = veredictos.flatMap((v) =>
    v.comprobaciones
      .filter((c) => c.estado === estado)
      .map((c) => `- ${v.agente}, ${v.variante}, ${c.numero} (${c.nombre}): ${c.motivo}`),
  );
  return filas.length > 0 ? filas : [estado === 'falla' ? 'Ninguna.' : 'Ninguno.'];
}

function errores(veredictos: readonly Veredicto[], delQue: 'agente' | 'ejecutor'): string[] {
  const filas = veredictos
    .filter((v) => v.estado === 'error' && delEjecutor(v) === (delQue === 'ejecutor'))
    .map((v) => `- ${v.agente}, ${v.variante}: ${v.error ?? 'sin motivo'}`);
  return filas.length > 0 ? filas : ['Ninguno.'];
}

/** La marca de una celda que no se da por vigente. */
const MARCA: Record<Vigencia['estado'], string> = { vigente: '', desactualizada: ' [desactualizada]', desconocida: ' [sin traza]' };

/** La línea del commit de la serie, si el resumen trae su traza. */
function lineaDelArnes(s: Suite): string[] {
  if (s.traza === undefined) return [];
  if (s.traza === null) return ['- Arnés: sin traza, porque alguna corrida no registra con qué commit se probó.'];
  const { commit, sucio, sucios } = s.traza.arnes;
  const n = Object.keys(sucios).length;
  const cambios = sucio ? `, con cambios sin commit en ${n} ${n === 1 ? 'ruta' : 'rutas'}` : '';
  return [`- Arnés: commit ${commit?.slice(0, 7) ?? 'desconocido'}${cambios}.`];
}

/**
 * La sección de la vigencia: cada celda desactualizada con su motivo, y las
 * que no tienen traza agrupadas por motivo, que suele ser uno solo.
 */
function vigencias(s: Suite): string[] {
  if (s.vigencia === undefined) return [];
  const de = (v: Veredicto) => s.vigencia?.[`${v.agente}/${v.variante}`];
  const filas = s.veredictos
    .filter((v) => de(v)?.estado === 'desactualizada')
    .map((v) => `- ${v.agente}, ${v.variante}: desactualizada: ${de(v)?.motivo}.`);
  const sinTraza = new Map<string, string[]>();
  for (const v of s.veredictos) {
    const x = de(v);
    if (x?.estado === 'desconocida') sinTraza.set(x.motivo, [...(sinTraza.get(x.motivo) ?? []), `${v.agente}/${v.variante}`]);
  }
  for (const [motivo, pares] of sinTraza) filas.push(`- Sin traza (${motivo}): ${pares.join(', ')}.`);
  return ['## Vigencia', '', ...(filas.length > 0 ? filas : ['Todas las celdas están vigentes.']), ''];
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
  // Con una sola serie, su fecha ya está arriba. Con varias, cada columna dice la suya.
  const varias = new Set(s.agentes.map((a) => s.series[a])).size > 1;
  const columna = (a: string) => (varias && s.series[a] ? `${a} (serie ${corta(s.series[a] as string)})` : a);
  const lineaDeSeries = varias ? [`- Series: ${s.agentes.map((a) => `${a} del ${s.series[a] ?? 'sin fecha'}`).join(', ')}.`] : [];
  const marca = (a: string, variante: string) => MARCA[s.vigencia?.[`${a}/${variante}`]?.estado ?? 'vigente'];
  const marcadas = Object.values(s.vigencia ?? {}).some((v) => v.estado !== 'vigente');
  const leyendaDeMarcas = marcadas
    ? [
        '',
        '`[desactualizada]`: un cambio posterior a la corrida la alcanza, y no se volvió a correr. `[sin traza]`: la corrida no registra con qué se probó, y no se da por vigente.',
      ]
    : [];
  return [
    '# Prueba final con agentes',
    '',
    `- Fecha: ${s.fecha}`,
    `- Carpeta: ${s.carpeta}`,
    `- Texto: ${s.texto.modo}, ${s.texto.palabras} palabras (${secciones})`,
    `- base.docx: ${docx}`,
    `- Agentes: ${s.agentes.join(', ')}.${s.omitidos.length > 0 ? ` Quedaron fuera: ${s.omitidos.join(', ')}.` : ''}`,
    ...lineaDeSeries,
    ...lineaDelArnes(s),
    `- Corridas: ${s.veredictos.length}. Pasan ${t.pasa}, con aviso ${t.aviso}, con falla ${t.falla}, con error del agente ${t.error}${t.ejecutor > 0 ? `, con error del ejecutor ${t.ejecutor}` : ''}.`,
    '',
    `| Variante | ${s.agentes.map(columna).join(' | ')} |`,
    `|---|${s.agentes.map(() => '---').join('|')}|`,
    ...s.variantes.map((variante) => {
      const celdas = s.agentes.map((a) => {
        const v = buscar(a, variante);
        return v === undefined ? celda(v) : `${celda(v)}${marca(a, variante)}`;
      });
      return `| ${variante} | ${celdas.join(' | ')} |`;
    }),
    '',
    'Los números de cada celda son las comprobaciones que causaron su estado:',
    '',
    ...Object.entries(NOMBRES).map(([n, nombre]) => `${n}. ${nombre}`),
    ...leyendaDeMarcas,
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
    ...errores(s.veredictos, 'agente'),
    '',
    ...(t.ejecutor > 0 ? ['## Errores del ejecutor', '', ...errores(s.veredictos, 'ejecutor'), ''] : []),
    ...vigencias(s),
  ].join('\n');
}

export function resumenJson(s: Suite) {
  return { ...s, totales: totales(s.veredictos), codigo: codigoDeSalida(s.veredictos) };
}
