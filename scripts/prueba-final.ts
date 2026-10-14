// La prueba final: agentes reales sobre un mismo texto, una vez por variante de
// uso del arnés, con cada punto del flujo comprobado de forma automática.
//
//   node scripts/prueba-final.ts --dir ../test-final
//   npm run prueba-final -- --dir ../test-final --simular
//
// Es la última capa de validación, después de `npm test`, y no forma parte de
// esa suite: llama a servicios externos, tarda horas y gasta cuota. La suite
// prueba la lógica de esta prueba con un agente falso; esto la corre de verdad.
//
// Lo que valida es lo que ningún gate ve: qué hace un agente real con estas
// skills. Las pruebas a mano con Copilot mostraron fallas que la suite no podía
// encontrar: no medir, no entregar el texto, elegir mal el tono, inventar
// hechos. Hasta esto se revisaban leyendo registros de sesión, un agente a la
// vez. Lo que no valida es la calidad de cada modelo en general: un veredicto
// dice si el agente siguió el flujo con este texto y estas skills, no si escribe
// bien.
//
// Las comprobaciones están en `prueba-final/comprobaciones.ts`, con sus umbrales
// y el porqué de cada uno. Los prompts, en `prueba-final/prompts.ts`. La copia
// en que trabaja cada agente, sin este código, en `prueba-final/copia.ts`. Qué
// variantes alcanza cada cambio, en la tabla de `prueba-final/impacto.ts`.

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { REPO_ROOT } from '../src/skills.ts';
import { AGENTES, type Contexto, type DefinicionDeAgente } from './prueba-final/agentes.ts';
import { corridasPublicadas, fechaPrevia, leerVeredicto, resumenPrevio } from './prueba-final/carpeta.ts';
import {
  ARNES_EN_LA_COPIA,
  CARPETA_DE_LA_COPIA,
  EXCLUIDOS,
  MARCADOR_DE_OPEN_SLIDE,
  planDeLaCopia,
  type PlanDeLaCopia,
} from './prueba-final/copia.ts';
import { parrafosDelDocx } from './prueba-final/docx.ts';
import { correrSuite, PREFIJO_DE_ENGRAM } from './prueba-final/ejecutor.ts';
import { ErrorDeUso } from './prueba-final/errores.ts';
import { completo, fragmento, type Texto } from './prueba-final/fragmento.ts';
import { lineasDelImpacto, planDeImpacto } from './prueba-final/impacto.ts';
import {
  compararInstaladas,
  errorDeInstaladas,
  lineasDeInstaladas,
  skillsDelArnes,
  type ComparacionDeAgente,
} from './prueba-final/instaladas.ts';
import { promptDe } from './prueba-final/prompts.ts';
import {
  agenteReal,
  archivosRastreados,
  cambiosDesde,
  commitDe,
  estadoDelArnes,
  estadoGit,
  verificarConElArnes,
  versionPorArgumentos,
} from './prueba-final/reales.ts';
import { reevaluar } from './prueba-final/reevaluar.ts';
import { resolverEjecutable, type Ejecutable } from './prueba-final/resolver.ts';
import { lineaDeTotales } from './prueba-final/resumen.ts';
import { fallidas } from './prueba-final/seleccion.ts';
import { cambiosRespectoDe, huellasDeMix, type EstadoDelArnes } from './prueba-final/traza.ts';
import { elegirVariantes, variantes, type Variante } from './prueba-final/variantes.ts';

/** Una corrida a la vez por agente: dos a la vez se disputan la cuota y el registro de sesiones. */
const PARALELO_POR_DEFECTO = 1;

/**
 * Minutos por corrida.
 *
 * En el sondeo, corregir dos oraciones le llevó seis minutos a Antigravity, el
 * más lento de los tres. El fragmento tiene centenares de palabras y un tono
 * pide leer su skill entera antes de escribir. Cuarenta deja margen para eso y
 * corta a un agente que quedó dando vueltas.
 */
const LIMITE_POR_DEFECTO = 40;

const TODAS = variantes();

/** Un texto partido en líneas de ochenta columnas, con la sangría dada. */
function envolver(texto: string, sangria: number): string {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    if (actual !== '' && sangria + actual.length + 1 + palabra.length > 80) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = actual === '' ? palabra : `${actual} ${palabra}`;
    }
  }
  lineas.push(actual);
  return lineas.map((l) => `${' '.repeat(sangria)}${l}`).join('\n');
}

