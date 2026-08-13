// Manifiesto del corpus: la huella de lo que se midió, para cuando ya no esté.
//
//   node --experimental-strip-types scripts/manifiesto.ts
//   node --experimental-strip-types scripts/manifiesto.ts --desde ../datos
//
// El corpus no vive en este repositorio y no va a vivir nunca. Son
// transcripciones ajenas y un libro; se juntaron para construir las skills y se
// borran. Este script existe por eso: mientras el corpus está a mano, deja
// escrito qué archivos eran, cuánto pesaban y qué contenían exactamente.
//
// Sin manifiesto, las cifras que las skills enuncian son folclore. Dicen
// «medido sobre 22 archivos» y nadie puede decir cuáles ni comprobar que fueran
// estos. Con manifiesto, cada cifra puede nombrar su origen aunque el origen ya
// no exista, y nadie puede reatribuirla en silencio a un corpus distinto.
//
// Esto no acopla nada. El manifiesto se escribe en `src/`, que es el
// verificador. Ninguna skill lo nombra, igual que ninguna skill nombra una
// regla: la skill declara, el verificador mide.
//
// No es un derivado que se recalcule en cada commit. El gate no puede
// regenerarlo, porque en la máquina donde corre el corpus no está. Es un
// registro: se escribe una vez y se conserva.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { REPO_ROOT, skillNames } from '../src/skills.ts';
import { countWords } from '../src/text.ts';

type Archivo = { ruta: string; bytes: number; sha256: string; palabras?: number };
type Corpus = { skill: string; medido: string; archivos: Archivo[] };

const DESTINO = join(REPO_ROOT, 'src', 'corpus.ts');

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
}

const raiz = resolve(argumento('--desde') ?? join(REPO_ROOT, '..', 'datos'));

if (!existsSync(raiz)) {
  console.error(`no hay corpus en ${raiz}`);
  console.error('el manifiesto solo se puede escribir con el corpus delante.');
  console.error('si ya se borró, el archivo que hay en src/corpus.ts es lo que queda.');
  process.exit(1);
}

/** Recorre en profundidad. Los corpus son planos hoy; no tienen por qué serlo. */
function archivosDe(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? archivosDe(join(dir, e.name)) : [join(dir, e.name)]))
    .sort();
}

/**
 * Cuenta palabras solo en los `.md`, que es lo único que es prosa.
 *
 * Un PDF son bytes comprimidos y un JSON es estructura: contar sus «palabras»
 * daría un número que parece una medición y no lo es. Preferimos no decir nada
 * antes que decir algo que se va a leer mal.
 */
function palabrasDe(ruta: string, crudo: Buffer): number | undefined {
  if (!ruta.endsWith('.md')) return undefined;
  return countWords(crudo.toString('utf8'));
}

const skills = new Set(skillNames());
const corpus: Corpus[] = [];
const huerfanos: string[] = [];

for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
  if (!entrada.isDirectory()) continue;
  if (!skills.has(entrada.name)) huerfanos.push(entrada.name);

  const base = join(raiz, entrada.name);
  const archivos = archivosDe(base).map((abs): Archivo => {
    const crudo = readFileSync(abs);
    const ruta = relative(base, abs).replace(/\\/gu, '/');
    const palabras = palabrasDe(ruta, crudo);
    return {
      ruta,
      bytes: statSync(abs).size,
      sha256: createHash('sha256').update(crudo).digest('hex'),
      ...(palabras === undefined ? {} : { palabras }),
    };
  });

  corpus.push({ skill: entrada.name, medido: hoy(), archivos });
}

corpus.sort((a, b) => a.skill.localeCompare(b.skill));

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Conserva la fecha de medición cuando el corpus no cambió.
 *
 * La fecha es procedencia, no ruido de generación: dice cuándo se miró ese
 * corpus. Volver a correr el script sobre los mismos archivos no es una
 * medición nueva, así que la fecha se queda donde estaba. La misma idea que
 * `gen.ts` aplica a la clasificación de los ítems.
 */
