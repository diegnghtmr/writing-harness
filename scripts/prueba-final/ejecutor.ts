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
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Contexto } from './agentes.ts';
import {
  agenteMidio,
  aislamiento,
  cambiosDeGit,
  conIdenticas,
  datosConservados,
  dentroDe,
  docxIntacto,
  estadoDe,
  extensionRazonable,
  leerTexto,
  repositoriosIntactos,
  respuestaCorrecta,
  salidaLegible,
  salidasIdenticas,
  skillsDeLaVariante,
  verificadorLimpio,
  type Comprobacion,
} from './comprobaciones.ts';
import { CARPETA_DE_LA_COPIA, cambiosDeLaCopia, construirCopia, huellaDeLaCopia, huellasDe, type PlanDeLaCopia } from './copia.ts';
import type { Texto } from './fragmento.ts';
import type { Lanzamiento } from './proceso.ts';
import { codigoDeSalida, resumenJson, resumenMarkdown, type Metadatos, type Suite, type Veredicto } from './resumen.ts';
import { escrituras, skillsCargadas, vacia, type Transcripcion } from './transcripcion.ts';
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
};

type Resultado = {
  agente: string;
  variante: string;
  staging: string;
  huellaSalida: string | null;
  comprobaciones: Comprobacion[];
  metadatos: Metadatos;
};

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

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

  async function correrUna(agente: Agente, variante: Variante): Promise<Resultado> {
    const id = deps.uuid();
    const staging = join(deps.tmp, `pf-${id}`);
    mkdirSync(staging, { recursive: true });
    const entrada = join(staging, 'entrada.md');
    const salida = join(staging, 'salida.md');
    writeFileSync(entrada, plan.texto.texto);
    const prompt = promptDe(variante, entrada, salida);
    const archivoPrompt = join(staging, 'prompt.txt');
    writeFileSync(archivoPrompt, prompt);
    const copia = join(staging, CARPETA_DE_LA_COPIA);
    const huellasDeLaCopia = construirCopia(plan.copia, copia);
    const ctx: Contexto = { prompt, archivoPrompt, sesion: id, cwd: copia, limiteMin: plan.limiteMin, staging };

    const huellaAntes = sha256(readFileSync(plan.docx));
    const gitAntes = estadoRepos();
    const yo = { acompanada: activas.size > 0 };
    for (const otra of activas) otra.acompanada = true;
    activas.add(yo);
    deps.avisar(`${agente.id}/${variante.id}: empieza`);
    const inicio = deps.ahora();
    let l: Lanzamiento;
    try {
      l = await agente.lanzar(ctx);
    } catch (e) {
      l = { stdout: '', stderr: String(e), codigo: null, vencido: false, duracionMs: 0 };
    }
    const fin = deps.ahora();
    activas.delete(yo);

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

    const huellaDespues = sha256(readFileSync(plan.docx));
    const gitDespues = estadoRepos();
    const cambiosEnLaCopia = cambiosDeLaCopia(huellasDeLaCopia, huellasDe(copia));
    const propias = agente.estadoPropio?.(ctx, t) ?? [];
    const bytes = existsSync(salida) ? new Uint8Array(readFileSync(salida)) : null;
    const leido = leerTexto(bytes);
    const texto = 'texto' in leido ? leido.texto : null;
    const verificacion = texto === null ? null : deps.verificar(salida, variante.banderas);
    writeFileSync(join(staging, 'verificador.txt'), verificacion?.salida ?? 'No se midió: no hay una salida legible.\n');

    const comprobaciones = [
      docxIntacto(huellaAntes, huellaDespues),
      salidaLegible(bytes),
      verificadorLimpio(verificacion),
      skillsDeLaVariante(variante, skillsCargadas(t)),
      agenteMidio(variante, t),
      respuestaCorrecta(variante, t.respuesta, texto, salida),
      datosConservados(plan.texto.texto, texto),
      extensionRazonable(plan.texto.texto, texto),
      repositoriosIntactos(gitAntes, gitDespues, escrituras(t), {
        staging,
        raices: plan.raicesGit,
        cwd: copia,
        paralelas: yo.acompanada,
        copia: cambiosEnLaCopia,
        propias,
      }),
      aislamiento(t, { staging, carpeta: plan.carpeta, mix: plan.mix }),
    ];
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
    };
    const fallas = comprobaciones.filter((c) => c.estado === 'falla').map((c) => c.numero);
    const vencida = l.vencido ? ', tiempo agotado' : '';
    deps.avisar(`${agente.id}/${variante.id}: ${fallas.length > 0 ? `falla ${fallas.join(', ')}` : estadoDe(comprobaciones)}${vencida}`);
    return {
      agente: agente.id,
      variante: variante.id,
      staging,
      huellaSalida: bytes === null ? null : sha256(bytes),
      comprobaciones,
      metadatos,
    };
  }

  const porAgente = await Promise.all(
    plan.agentes.map((a) => enParalelo(plan.variantes, plan.paralelo, (v) => correrUna(a, v))),
  );
  // En el orden de las variantes y, dentro de cada una, en el de los agentes.
  const resultados = plan.variantes.flatMap((_, i) => porAgente.map((r) => r[i] as Resultado));

  const clave = (r: Resultado) => `${r.agente}/${r.variante}`;
  const iguales = salidasIdenticas(resultados.map((r) => ({ clave: clave(r), huella: r.huellaSalida })));
  const veredictos: Veredicto[] = resultados.map((r) => {
    const comprobaciones = r.comprobaciones.map((c) => (c.numero === 10 ? conIdenticas(c, iguales.get(clave(r)) ?? []) : c));
    return { agente: r.agente, variante: r.variante, estado: estadoDe(comprobaciones), comprobaciones, metadatos: r.metadatos };
  });

  const suite: Suite = {
    fecha: inicioSerie.toISOString(),
    carpeta: plan.carpeta,
    texto: {
      modo: plan.texto.modo,
      palabras: plan.texto.palabras,
      secciones: plan.texto.secciones.map((s) => ({ titulo: s.titulo, palabras: s.palabras })),
    },
    docx: { antes: huellaInicial, despues: sha256(readFileSync(plan.docx)) },
    agentes: plan.agentes.map((a) => a.id),
    variantes: plan.variantes.map((v) => v.id),
    veredictos,
  };
  publicar(plan.carpeta, resultados, veredictos, suite, inicioSerie);
  return { suite, codigo: codigoDeSalida(veredictos) };
}

