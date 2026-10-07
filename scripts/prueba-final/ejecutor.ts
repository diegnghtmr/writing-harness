// La serie de corridas: cada agente con cada variante, aisladas entre sí, y los
// resultados publicados al final.
//
// El aislamiento es la razón de casi todo lo que hay acá. En el sondeo, con las
// tres corridas escribiendo en una carpeta compartida, Antigravity recorrió las
// carpetas vecinas, leyó lo que habían dejado los otros dos agentes y entregó
// la salida de Grok byte a byte. Desde entonces:
//
// - cada corrida trabaja en una carpeta propia bajo el directorio temporal del
//   sistema, con un nombre al azar, y no bajo una carpeta común que pueda
//   recorrer;
// - nada se publica en la carpeta de la prueba hasta que terminó la serie
//   entera, así que ninguna corrida puede ver el resultado de otra;
// - al final, dos salidas idénticas byte a byte son una falla.
//
// En la primera corrida de humo apareció otra fuga: trabajando en mix, Grok
// encontró el código de esta prueba, importó las funciones que comparan los
// hechos y revisó con ellas su propia salida. Desde entonces el agente no
// trabaja en mix sino en una copia, dentro de la carpeta de su corrida, sin el
// código de la prueba (`copia.ts` dice qué lleva y por qué). `entrada.md` y
// `salida.md` quedan fuera de la copia, en la carpeta de la corrida, y la
// comprobación del verificador usa el del ejecutor, no el de la copia.
//
// Lo que cambia entre la prueba de verdad y la de la suite son las
// dependencias: el agente, el verificador, git y el reloj. Por eso entran como
// parámetros.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Contexto } from './agentes.ts';
import { carpetasDeAgentes, escribirResumen, fechaPrevia, HISTORIAL, marca, mover, suiteDeLaCarpeta } from './carpeta.ts';
import {
  agenteMidio,
  aislamiento,
  cambiosDeGit,
  conIdenticas,
  datosConservados,
  datosNuevos,
  dentroDe,
  docxIntacto,
  errorDelAgente,
  estadoDe,
  extensionRazonable,
  leerTexto,
  repositoriosIntactos,
  respuestaCorrecta,
  salidaLegible,
  salidasIdenticas,
  sinJuzgar,
  sinTerminar,
  skillsDeLaVariante,
  verificadorLimpio,
  type Comprobacion,
  type HuellaLeida,
} from './comprobaciones.ts';
import {
  CARPETA_DE_LA_COPIA,
  cambiosDeLaCopia,
  construirCopia,
  DE_MIX,
  huellaDeLaCopia,
  huellasDe,
  type PlanDeLaCopia,
} from './copia.ts';
import type { Texto } from './fragmento.ts';
import type { Lanzamiento } from './proceso.ts';
import { codigoDeSalida, type Metadatos, type Suite, type Veredicto } from './resumen.ts';
import { huellasDeMix, trazaDeLaSerie, vigenciaDe, type EstadoDelArnes, type Traza } from './traza.ts';
import { escrituras, lecturasDeSkills, vacia, type Transcripcion } from './transcripcion.ts';
import { promptDe } from './prompts.ts';
import type { Variante } from './variantes.ts';

export type Agente = {
  id: string;
  /** Lanza la corrida y espera a que termine o venza. */
  lanzar(ctx: Contexto): Promise<Lanzamiento>;
  /** Lee la sesión, y copia a la carpeta de la corrida lo que el agente dejó fuera de ella. */
  recoger(ctx: Contexto, l: Lanzamiento): Transcripcion;
  /** Las carpetas donde el agente guarda su propio estado, que no cuentan como escribir fuera. */
  estadoPropio?(ctx: Contexto, t: Transcripcion): string[];
};