const USO = `uso: node scripts/prueba-final.ts --dir <carpeta> [opciones]
     npm run prueba-final -- --dir <carpeta> [opciones]

Corre agentes reales sobre el texto de <carpeta>/base.docx, una vez por variante
de uso del arnés, y comprueba cada corrida. No forma parte de npm test: llama a
servicios externos, tarda y gasta cuota.

  --dir <carpeta>      La carpeta con base.docx. Los resultados quedan ahí, y lo
                       que había de una serie anterior pasa entero a historial/:
                       la carpeta guarda una sola serie.
  --agregar            Suma esta serie a lo que ya hay: quedan los agentes que no
                       corren, se reemplazan solo los pares que corren y el
                       resumen junta todo, con la fecha de la serie de cada agente.
  --fallidas           Vuelve a correr solo los pares de la serie de la raíz que
                       dieron falla o error, y los suma como --agregar.
  --con-avisos         Con --fallidas, también los que pasaron con aviso.
  --afectadas          Corre solo las variantes que alcanzan los cambios, según
                       la tabla de impacto, y las suma como --agregar. Imprime
                       cada cambio con su efecto y su motivo.
  --desde <ref>        Con --afectadas, el commit del arnés desde el que se
                       comparan los cambios. Por defecto, el de la serie.
  --reevaluar          No corre ningún agente: vuelve a juzgar las corridas ya
                       publicadas en <carpeta> con las comprobaciones de hoy, e
                       imprime qué cambió en cada una.
  --agentes <lista>    Separados por coma. Por defecto: ${Object.keys(AGENTES).join(',')}.
  --variantes <lista>  Por identificador o por nombre de skill. Por defecto, todas:
${envolver(`${TODAS.map((v) => v.id).join(', ')}.`, 23)}
                       Con --fallidas y --afectadas, las dos listas acotan lo
                       que se eligió.
  --completo           El documento entero, sin tablas, en vez del Resumen y la
                       Introducción.
  --paralelo <n>       Corridas a la vez dentro de un agente. Por defecto, ${PARALELO_POR_DEFECTO}.
                       Agentes distintos corren siempre a la vez.
  --limite <minutos>   El tiempo de cada corrida. Por defecto, ${LIMITE_POR_DEFECTO}.
  --simular            Extrae el texto e imprime el plan, los comandos y las
                       cuentas. No corre ningún agente ni escribe nada.
  -h, --help           Esta ayuda.

Cada corrida usa una carpeta propia en el directorio temporal, y el agente
trabaja en una copia dentro de ella: las instrucciones de la carpeta que
contiene a <carpeta> y lo que git rastrea del arnés, sin el código de esta
prueba. Cada corrida tiene su propio proyecto de Engram,
${PREFIJO_DE_ENGRAM}-<serie>-<agente>-<variante>, anotado en su veredicto, y los
resultados se publican al terminar la serie. El veredicto anota también el
commit del arnés, la huella de las instrucciones y la de las skills instaladas.

Antes de correr, compara byte a byte las skills del arnés con las instaladas
que lee cada agente, y no corre si alguna falta o difiere: hay que
sincronizarlas primero. Con --simular informa la comparación sin fallar.

Una corrida que el agente no terminó, por una cuota agotada, una sesión vencida
o el límite de tiempo, queda como error del agente y no como falla. Una que no
terminó porque falló el ejecutor queda como error del ejecutor, contado aparte.

Sale con 0 si todas las corridas pasaron todas las comprobaciones, con 1 si
alguna falló o el agente no la terminó, y con 2 si no pudo correr: una opción
mal escrita, una carpeta sin base.docx, un documento sin los títulos del
fragmento, un agente que no está instalado o unas skills instaladas que no son
las del repositorio.`;

type Opciones = {
  dir?: string;
  agentes?: string;
  variantes?: string;
  desde?: string;
  completo: boolean;
  paralelo: number;
  limite: number;
  simular: boolean;
  agregar: boolean;
  reevaluar: boolean;
  fallidas: boolean;
  conAvisos: boolean;
  afectadas: boolean;
  ayuda: boolean;
};

