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
// en que trabaja cada agente, sin este código, en `prueba-final/copia.ts`.

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { REPO_ROOT } from '../src/skills.ts';
import { AGENTES, type Contexto, type DefinicionDeAgente } from './prueba-final/agentes.ts';
import {
  ARNES_EN_LA_COPIA,
  CARPETA_DE_LA_COPIA,
  EXCLUIDOS,
  MARCADOR_DE_OPEN_SLIDE,
  planDeLaCopia,
  type PlanDeLaCopia,
} from './prueba-final/copia.ts';
import { parrafosDelDocx } from './prueba-final/docx.ts';
import { correrSuite } from './prueba-final/ejecutor.ts';
import { lineaDeTotales } from './prueba-final/resumen.ts';
import { ErrorDeUso } from './prueba-final/errores.ts';
import { completo, fragmento, type Texto } from './prueba-final/fragmento.ts';
import { promptDe } from './prueba-final/prompts.ts';
import {
  agenteReal,
  archivosRastreados,
  estadoGit,
  PROYECTO_DE_ENGRAM,
  verificarConElArnes,
  versionPorArgumentos,
} from './prueba-final/reales.ts';
import { resolverEjecutable, type Ejecutable } from './prueba-final/resolver.ts';
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
                       que había de una serie anterior pasa a historial/.
  --agentes <lista>    Separados por coma. Por defecto: ${Object.keys(AGENTES).join(',')}.
  --variantes <lista>  Por identificador o por nombre de skill. Por defecto, todas:
${envolver(`${TODAS.map((v) => v.id).join(', ')}.`, 23)}
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
prueba. Los agentes corren con ENGRAM_PROJECT=${PROYECTO_DE_ENGRAM}, y los
resultados se publican al terminar la serie.

Una corrida que el agente no terminó, por una cuota agotada, una sesión vencida
o el límite de tiempo, queda como error del agente y no como falla.

Sale con 0 si todas las corridas pasaron todas las comprobaciones, con 1 si
alguna falló o el agente no la terminó, y con 2 si no pudo correr: una opción
mal escrita, una carpeta sin base.docx, un documento sin los títulos del
fragmento o un agente que no está instalado.`;

type Opciones = {
  dir?: string;
  agentes?: string;
  variantes?: string;
  completo: boolean;
  paralelo: number;
  limite: number;
  simular: boolean;
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
    else if (arg === '--completo') o.completo = true;
    else if (arg === '--paralelo') o.paralelo = enteroPositivo(arg, valor());
    else if (arg === '--limite') o.limite = enteroPositivo(arg, valor());
    else if (arg === '--simular') o.simular = true;
    else if (arg === '--help' || arg === '-h') o.ayuda = true;
    else throw new ErrorDeUso(`opción desconocida: ${arg}`);
  }
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

function leerTexto(carpeta: string, entero: boolean): { texto: Texto; docx: string; huella: string } {
  if (!existsSync(carpeta) || !statSync(carpeta).isDirectory()) throw new ErrorDeUso(`la carpeta no existe: ${carpeta}`);
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

function imprimirPlan(
  carpeta: string,
  leido: { texto: Texto; huella: string },
  mix: string,
  copia: PlanDeLaCopia,
  agentes: { def: DefinicionDeAgente; ejecutable: Ejecutable | null }[],
  vs: Variante[],
  o: Opciones,
): void {
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
  };
  const lineas = [
    o.simular ? 'Prueba final: simulación. No corre ningún agente ni escribe nada.' : 'Prueba final.',
    '',
    `Carpeta: ${carpeta}`,
    `base.docx: sha256 ${leido.huella}`,
    `Texto: ${leido.texto.modo}, ${leido.texto.palabras} palabras`,
    ...leido.texto.secciones.map((s) => `  ${s.titulo}: ${s.palabras} palabras`),
    '',
    `Corridas: ${agentes.length} agentes por ${vs.length} variantes, ${agentes.length * vs.length} en total.`,
    `Hasta ${o.paralelo} a la vez por agente; los agentes corren a la vez. Límite: ${o.limite} minutos por corrida.`,
    ...(fuera.length > 0 ? [`No corren esta vez: ${fuera.join(', ')}.`] : []),
    '',
    ...lineasDeLaCopia(copia, mix, cwd),
    '',
    `Agentes, trabajando en la copia con ENGRAM_PROJECT=${PROYECTO_DE_ENGRAM}:`,
    ...agentes.flatMap(({ def, ejecutable }) =>
      ejecutable === null
        ? [`  ${def.id}: no se encontró en el PATH`]
        : [`  ${def.id}: ${mostrar([ejecutable.comando, ...ejecutable.prefijo])}`, `    ${mostrar(def.argumentos(ctx))}`],
    ),
    '',
    `Prompts, con la carpeta de cada corrida en ${staging}:`,
    ...vs.map((v) => `  ${v.id}: ${promptDe(v, join(staging, 'entrada.md'), join(staging, 'salida.md'))}`),
  ];
  console.log(lineas.join('\n'));
}

async function main(argv: readonly string[]): Promise<number> {
  const o = leerOpciones(argv);
  if (o.ayuda) {
    console.log(USO);
    return 0;
  }
  if (o.dir === undefined) throw new ErrorDeUso('falta --dir <carpeta>');
  const agentes = elegirAgentes(o.agentes);
  const vs = elegirVariantes(o.variantes, TODAS);
  const carpeta = resolve(o.dir);
  const leido = leerTexto(carpeta, o.completo);
  const mix = dirname(carpeta);
  const rastreados = archivosRastreados(REPO_ROOT);
  if (rastreados === null) throw new ErrorDeUso(`git no pudo listar los archivos de ${REPO_ROOT}, y sin esa lista no hay copia`);
  const copia = planDeLaCopia({ mix, arnes: REPO_ROOT, rastreados, existe: esArchivo });
  const resueltos = agentes.map((def) => ({ def, ejecutable: resolver(def) }));
  imprimirPlan(carpeta, leido, mix, copia, resueltos, vs, o);
  if (o.simular) return 0;

  const faltan = resueltos.filter((r) => r.ejecutable === null).map((r) => r.def.id);
  if (faltan.length > 0) throw new ErrorDeUso(`no se encontró en el PATH: ${faltan.join(', ')}`);
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
      variantes: vs,
      paralelo: o.paralelo,
      omitidos: omitidos(agentes),
      limiteMin: o.limite,
    },
    {
      tmp: tmpdir(),
      uuid: randomUUID,
      estadoGit,
      verificar: verificarConElArnes,
      ahora: () => new Date(),
      avisar: (l) => console.log(l),
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
    // Con 2 y no con 1: el 1 dice que una corrida falló, y acá no llegó a correr ninguna.
    if (e instanceof ErrorDeUso) console.error(`error: ${e.message}\n\n${USO}`);
    else console.error(`error: ${(e as Error).stack ?? String(e)}`);
    process.exitCode = 2;
  },
);