export type Dependencias = {
  /** Donde se crean las carpetas de las corridas. */
  tmp: string;
  uuid(): string;
  /** `git status --porcelain` de un repositorio, o null si git no respondió. */
  estadoGit(raiz: string): string | null;
  /** El verificador del arnés sobre un archivo, con las opciones de la variante. */
  verificar(archivo: string, banderas: readonly string[]): { codigo: number | null; salida: string };
  ahora(): Date;
  /** Una línea de progreso para quien mira la consola. */
  avisar(linea: string): void;
  /**
   * Las rutas del arnés que cambiaron desde un estado anotado, o null si git
   * no reconoce su commit. Con esto se marcan, al publicar, las celdas que un
   * cambio posterior dejó desactualizadas.
   */
  cambiosDesde(arnes: EstadoDelArnes): string[] | null;
};

export type Plan = {
  carpeta: string;
  docx: string;
  /** La carpeta que contiene la de la prueba: de ahí salen las instrucciones de la copia. */
  mix: string;
  /** Lo que lleva la copia de cada corrida, que es donde trabajan los agentes. */
  copia: PlanDeLaCopia;
  raicesGit: string[];
  texto: Texto;
  agentes: Agente[];
  variantes: Variante[];
  /** Corridas a la vez dentro de un mismo agente. Agentes distintos siempre corren a la vez. */
  paralelo: number;
  limiteMin: number;
  /** Los agentes conocidos que no corren esta vez, para que el resumen lo diga. */
  omitidos: string[];
  /** Sumar esta serie a lo que ya hay en la raíz en vez de reemplazarlo. Ver `publicar`. */
  agregar: boolean;
  /**
   * Si está, corren solo estos pares, escritos `agente/variante`, y no el
   * cruce entero de agentes y variantes. Es lo que corre `--fallidas`.
   */
  pares?: ReadonlySet<string>;
  /**
   * Con qué se prueba: el arnés al empezar la serie y, por agente, las skills
   * instaladas que lee. Cada veredicto lo anota.
   */
  traza: { arnes: EstadoDelArnes; instaladas: Record<string, NonNullable<Traza['instaladas']>> };
};

/** El principio del nombre del proyecto de Engram de cada corrida. */
export const PREFIJO_DE_ENGRAM = 'prueba-final';

/**
 * El proyecto de Engram de una corrida: uno por serie, agente y variante.
 *
 * Grok y Antigravity cargan las instrucciones globales del usuario, que mandan
 * a guardar y a buscar memorias. Con un proyecto común para toda la prueba, en
 * la corrida completa Grok leyó lo que había guardado otra corrida, y las
 * corridas dejaron de ser independientes. Antes, sin proyecto propio,
 * escribían en el proyecto real del usuario.
 */
export function proyectoDeEngram(serie: Date, agente: string, variante: string): string {
  const fecha = serie.toISOString().slice(0, 19).replace(/-|:/gu, '').replace('T', '-');
  return `${PREFIJO_DE_ENGRAM}-${fecha}-${agente}-${variante}`;
}

type Resultado = {
  agente: string;
  variante: string;
  staging: string;
  huellaSalida: string | null;
  comprobaciones: Comprobacion[];
  /** Por qué el agente no terminó la corrida, o null. */
  error: string | null;
  metadatos: Metadatos;
};

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Lo más largo que puede ser el motivo de una falla del ejecutor: entra en una celda del resumen. */
const LARGO_DEL_MOTIVO = 160;

/** Una excepción en una frase corta: su primera línea. */
function enUnaLinea(e: unknown): string {
  const linea = (e instanceof Error ? e.message : String(e)).split(/\r?\n/u)[0]?.trim() ?? '';
  return linea.length <= LARGO_DEL_MOTIVO ? linea : `${linea.slice(0, LARGO_DEL_MOTIVO - 1)}…`;
}

/**
 * La huella de un archivo, o por qué no se pudo leer. base.docx se lee antes y
 * después de cada corrida: si falta, es una falla de la comprobación 1, no una
 * excepción que tumbe la serie.
 */