function enteroPositivo(opcion: string, valor: string): number {
  if (!/^\d+$/u.test(valor) || Number(valor) < 1) throw new ErrorDeUso(`${opcion} pide un entero positivo, y recibió «${valor}»`);
  return Number(valor);
}

function leerOpciones(argv: readonly string[]): Opciones {
  const o: Opciones = {
    completo: false,
    paralelo: PARALELO_POR_DEFECTO,
    limite: LIMITE_POR_DEFECTO,
    simular: false,
    agregar: false,
    reevaluar: false,
    fallidas: false,
    conAvisos: false,
    afectadas: false,
    ayuda: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const valor = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new ErrorDeUso(`${arg} necesita un valor`);
      return v;
    };
    if (arg === '--dir') o.dir = valor();
    else if (arg === '--agentes') o.agentes = valor();
    else if (arg === '--variantes') o.variantes = valor();
    else if (arg === '--desde') o.desde = valor();
    else if (arg === '--completo') o.completo = true;
    else if (arg === '--paralelo') o.paralelo = enteroPositivo(arg, valor());
    else if (arg === '--limite') o.limite = enteroPositivo(arg, valor());
    else if (arg === '--simular') o.simular = true;
    else if (arg === '--agregar') o.agregar = true;
    else if (arg === '--reevaluar') o.reevaluar = true;
    else if (arg === '--fallidas') o.fallidas = true;
    else if (arg === '--con-avisos') o.conAvisos = true;
    else if (arg === '--afectadas') o.afectadas = true;
    else if (arg === '--help' || arg === '-h') o.ayuda = true;
    else throw new ErrorDeUso(`opción desconocida: ${arg}`);
  }
  if (o.reevaluar && (o.simular || o.agregar || o.fallidas || o.afectadas)) {
    throw new ErrorDeUso('--reevaluar no corre nada: no se combina con --simular, --agregar, --fallidas ni --afectadas');
  }
  if (o.fallidas && o.afectadas) throw new ErrorDeUso('--fallidas y --afectadas eligen qué corre de dos maneras distintas: va una u otra');
  if (o.conAvisos && !o.fallidas) throw new ErrorDeUso('--con-avisos solo vale con --fallidas');
  if (o.desde !== undefined && !o.afectadas) throw new ErrorDeUso('--desde solo vale con --afectadas');
  return o;
}

function elegirAgentes(lista: string | undefined): DefinicionDeAgente[] {
  const pedidos = (lista ?? Object.keys(AGENTES).join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const desconocidos = pedidos.filter((p) => !Object.hasOwn(AGENTES, p));
  if (desconocidos.length > 0 || pedidos.length === 0) {
    throw new ErrorDeUso(
      `agente desconocido: ${desconocidos.join(', ') || '(ninguno)'}. Disponibles: ${Object.keys(AGENTES).join(', ')}.`,
    );
  }
  return [...new Set(pedidos)].map((p) => AGENTES[p] as DefinicionDeAgente);
}

/** Los agentes conocidos que `--agentes` dejó fuera, en el orden de `AGENTES`. */
const omitidos = (elegidos: readonly DefinicionDeAgente[]): string[] =>
  Object.keys(AGENTES).filter((id) => !elegidos.some((d) => d.id === id));

const existeLaCarpeta = (carpeta: string) => {
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) throw new ErrorDeUso(`la carpeta no existe: ${carpeta}`);
};

function leerTexto(carpeta: string, entero: boolean): { texto: Texto; docx: string; huella: string } {
  existeLaCarpeta(carpeta);
  const docx = join(carpeta, 'base.docx');
  if (!existsSync(docx)) throw new ErrorDeUso(`no hay base.docx en ${carpeta}`);
  const bytes = readFileSync(docx);
  let parrafos;
  try {
    parrafos = parrafosDelDocx(bytes);
  } catch (e) {
    throw new ErrorDeUso(`base.docx no se pudo leer: ${(e as Error).message}`);
  }
  return {
    texto: entero ? completo(parrafos) : fragmento(parrafos),
    docx,
    huella: createHash('sha256').update(bytes).digest('hex'),
  };
}

const esArchivo = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

const resolver = (def: DefinicionDeAgente): Ejecutable | null =>
  resolverEjecutable(def.ejecutable, {
    ruta: process.env.PATH ?? '',
    plataforma: process.platform,
    existe: esArchivo,
    leer: (p) => readFileSync(p, 'utf8'),
    node: process.execPath,
  });

