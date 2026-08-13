// Mide el corpus y deja el resultado escrito, antes de que el corpus se borre.
//
//   node --experimental-strip-types scripts/medir.ts
//   node --experimental-strip-types scripts/medir.ts --desde ../datos
//
// El manifiesto dice qué archivos había. Esto dice qué contenían. Son las dos
// mitades de lo mismo: sin el manifiesto una cifra no puede nombrar su origen,
// y sin la medición el origen no dice qué se sacó de él.
//
// Antes de medir, comprueba el sha256 de cada archivo contra el manifiesto. Si
// uno solo difiere, aborta. Medir un corpus distinto del que quedó fichado
// produciría cifras que parecen trazables y no lo son, que es peor que no tener
// ninguna.
//
// El texto que cuenta no es el archivo entero. Una transcripción trae cabecera
// de metadatos y marcas de tiempo `**[mm:ss]**` en cada línea, y contar eso
// infla el recuento alrededor de un 15 %. Se mide lo que viene después de
// «## Transcripción», sin las marcas. Las fichas de han no tienen transcripción,
// así que ahí se cuenta el archivo entero y la medición lo dice.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CORPUS } from '../src/corpus.ts';
import { REPO_ROOT } from '../src/skills.ts';
import { countWords } from '../src/text.ts';

type Fuente = 'cuerpo-de-transcripcion' | 'archivo-completo';
type ArchivoMedido = {
  skill: string;
  archivo: string;
  palabras: number;
  signos: number;
  cues: number;
  segundos?: number;
};
type Medicion = {
  id: string;
  skill: string;
  afirmacion: string;
  regla: string;
  fuente: Fuente;
  archivos: number;
  unidad: string;
  valor: number;
  medido: string;
};

const DESTINO = join(REPO_ROOT, 'src', 'mediciones.ts');
const ES_TRANSCRIPCION = /^\d\d-/u;
const CABECERA_CUERPO = /^##\s+Transcri\S*\s*$/imu;
const MARCA_DE_TIEMPO = /\*\*\[[\d:]+\]\*\*/gu;
const TERMINAL = /[.?!…]/gu;

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
}

const raiz = resolve(argumento('--desde') ?? join(REPO_ROOT, '..', 'datos'));