function huellaDe(ruta: string): HuellaLeida {
  try {
    return sha256(readFileSync(ruta));
  } catch (e) {
    return { ilegible: (e as NodeJS.ErrnoException).code ?? enUnaLinea(e) };
  }
}

/** Una huella para el resumen, que la escribe como texto. */
const huellaEscrita = (h: HuellaLeida) => (typeof h === 'string' ? h : `no se pudo leer (${h.ilegible})`);

/** Corre `fn` sobre cada elemento, con a lo sumo `n` a la vez, y conserva el orden. */
async function enParalelo<T, R>(items: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const k = siguiente++;
      out[k] = await fn(items[k] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, trabajador));
  return out;
}

/** Lo que git no tiene que mirar en un repositorio: la carpeta de la prueba si cae adentro, y `odd/`. */
function ignorados(raiz: string, carpeta: string): string[] {
  const rel = relative(raiz, carpeta).replace(/\\/gu, '/');
  const adentro = rel !== '' && !rel.startsWith('..') && !/^[a-z]:/iu.test(rel) && !rel.startsWith('/');
  return adentro ? [`${rel}/`, 'odd/'] : ['odd/'];
}

export async function correrSuite(plan: Plan, deps: Dependencias): Promise<{ suite: Suite; codigo: 0 | 1 }> {
  const inicioSerie = deps.ahora();
  const huellaInicial = sha256(readFileSync(plan.docx));
  const estadoRepos = () =>
    Object.fromEntries(
      plan.raicesGit.map((r) => [r, cambiosDeGit(deps.estadoGit(r), ignorados(r, plan.carpeta))]),
    ) as Record<string, string[] | null>;

  // Qué corridas estaban activas a la vez, para saber si un cambio en git se le
  // puede atribuir a una sola.
  const activas = new Set<{ acompanada: boolean }>();

  /**
   * Una corrida, con lo que falle del lado del ejecutor contenido en ella.
   *
   * Fuera de lanzar y recoger, que ya contienen lo suyo, una excepción armando
   * la carpeta, la copia o el estado de git rechazaba la serie entera, y como
   * se publica al final, no se publicaba nada. Ahora esa corrida queda como
   * error, con el motivo, y las demás siguen.
   */
  async function correrUna(agente: Agente, variante: Variante): Promise<Resultado> {
    const id = deps.uuid();
    const staging = join(deps.tmp, `pf-${id}`);
    const engram = proyectoDeEngram(inicioSerie, agente.id, variante.id);
    try {
      return await juzgarUna(agente, variante, id, staging, engram);
    } catch (e) {
      return delEjecutor(agente, variante, id, staging, engram, e);
    }
  }

  /**
   * Una corrida en que falló el ejecutor y no el agente.
   *
   * Su estado es `error`, el de la corrida que no se terminó de juzgar: no le
   * carga una falla a ninguna comprobación de las skills, y su motivo dice que
   * el que falló fue el ejecutor. La comprobación 1 se hace igual, contra la
   * huella del principio de la serie, porque no depende de la corrida.
   */
  function delEjecutor(agente: Agente, variante: Variante, id: string, staging: string, engram: string, e: unknown): Resultado {
    const error = `falla del ejecutor: ${enUnaLinea(e)}`;
    deps.avisar(`${agente.id}/${variante.id}: error: ${error}`);
    const comprobaciones = sinJuzgar(error);
    comprobaciones[0] = docxIntacto(huellaInicial, huellaDe(plan.docx));
    const ahora = deps.ahora().toISOString();
    let mix: Record<string, string> = {};
    try {
      mix = huellasDeMix(plan.mix);
    } catch {
      // Sin las huellas de mix, la celda queda sin traza de mix y nada más.
    }
    return {
      agente: agente.id,
      variante: variante.id,
      staging,
      huellaSalida: null,
      comprobaciones,
      error,
      metadatos: {
        version: null,
        modelo: null,
        duracionMs: 0,
        duracionAgenteMs: null,
        codigo: null,
        vencido: false,
        costo: null,
        sesion: id,
        inicio: ahora,
        fin: ahora,
        copia: { archivos: 0, huella: '' },
        engram,
        traza: { arnes: plan.traza.arnes, mix, docx: huellaInicial, instaladas: plan.traza.instaladas[agente.id] ?? null },
      },
    };
  }

  async function juzgarUna(agente: Agente, variante: Variante, id: string, staging: string, engram: string): Promise<Resultado> {
    mkdirSync(staging, { recursive: true });
    const entrada = join(staging, 'entrada.md');
    const salida = join(staging, 'salida.md');
    writeFileSync(entrada, plan.texto.texto);
    const prompt = promptDe(variante, entrada, salida);
    const archivoPrompt = join(staging, 'prompt.txt');
    writeFileSync(archivoPrompt, prompt);
    const copia = join(staging, CARPETA_DE_LA_COPIA);
    const huellasDeLaCopia = construirCopia(plan.copia, copia);
    const ctx: Contexto = { prompt, archivoPrompt, sesion: id, cwd: copia, limiteMin: plan.limiteMin, staging, engram };

    const huellaAntes = huellaDe(plan.docx);
    const gitAntes = estadoRepos();
    const yo = { acompanada: activas.size > 0 };
    for (const otra of activas) otra.acompanada = true;
    activas.add(yo);
    let inicio: Date;
    let fin: Date;
    let l: Lanzamiento;
    try {
      deps.avisar(`${agente.id}/${variante.id}: empieza`);
      inicio = deps.ahora();
      try {
        l = await agente.lanzar(ctx);
      } catch (e) {
        l = { stdout: '', stderr: String(e), codigo: null, vencido: false, duracionMs: 0 };
      }
      fin = deps.ahora();
    } finally {
      // Una corrida que se cae acá no puede quedar para siempre como activa.
      activas.delete(yo);
    }

    writeFileSync(join(staging, 'stdout.txt'), l.stdout);
    writeFileSync(join(staging, 'stderr.txt'), l.stderr);
    let t: Transcripcion;
    try {
      t = agente.recoger(ctx, l);
    } catch (e) {
      deps.avisar(`${agente.id}/${variante.id}: no se pudo leer la sesión: ${String(e)}`);
      t = vacia();
    }
    writeFileSync(join(staging, 'respuesta.txt'), t.respuesta ?? '');

    const huellaDespues = huellaDe(plan.docx);
    const gitDespues = estadoRepos();
    const cambiosEnLaCopia = cambiosDeLaCopia(huellasDeLaCopia, huellasDe(copia));
    const propias = agente.estadoPropio?.(ctx, t) ?? [];
    const bytes = existsSync(salida) ? new Uint8Array(readFileSync(salida)) : null;
    const leido = leerTexto(bytes);
    const texto = 'texto' in leido ? leido.texto : null;
    const verificacion = texto === null ? null : deps.verificar(salida, variante.banderas);
    writeFileSync(join(staging, 'verificador.txt'), verificacion?.salida ?? 'No se midió: no hay una salida legible.\n');

    const error = errorDelAgente(t, l);
    const lecturas = lecturasDeSkills(t);
    // La respuesta también es un texto en español: se mide con la base sola.
    const respondio = t.respuesta !== null && t.respuesta.trim() !== '';
    const medicionDeLaRespuesta = respondio ? deps.verificar(join(staging, 'respuesta.txt'), []) : null;
    const medidas = [
      docxIntacto(huellaAntes, huellaDespues),
      salidaLegible(bytes),
      verificadorLimpio(verificacion),
      skillsDeLaVariante(variante, lecturas.completas, lecturas.parciales),
      agenteMidio(variante, t, { staging, copia }),
      respuestaCorrecta(variante, t.respuesta, texto, salida, medicionDeLaRespuesta),
      datosConservados(plan.texto.texto, texto),
      extensionRazonable(plan.texto.texto, texto, variante.id),
      repositoriosIntactos(gitAntes, gitDespues, escrituras(t), {
        staging,
        raices: plan.raicesGit,
        cwd: copia,
        paralelas: yo.acompanada,
        copia: cambiosEnLaCopia,
        propias,
      }),
      aislamiento(t, { staging, carpeta: plan.carpeta, mix: plan.mix, reales: plan.raicesGit }),
      datosNuevos(plan.texto.texto, texto),
    ];
    // Una corrida que el agente no terminó no se juzga por lo que no llegó a hacer.
    const comprobaciones = error === null ? medidas : sinTerminar(medidas, error);
    const metadatos: Metadatos = {
      version: t.version,
      modelo: t.modelo,
      duracionMs: l.duracionMs,
      duracionAgenteMs: t.duracionMs,
      codigo: l.codigo,
      vencido: l.vencido,
      costo: t.costo,
      sesion: t.sesion ?? id,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      copia: { archivos: Object.keys(huellasDeLaCopia).length, huella: huellaDeLaCopia(huellasDeLaCopia) },
      engram,
      traza: {
        arnes: plan.traza.arnes,
        // Las de la copia que recibió el agente, no las de mix: son lo que leyó.
        mix: Object.fromEntries(DE_MIX.flatMap((m) => (huellasDeLaCopia[m] === undefined ? [] : [[m, huellasDeLaCopia[m]]]))),
        docx: huellaInicial,
        instaladas: plan.traza.instaladas[agente.id] ?? null,
      },
    };
    const fallas = comprobaciones.filter((c) => c.estado === 'falla').map((c) => c.numero);
    const juicio = fallas.length > 0 ? `falla ${fallas.join(', ')}` : estadoDe(comprobaciones);
    deps.avisar(`${agente.id}/${variante.id}: ${error === null ? juicio : `error: ${error}`}`);
    return {
      agente: agente.id,
      variante: variante.id,
      staging,
      huellaSalida: bytes === null ? null : sha256(bytes),
      comprobaciones,
      error,
      metadatos,
    };
  }

  const corre = (a: Agente, v: Variante) => plan.pares === undefined || plan.pares.has(`${a.id}/${v.id}`);
  const porAgente = await Promise.all(
    plan.agentes.map((a) => enParalelo(plan.variantes.filter((v) => corre(a, v)), plan.paralelo, (v) => correrUna(a, v))),
  );
  // En el orden de las variantes y, dentro de cada una, en el de los agentes.
  const posicion = <T>(xs: readonly T[], f: (x: T) => boolean) => xs.findIndex(f);
  const resultados = porAgente
    .flat()
    .sort(
      (x, y) =>
        posicion(plan.variantes, (v) => v.id === x.variante) - posicion(plan.variantes, (v) => v.id === y.variante) ||
        posicion(plan.agentes, (a) => a.id === x.agente) - posicion(plan.agentes, (a) => a.id === y.agente),
    );

  const clave = (r: Resultado) => `${r.agente}/${r.variante}`;
  const iguales = salidasIdenticas(resultados.map((r) => ({ clave: clave(r), huella: r.huellaSalida })));
  const veredictos: Veredicto[] = resultados.map((r) => {
    const comprobaciones = r.comprobaciones.map((c) => (c.numero === 10 ? conIdenticas(c, iguales.get(clave(r)) ?? []) : c));
    return {
      agente: r.agente,
      variante: r.variante,
      estado: r.error === null ? estadoDe(comprobaciones) : 'error',
      error: r.error,
      serie: inicioSerie.toISOString(),
      comprobaciones,
      metadatos: r.metadatos,
    };
  });

  const suite: Suite = {
    fecha: inicioSerie.toISOString(),
    carpeta: plan.carpeta,
    texto: {
      modo: plan.texto.modo,
      palabras: plan.texto.palabras,
      secciones: plan.texto.secciones.map((s) => ({ titulo: s.titulo, palabras: s.palabras })),
    },
    docx: { antes: huellaInicial, despues: huellaEscrita(huellaDe(plan.docx)) },
    agentes: plan.agentes.map((a) => a.id),
    omitidos: plan.omitidos,
    series: Object.fromEntries(plan.agentes.map((a) => [a.id, inicioSerie.toISOString()])),
    variantes: plan.variantes.map((v) => v.id),
    veredictos,
    traza: trazaDeLaSerie(veredictos),
  };
  const publicada = publicar(plan, resultados, veredictos, suite, inicioSerie, deps);
  return { suite: publicada, codigo: codigoDeSalida(publicada.veredictos) };
}

