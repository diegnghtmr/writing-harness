// Las once comprobaciones de cada corrida de la prueba final.
//
// Cada una es una función pura que recibe lo que dejó la corrida y devuelve
// pasa, aviso o falla, con el motivo escrito para quien lea el resumen. Una
// falla es bloqueante: con una sola, la prueba sale con 1. Un aviso se informa y
// no frena, igual que una advertencia del verificador.
//
// Todas miden lo que piden las skills, no lo que pide el prompt. El prompt solo
// dice qué hacer con el texto y dónde dejarlo; que el agente cargue las skills,
// mida, anuncie el tono y no repita el texto tiene que salir de ellas.

import { posix } from 'node:path';
import { countWords } from '../../src/text.ts';
import { anclasDe, faltantes, normalizar, type Anclas, type Cita } from './anclas.ts';
import { ARNES_EN_LA_COPIA, esCodigoDeLaPrueba, type CambiosDeLaCopia } from './copia.ts';
import type { Lanzamiento } from './proceso.ts';
import { cadenasDe, comandos, type Llamada, type Transcripcion } from './transcripcion.ts';
import { SKILL_BASE, skillsRequeridas, type Variante } from './variantes.ts';

/**
 * El estado de una comprobación. «sin evaluar» es el de una que depende de que
 * la corrida termine, en una corrida que el agente no terminó: no pasa ni
 * falla, porque lo que mediría no llegó a existir.
 */
export type Estado = 'pasa' | 'aviso' | 'falla' | 'sin evaluar';

export type Comprobacion = {
  numero: number;
  nombre: string;
  estado: Estado;
  motivo: string;
  detalle?: unknown;
  /** Al volver a juzgar, la que no se pudo recalcular y quedó como la dejó la corrida. */
  conservada?: boolean;
};

export const NOMBRES: Record<number, string> = {
  1: 'base.docx intacto',
  2: 'salida legible',
  3: 'verificador sin errores',
  4: 'skills cargadas',
  5: 'el agente midió',
  6: 'respuesta',
  7: 'datos conservados',
  8: 'extensión',
  9: 'repositorios intactos',
  10: 'aislamiento',
  11: 'datos nuevos',
};

const comprobacion = (numero: number, estado: Juicio, motivo: string, detalle?: unknown): Comprobacion => ({
  numero,
  nombre: NOMBRES[numero] ?? '',
  estado,
  motivo,
  ...(detalle === undefined ? {} : { detalle }),
});

/** Lo que una comprobación dice de la corrida. Una sin evaluar no dice nada. */
export type Juicio = 'pasa' | 'aviso' | 'falla';

const ORDEN: Record<Estado, number> = { 'sin evaluar': 0, pasa: 0, aviso: 1, falla: 2 };
const peor = (estados: Estado[]): Juicio =>
  estados.reduce<Juicio>((a, b) => (b !== 'sin evaluar' && ORDEN[b] > ORDEN[a] ? b : a), 'pasa');

/** El estado de una corrida: el peor de sus comprobaciones. */
export const estadoDe = (cs: readonly Comprobacion[]): Juicio => peor(cs.map((c) => c.estado));

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una lista que no se desborda en el resumen. */
const lista = (xs: readonly string[], tope = 10) =>
  xs.length <= tope ? xs.join(', ') : `${xs.slice(0, tope).join(', ')} y ${xs.length - tope} más`;

/**
 * Rutas sin repetir: la misma ruta con otras barras o con otras mayúsculas es
 * una sola. Queda la primera forma en que apareció.
 *
 * En la primera corrida de humo, una escritura de Antigravity salió dos veces
 * en el mismo motivo.
 */
function sinRepetir(rutas: readonly string[]): string[] {
  const vistas = new Map<string, string>();
  for (const r of rutas) {
    const clave = r.replace(/[\\/]+/gu, '/').replace(/^\.\//u, '').replace(/\/$/u, '').toLowerCase();
    if (!vistas.has(clave)) vistas.set(clave, r);
  }
  return [...vistas.values()];
}

// 1 -------------------------------------------------------------------------

/** Una huella sha256, o por qué no se pudo leer el archivo. */
export type HuellaLeida = string | { ilegible: string };

/**
 * Un base.docx que no se puede leer, antes o después de la corrida, es una
 * falla con su motivo y no una excepción: una excepción acá tumbaba la serie
 * entera, y la serie no publicaba nada.
 */
export function docxIntacto(antes: HuellaLeida, despues: HuellaLeida): Comprobacion {
  if (typeof antes !== 'string') return comprobacion(1, 'falla', `no se pudo leer base.docx antes de la corrida (${antes.ilegible})`);
  if (typeof despues !== 'string') return comprobacion(1, 'falla', `no se pudo leer base.docx después de la corrida (${despues.ilegible})`);
  if (antes === despues) return comprobacion(1, 'pasa', 'la huella sha256 no cambió');
  return comprobacion(1, 'falla', `la huella sha256 cambió: ${antes.slice(0, 12)}… pasó a ${despues.slice(0, 12)}…`, {
    antes,
    despues,
  });
}

// 2 -------------------------------------------------------------------------

// `fatal` hace que un byte que no es UTF-8 lance en vez de volverse U+FFFD, y el
// decodificador se salta solo la marca de orden de bytes de UTF-8. Es la misma
// lectura del verificador.
const UTF8 = new TextDecoder('utf-8', { fatal: true });

/** El texto de salida.md, o por qué no se puede leer. */
export function leerTexto(bytes: Uint8Array | null): { texto: string } | { motivo: string } {
  if (bytes === null) return { motivo: 'salida.md no existe en la carpeta de la corrida' };
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    return { motivo: 'salida.md está en UTF-16: empieza con su marca de orden de bytes' };
  }
  if (bytes.includes(0)) return { motivo: 'salida.md tiene bytes nulos: parece UTF-16 sin marca' };
  let texto: string;
  try {
    texto = UTF8.decode(bytes);
  } catch {
    return { motivo: 'salida.md tiene bytes que no son UTF-8' };
  }
  if (texto.trim() === '') return { motivo: 'salida.md está vacío' };
  return { texto };
}