/** La fecha de la serie anterior, para nombrar su carpeta en el historial. */
function fechaPrevia(carpeta: string): string | null {
  try {
    const previo = JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8')) as { fecha?: unknown };
    return typeof previo.fecha === 'string' ? previo.fecha : null;
  } catch {
    return null;
  }
}

/**
 * Lleva cada corrida a `<carpeta>/<agente>/<variante>/` y escribe el resumen.
 *
 * Lo que ya estaba de una serie anterior no se borra ni se mezcla: se mueve a
 * `historial/<fecha de esa serie>/`. Mezclar dejaba en una misma carpeta la
 * salida de una corrida y el veredicto de otra.
 *
 * La copia no se publica: es la misma en cada corrida, su huella queda en el
 * veredicto, y lo que el agente cambió en ella ya está en el motivo de los
 * repositorios. Se borra con el resto de la carpeta de la corrida.
 */
function publicar(
  carpeta: string,
  resultados: readonly Resultado[],
  veredictos: readonly Veredicto[],
  suite: Suite,
  inicio: Date,
): void {
  const marca = (fechaPrevia(carpeta) ?? inicio.toISOString()).replace(/[:.]/gu, '-');
  const historial = join(carpeta, 'historial', marca);
  const mover = (desde: string, hasta: string) => {
    if (!existsSync(desde)) return;
    mkdirSync(dirname(hasta), { recursive: true });
    renameSync(desde, hasta);
  };
  for (const nombre of ['resumen.md', 'resumen.json']) mover(join(carpeta, nombre), join(historial, nombre));
  resultados.forEach((r, i) => {
    const destino = join(carpeta, r.agente, r.variante);
    mover(destino, join(historial, r.agente, r.variante));
    mkdirSync(dirname(destino), { recursive: true });
    const copia = join(r.staging, CARPETA_DE_LA_COPIA);
    cpSync(r.staging, destino, { recursive: true, filter: (desde) => !dentroDe(desde, copia) });
    writeFileSync(join(destino, 'veredicto.json'), `${JSON.stringify(veredictos[i], null, 2)}\n`);
  });
  writeFileSync(join(carpeta, 'resumen.md'), resumenMarkdown(suite));
  writeFileSync(join(carpeta, 'resumen.json'), `${JSON.stringify(resumenJson(suite), null, 2)}\n`);
  for (const r of resultados) rmSync(r.staging, { recursive: true, force: true });
}