/**
 * Lleva cada corrida a `<carpeta>/<agente>/<variante>/` y escribe el resumen.
 *
 * Lo que ya estaba no se borra ni se mezcla: se mueve a `historial/<fecha de
 * esa serie>/`. Mezclar dejaba en una misma carpeta la salida de una corrida y
 * el veredicto de otra.
 *
 * Por defecto la raíz guarda una sola serie: todas las carpetas de agentes y el
 * resumen anterior pasan al historial, también las de agentes que esta vez no
 * corrieron. Mover solo los pares que corrían dejó en la raíz un agy/fonda de
 * otra serie, y en el historial un resumen que contaba una corrida que no
 * estaba con él. Con `--agregar`, en cambio, la raíz junta series: quedan los
 * agentes que no corren, se reemplazan solo los pares que corren y el resumen
 * se rehace con todos los veredictos de la raíz, cada agente con la fecha de
 * su serie. Así se suma un agente a una serie publicada sin volver a correr
 * los demás.
 *
 * La copia no se publica: es la misma en cada corrida, su huella queda en el
 * veredicto, y lo que el agente cambió en ella ya está en el motivo de los
 * repositorios. Se borra con el resto de la carpeta de la corrida.
 *
 * El resumen marca cada celda que un cambio posterior a su corrida alcanza.
 * Con `--agregar` la raíz junta corridas de commits distintos, y sin la marca
 * una celda vieja se lee igual que una recién corrida.
 */