export function salidaLegible(bytes: Uint8Array | null): Comprobacion {
  const r = leerTexto(bytes);
  if ('motivo' in r) return comprobacion(2, 'falla', r.motivo);
  return comprobacion(2, 'pasa', `${plural(countWords(r.texto), 'palabra', 'palabras')} en UTF-8`);
}

// 3 -------------------------------------------------------------------------

/** Los errores y advertencias de la última línea del verificador. */
export function resumenDelVerificador(salida: string): { errores: number; advertencias: number } | null {
  const m = /(\d+) error\(es\), (\d+) advertencia\(s\)/u.exec(salida);
  if (m) return { errores: Number(m[1]), advertencias: Number(m[2]) };
  if (/: sin hallazgos/u.test(salida)) return { errores: 0, advertencias: 0 };
  return null;
}

export function verificadorLimpio(r: { codigo: number | null; salida: string } | null): Comprobacion {
  if (r === null) return comprobacion(3, 'falla', 'no se midió: no hay salida legible');
  const cuenta = resumenDelVerificador(r.salida);
  const dicho = cuenta
    ? `${plural(cuenta.errores, 'error', 'errores')}, ${plural(cuenta.advertencias, 'advertencia', 'advertencias')}`
    : 'sin resumen';
  if (r.codigo === 0) return comprobacion(3, 'pasa', dicho, cuenta ?? undefined);
  if (r.codigo === 1) return comprobacion(3, 'falla', dicho, cuenta ?? undefined);
  return comprobacion(3, 'falla', `el verificador no pudo leer la salida (código ${r.codigo})`);
}

// 4 -------------------------------------------------------------------------

/**
 * Las skills de la variante.
 *
 * Un tono es cualquier skill `*-writing` que no sea la base: la cuenta incluye
 * las que no son de este arnés, porque en la base cargar cualquier skill de
 * estilo ya es aplicar una forma que no se pidió.
 *
 * `cargadas` son las que se leyeron enteras; `parciales`, las que solo se
 * leyeron en parte o se consultaron. Una skill pedida leída solo en parte avisa:
 * en la corrida completa, Grok leyó spanish-writing hasta la línea doscientas o
 * cuatrocientas, de más de ochocientas. Una que no se pidió, leída en parte, es
 * una consulta y no cuenta como cargada.
 */
export function skillsDeLaVariante(v: Variante, cargadas: readonly string[], parciales: readonly string[] = []): Comprobacion {
  const requeridas = skillsRequeridas(v);
  const faltan = requeridas.filter((s) => !cargadas.includes(s) && !parciales.includes(s));
  const enParte = requeridas.filter((s) => !cargadas.includes(s) && parciales.includes(s));
  const tonos = cargadas.filter((s) => /-writing$/u.test(s) && s !== SKILL_BASE && s !== v.skill);
  const detalle = { cargadas, parciales, faltan, tonos };
  const motivos: string[] = [];
  if (faltan.length > 0) motivos.push(`no cargó ${faltan.join(', ')}`);
  if (v.clase === 'base' && tonos.length > 0) motivos.push(`al corregir cargó un tono: ${tonos.join(', ')}`);
  if (motivos.length > 0) return comprobacion(4, 'falla', motivos.join('; '), detalle);
  const avisos = [
    ...enParte.map((s) => `lectura parcial de ${s}`),
    ...(tonos.length > 0 ? [`cargó además otro tono: ${tonos.join(', ')}`] : []),
  ];
  if (avisos.length > 0) return comprobacion(4, 'aviso', avisos.join('; '), detalle);
  return comprobacion(4, 'pasa', `cargó ${requeridas.join(', ')}`, detalle);
}

// 5 -------------------------------------------------------------------------

const VERIFICADOR = /src[\\/]cli\.ts/u;

/** El tramo de un comando que corresponde al verificador: hasta el próximo `;`, `&`, `|` o salto de línea. */
function tramo(comando: string): string {
  const i = comando.search(VERIFICADOR);
  const resto = comando.slice(i);
  const fin = resto.search(/[;&|\n]/u);
  return fin < 0 ? resto : resto.slice(0, fin);
}

