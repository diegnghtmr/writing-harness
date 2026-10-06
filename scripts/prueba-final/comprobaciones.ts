// Las diez comprobaciones de cada corrida de la prueba final.
//
// Cada una es una función pura que recibe lo que dejó la corrida y devuelve
// pasa, aviso o falla, con el motivo escrito para quien lea el resumen. Una
// falla es bloqueante: con una sola, la prueba sale con 1. Un aviso se informa y
// no frena, igual que una advertencia del verificador.
//
// Todas miden lo que piden las skills, no lo que pide el prompt. El prompt solo
// dice qué hacer con el texto y dónde dejarlo; que el agente cargue las skills,
// mida, anuncie el tono y no repita el texto tiene que salir de ellas.

import { countWords } from '../../src/text.ts';
import { anclasDe, faltantes, normalizar, type Cita } from './anclas.ts';
import { cadenasDe, comandos, type Transcripcion } from './transcripcion.ts';
import { SKILL_BASE, skillsRequeridas, type Variante } from './variantes.ts';

export type Estado = 'pasa' | 'aviso' | 'falla';

export type Comprobacion = {
  numero: number;
  nombre: string;
  estado: Estado;
  motivo: string;
  detalle?: unknown;
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
};

const comprobacion = (numero: number, estado: Estado, motivo: string, detalle?: unknown): Comprobacion => ({
  numero,
  nombre: NOMBRES[numero] ?? '',
  estado,
  motivo,
  ...(detalle === undefined ? {} : { detalle }),
});

const ORDEN: Record<Estado, number> = { pasa: 0, aviso: 1, falla: 2 };
const peor = (estados: Estado[]): Estado => estados.reduce<Estado>((a, b) => (ORDEN[b] > ORDEN[a] ? b : a), 'pasa');

/** El estado de una corrida: el peor de sus comprobaciones. */
export const estadoDe = (cs: readonly Comprobacion[]): Estado => peor(cs.map((c) => c.estado));

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Una lista que no se desborda en el resumen. */
const lista = (xs: readonly string[], tope = 10) =>
  xs.length <= tope ? xs.join(', ') : `${xs.slice(0, tope).join(', ')} y ${xs.length - tope} más`;

// 1 -------------------------------------------------------------------------