if (!existsSync(raiz)) {
  console.error(`no hay corpus en ${raiz}`);
  console.error('esta medición solo se puede hacer con el corpus delante.');
  console.error('si ya se borró, src/mediciones.ts es lo que quedó de él.');
  process.exit(1);
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Segundos de un `mm:ss` o de un `h:mm:ss`. */
function segundosDe(reloj: string): number {
  const partes = reloj.split(':').map(Number);
  if (partes.some(Number.isNaN)) return 0;
  return partes.reduce((total, p) => total * 60 + p, 0);
}

/** Duraciones que solitario declara en su `manifest.json`, por nombre de archivo. */
function duracionesDelManifiesto(dir: string): Map<string, number> {
  const ruta = join(dir, 'manifest.json');
  if (!existsSync(ruta)) return new Map();
  const json = JSON.parse(readFileSync(ruta, 'utf8')) as {
    entries?: { filename?: string; duration?: number }[];
  };
  return new Map(
    (json.entries ?? [])
      .filter((e) => e.filename && typeof e.duration === 'number')
      .map((e) => [e.filename as string, e.duration as number]),
  );
}

const porArchivo: ArchivoMedido[] = [];
const mediciones: Medicion[] = [];
const desajustes: string[] = [];

for (const corpus of CORPUS) {
  const dir = join(raiz, corpus.skill);
  const duraciones = duracionesDelManifiesto(dir);
  const seleccion = corpus.archivos.filter((a) => ES_TRANSCRIPCION.test(a.ruta));

  // Una transcripción es un archivo con cabecera «## Transcripción». Si ninguno
  // la tiene, el corpus no es de transcripciones y se cuenta entero.
  let conCabecera = 0;
  const textos = new Map<string, { crudo: string; cuerpo: string; cues: number }>();

  for (const archivo of seleccion) {
    const ruta = join(dir, archivo.ruta);
    const bytes = readFileSync(ruta);
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (sha !== archivo.sha256) {
      desajustes.push(`${corpus.skill}/${archivo.ruta}`);
      continue;
    }
    const crudo = bytes.toString('utf8');
    const corte = CABECERA_CUERPO.exec(crudo);
    if (corte) conCabecera++;
    const tras = corte ? crudo.slice(corte.index + corte[0].length) : crudo;
    const cues = (crudo.match(MARCA_DE_TIEMPO) ?? []).length;
    textos.set(archivo.ruta, { crudo, cuerpo: tras.replace(MARCA_DE_TIEMPO, ' '), cues });
  }

  if (desajustes.length) break;

  const fuente: Fuente = conCabecera === seleccion.length ? 'cuerpo-de-transcripcion' : 'archivo-completo';

  for (const archivo of seleccion) {
    const t = textos.get(archivo.ruta);
    if (!t) continue;
    const texto = fuente === 'cuerpo-de-transcripcion' ? t.cuerpo : t.crudo;
    const cabecera = /^-\s+Duration:\s*([\d:]+)\s*$/imu.exec(t.crudo);
    const segundos = duraciones.get(archivo.ruta) ?? (cabecera ? segundosDe(cabecera[1] as string) : undefined);
    porArchivo.push({
      skill: corpus.skill,
      archivo: archivo.ruta,
      palabras: countWords(texto),
      signos: (texto.match(TERMINAL) ?? []).length,
      cues: t.cues,
      ...(segundos === undefined ? {} : { segundos }),
    });
  }

  const filas = porArchivo.filter((f) => f.skill === corpus.skill);
  const suma = (f: (x: ArchivoMedido) => number) => filas.reduce((n, x) => n + f(x), 0);
  const agregar = (id: string, afirmacion: string, regla: string, unidad: string, valor: number) =>
    mediciones.push({
      id: `${corpus.skill}/${id}`,
      skill: corpus.skill,
      afirmacion,
      regla,
      fuente,
      archivos: filas.length,
      unidad,
      valor,
      medido: hoy(),
    });

  const deTranscripcion = fuente === 'cuerpo-de-transcripcion';
  agregar(
    'archivos',
    deTranscripcion ? 'Transcripciones que componen el corpus.' : 'Fichas que componen el corpus.',
    'Archivos del manifiesto cuyo nombre empieza por dos dígitos.',
    'archivos',
    filas.length,
  );
  agregar(
    'palabras',
    deTranscripcion ? 'Palabras del cuerpo de las transcripciones.' : 'Palabras de las fichas.',
    deTranscripcion
      ? 'Texto posterior a «## Transcripción», sin las marcas **[mm:ss]**, partido por espacio en blanco.'
      : 'Archivo entero partido por espacio en blanco. Estas fichas no tienen transcripción.',
    'palabras',
    suma((f) => f.palabras),
  );
  agregar(
    'signos-terminales',
    'Signos terminales del mismo texto.',
    'Apariciones de «.», «?», «!» o «…». Mide si la transcripción trae puntuación, no si la trae bien.',
    'signos',
    suma((f) => f.signos),
  );
  if (suma((f) => f.cues) > 0) {
    agregar(
      'marcas-de-tiempo',
      'Marcas de tiempo de las transcripciones.',
      'Apariciones de **[mm:ss]**. Una por línea de subtítulo.',
      'marcas',
      suma((f) => f.cues),
    );
  }
  const conSegundos = filas.filter((f) => f.segundos !== undefined);
  if (conSegundos.length) {
    agregar(
      'segundos',
      'Duración declarada del material.',
      'Suma de «- Duration:» de cada cabecera, o del campo «duration» del manifest.json donde la cabecera no lo trae.',
      'segundos',
      conSegundos.reduce((n, f) => n + (f.segundos ?? 0), 0),
    );
  }
}

if (desajustes.length) {
  console.error('el corpus no coincide con el manifiesto:');
  for (const d of desajustes) console.error(`  ${d}`);
  console.error('');
  console.error('medir un corpus distinto del que quedó fichado da cifras que');
  console.error('parecen trazables y no lo son. no se escribió nada.');
  process.exit(1);
}

/**
 * Conserva la fecha cuando el valor no cambió.
 *
 * Volver a correr el script sobre el mismo corpus no es una medición nueva. La
 * misma idea que en `manifiesto.ts` y en `gen.ts`.
 */
if (existsSync(DESTINO)) {
  try {
    const previo = (await import(`file://${DESTINO.replace(/\\/gu, '/')}`)) as {
      MEDICIONES?: Medicion[];
    };
    for (const m of mediciones) {
      const antes = previo.MEDICIONES?.find((p) => p.id === m.id);
      if (antes && antes.valor === m.valor) m.medido = antes.medido;
    }
  } catch {
    // Un archivo previo ilegible no puede frenar una medición.
  }
}

const CABECERA = `// GENERADO por scripts/medir.ts. Lo que el corpus contenía.
//
// El manifiesto de \`corpus.ts\` dice qué archivos había. Esto dice qué había
// dentro. Son las dos mitades de lo mismo, y las dos existen porque el corpus se
// borra: sin ellas, las cifras que las skills enuncian se quedan sin nada
// detrás.
//
// Cada medición trae las cuatro casillas que hacen comprobable una cifra: qué
// afirma, con qué regla se produjo, sobre qué archivos, y en qué unidad. La
// regla no es una descripción: es lo que \`scripts/medir.ts\` ejecuta, así que
// mientras el corpus exista cualquiera puede volver a correrlo y obtener este
// mismo número o descubrir que no.
//
// \`fuente\` dice qué texto se contó. \`cuerpo-de-transcripcion\` es lo que viene
// después de «## Transcripción», sin las marcas de tiempo; contar el archivo
// entero mete la cabecera de metadatos e infla el recuento alrededor de un 15 %.
// \`archivo-completo\` es para las fichas de han, que no tienen transcripción.
//
// Los signos terminales están para que nadie derive longitud de oración sin
// mirar antes. Una transcripción automática sin puntuar da menos de diez signos
// cada mil palabras, y sobre eso la media de palabras por oración es una
// ficción con dos decimales.

export type Fuente = 'cuerpo-de-transcripcion' | 'archivo-completo';

/** Una cifra con lo que hace falta para comprobarla. */
export type Medicion = {
  /** Clave estable: corpus y magnitud. */
  id: string;
  skill: string;
  /** Qué se midió. */
  afirmacion: string;
  /** Con qué regla. Lo que ejecuta \`scripts/medir.ts\`. */
  regla: string;
  /** Sobre qué texto de cada archivo. */
  fuente: Fuente;
  /** Cuántos archivos entraron. El manifiesto dice cuáles. */
  archivos: number;
  unidad: string;
  valor: number;
  /** Fecha de la medición, no de la última vez que corrió el script. */
  medido: string;
};

/** El detalle del que sale cada agregado. Un renglón por archivo medido. */
export type ArchivoMedido = {
  skill: string;
  /** Ruta tal como la registra el manifiesto. */
  archivo: string;
  palabras: number;
  signos: number;
  /** Marcas **[mm:ss]**. Cero donde no hay transcripción. */
  cues: number;
  /** Segundos de material, donde el corpus los declara. */
  segundos?: number;
};

export const MEDICIONES: readonly Medicion[] = [
`;

const cuerpoMediciones = mediciones
  .map(
    (m) => `  {
    id: '${m.id}',
    skill: '${m.skill}',
    afirmacion: ${JSON.stringify(m.afirmacion)},
    regla: ${JSON.stringify(m.regla)},
    fuente: '${m.fuente}',
    archivos: ${m.archivos},
    unidad: '${m.unidad}',
    valor: ${m.valor},
    medido: '${m.medido}',
  },`,
  )
  .join('\n');

const cuerpoArchivos = porArchivo
  .map((f) => {
    const segundos = f.segundos === undefined ? '' : `, segundos: ${f.segundos}`;
    return `  { skill: '${f.skill}', archivo: ${JSON.stringify(f.archivo)}, palabras: ${f.palabras}, signos: ${f.signos}, cues: ${f.cues}${segundos} },`;
  })
  .join('\n');

writeFileSync(
  DESTINO,
  `${CABECERA}${cuerpoMediciones}\n];\n\nexport const POR_ARCHIVO: readonly ArchivoMedido[] = [\n${cuerpoArchivos}\n];\n`,
  'utf8',
);

console.log(`corpus leído en ${raiz}`);
console.log(`${mediciones.length} mediciones sobre ${porArchivo.length} archivos`);
console.log('');
console.log('skill                   archivos  palabras   signos/1000  minutos');
for (const corpus of CORPUS) {
  const de = (id: string) => mediciones.find((m) => m.id === `${corpus.skill}/${id}`)?.valor;
  const palabras = de('palabras') ?? 0;
  const signos = de('signos-terminales') ?? 0;
  const segundos = de('segundos');
  console.log(
    `${corpus.skill.padEnd(22)} ${String(de('archivos') ?? 0).padStart(8)} ${String(palabras).padStart(9)} ${((1000 * signos) / (palabras || 1)).toFixed(1).padStart(12)} ${(segundos === undefined ? '-' : Math.round(segundos / 60)).toString().padStart(8)}`,
  );
}
console.log('');
console.log(`escrito: src/mediciones.ts`);