/** Las opciones de capa de una invocación del verificador. */
export function banderasDe(comando: string): { tono: string | null; pasada: string | null } {
  const t = tramo(comando);
  return {
    tono: /(?:^|\s)(?:--tono|-t)\s+["']?([\w-]+)/u.exec(t)?.[1] ?? null,
    pasada: /(?:^|\s)(?:--pasada|-p)\s+["']?([\w-]+)/u.exec(t)?.[1] ?? null,
  };
}

const describirBanderas = (b: { tono: string | null; pasada: string | null }) =>
  [b.tono ? `--tono ${b.tono}` : null, b.pasada ? `--pasada ${b.pasada}` : null].filter(Boolean).join(' ') ||
  'sin opciones';

/** Dónde está la corrida: su carpeta y la copia en que trabajó el agente. */
export type ContextoDeMedicion = { staging: string; copia: string };

const esRutaAbsoluta = (p: string) => /^[a-z]:[\\/]/iu.test(p) || p.startsWith('/') || p.startsWith('\\');

/** Una ruta absoluta con barras normales y sin `.` ni `..`. */
const resolver = (base: string, ruta: string) =>
  posix.normalize((esRutaAbsoluta(ruta) ? ruta : `${base}/${ruta}`).replace(/\\+/gu, '/'));

/** El último cambio de carpeta de un comando antes de una posición: `Set-Location`, `cd`, `pushd` y sus alias. */
const CAMBIO_DE_CARPETA =
  /(?:^|[;&|\n(]\s*|\s)(?:set-location|cd|chdir|push-location|pushd|sl)\s+(?:-(?:literal)?path\s+)?(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))/giu;

/**
 * Con qué verificador midió una invocación: el de la copia, uno fuera de ella,
 * o uno que no existe.
 *
 * La ruta del `cli.ts` se lee del comando y se resuelve contra la carpeta en que
 * corrió: la del último cambio de carpeta del mismo comando, la que trae la
 * herramienta en su campo de carpeta, o la copia. En la corrida completa, cinco
 * corridas de Grok hicieron `Set-Location` al arnés real y midieron desde ahí.
 * Antes de eso probaban `node src/cli.ts` desde la raíz de la copia, donde no
 * hay ningún verificador: un intento así no midió nada.
 */
function dondeMidio(l: Llamada, ctx: ContextoDeMedicion): 'copia' | 'fuera' | 'nula' {
  const comando = l.comando ?? '';
  const i = comando.search(VERIFICADOR);
  let inicio = i;
  while (inicio > 0 && !/[\s"'`]/u.test(comando[inicio - 1] as string)) inicio--;
  const token = comando.slice(inicio, i + 'src/cli.ts'.length);
  const e = l.entrada !== null && typeof l.entrada === 'object' ? (l.entrada as Record<string, unknown>) : {};
  let base = ctx.copia;
  const campoCwd = ['Cwd', 'cwd', 'working_directory', 'workdir'].map((c) => e[c]).find((x) => typeof x === 'string');
  if (typeof campoCwd === 'string') base = resolver(base, campoCwd);
  const cambio = [...comando.slice(0, inicio).matchAll(CAMBIO_DE_CARPETA)].at(-1);
  const destino = cambio ? (cambio[1] ?? cambio[2] ?? cambio[3]) : undefined;
  if (destino !== undefined) base = resolver(base, destino);
  const ruta = resolver(base, token);
  if (normalizarRuta(ruta) === normalizarRuta(`${ctx.copia}/${ARNES_EN_LA_COPIA}/src/cli.ts`)) return 'copia';
  return dentroDe(ruta, ctx.staging) ? 'nula' : 'fuera';
}

/** La respuesta admite que no midió. */
const NIEGA_MEDIR =
  /\bno\s+(?:(?:lo|la)\s+)?(?:pude|pudo|se\s+pudo|logre|logro|consegui|fue\s+posible|he\s+podido)\s+(?:medir|verificar|correr|ejecutar|usar|pasar)|\bsin\s+(?:poder\s+)?medir\b|\bno\s+(?:lo\s+)?medi\b|\bno\s+paso\s+por\s+el\s+verificador|\bno\s+(?:se\s+)?(?:corrio|ejecuto|uso)\s+el\s+verificador|\bverificador\s+no\s+(?:esta|existe|aparece|se\s+encontro)/u;

/** La respuesta afirma una medición. */
const AFIRMA_MEDIR =
  /\bsin\s+hallazgos\b|\b0\s+errores\b|\bcero\s+errores\b|\bsin\s+errores\b|\bverificad[oa]s?\b|\bverificacion\b|\bmedid[oa]s?\b|\bel\s+verificador\s+(?:cerro|termino|dio|marco|devolvio|reporto|no\s+marco)/u;

/**
 * Por qué falla una corrida que no corrió el verificador. No es lo mismo decir
 * que no se pudo medir, como hicieron dos corridas de Grok, que afirmar una
 * medición que no ocurrió: lo segundo es grave, porque engaña a quien lee.
 */
function sinMedicion(respuesta: string | null): Comprobacion {
  const r = llano(respuesta ?? '');
  const base = 'no corrió el verificador sobre ningún texto';
  if (NIEGA_MEDIR.test(r)) return comprobacion(5, 'falla', `no midió y lo dijo: ${base}`, { grave: false });
  if (AFIRMA_MEDIR.test(r)) return comprobacion(5, 'falla', `grave: afirma una medición que no corrió; ${base}`, { grave: true });
  return comprobacion(5, 'falla', base, { grave: false });
}

export function agenteMidio(v: Variante, t: Transcripcion, ctx?: ContextoDeMedicion): Comprobacion {
  const invocaciones = comandos(t).filter((l) => {
    if (l.comando === null || !VERIFICADOR.test(l.comando)) return false;
    // Enrutar o pedir la ayuda no mide ningún texto.
    return !/--enrutar|(?:^|\s)(?:-h|--help)(?:\s|$)/u.test(tramo(l.comando));
  });
  const donde = invocaciones.map((l) => (ctx === undefined ? 'copia' : dondeMidio(l, ctx)));
  const mediciones = invocaciones.filter((_, i) => donde[i] !== 'nula');
  const ultima = mediciones.at(-1);
  if (ultima === undefined || ultima.comando === null) return sinMedicion(t.respuesta);
  const fuera = donde.filter((d) => d !== 'nula').every((d) => d === 'fuera');
  const conLaReal = fuera ? '; midió con el verificador real, fuera de su copia' : '';
  const b = banderasDe(ultima.comando);
  const nombres = v.skill === null ? [v.id] : [v.id, v.skill];
  const esperado =
    v.clase === 'base'
      ? { tono: null, pasada: null }
      : v.clase === 'tono'
        ? { tono: v.id, pasada: null }
        : { tono: null, pasada: v.id };
  const coincide = (dado: string | null, pedido: string | null) =>
    pedido === null ? dado === null : dado !== null && nombres.includes(dado);
  const conBanderas = coincide(b.tono, esperado.tono) && coincide(b.pasada, esperado.pasada);
  const detalle = { veces: mediciones.length, ultimoCodigo: ultima.codigo, ultimo: ultima.comando, conBanderas, fuera };
  const veces = plural(mediciones.length, 'vez', 'veces');
  const codigo = ultima.codigo === null ? 'sin código registrado' : `código ${ultima.codigo}`;
  if (!conBanderas) {
    return comprobacion(
      5,
      'aviso',
      `lo corrió ${veces}; la última, ${describirBanderas(b)}, y la variante pide ${describirBanderas(esperado)} (${codigo})${conLaReal}`,
      detalle,
    );
  }
  const dicho = `lo corrió ${veces}; la última, con las opciones de la variante (${codigo})`;
  if (fuera) return comprobacion(5, 'aviso', `${dicho}${conLaReal}`, detalle);
  return comprobacion(5, 'pasa', dicho, detalle);
}

// 6 -------------------------------------------------------------------------

/**
 * Desde cuántas palabras seguidas iguales a salida.md la respuesta repite el texto.
 *
 * El defecto que se busca es pegar en la respuesta el texto entregado, y eso deja
 * corridas del largo de un párrafo. Lo que la skill sí pide en la respuesta, la
 * línea del tono y las advertencias que queden, cita a lo sumo el fragmento que
 * una advertencia señala, que es una frase. Veinticinco palabras quedan por
 * encima de la oración mediana del texto de la prueba y muy por debajo de un
 * párrafo.
 */
export const SHINGLE_DE_REPETICION = 25;

const palabrasNormalizadas = (s: string): string[] => normalizar(s).match(/[\p{L}\d]+/gu) ?? [];

/** La corrida más larga de palabras seguidas que dos textos comparten. */
export function repeticionMasLarga(a: string, b: string): number {
  const x = palabrasNormalizadas(a);
  const y = palabrasNormalizadas(b);
  let mejor = 0;
  let previa = new Array<number>(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const actual = new Array<number>(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) {
        actual[j] = (previa[j - 1] as number) + 1;
        if ((actual[j] as number) > mejor) mejor = actual[j] as number;
      }
    }
    previa = actual;
  }
  return mejor;
}

// Al corregir, la línea del tono dice que no hubo. Sobre el texto sin tildes y
// con los guiones vueltos espacios. Las raíces cubren la primera persona:
// «apliqué» y «utilicé» quedan «aplique» y «utilice» sin la tilde, y no
// empiezan por «aplic» ni por «utiliz». En la serie de codex del 2026-10-14, una
// respuesta que decía «No apliqué un tono» falló por no decirlo.
const NIEGA_TONO =
  /\b(?:ningun|sin)\s+tono\b|\bno\s+(?:se\s+)?(?:aplic|apliqu|us|utiliz|utilic|hub|eleg|elij|eligi)\w*\s+(?:(?:ningun|el|un)\s+)?tono\b|\btono\s*:\s*(?:ninguno|no|sin)\b/u;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const llano = (s: string) => normalizar(s).replace(/[-_]/gu, ' ');

/**
 * Si la respuesta nombra el tono.
 *
 * Por el nombre de la skill, o por el identificador junto a la palabra «tono» o
 * entre comillas. El identificador suelto no alcanza: `han` es también un verbo,
 * y «se han corregido» no anuncia nada.
 */
function nombraElTono(respuesta: string, v: Variante): boolean {
  const r = llano(respuesta);
  const id = escapar(llano(v.id));
  if (v.skill !== null && r.includes(llano(v.skill))) return true;
  if (new RegExp(`\\btono\\W+(?:\\w+\\W+){0,3}?${id}\\b`, 'u').test(r)) return true;
  return new RegExp(`[«"'\`“]${id}[»"'\`”]`, 'u').test(r);
}

/**
 * Si la respuesta nombra la pasada: por su skill, o por su verbo en cualquier
 * forma. «humanizar», «humanizado» y «humanización» llevan la raíz `humaniz`, y
 * «humanicé» la misma con la `z` vuelta `c` delante de `e`.
 *
 * La palabra «pasada» sola no la nombra: no dice cuál. Tampoco las seis
 * primeras letras del verbo, que comparte «humanidad». Las dos cosas daban por
 * nombrada la pasada en una respuesta que no la nombraba.
 */
function nombraLaPasada(respuesta: string, v: Variante): boolean {
  const r = llano(respuesta);
  if (v.skill !== null && r.includes(llano(v.skill))) return true;
  const raiz = llano(v.id).replace(/(?:ar|er|ir)$/u, '');
  const formas = raiz.endsWith('z') ? [raiz, `${raiz.slice(0, -1)}ce`] : [raiz];
  return new RegExp(`\\b(?:${formas.map(escapar).join('|')})`, 'u').test(r);
}

const normalizarRutaLibre = (s: string) => s.replace(/\\/gu, '/').toLowerCase();

/** Lo que da el porqué en la línea del tono. */
const DA_EL_PORQUE = /\b(?:porque|por|ya\s+que|dado\s+que|a\s+pedido|se\s+pidio|peticion)\b/u;

/**
 * Si la línea del tono dice por qué.
 *
 * La skill de entrada pide decir el tono y por qué, y al corregir, que no hubo
 * tono y por qué. Ocho de quince respuestas de Copilot dijeron solo cuál. La
 * línea es la primera que nombra el tono o dice que no lo hubo, y el porqué se
 * busca después de eso: con «porque» y sus parientes, o después de dos puntos.
 */
function daElPorque(respuesta: string, v: Variante): boolean {
  for (const linea of respuesta.split(/\r?\n/u)) {
    const r = llano(linea);
    let fin = -1;
    if (v.clase === 'tono') {
      for (const nombre of [v.skill, v.id]) {
        if (nombre === null) continue;
        for (const m of r.matchAll(new RegExp(`\\b${escapar(llano(nombre))}\\b`, 'gu'))) fin = Math.max(fin, m.index + m[0].length);
      }
    } else {
      const m = NIEGA_TONO.exec(r);
      if (m !== null) fin = m.index + m[0].length;
    }
    if (fin < 0) continue;
    const resto = r.slice(fin);
    return DA_EL_PORQUE.test(resto) || /^[^\p{L}\d]*:\s*\S+\s+\S+/u.test(resto);
  }
  return false;
}

/** Los identificadores de las reglas con severidad error en la salida del verificador. */
const reglasConError = (salida: string): string[] => [...new Set([...salida.matchAll(/\berror\s+([a-z0-9][a-z0-9-]*)\s/gu)].map((m) => m[1] as string))];

/**
 * La respuesta del agente.
 *
 * `medicion` es la de la respuesta misma con el verificador, solo la base: la
 * respuesta también es un texto en español. En la corrida completa, cuatro
 * respuestas de Grok tutearon y una entregó Markdown.
 */
export function respuestaCorrecta(
  v: Variante,
  respuesta: string | null,
  salida: string | null,
  rutaSalida: string,
  medicion: { codigo: number | null; salida: string } | null = null,
): Comprobacion {
  if (respuesta === null || respuesta.trim() === '') return comprobacion(6, 'falla', 'el agente no dio respuesta');
  const problemas: string[] = [];
  if (v.clase === 'base' && !NIEGA_TONO.test(llano(respuesta))) problemas.push('no dice que no se aplicó ningún tono');
  if (v.clase === 'tono' && !nombraElTono(respuesta, v)) problemas.push(`no nombra el tono ${v.skill}`);
  if (v.clase === 'pasada' && !nombraLaPasada(respuesta, v)) problemas.push(`no nombra la pasada ${v.id}`);
  const r = normalizarRutaLibre(respuesta);
  if (!r.includes('salida.md') && !r.includes(normalizarRutaLibre(rutaSalida))) {
    problemas.push('no dice dónde quedó el texto');
  }
  const repetidas = salida === null ? 0 : repeticionMasLarga(respuesta, salida);
  if (repetidas >= SHINGLE_DE_REPETICION) problemas.push(`repite el texto: ${repetidas} palabras seguidas de salida.md`);
  const avisos: string[] = [];
  if (!daElPorque(respuesta, v)) avisos.push('la línea del tono no dice por qué');
  const reglas = medicion !== null && medicion.codigo === 1 ? reglasConError(medicion.salida) : [];
  if (medicion !== null && medicion.codigo === 1) {
    avisos.push(`la respuesta tiene errores de la base${reglas.length > 0 ? `: ${reglas.join(', ')}` : ''}`);
  }
  const detalle = { repetidas, reglas };
  if (problemas.length > 0) return comprobacion(6, 'falla', [...problemas, ...avisos].join('; '), detalle);
  if (avisos.length > 0) return comprobacion(6, 'aviso', avisos.join('; '), detalle);
  return comprobacion(6, 'pasa', 'nombra la capa y su porqué, dice dónde quedó el texto y no lo repite', detalle);
}

// 7 -------------------------------------------------------------------------

const citaComoTexto = (c: Cita) => `${c.autor} (${c.anio})`;

export function datosConservados(entrada: string, salida: string | null): Comprobacion {
  if (salida === null) return comprobacion(7, 'falla', 'no hay salida con que comparar');
  const anclas = anclasDe(entrada);
  const f = faltantes(anclas, salida);
  const detalle = { anclas, faltantes: f };
  const partes = describirAnclas(f);
  // Una cifra, una cita o una década perdida es un hecho perdido. Un nombre
  // propio se reconoce por la mayúscula, que es una señal más floja: avisa.
  if (f.numeros.length > 0 || f.citas.length > 0 || f.decadas.length > 0) {
    return comprobacion(7, 'falla', `faltan ${partes.join('; ')}`, detalle);
  }
  if (f.nombres.length > 0) return comprobacion(7, 'aviso', `faltan ${partes.join('; ')}`, detalle);
  const total = anclas.numeros.length + anclas.citas.length + anclas.decadas.length + anclas.nombres.length;
  return comprobacion(7, 'pasa', `están las ${total} anclas del original`, detalle);
}

/** Unas anclas dichas para el motivo, por clase. */
function describirAnclas(a: Anclas, numeros: readonly string[] = a.numeros): string[] {
  const partes: string[] = [];
  if (numeros.length > 0) partes.push(`cifras ${lista(numeros)}`);
  if (a.citas.length > 0) partes.push(`citas ${lista(a.citas.map(citaComoTexto))}`);
  if (a.decadas.length > 0) partes.push(`décadas ${lista(a.decadas.map((d) => `década de ${d}`))}`);
  if (a.nombres.length > 0) partes.push(`nombres ${lista(a.nombres)}`);
  return partes;
}

// 8 -------------------------------------------------------------------------

/**
 * Los bordes de la razón entre las palabras de la salida y las de la entrada.
 *
 * Corregir casi no cambia la extensión, pero un tono sí: uno de economía
 * expresiva recorta, uno que glosa cada término alarga. Los bordes de aviso
 * dejan pasar eso y señalan lo que ya merece una lectura. Los de falla marcan
 * lo que ningún tono explica: perder dos de cada cinco palabras es un resumen,
 * y casi duplicar el texto es agregarle lo que no tenía.
 */
export const RAZON_FALLA_MIN = 0.6;
export const RAZON_AVISO_MIN = 0.8;
export const RAZON_AVISO_MAX = 1.35;
export const RAZON_FALLA_MAX = 1.8;

/**
 * El borde de falla por arriba de las variantes cuya forma alarga de verdad.
 *
 * `solitario` le da su turno al adversario y `catedra` expone la tesis rival
 * antes de refutarla: las dos cosas son forma del tono y no relleno. En la
 * corrida completa, Grok llevó solitario a 1,85 sin agregar nada que el tono no
 * pidiera. Dos veces el original sigue marcando lo que ninguna forma explica.
 */
export const RAZON_FALLA_MAX_POR_VARIANTE: Readonly<Record<string, number>> = { solitario: 2.0, catedra: 2.0 };

export function extensionRazonable(entrada: string, salida: string | null, variante?: string): Comprobacion {
  if (salida === null) return comprobacion(8, 'falla', 'no hay salida que medir');
  const de = countWords(entrada);
  const a = countWords(salida);
  const razon = de === 0 ? Number.POSITIVE_INFINITY : a / de;
  const maximo = (variante === undefined ? undefined : RAZON_FALLA_MAX_POR_VARIANTE[variante]) ?? RAZON_FALLA_MAX;
  const detalle = { entrada: de, salida: a, razon, maximo };
  const dicho = `${a} palabras de ${de} (${razon.toFixed(2).replace('.', ',')})`;
  if (razon < RAZON_FALLA_MIN) return comprobacion(8, 'falla', `${dicho}: parece un recorte o un resumen`, detalle);
  if (razon > maximo) return comprobacion(8, 'falla', `${dicho}: agrega mucho más de lo que había`, detalle);
  if (razon < RAZON_AVISO_MIN || razon > RAZON_AVISO_MAX) return comprobacion(8, 'aviso', dicho, detalle);
  return comprobacion(8, 'pasa', dicho, detalle);
}

// 11 ------------------------------------------------------------------------

/**
 * Desde qué valor una cifra nueva es un hecho inventado.
 *
 * Es el mismo borde de las anclas: por debajo de diez, un número es léxico
 * corriente que un tono puede traer al ordenar el texto, como «tres pasos».
 */
export const UMBRAL_DE_CIFRA_NUEVA = 10;

/**
 * Lo que la salida afirma y la entrada no tenía.
 *
 * Es la otra mitad de los datos conservados: un tono puede cambiar la forma,
 * no agregar hechos. Las anclas de la salida se buscan en la entrada, con las
 * mismas lecturas: los números con letra, las décadas y la numeración de los
 * títulos. Una cita de autor y año o una cifra desde diez que no estaban son
 * hechos inventados. Un nombre propio, una cifra chica o una década nuevos
 * avisan: pueden ser parte de un ejemplo que la forma del tono pidió.
 */
export function datosNuevos(entrada: string, salida: string | null): Comprobacion {
  if (salida === null) return comprobacion(11, 'falla', 'no hay salida con que comparar');
  const nuevos = faltantes(anclasDe(salida), entrada);
  const valor = (n: string) => Number(n.replace(',', '.'));
  const grandes = nuevos.numeros.filter((n) => valor(n) >= UMBRAL_DE_CIFRA_NUEVA);
  const chicos = nuevos.numeros.filter((n) => valor(n) < UMBRAL_DE_CIFRA_NUEVA);
  const detalle = { nuevos };
  if (grandes.length > 0 || nuevos.citas.length > 0) {
    return comprobacion(11, 'falla', `agrega ${describirAnclas(nuevos).join('; ')}`, detalle);
  }
  if (chicos.length > 0 || nuevos.decadas.length > 0 || nuevos.nombres.length > 0) {
    return comprobacion(11, 'aviso', `agrega ${describirAnclas(nuevos).join('; ')}`, detalle);
  }
  return comprobacion(11, 'pasa', 'no agrega cifras, citas, décadas ni nombres que el original no tenga', detalle);
}

// 9 -------------------------------------------------------------------------

/** Una ruta para comparar: barras normales, sin mayúsculas y sin barra final. */
export const normalizarRuta = (p: string): string =>
  p.replace(/\\/gu, '/').replace(/\/+/gu, '/').replace(/\/$/u, '').toLowerCase();

const esAbsoluta = (p: string) => /^[a-z]:[\\/]/iu.test(p) || p.startsWith('/') || p.startsWith('\\\\');

export const dentroDe = (ruta: string, dir: string): boolean => {
  const a = normalizarRuta(ruta);
  const b = normalizarRuta(dir);
  return a === b || a.startsWith(`${b}/`);
};

/**
 * Las líneas de `git status --porcelain` sin las rutas que la prueba deja a
 * propósito: la carpeta de resultados y `odd/`.
 */
export function cambiosDeGit(porcelana: string | null, ignorar: readonly string[]): string[] | null {
  if (porcelana === null) return null;
  return porcelana
    .split(/\r?\n/u)
    .filter((l) => l.trim() !== '')
    .filter((l) => {
      const ruta = (l.slice(3).split(' -> ').at(-1) ?? '').replace(/^"|"$/gu, '');
      return !ignorar.some((p) => ruta === p.replace(/\/$/u, '') || ruta.startsWith(p));
    });
}

export type ContextoDeRepositorios = {
  staging: string;
  raices: readonly string[];
  /** Donde trabajó el agente: la copia. Una ruta relativa se lee desde acá. */
  cwd: string;
  /** Si otras corridas estaban activas a la vez: entonces un cambio no se le puede atribuir a esta. */
  paralelas: boolean;
  /** Lo que cambió en la copia, por la huella de cada archivo. */
  copia: CambiosDeLaCopia;
  /**
   * Las carpetas donde el agente guarda su propio estado. Escribir ahí es parte
   * de cómo funciona, no escribir fuera: en la primera corrida de humo,
   * Antigravity guardó un borrador en la carpeta de su conversación y salió como
   * escritura fuera de la corrida.
   */
  propias: readonly string[];
};

/**
 * Que la corrida no tocó nada que no fuera suyo.
 *
 * Mira tres cosas. El `git status` de los repositorios reales, antes y después.
 * La huella de cada archivo de la copia: el agente trabaja ahí, y git no la ve;
 * cambiar o borrar uno de esos archivos es tocar el arnés que se estaba usando,
 * y crear uno nuevo es dejar algo donde no se pidió. Y las escrituras de la
 * sesión que caen fuera de la carpeta de la corrida y del estado propio del
 * agente.
 */
export function repositoriosIntactos(
  antes: Record<string, string[] | null>,
  despues: Record<string, string[] | null>,
  escritas: readonly string[],
  ctx: ContextoDeRepositorios,
): Comprobacion {
  const hallazgos: { estado: Juicio; texto: string }[] = [];
  for (const raiz of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const a = antes[raiz];
    const d = despues[raiz];
    if (a == null || d == null) {
      hallazgos.push({ estado: 'aviso', texto: `${raiz}: git no respondió, así que no se puede afirmar nada` });
      continue;
    }
    const cambios = [...d.filter((x) => !a.includes(x)), ...a.filter((x) => !d.includes(x)).map((x) => `ya no: ${x}`)];
    if (cambios.length > 0) {
      const atribucion = ctx.paralelas ? '. Con corridas en paralelo, no se puede atribuir a esta' : '';
      hallazgos.push({ estado: 'falla', texto: `${raiz}: ${lista([...new Set(cambios)])}${atribucion}` });
    }
  }
  const { modificados, borrados, nuevos } = ctx.copia;
  if (modificados.length > 0) hallazgos.push({ estado: 'falla', texto: `cambió en la copia: ${lista(sinRepetir(modificados))}` });
  if (borrados.length > 0) hallazgos.push({ estado: 'falla', texto: `borró de la copia: ${lista(sinRepetir(borrados))}` });
  if (nuevos.length > 0) hallazgos.push({ estado: 'aviso', texto: `creó en la copia: ${lista(sinRepetir(nuevos))}` });

  const enRepositorios: string[] = [];
  const afuera: string[] = [];
  for (const e of escritas) {
    const ruta = esAbsoluta(e) ? e : `${ctx.cwd}/${e}`;
    // Lo que cae en la copia lo decide su huella, más arriba.
    if (dentroDe(ruta, ctx.staging) || ctx.propias.some((p) => dentroDe(ruta, p))) continue;
    if (ctx.raices.some((r) => dentroDe(ruta, r))) enRepositorios.push(e);
    else afuera.push(e);
  }
  if (enRepositorios.length > 0) {
    hallazgos.push({ estado: 'falla', texto: `escribió en un repositorio: ${lista(sinRepetir(enRepositorios))}` });
  }
  if (afuera.length > 0) hallazgos.push({ estado: 'aviso', texto: `escribió fuera de su carpeta: ${lista(sinRepetir(afuera))}` });
  if (hallazgos.length === 0) {
    return comprobacion(9, 'pasa', 'git no cambió, la copia tampoco, y no escribió fuera de su carpeta');
  }
  return comprobacion(
    9,
    peor(hallazgos.map((h) => h.estado)),
    hallazgos.map((h) => h.texto).join('; '),
    hallazgos,
  );
}

// 10 ------------------------------------------------------------------------

export type ContextoDeAislamiento = {
  staging: string;
  carpeta: string;
  /** La carpeta que contiene la de la prueba. La copia la replica, así que una ruta relativa se lee contra ella. */
  mix: string;
  /** Las raíces de los repositorios reales, las del plan del ejecutor. */
  reales: readonly string[];
};

/** Una ruta absoluta, ya con barras normales: con letra de unidad o desde la raíz. */
const esAbsolutaNormal = (r: string) => /^[a-z]:\//iu.test(r) || r.startsWith('/');

const UNA_CORRIDA = /pf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

/**
 * Las rutas de una cadena: lo que queda entre espacios, comillas y los signos
 * que separan argumentos, con las barras normalizadas y sin el `./` del
 * principio. Un comando entero, un `import` dentro de `node -e` o el campo de
 * ruta de una herramienta dan todos sus rutas de la misma manera.
 */
export function rutasEn(s: string): string[] {
  return s
    .split(/[\s"'`<>|;,()[\]{}]+/u)
    .map((t) => t.replace(/[\\/]+/gu, '/').replace(/^\.\//u, '').replace(/[.:]+$/u, ''))
    .filter((t) => t.includes('/'));
}

/**
 * Lo que el agente usó fuera de lo suyo.
 *
 * En el sondeo, Antigravity recorrió las carpetas vecinas, leyó lo que habían
 * dejado los otros dos agentes y copió una salida byte a byte. En la primera
 * corrida de humo, Grok buscó en el ejecutor cómo se comprueban los hechos,
 * importó las funciones que los comparan y revisó con ellas su propia salida.
 * Cualquiera de las dos cosas deja un veredicto que no mide las skills, así que
 * leer, buscar, importar o ejecutar el código de la prueba, la carpeta de la
 * prueba u otra corrida es una falla, con las rutas en el motivo.
 *
 * Se miran las entradas de todas las herramientas, en cualquier forma de ruta.
 * Una copia que no se leyó la caza `salidasIdenticas`, al final de la serie.
 *
 * Queda un camino que no nombra ningún archivo de la prueba: una búsqueda sobre
 * el arnés real entero recorre su código igual. Por eso una ruta absoluta a un
 * repositorio real avisa, con la ruta. Es un aviso y no una falla porque leer el
 * arnés real no es usar el oráculo; la falla queda para lo que sí lo nombra. Lo
 * que cae en la copia propia no cuenta, aunque la carpeta temporal estuviera
 * dentro de una raíz real.
 */
export function aislamiento(t: Transcripcion, ctx: ContextoDeAislamiento): Comprobacion {
  const propia = normalizarRuta(ctx.staging).split('/').at(-1) ?? '';
  const carpeta = normalizarRuta(ctx.carpeta);
  const relativa = dentroDe(ctx.carpeta, ctx.mix) ? carpeta.slice(normalizarRuta(ctx.mix).length + 1) : null;
  const porNombre = relativa ? new RegExp(`(?:^|/)${escapar(relativa)}(?:/|$)`, 'u') : null;
  const codigo: string[] = [];
  const deLaCarpeta: string[] = [];
  const otras: string[] = [];
  const reales: string[] = [];
  for (const l of t.llamadas) {
    for (const s of cadenasDe(l.entrada)) {
      for (const ruta of rutasEn(s)) {
        const n = normalizarRuta(ruta);
        const deCodigo = esCodigoDeLaPrueba(ruta);
        const enCarpeta = n === carpeta || n.startsWith(`${carpeta}/`) || (porNombre?.test(n) ?? false);
        const enOtra = [...n.matchAll(UNA_CORRIDA)].some((m) => m[0] !== propia);
        if (deCodigo) codigo.push(ruta);
        if (enCarpeta) deLaCarpeta.push(ruta);
        if (enOtra) otras.push(ruta);
        // Lo que ya falla no se repite como aviso.
        if (deCodigo || enCarpeta || enOtra || !esAbsolutaNormal(ruta) || dentroDe(ruta, ctx.staging)) continue;
        if (ctx.reales.some((r) => dentroDe(ruta, r))) reales.push(ruta);
      }
      // Una ruta con espacios no sale entera de `rutasEn`.
      const entera = normalizarRuta(s);
      if (carpeta.includes(' ') && entera.includes(carpeta)) deLaCarpeta.push(ctx.carpeta);
      for (const r of ctx.reales) if (r.includes(' ') && entera.includes(normalizarRuta(r))) reales.push(r);
    }
  }
  const grupos = [
    { nombre: 'el código de la prueba', rutas: sinRepetir(codigo) },
    { nombre: 'la carpeta de la prueba', rutas: sinRepetir(deLaCarpeta) },
    { nombre: 'otra corrida', rutas: sinRepetir(otras) },
  ].filter((g) => g.rutas.length > 0);
  const delRepositorio = sinRepetir(reales);
  const aviso = delRepositorio.length > 0 ? `miró los repositorios reales fuera de su copia (${lista(delRepositorio)})` : null;
  const detalle = {
    ...Object.fromEntries(grupos.map((g) => [g.nombre, g.rutas])),
    ...(aviso === null ? {} : { 'los repositorios reales': delRepositorio }),
  };
  if (grupos.length > 0) {
    const motivo = `usó ${grupos.map((g) => `${g.nombre} (${lista(g.rutas)})`).join('; ')}`;
    return comprobacion(10, 'falla', aviso === null ? motivo : `${motivo}; además ${aviso}`, detalle);
  }
  if (aviso !== null) return comprobacion(10, 'aviso', aviso, detalle);
  return comprobacion(10, 'pasa', 'no tocó nada de otras corridas ni de la prueba');
}

/** Para cada corrida, las otras cuya salida.md es idéntica byte a byte. */
export function salidasIdenticas(corridas: readonly { clave: string; huella: string | null }[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const c of corridas) {
    if (c.huella === null) continue;
    const otras = corridas.filter((o) => o.clave !== c.clave && o.huella === c.huella).map((o) => o.clave);
    if (otras.length > 0) out.set(c.clave, otras);
  }
  return out;
}

/** La comprobación 10 con la copia sumada: una salida idéntica a otra es una falla. */
export function conIdenticas(c: Comprobacion, otras: readonly string[]): Comprobacion {
  if (otras.length === 0) return c;
  const previo = c.estado === 'pasa' ? '' : `; además ${c.motivo}`;
  return { ...c, estado: 'falla', motivo: `salida.md idéntica byte a byte a la de ${otras.join(', ')}${previo}` };
}

// Errores del propio agente ---------------------------------------------------

/**
 * Por qué la corrida no terminó por el lado del agente, o null si terminó.
 *
 * En la segunda corrida de humo, agy agotó su cuota al dar la respuesta final y
 * la comprobación de la respuesta lo contó como una falla de las skills. Una
 * corrida que el agente no terminó no dice nada de las skills. Va primero el
 * error que el agente informa, que es el más preciso; después el límite de
 * tiempo del ejecutor; y después un proceso que salió con un código distinto
 * de cero sin dar respuesta. Uno que salió con cero sin responder sí terminó:
 * eso lo juzga la comprobación de la respuesta.
 */
export function errorDelAgente(t: Transcripcion, l: Pick<Lanzamiento, 'codigo' | 'vencido'>): string | null {
  if (t.error !== null) return t.error;
  if (l.vencido) return 'tiempo agotado';
  const respondio = t.respuesta !== null && t.respuesta.trim() !== '';
  if (respondio || l.codigo === 0) return null;
  return l.codigo === null ? 'el proceso no se pudo lanzar' : `el proceso terminó con código ${l.codigo}`;
}

/**
 * Las comprobaciones que dependen de que la corrida termine.
 *
 * La salida, el verificador sobre ella, las skills cargadas, la medición, la
 * respuesta, los datos, la extensión y los datos nuevos miden el trabajo terminado: en una
 * corrida cortada a mitad de camino, que falten no dice nada de las skills.
 * Las otras tres se pueden afirmar con lo que haya: si base.docx cambió, si se
 * tocó algo fuera de la corrida y si se usó lo de la prueba.
 */
export const DEPENDEN_DE_TERMINAR = [2, 3, 4, 5, 6, 7, 8, 11];

/**
 * Las comprobaciones de una corrida que el ejecutor no pudo juzgar, porque falló
 * él y no el agente: todas sin evaluar, con el motivo.
 */
export function sinJuzgar(motivo: string): Comprobacion[] {
  return Object.keys(NOMBRES).map((n): Comprobacion => ({
    numero: Number(n),
    nombre: NOMBRES[Number(n)] ?? '',
    estado: 'sin evaluar',
    motivo: `no se juzgó: ${motivo}`,
  }));
}

/**
 * Las comprobaciones de una corrida que el agente no terminó: las que dependen
 * de que termine quedan sin evaluar, con lo que daban en el motivo para quien
 * quiera mirarlo.
 */
export function sinTerminar(cs: readonly Comprobacion[], error: string): Comprobacion[] {
  return cs.map((c) =>
    DEPENDEN_DE_TERMINAR.includes(c.numero)
      ? { ...c, estado: 'sin evaluar', motivo: `la corrida no terminó (${error}); con lo que quedó daba ${c.estado}: ${c.motivo}` }
      : c,
  );
}
