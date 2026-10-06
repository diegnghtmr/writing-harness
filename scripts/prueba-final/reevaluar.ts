// Volver a juzgar una serie ya publicada, sin correr ningún agente.
//
// Una comprobación nueva o un umbral corregido se validaban gastando otra
// corrida completa: horas y cuota, para ver qué decía el cambio sobre textos
// que ya estaban escritos. Lo que la corrida publicó alcanza para recalcular
// casi todo: la entrada, la salida, la respuesta y la sesión del agente. Lo que
// no se puede mirar después se conserva tal como quedó, marcado: la huella de
// base.docx antes y después de la corrida, y el estado de git y de la copia,
// que se borró al publicar. El verificador es el de hoy, que es justamente lo
// que se quiere probar.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  corridasPublicadas,
  escribirResumen,
  HISTORIAL,
  leerVeredicto,
  marca,
  mover,
  resumenPrevio,
  suiteDeLaCarpeta,
} from './carpeta.ts';
import {
  agenteMidio,
  aislamiento,
  conIdenticas,
  datosConservados,
  datosNuevos,
  errorDelAgente,
  estadoDe,
  extensionRazonable,
  leerTexto,
  NOMBRES,
  respuestaCorrecta,
  salidaLegible,
  salidasIdenticas,
  sinTerminar,
  skillsDeLaVariante,
  verificadorLimpio,
  type Comprobacion,
} from './comprobaciones.ts';
import { CARPETA_DE_LA_COPIA } from './copia.ts';
import { ErrorDeUso } from './errores.ts';
import { celda, codigoDeSalida, type Suite, type Veredicto } from './resumen.ts';
import { huellasDeMix, vigenciaDe, type EstadoDelArnes } from './traza.ts';
import { lecturasDeSkills, type Transcripcion } from './transcripcion.ts';
import { variantes } from './variantes.ts';

/** Lo que la corrida dejó de la sesión del agente. */
export type ArchivosDeLaCorrida = { stdout: string; transcripcion: string | null; log: string | null; stderr: string | null };

export type DependenciasDeReevaluacion = {
  /** El verificador de hoy sobre un archivo, con las opciones dadas. */
  verificar(archivo: string, banderas: readonly string[]): { codigo: number | null; salida: string };
  /** La sesión leída por el lector de su agente, o null si no hay lector para ese agente. */
  parsear(agente: string, variante: string, archivos: ArchivosDeLaCorrida, staging: string): Transcripcion | null;
  ahora(): Date;
  avisar(linea: string): void;
  /** Las rutas del arnés que cambiaron desde un estado anotado, o null si git no lo sabe. Rehace la marca de vigencia del resumen. */
  cambiosDesde(arnes: EstadoDelArnes): string[] | null;
};

/** Cómo estaba una corrida y cómo queda: el estado con las comprobaciones que lo causan. */
export type Cambio = { agente: string; variante: string; antes: string; despues: string };