/** Un argumento como se escribiría en una consola: entre comillas si tiene espacios. */
const mostrar = (args: readonly string[]) =>
  args.map((a) => (/[\s"]/u.test(a) ? `"${a.replace(/"/gu, '\\"')}"` : a)).join(' ');

/** Qué corre: los agentes, las variantes y, si no es el cruce entero, los pares. */
type Seleccion = {
  agentes: DefinicionDeAgente[];
  variantes: Variante[];
  pares?: Set<string>;
  /** Por qué corre esto, para imprimir antes del plan. */
  lineas: string[];
  agregar: boolean;
};

/**
 * `--fallidas`: los pares de la raíz que dieron falla o error, y con
 * `--con-avisos` también los que pasaron con aviso.
 */
function seleccionarFallidas(carpeta: string, o: Opciones): Seleccion {
  existeLaCarpeta(carpeta);
  const corridas = corridasPublicadas(carpeta);
  if (corridas.length === 0) {
    throw new ErrorDeUso(`no hay ninguna serie publicada en ${carpeta}: --fallidas vuelve a correr lo que falló en la serie de la raíz`);
  }
  const previa = fechaPrevia(carpeta);
  const veredictos = corridas.map((c) => leerVeredicto(join(c.dir, 'veredicto.json'), previa));
  const agentes = o.agentes === undefined ? Object.keys(AGENTES) : elegirAgentes(o.agentes).map((d) => d.id);
  const vs = elegirVariantes(o.variantes, TODAS);
  const { pares, fuera } = fallidas(veredictos, { conAvisos: o.conAvisos, agentes, variantes: vs.map((v) => v.id) });
  const que = o.conAvisos ? 'falla, error o aviso' : 'falla o error';
  const lineas =
    pares.length === 0
      ? [`Nada que volver a correr: ninguna corrida que se pueda correr dio ${que}.`]
      : [`Vuelven a correr ${pares.length} corridas de la serie de la raíz, las que dieron ${que}:`, ...pares.map((p) => `  ${p.agente}/${p.variante}: ${p.celda}`)];
  if (fuera.length > 0) {
    lineas.push(`Dieron ${que} y no vuelven a correr, por --agentes, por --variantes o porque ya no se pueden correr: ${fuera.map((p) => `${p.agente}/${p.variante}`).join(', ')}.`);
  }
  return {
    agentes: Object.keys(AGENTES)
      .filter((id) => pares.some((p) => p.agente === id))
      .map((id) => AGENTES[id] as DefinicionDeAgente),
    variantes: vs.filter((v) => pares.some((p) => p.variante === v.id)),
    pares: new Set(pares.map((p) => `${p.agente}/${p.variante}`)),
    lineas,
    agregar: true,
  };
}

/**
 * `--afectadas`: las variantes que alcanzan los cambios desde `--desde` o
 * desde el commit de la serie, según la tabla de impacto. Las instrucciones de
 * mix y base.docx se comparan con las huellas que registró la serie; las que
 * no registró cuentan como cambio.
 */
function seleccionarAfectadas(carpeta: string, mix: string, huellaDelDocx: string, o: Opciones): Seleccion {
  const previo = resumenPrevio(carpeta);
  const registrada = previo?.traza ?? null;
  let arnes: EstadoDelArnes;
  let desde: string;
  if (o.desde !== undefined) {
    const commit = commitDe(REPO_ROOT, o.desde);
    if (commit === null) throw new ErrorDeUso(`git no reconoce «${o.desde}» como un commit de ${REPO_ROOT}`);
    arnes = { commit, sucio: false, sucios: {} };
    desde = commit.startsWith(o.desde) ? o.desde : `${o.desde} (${commit.slice(0, 7)})`;
  } else if (registrada?.arnes?.commit) {
    arnes = registrada.arnes;
    desde = `${registrada.arnes.commit.slice(0, 7)}, el commit de la serie${arnes.sucio ? ' con sus cambios sin commit' : ''}`;
  } else {
    throw new ErrorDeUso(`la serie de ${carpeta} no registra con qué commit del arnés se probó: --afectadas necesita --desde <ref>`);
  }
  const rutas = cambiosDesde(REPO_ROOT, arnes);
  if (rutas === null) throw new ErrorDeUso(`git no pudo comparar ${REPO_ROOT} con el commit ${arnes.commit}`);
  const cambios = cambiosRespectoDe(
    { mix: registrada?.mix ?? null, docx: registrada?.docx ?? previo?.docx?.antes ?? null },
    { mix: huellasDeMix(mix), docx: huellaDelDocx },
    rutas,
  );
  const plan = planDeImpacto(cambios, TODAS);
  const agentes = elegirAgentes(o.agentes);
  const lineas = lineasDelImpacto(plan, { desde: `${desde} hasta el árbol de trabajo`, agentes: agentes.map((a) => a.id) });
  let vs = plan.variantes;
  if (o.variantes !== undefined) {
    const pedidas = elegirVariantes(o.variantes, TODAS);
    vs = vs.filter((v) => pedidas.includes(v));
    lineas.push(`--variantes acota a: ${vs.map((v) => v.id).join(', ') || 'ninguna'}.`);
  }
  return { agentes, variantes: vs, lineas, agregar: true };
}

/** Qué lleva la copia de cada corrida, de dónde sale cada parte y qué queda fuera. */
function lineasDeLaCopia(copia: PlanDeLaCopia, mix: string, cwd: string): string[] {
  const lineas = [
    `Copia de trabajo de cada corrida, en ${cwd}: ${copia.archivos.length} archivos en total.`,
    copia.deMix.length > 0 ? `  De ${mix}: ${copia.deMix.join(', ')}.` : `  De ${mix}: nada.`,
    `  ${MARCADOR_DE_OPEN_SLIDE.ruta}: un marcador, para que open-slide/ no quede vacía.`,
    `  En ${ARNES_EN_LA_COPIA}/: ${copia.delArnes} archivos que git rastrea en ${REPO_ROOT.replace(/[\\/]$/u, '')}.`,
    `  Quedan fuera, ${copia.excluidos.length} archivos: ${EXCLUIDOS.join(', ')}.`,
    '  Sin .git, sin node_modules y sin nada que git no rastree.',
  ];
  if (copia.faltan.length > 0) lineas.push(`  No están en disco y no se copian: ${copia.faltan.join(', ')}.`);
  return lineas;
}

/** El commit del arnés con que se va a probar, y si hay cambios sin commit. */
function lineaDelArnes(a: EstadoDelArnes): string {
  const n = Object.keys(a.sucios).length;
  const sucio = a.sucio ? `, con cambios sin commit en ${n} ${n === 1 ? 'ruta' : 'rutas'}` : ', sin cambios sin commit';
  return `Arnés: commit ${a.commit?.slice(0, 7) ?? 'desconocido'}${sucio}.`;
}

function imprimirPlan(
  carpeta: string,
  leido: { texto: Texto; huella: string },
  mix: string,
  copia: PlanDeLaCopia,
  agentes: { def: DefinicionDeAgente; ejecutable: Ejecutable | null }[],
  sel: Seleccion,
  o: Opciones,
  arnes: EstadoDelArnes,
  instaladas: readonly ComparacionDeAgente[],
): void {
  const vs = sel.variantes;
  const staging = join(tmpdir(), 'pf-<uuid>');
  const cwd = join(staging, CARPETA_DE_LA_COPIA);
  const fuera = omitidos(agentes.map((a) => a.def));
  const ctx: Contexto = {
    prompt: '<prompt>',
    archivoPrompt: join(staging, 'prompt.txt'),
    sesion: '<uuid>',
    cwd,
    limiteMin: o.limite,
    staging,
    engram: `${PREFIJO_DE_ENGRAM}-<serie>-<agente>-<variante>`,
  };
  const corridas =
    sel.pares === undefined
      ? `Corridas: ${agentes.length} agentes por ${vs.length} variantes, ${agentes.length * vs.length} en total.`
      : `Corridas: ${sel.pares.size}, solo los pares elegidos.`;
  const lineas = [
    o.simular ? 'Prueba final: simulación. No corre ningún agente ni escribe nada.' : 'Prueba final.',
    '',
    `Carpeta: ${carpeta}`,
    `base.docx: sha256 ${leido.huella}`,
    lineaDelArnes(arnes),
    `Texto: ${leido.texto.modo}, ${leido.texto.palabras} palabras`,
    ...leido.texto.secciones.map((s) => `  ${s.titulo}: ${s.palabras} palabras`),
    '',
    corridas,
    `Hasta ${o.paralelo} a la vez por agente; los agentes corren a la vez. Límite: ${o.limite} minutos por corrida.`,
    ...(sel.agregar ? ['Se suman a lo publicado, como con --agregar: el resto de la raíz queda donde está.'] : []),
    ...(fuera.length > 0 ? [`No corren esta vez: ${fuera.join(', ')}.`] : []),
    '',
    ...lineasDeLaCopia(copia, mix, cwd),
    '',
    `Agentes, trabajando en la copia con ENGRAM_PROJECT=${PREFIJO_DE_ENGRAM}-<serie>-<agente>-<variante>:`,
    ...agentes.flatMap(({ def, ejecutable }) => [
      ...(ejecutable === null
        ? // Los argumentos se muestran igual: no dependen de dónde esté instalado.
          [`  ${def.id}: no se encontró en el PATH`, `    ${mostrar(def.argumentos(ctx))}`]
        : [`  ${def.id}: ${mostrar([ejecutable.comando, ...ejecutable.prefijo])}`, `    ${mostrar(def.argumentos(ctx))}`]),
      ...Object.entries(def.variables?.(homedir(), ctx) ?? {}).map(([k, v]) => `    con ${k}=${v}`),
    ]),
    '',
    `Prompts, con la carpeta de cada corrida en ${staging}:`,
    ...vs.map((v) => `  ${v.id}: ${promptDe(v, join(staging, 'entrada.md'), join(staging, 'salida.md'))}`),
    '',
    'Skills instaladas que lee cada agente, comparadas byte a byte con skills/ del arnés:',
    ...lineasDeInstaladas(instaladas),
  ];
  if (o.simular && errorDeInstaladas(instaladas) !== null) {
    lineas.push('Sin --simular no correría: hay que sincronizar primero esas copias.');
  }
  console.log(lineas.join('\n'));
}

/**
 * `--reevaluar`: vuelve a juzgar lo publicado en la carpeta, sin correr ningún
 * agente, e imprime cómo estaba y cómo queda cada corrida.
 */
function reevaluarCarpeta(carpeta: string): 0 | 1 {
  existeLaCarpeta(carpeta);
  const mix = dirname(carpeta);
  const { suite, codigo, cambios } = reevaluar(
    { carpeta, mix, reales: [...new Set([mix, REPO_ROOT.replace(/[\\/]$/u, '')])], conocidos: Object.keys(AGENTES) },
    {
      verificar: verificarConElArnes,
      parsear: (agente, _variante, a) => AGENTES[agente]?.parsear(a.stdout, a.transcripcion, a.log, a.stderr) ?? null,
      ahora: () => new Date(),
      avisar: (l) => console.log(l),
      cambiosDesde: (a) => cambiosDesde(REPO_ROOT, a),
    },
  );
  const ancho = Math.max(...cambios.map((c) => `${c.agente}/${c.variante}`.length));
  console.log(`Reevaluación de ${carpeta}, sin correr ningún agente.\n`);
  for (const c of cambios) {
    const igual = c.antes === c.despues ? '  (igual)' : '';
    console.log(`${`${c.agente}/${c.variante}`.padEnd(ancho)}  ${c.antes}  ->  ${c.despues}${igual}`);
  }
  console.log(`\n${lineaDeTotales(suite.veredictos)}. Resumen en ${join(carpeta, 'resumen.md')}`);
  return codigo;
}

async function main(argv: readonly string[]): Promise<number> {
  const o = leerOpciones(argv);
  if (o.ayuda) {
    console.log(USO);
    return 0;
  }
  if (o.dir === undefined) throw new ErrorDeUso('falta --dir <carpeta>');
  const carpeta = resolve(o.dir);
  if (o.reevaluar) return reevaluarCarpeta(carpeta);
  // Las fallidas se leen antes que el documento: sin una serie publicada no
  // hay nada que volver a correr, haya o no base.docx.
  const deLaRaiz = o.fallidas ? seleccionarFallidas(carpeta, o) : null;
  const leido = leerTexto(carpeta, o.completo);
  const mix = dirname(carpeta);
  const sel: Seleccion =
    deLaRaiz ??
    (o.afectadas
      ? seleccionarAfectadas(carpeta, mix, leido.huella, o)
      : { agentes: elegirAgentes(o.agentes), variantes: elegirVariantes(o.variantes, TODAS), lineas: [], agregar: o.agregar });
  if (sel.lineas.length > 0) console.log(`${sel.lineas.join('\n')}\n`);
  if (sel.variantes.length === 0 || sel.agentes.length === 0) {
    // --fallidas y --afectadas ya dijeron por qué no corre nada.
    if (sel.lineas.length === 0) console.log('Nada que correr.');
    return 0;
  }

  const rastreados = archivosRastreados(REPO_ROOT);
  if (rastreados === null) throw new ErrorDeUso(`git no pudo listar los archivos de ${REPO_ROOT}, y sin esa lista no hay copia`);
  const copia = planDeLaCopia({ mix, arnes: REPO_ROOT, rastreados, existe: esArchivo });
  const resueltos = sel.agentes.map((def) => ({ def, ejecutable: resolver(def) }));
  const arnes = estadoDelArnes(REPO_ROOT);
  const skills = skillsDelArnes(rastreados);
  const instaladas: ComparacionDeAgente[] = sel.agentes.map((def) => ({
    agente: def.id,
    comparacion: compararInstaladas(REPO_ROOT, skills, def.skills(homedir())),
  }));
  imprimirPlan(carpeta, leido, mix, copia, resueltos, sel, o, arnes, instaladas);
  if (o.simular) return 0;

  // Antes de buscar los agentes: una copia vieja no se corre, esté o no el agente.
  const desincronizadas = errorDeInstaladas(instaladas);
  if (desincronizadas !== null) throw new ErrorDeUso(desincronizadas, false);
  const faltan = resueltos.filter((r) => r.ejecutable === null).map((r) => r.def.id);
  if (faltan.length > 0) throw new ErrorDeUso(`no se encontró en el PATH: ${faltan.join(', ')}`);
  // Lo que dejó armado una serie anterior que se cayó, como un CODEX_HOME con
  // la sesión del usuario, se borra antes de lanzar nada.
  for (const def of sel.agentes) {
    const barridos = def.barrer?.(homedir()) ?? [];
    if (barridos.length > 0) console.log(`${def.id}: se borró lo que dejó una serie anterior: ${barridos.join(', ')}`);
  }
  console.log('');
  const { suite, codigo } = await correrSuite(
    {
      carpeta,
      docx: leido.docx,
      mix,
      copia,
      raicesGit: [...new Set([mix, REPO_ROOT.replace(/[\\/]$/u, '')])],
      texto: leido.texto,
      agentes: resueltos.map(({ def, ejecutable }) => {
        const e = ejecutable as Ejecutable;
        return agenteReal(def, e, {
          home: homedir(),
          version: def.version === null ? null : versionPorArgumentos(e, def.version),
        });
      }),
      variantes: sel.variantes,
      paralelo: o.paralelo,
      omitidos: omitidos(sel.agentes),
      agregar: sel.agregar,
      limiteMin: o.limite,
      ...(sel.pares === undefined ? {} : { pares: sel.pares }),
      traza: {
        arnes,
        instaladas: Object.fromEntries(instaladas.map((x) => [x.agente, { directorio: x.comparacion.directorio, huella: x.comparacion.huella }])),
      },
    },
    {
      tmp: tmpdir(),
      uuid: randomUUID,
      estadoGit,
      verificar: verificarConElArnes,
      ahora: () => new Date(),
      avisar: (l) => console.log(l),
      cambiosDesde: (a) => cambiosDesde(REPO_ROOT, a),
    },
  );
  console.log(`\n${lineaDeTotales(suite.veredictos)}. Resumen en ${join(carpeta, 'resumen.md')}`);
  return codigo;
}

main(process.argv.slice(2)).then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e: unknown) => {
    // Con 2 y no con 1: el 1 dice que una corrida falló, y aquí no llegó a correr ninguna.
    if (e instanceof ErrorDeUso) console.error(e.conAyuda ? `error: ${e.message}\n\n${USO}` : `error: ${e.message}`);
    else console.error(`error: ${(e as Error).stack ?? String(e)}`);
    process.exitCode = 2;
  },
);