function publicar(
  plan: Plan,
  resultados: readonly Resultado[],
  veredictos: readonly Veredicto[],
  suite: Suite,
  inicio: Date,
  deps: Dependencias,
): Suite {
  const carpeta = plan.carpeta;
  const previa = fechaPrevia(carpeta);
  const historial = join(carpeta, HISTORIAL, marca(previa ?? inicio.toISOString()));
  for (const nombre of ['resumen.md', 'resumen.json']) mover(join(carpeta, nombre), join(historial, nombre));
  if (!plan.agregar) {
    for (const agente of new Set([...carpetasDeAgentes(carpeta), ...resultados.map((r) => r.agente)])) {
      mover(join(carpeta, agente), join(historial, agente));
    }
  }
  resultados.forEach((r, i) => {
    const destino = join(carpeta, r.agente, r.variante);
    mover(destino, join(historial, r.agente, r.variante));
    mkdirSync(destino, { recursive: true });
    // Una corrida en que falló el ejecutor puede no tener carpeta: se publica su veredicto solo.
    const copia = join(r.staging, CARPETA_DE_LA_COPIA);
    if (existsSync(r.staging)) cpSync(r.staging, destino, { recursive: true, filter: (desde) => !dentroDe(desde, copia) });
    writeFileSync(join(destino, 'veredicto.json'), `${JSON.stringify(veredictos[i], null, 2)}\n`);
  });
  const reunida = plan.agregar ? suiteDeLaCarpeta(carpeta, suite, [...suite.agentes, ...plan.omitidos], previa) : suite;
  const actual = { mix: huellasDeMix(plan.mix), docx: huellaEscrita(huellaDe(plan.docx)) };
  const publicada: Suite = { ...reunida, vigencia: vigenciaDe(reunida.veredictos, actual, deps.cambiosDesde) };
  escribirResumen(carpeta, publicada);
  for (const r of resultados) if (existsSync(r.staging)) rmSync(r.staging, { recursive: true, force: true });
  return publicada;
}