/** La carpeta de la corrida, sacada de la ruta de la entrada que dice el prompt. */
function stagingDe(prompt: string): string | null {
  const entrada = /`([^`]*entrada\.md)`/u.exec(prompt)?.[1];
  return entrada === undefined ? null : entrada.replace(/[\\/][^\\/]*$/u, '');
}

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

type Rejuzgada = { comprobaciones: Comprobacion[]; error: string | null; huella: string | null };

function rejuzgar(
  dir: string,
  agente: string,
  idVariante: string,
  viejo: Veredicto,
  o: { carpeta: string; mix: string; reales: readonly string[] },
  deps: DependenciasDeReevaluacion,
): Rejuzgada | null {
  const leer = (nombre: string) => (existsSync(join(dir, nombre)) ? readFileSync(join(dir, nombre), 'utf8') : null);
  const v = variantes().find((x) => x.id === idVariante);
  const staging = stagingDe(leer('prompt.txt') ?? '');
  if (v === undefined || staging === null) {
    deps.avisar(`${agente}/${idVariante}: no se reconoce la variante o el prompt; se conserva el veredicto`);
    return null;
  }
  const archivos = { stdout: leer('stdout.txt') ?? '', transcripcion: leer('transcripcion.jsonl'), log: leer('agy.log'), stderr: leer('stderr.txt') };
  const t = deps.parsear(agente, idVariante, archivos, staging);
  if (t === null) {
    deps.avisar(`${agente}/${idVariante}: no hay con qué leer la sesión de ${agente}; se conserva el veredicto`);
    return null;
  }
  const separador = staging.includes('\\') ? '\\' : '/';
  const copia = `${staging}${separador}${CARPETA_DE_LA_COPIA}`;
  const entrada = leer('entrada.md') ?? '';
  const rutaSalida = join(dir, 'salida.md');
  const bytes = existsSync(rutaSalida) ? new Uint8Array(readFileSync(rutaSalida)) : null;
  const leido = leerTexto(bytes);
  const texto = 'texto' in leido ? leido.texto : null;
  const verificacion = texto === null ? null : deps.verificar(rutaSalida, v.banderas);
  const respondio = t.respuesta !== null && t.respuesta.trim() !== '';
  const medicion = respondio ? deps.verificar(join(dir, 'respuesta.txt'), []) : null;
  const conservar = (numero: number): Comprobacion => {
    const previa = viejo.comprobaciones.find((c) => c.numero === numero);
    if (previa === undefined) {
      return { numero, nombre: NOMBRES[numero] ?? '', estado: 'sin evaluar', motivo: 'no estaba en el veredicto de la corrida', conservada: true };
    }
    return { ...previa, motivo: `${previa.motivo} (conservada de la corrida)`, conservada: true };
  };
  const lecturas = lecturasDeSkills(t);
  const medidas = [
    conservar(1),
    salidaLegible(bytes),
    verificadorLimpio(verificacion),
    skillsDeLaVariante(v, lecturas.completas, lecturas.parciales),
    agenteMidio(v, t, { staging, copia }),
    respuestaCorrecta(v, t.respuesta, texto, `${staging}${separador}salida.md`, medicion),
    datosConservados(entrada, texto),
    extensionRazonable(entrada, texto, v.id),
    conservar(9),
    aislamiento(t, { staging, carpeta: o.carpeta, mix: o.mix, reales: o.reales }),
    datosNuevos(entrada, texto),
  ];
  const md = viejo.metadatos as { codigo?: number | null; vencido?: boolean };
  const error = errorDelAgente(t, { codigo: md.codigo ?? 0, vencido: md.vencido ?? false });
  return { comprobaciones: error === null ? medidas : sinTerminar(medidas, error), error, huella: bytes === null ? null : sha256(bytes) };
}

/**
 * Recalcula cada veredicto publicado en la raíz de `carpeta` y rehace el
 * resumen. Antes de reescribir, lleva el resumen anterior y cada veredicto que
 * reescribe a `historial/<fecha>-reevaluacion/`. Devuelve, por corrida, cómo
 * estaba y cómo queda.
 */
export function reevaluar(
  o: { carpeta: string; mix: string; reales: readonly string[]; conocidos?: readonly string[] },
  deps: DependenciasDeReevaluacion,
): { suite: Suite; codigo: 0 | 1; cambios: Cambio[] } {
  const corridas = corridasPublicadas(o.carpeta);
  if (corridas.length === 0) {
    throw new ErrorDeUso(`no hay ningún veredicto.json publicado en ${o.carpeta}: no hay nada que volver a juzgar`);
  }
  const previo = resumenPrevio(o.carpeta);
  const serieAnterior = typeof previo?.fecha === 'string' ? previo.fecha : null;
  const items = corridas.map((c) => {
    const viejo = leerVeredicto(join(c.dir, 'veredicto.json'), serieAnterior);
    return { ...c, viejo, rejuzgada: rejuzgar(c.dir, c.agente, c.variante, viejo, o, deps) };
  });

  const clave = (x: { agente: string; variante: string }) => `${x.agente}/${x.variante}`;
  const iguales = salidasIdenticas(items.flatMap((x) => (x.rejuzgada === null ? [] : [{ clave: clave(x), huella: x.rejuzgada.huella }])));
  const ahora = deps.ahora().toISOString();
  const nuevos = items.map((x) => {
    if (x.rejuzgada === null) return { ...x, nuevo: x.viejo };
    const comprobaciones = x.rejuzgada.comprobaciones.map((c) => (c.numero === 10 ? conIdenticas(c, iguales.get(clave(x)) ?? []) : c));
    const nuevo: Veredicto = {
      ...x.viejo,
      estado: x.rejuzgada.error === null ? estadoDe(comprobaciones) : 'error',
      error: x.rejuzgada.error,
      comprobaciones,
      reevaluado: ahora,
    };
    return { ...x, nuevo };
  });

  const historial = join(o.carpeta, HISTORIAL, `${marca(ahora)}-reevaluacion`);
  for (const nombre of ['resumen.md', 'resumen.json']) mover(join(o.carpeta, nombre), join(historial, nombre));
  for (const x of nuevos) {
    if (x.rejuzgada === null) continue;
    mover(join(x.dir, 'veredicto.json'), join(historial, x.agente, x.variante, 'veredicto.json'));
    writeFileSync(join(x.dir, 'veredicto.json'), `${JSON.stringify(x.nuevo, null, 2)}\n`);
  }

  const base: Pick<Suite, 'fecha' | 'texto' | 'docx'> = {
    fecha: serieAnterior ?? ahora,
    texto: previo?.texto ?? { modo: 'fragmento', palabras: 0, secciones: [] },
    docx: previo?.docx ?? { antes: '', despues: '' },
  };
  const conocidos = o.conocidos ?? [...(previo?.agentes ?? []), ...(previo?.omitidos ?? [])];
  const reunida = suiteDeLaCarpeta(o.carpeta, base, conocidos, serieAnterior);
  const docx = join(o.carpeta, 'base.docx');
  const actual = { mix: huellasDeMix(o.mix), docx: existsSync(docx) ? sha256(readFileSync(docx)) : '' };
  const suite: Suite = { ...reunida, vigencia: vigenciaDe(reunida.veredictos, actual, deps.cambiosDesde) };
  escribirResumen(o.carpeta, suite);
  const cambios = nuevos.map((x) => ({ agente: x.agente, variante: x.variante, antes: celda(x.viejo), despues: celda(x.nuevo) }));
  return { suite, codigo: codigoDeSalida(suite.veredictos), cambios };
}