export function docxIntacto(antes: string, despues: string): Comprobacion {
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
 */
export function skillsDeLaVariante(v: Variante, cargadas: readonly string[]): Comprobacion {
  const requeridas = skillsRequeridas(v);
  const faltan = requeridas.filter((s) => !cargadas.includes(s));
  const tonos = cargadas.filter((s) => /-writing$/u.test(s) && s !== SKILL_BASE && s !== v.skill);
  const detalle = { cargadas, faltan, tonos };
  const motivos: string[] = [];
  if (faltan.length > 0) motivos.push(`no cargó ${faltan.join(', ')}`);
  if (v.clase === 'base' && tonos.length > 0) motivos.push(`al corregir cargó un tono: ${tonos.join(', ')}`);
  if (motivos.length > 0) return comprobacion(4, 'falla', motivos.join('; '), detalle);
  if (tonos.length > 0) return comprobacion(4, 'aviso', `cargó además otro tono: ${tonos.join(', ')}`, detalle);
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

export function agenteMidio(v: Variante, t: Transcripcion): Comprobacion {
  const mediciones = comandos(t).filter((l) => {
    if (l.comando === null || !VERIFICADOR.test(l.comando)) return false;
    // Enrutar o pedir la ayuda no mide ningún texto.
    return !/--enrutar|(?:^|\s)(?:-h|--help)(?:\s|$)/u.test(tramo(l.comando));
  });
  const ultima = mediciones.at(-1);
  if (ultima === undefined || ultima.comando === null) {
    return comprobacion(5, 'falla', 'no corrió el verificador sobre ningún texto');
  }
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
  const detalle = { veces: mediciones.length, ultimoCodigo: ultima.codigo, ultimo: ultima.comando, conBanderas };
  const veces = plural(mediciones.length, 'vez', 'veces');
  const codigo = ultima.codigo === null ? 'sin código registrado' : `código ${ultima.codigo}`;
  if (!conBanderas) {
    return comprobacion(
      5,
      'aviso',
      `lo corrió ${veces}; la última, ${describirBanderas(b)}, y la variante pide ${describirBanderas(esperado)} (${codigo})`,
      detalle,
    );
  }
  return comprobacion(5, 'pasa', `lo corrió ${veces}; la última, con las opciones de la variante (${codigo})`, detalle);
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
// con los guiones vueltos espacios.
const NIEGA_TONO =
  /\b(?:ningun|sin)\s+tono\b|\bno\s+(?:se\s+)?(?:aplic|us|utiliz|hub|eleg|eligi)\w*\s+(?:(?:ningun|el|un)\s+)?tono\b|\btono\s*:\s*(?:ninguno|no|sin)\b/u;

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

function nombraLaPasada(respuesta: string, v: Variante): boolean {
  const r = llano(respuesta);
  // «humanicé», «humanizado», «humanizar»: la raíz común son las seis primeras letras.
  return r.includes(llano(v.id).slice(0, 6)) || (v.skill !== null && r.includes(llano(v.skill))) || /\bpasada\b/u.test(r);
}

const normalizarRutaLibre = (s: string) => s.replace(/\\/gu, '/').toLowerCase();

export function respuestaCorrecta(
  v: Variante,
  respuesta: string | null,
  salida: string | null,
  rutaSalida: string,
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
  const detalle = { repetidas };
  if (problemas.length > 0) return comprobacion(6, 'falla', problemas.join('; '), detalle);
  return comprobacion(6, 'pasa', 'nombra la capa, dice dónde quedó el texto y no lo repite', detalle);
}

// 7 -------------------------------------------------------------------------

const citaComoTexto = (c: Cita) => `${c.autor} (${c.anio})`;

export function datosConservados(entrada: string, salida: string | null): Comprobacion {
  if (salida === null) return comprobacion(7, 'falla', 'no hay salida con que comparar');
  const anclas = anclasDe(entrada);
  const f = faltantes(anclas, salida);
  const detalle = { anclas, faltantes: f };
  const partes: string[] = [];
  if (f.numeros.length > 0) partes.push(`cifras ${lista(f.numeros)}`);
  if (f.citas.length > 0) partes.push(`citas ${lista(f.citas.map(citaComoTexto))}`);
  if (f.nombres.length > 0) partes.push(`nombres ${lista(f.nombres)}`);
  // Una cifra o una cita perdida es un hecho perdido. Un nombre propio se
  // reconoce por la mayúscula, que es una señal más floja: avisa.
  if (f.numeros.length > 0 || f.citas.length > 0) return comprobacion(7, 'falla', `faltan ${partes.join('; ')}`, detalle);
  if (f.nombres.length > 0) return comprobacion(7, 'aviso', `faltan ${partes.join('; ')}`, detalle);
  const total = anclas.numeros.length + anclas.citas.length + anclas.nombres.length;
  return comprobacion(7, 'pasa', `están las ${total} anclas del original`, detalle);
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

export function extensionRazonable(entrada: string, salida: string | null): Comprobacion {
  if (salida === null) return comprobacion(8, 'falla', 'no hay salida que medir');
  const de = countWords(entrada);
  const a = countWords(salida);
  const razon = de === 0 ? Number.POSITIVE_INFINITY : a / de;
  const detalle = { entrada: de, salida: a, razon };
  const dicho = `${a} palabras de ${de} (${razon.toFixed(2).replace('.', ',')})`;
  if (razon < RAZON_FALLA_MIN) return comprobacion(8, 'falla', `${dicho}: parece un recorte o un resumen`, detalle);
  if (razon > RAZON_FALLA_MAX) return comprobacion(8, 'falla', `${dicho}: agrega mucho más de lo que había`, detalle);
  if (razon < RAZON_AVISO_MIN || razon > RAZON_AVISO_MAX) return comprobacion(8, 'aviso', dicho, detalle);
  return comprobacion(8, 'pasa', dicho, detalle);
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
  cwd: string;
  /** Si otras corridas estaban activas a la vez: entonces un cambio no se le puede atribuir a esta. */
  paralelas: boolean;
};

export function repositoriosIntactos(
  antes: Record<string, string[] | null>,
  despues: Record<string, string[] | null>,
  escritas: readonly string[],
  ctx: ContextoDeRepositorios,
): Comprobacion {
  const hallazgos: { estado: Estado; texto: string }[] = [];
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
      hallazgos.push({ estado: 'falla', texto: `${raiz}: ${lista(cambios)}${atribucion}` });
    }
  }
  for (const e of escritas) {
    const ruta = esAbsoluta(e) ? e : `${ctx.cwd}/${e}`;
    if (dentroDe(ruta, ctx.staging)) continue;
    if (ctx.raices.some((r) => dentroDe(ruta, r))) {
      hallazgos.push({ estado: 'falla', texto: `escribió en un repositorio: ${e}` });
    } else {
      hallazgos.push({ estado: 'aviso', texto: `escribió fuera de su carpeta: ${e}` });
    }
  }
  if (hallazgos.length === 0) {
    return comprobacion(9, 'pasa', 'git no cambió y no escribió fuera de su carpeta');
  }
  return comprobacion(
    9,
    peor(hallazgos.map((h) => h.estado)),
    hallazgos.map((h) => h.texto).join('; '),
    hallazgos,
  );
}

// 10 ------------------------------------------------------------------------

export type ContextoDeAislamiento = { staging: string; carpeta: string; cwd: string };

const UNA_CORRIDA = /pf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu;

/**
 * Lo que el agente miró fuera de lo suyo.
 *
 * En el sondeo, Antigravity recorrió las carpetas vecinas, leyó lo que habían
 * dejado los otros dos agentes y copió una salida byte a byte; también leyó el
 * documento de la tarea. Esto marca las lecturas de otra corrida, de la carpeta
 * de la prueba, de `odd/` y de los archivos del ejecutor. Es un aviso: leer no
 * es copiar. La copia la caza `salidasIdenticas`, al final de la serie.
 */
export function aislamiento(t: Transcripcion, ctx: ContextoDeAislamiento): Comprobacion {
  const propia = normalizarRuta(ctx.staging).split('/').at(-1) ?? '';
  const carpeta = normalizarRuta(ctx.carpeta);
  const relativa = dentroDe(ctx.carpeta, ctx.cwd) ? carpeta.slice(normalizarRuta(ctx.cwd).length + 1) : null;
  const porNombre = relativa ? new RegExp(`(?:^|[\\s"'\`=/])${escapar(relativa)}(?:/|$|[\\s"'\`])`, 'u') : null;
  const hallazgos = new Set<string>();
  for (const l of t.llamadas) {
    for (const s of cadenasDe(l.entrada)) {
      const n = normalizarRuta(s);
      for (const m of n.matchAll(UNA_CORRIDA)) if (m[0] !== propia) hallazgos.add(`otra corrida (${m[0]})`);
      if (n.includes(carpeta) || porNombre?.test(n)) hallazgos.add('la carpeta de la prueba');
      if (/(?:^|[\s"'`=/])odd\//u.test(n)) hallazgos.add('odd/');
      if (/(?:scripts|evals)\/(?:fixtures\/)?prueba-final/u.test(n)) hallazgos.add('los archivos del ejecutor');
    }
  }
  if (hallazgos.size === 0) return comprobacion(10, 'pasa', 'no tocó nada de otras corridas ni de la prueba');
  return comprobacion(10, 'aviso', `miró ${[...hallazgos].join(', ')}`, [...hallazgos]);
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