async function conservarFechas(nuevos: Corpus[]): Promise<void> {
  if (!existsSync(DESTINO)) return;
  let previo: { CORPUS?: Corpus[] };
  try {
    previo = (await import(`file://${DESTINO.replace(/\\/gu, '/')}`)) as { CORPUS?: Corpus[] };
  } catch {
    return;
  }
  for (const c of nuevos) {
    const antes = previo.CORPUS?.find((p) => p.skill === c.skill);
    if (!antes) continue;
    const igual =
      antes.archivos.length === c.archivos.length &&
      antes.archivos.every((a, i) => a.sha256 === c.archivos[i]?.sha256);
    if (igual) c.medido = antes.medido;
  }
}

await conservarFechas(corpus);

const CABECERA = `// GENERADO por scripts/manifiesto.ts. La huella del corpus con el que se
// construyeron las skills.
//
// El corpus no está en este repositorio y no va a estar: son transcripciones
// ajenas y un libro, se juntaron para construir las skills y se borran. Esto es
// lo que sobrevive, y por eso no se toca a mano.
//
// Para qué sirve: una skill dice «medido sobre 22 archivos» y nunca dice
// cuáles. Acá está la lista, con el contenido exacto fijado por su sha256. Una
// cifra puede nombrar de dónde salió aunque el origen ya no exista, y un archivo
// que cambió de contenido se delata aunque conserve el nombre.
//
// Esto no es un derivado. El gate no lo regenera y el CI no lo comprueba, porque
// en esas máquinas el corpus no está. Es un registro.
//
// \`palabras\` solo aparece en los \`.md\`, que es lo único que es prosa. Un PDF
// son bytes comprimidos y un JSON es estructura: contar sus palabras daría un
// número que parece una medición y no lo es.
//
// \`medido\` es la fecha en que se miró ese corpus, no la fecha de la última vez
// que corrió el script.

export type ArchivoDeCorpus = {
  /** Ruta relativa a la carpeta del corpus, con barras normales. */
  ruta: string;
  bytes: number;
  /** sha256 del contenido en bruto, en hexadecimal. Fija la edición. */
  sha256: string;
  /** Palabras contadas como las cuenta el verificador. Solo en \`.md\`. */
  palabras?: number;
};

export type Corpus = {
  /** La skill que se construyó con este corpus. Coincide con la carpeta. */
  skill: string;
  /** Fecha de la medición, en ISO. */
  medido: string;
  archivos: readonly ArchivoDeCorpus[];
};

export const CORPUS: readonly Corpus[] = [
`;

const cuerpo = corpus
  .map((c) => {
    const archivos = c.archivos
      .map((a) => {
        const palabras = a.palabras === undefined ? '' : `, palabras: ${a.palabras}`;
        return `      { ruta: ${JSON.stringify(a.ruta)}, bytes: ${a.bytes}${palabras}, sha256: '${a.sha256}' },`;
      })
      .join('\n');
    return `  {
    skill: '${c.skill}',
    medido: '${c.medido}',
    archivos: [
${archivos}
    ],
  },`;
  })
  .join('\n');

writeFileSync(DESTINO, `${CABECERA}${cuerpo}\n];\n`, 'utf8');

const archivos = corpus.reduce((n, c) => n + c.archivos.length, 0);
const bytes = corpus.reduce((n, c) => n + c.archivos.reduce((m, a) => m + a.bytes, 0), 0);
const palabras = corpus.reduce(
  (n, c) => n + c.archivos.reduce((m, a) => m + (a.palabras ?? 0), 0),
  0,
);

console.log(`corpus leído en ${raiz}`);
console.log(`${corpus.length} corpus, ${archivos} archivos, ${bytes} bytes, ${palabras} palabras`);
for (const c of corpus) {
  const p = c.archivos.reduce((m, a) => m + (a.palabras ?? 0), 0);
  console.log(
    `  ${c.skill.padEnd(22)} ${String(c.archivos.length).padStart(3)} archivos  ${String(p).padStart(7)} palabras  ${c.medido}`,
  );
}
if (huerfanos.length) {
  // No es un error: puede haber corpus de una skill que todavía no existe. Pero
  // tiene que verse, porque también puede ser una skill que se renombró y dejó
  // su manifiesto apuntando a un nombre muerto.
  console.log('');
  console.log(`sin skill que le corresponda: ${huerfanos.join(', ')}`);
}
console.log('');
console.log(`escrito: ${relative(REPO_ROOT, DESTINO).replace(/\\/gu, '/')}`);
