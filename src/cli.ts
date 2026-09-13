// CLI del verificador.
//
//   node src/cli.ts <archivo...> [--tono <id>] [--pasada humanizar]
//   cat texto.txt | node src/cli.ts --tono camus
//   node src/cli.ts --enrutar comunidadAfectada
//
// Sale con 1 si hay errores, para poder encadenarlo en un hook o en CI. Sale
// con 2 si no pudo usar la entrada: una opción mal escrita, un archivo que no
// existe o uno que no está en UTF-8. En los tres casos no mide nada.
//
// `--enrutar` es la excepción: no mide nada y no lee ningún archivo. Responde
// qué tono corresponde a una petición y por qué. Está acá porque el
// enrutamiento tiene que poder consultarse desde fuera, igual que todo lo
// demás: si hiciera falta que una skill lo invocara, la respuesta no sería
// darle la invocación.

import { readFileSync } from 'node:fs';
import { check, format, relevadas, type Finding } from './check.ts';
import {
  RASGOS,
  type Rasgos,
  RUTAS,
  rasgosQueAbren,
  rasgosQueCompletan,
  rutasQueLeen,
  sugerirTono,
} from './enrutamiento.ts';
import { PASADAS, PASADA_IDS, TONES, TONE_IDS } from './rules.ts';
// El nombre de la skill es identidad de la skill, no una ruta: importar esta
// constante no lee ninguna skill, porque `skills.ts` no tiene efectos
// secundarios al importarse.
import { ENTRADA } from './skills.ts';

/**
 * Cada rasgo con los pasos que lo leen y el motivo que da cada uno.
 *
 * Sale entero de `RUTAS`. Quien enrutaba elegía los rasgos por el nombre, y un
 * nombre como `academico` describía el ámbito del pedido y no la forma del
 * texto. Con el motivo delante, el rasgo se elige por lo que el paso pide.
 */
const SIGNIFICADOS = RASGOS.map((rasgo) =>
  [
    `  ${rasgo}`,
    ...rutasQueLeen(rasgo).map(
      (l) => `    paso ${l.paso}, ${l.skill}${l.con.length > 0 ? `, con ${l.con.join(' o ')}` : ''}: ${l.cuando}.`,
    ),
  ].join('\n'),
).join('\n');

/** Una capa que se pide por su identificador o por el nombre de su skill. */
type Capa = { skill: string };

/**
 * El identificador que corresponde a un valor de `--tono` o `--pasada`, o
 * `undefined` si no corresponde a ninguno.
 *
 * Vale también el nombre de la skill: `camus-writing` por `camus`,
 * `humanizar-espanol` por `humanizar`. Un agente que acababa de cargar
 * `camus-writing` pasó ese nombre y recibió «tono desconocido», y una persona
 * cometió el mismo error: el nombre que se acaba de leer es el que se escribe.
 * Sale del campo `skill` de cada capa, así que un tono nuevo lo trae sin tocar
 * nada acá.
 */
function identificador(valor: string, capas: Record<string, Capa>): string | undefined {
  if (Object.hasOwn(capas, valor)) return valor;
  return Object.entries(capas).find(([, capa]) => capa.skill === valor)?.[0];
}

/** La primera capa de la lista, para que el ejemplo salga del dato y no quede escrito a mano. */
function ejemplo(capas: Record<string, Capa>): { id: string; skill: string } {
  const [id, capa] = Object.entries(capas)[0] ?? ['', { skill: '' }];
  return { id, skill: capa.skill };
}

/** El error de un valor que no es ni un identificador ni el nombre de una skill. */
function desconocido(que: string, valor: string, capas: Record<string, Capa>): Error {
  return new Error(
    `${que}: ${valor}. Disponibles: ${Object.keys(capas).join(', ')}. ` +
      `También vale el nombre de su skill, como ${ejemplo(capas).skill}.`,
  );
}

const TONO = ejemplo(TONES);
const PASADA = ejemplo(PASADAS);

const USAGE = `uso: node src/cli.ts <archivo...> [--tono <${TONE_IDS.join('|')}>]
                              [--pasada <${PASADA_IDS.join('|')}>]
     node src/cli.ts --enrutar <rasgo,rasgo,...>

Sin --tono corre solo la capa base, que es la normativa y rige siempre.
Con --tono añade las reglas de ese tono: longitudes, persona, ritmo.
Con --pasada añade el catálogo de esa pasada, que no corre solo. Igual que la
skill, humanizar se pide de forma explícita o no interviene.
--tono y --pasada aceptan también el nombre de su skill:
${TONO.skill} vale por ${TONO.id}, y ${PASADA.skill} vale por ${PASADA.id}.

Pedir una pasada puede relevar al tono en lo que esa pasada gobierna. humanizar
gobierna el ritmo, así que con --pasada humanizar las reglas de longitud del
tono se retiran y mandan las de la pasada. La capa base no cede nunca nada.
Cuando eso ocurre, se dice cuáles se retiraron y por qué.

--enrutar no mide ningún texto: responde qué tono corresponde a una petición y
por qué, recorriendo la lista de ${ENTRADA} en orden. Siempre devuelve
uno. Cada rasgo, con los pasos que lo leen y el motivo que da cada paso:
${SIGNIFICADOS}

Lee de la entrada estándar si no se pasa ningún archivo.`;

function enrutar(lista: string): void {
  const pedidos = lista.split(',').map((s) => s.trim()).filter(Boolean);
  const desconocidos = pedidos.filter((r) => !RASGOS.includes(r as (typeof RASGOS)[number]));
  if (desconocidos.length) {
    throw new Error(`rasgo desconocido: ${desconocidos.join(', ')}. Disponibles: ${RASGOS.join(', ')}`);
  }
  const rasgos = Object.fromEntries(pedidos.map((r) => [r, true])) as Rasgos;
  const s = sugerirTono(rasgos);
  console.log(`${s.skill}`);
  console.log(`  ${s.porque}`);
  if (!s.reclamado) {
    console.log('  Ningún rasgo de los dados es más estrecho que el caso general.');
  }
  const posicion = RUTAS.findIndex((r) => r.tono === s.tono) + 1;
  console.log(`  Paso ${posicion} de ${RUTAS.length} de la lista de ${ENTRADA}.`);
  // Varias rutas piden dos rasgos. Quien pasaba uno solo recibía el último paso
  // sin aviso, y lo tomaba por una decisión cuando le faltaba declarar algo. Y
  // quien no pasaba ninguno, o uno que no completaba nada, tampoco se enteraba
  // de las rutas que un rasgo abre por sí solo.
  const completan = rasgosQueCompletan(rasgos);
  const abren = rasgosQueAbren(rasgos);
  const linea = (c: { rasgo: string; paso: number }) => `    + ${c.rasgo}: ${RUTAS[c.paso - 1]?.skill}, paso ${c.paso}`;
  if (completan.length > 0 || abren.length > 0) {
    console.log(
      pedidos.length === 0
        ? '  Aviso: no se dio ningún rasgo, así que la respuesta es el último paso.'
        : '  Aviso: los rasgos dados no completan ninguna ruta de la lista, así que la respuesta es el último paso.',
    );
  }
  if (completan.length > 0) {
    console.log('  Con uno de estos rasgos más, la ruta sería otra:');
    for (const c of completan) console.log(linea(c));
  }
  if (abren.length > 0) {
    console.log('  Estos rasgos abren una ruta por sí solos:');
    for (const c of abren) console.log(linea(c));
  }
}

function parse(argv: string[]): { files: string[]; tone?: string; pasadas: string[] } {
  const files: string[] = [];
  const pasadas: string[] = [];
  let tone: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--enrutar') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--enrutar necesita al menos un rasgo');
      enrutar(valor);
      process.exit(0);
    } else if (arg === '--tono' || arg === '-t') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--tono necesita un valor');
      // Desde acá corre el identificador: el aviso de lo relevado y la medición
      // dicen `camus` aunque se haya pedido `camus-writing`.
      tone = identificador(valor, TONES);
      if (tone === undefined) throw desconocido('tono desconocido', valor, TONES);
    } else if (arg === '--pasada' || arg === '-p') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--pasada necesita un valor');
      const id = identificador(valor, PASADAS);
      if (id === undefined) throw desconocido('pasada desconocida', valor, PASADAS);
      // Repetirla no la aplica dos veces, tampoco pedida una vez por cada
      // nombre. Sin esto, sus reglas entraban dos veces en la lista y
      // `assertRules` abortaba con «regla duplicada», que es un mensaje interno
      // sobre un error del usuario.
      if (!pasadas.includes(id)) pasadas.push(id);
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg.startsWith('-')) {
      throw new Error(`opción desconocida: ${arg}`);
    } else {
      files.push(arg);
    }
  }
  return { files, tone, pasadas };
}

function readStdin(): Uint8Array {
  try {
    return readFileSync(0);
  } catch {
    return new Uint8Array(0);
  }
}

// Qué hacer con una entrada rechazada. Es lo mismo para todas las causas, así
// que se dice una vez aunque se rechacen varias.
const REMEDIO =
  'El verificador solo lee UTF-8, y medir otra codificación puede dar por limpio un texto roto. ' +
  'Hay que guardar el texto como archivo UTF-8 y volver a pasarlo.';

// `TextDecoder` se salta la marca de orden de bytes de UTF-8 si el texto abre
// con ella, y `readFileSync(path, 'utf8')` no: la dejaba como primer carácter,
// la regla de caracteres invisibles la marcaba en 1:1 y cada hallazgo de la
// primera línea caía una columna más allá. `fatal` hace que un byte que no es
// UTF-8 lance, en vez de volverse U+FFFD en silencio.
const UTF8 = new TextDecoder('utf-8', { fatal: true });

/**
 * El texto, o por qué no se puede medir.
 *
 * Existe porque el verificador medía cualquier cosa. El UTF-16 que escribe `>`
 * en Windows PowerShell 5.1, leído como UTF-8, salía «sin hallazgos» con
 * salida 0, y un archivo en Windows-1252 también, con cada acento vuelto
 * U+FFFD. Un veredicto sobre lo que no se pudo leer se ve desde fuera igual que
 * uno sobre un texto que pasó.
 *
 * Lo que no ve: la tubería de PowerShell 5.1 cambia cada acento por `?` antes
 * de que node reciba nada, y eso es UTF-8 válido. Por eso AGENTS.md pide el
 * texto como archivo.
 */
function decodificar(bytes: Uint8Array): { texto: string } | { motivo: string } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { motivo: 'parece UTF-16: empieza con los bytes FF FE, la marca de orden de bytes de esa codificación' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { motivo: 'parece UTF-16: empieza con los bytes FE FF, la marca de orden de bytes de esa codificación' };
  }
  if (bytes.includes(0)) {
    return { motivo: 'parece UTF-16 sin marca de orden de bytes: tiene bytes nulos, que un texto en UTF-8 no lleva' };
  }
  try {
    return { texto: UTF8.decode(bytes) };
  } catch {
    return { motivo: 'tiene bytes que no son UTF-8, como los de un archivo guardado en Windows-1252' };
  }
}

function main(): void {
  const { files, tone, pasadas } = parse(process.argv.slice(2));
  const crudas: { path: string; bytes: Uint8Array }[] =
    files.length > 0
      ? files.map((path) => ({ path, bytes: readFileSync(path) }))
      : [{ path: '(entrada estándar)', bytes: readStdin() }];

  // Se revisan todas antes de medir ninguna, igual que un archivo que no existe
  // corta la corrida entera. Medir las legibles dejaría un «sin hallazgos» al
  // lado de un texto que nadie leyó.
  const inputs: { path: string; text: string }[] = [];
  const rechazos: string[] = [];
  for (const { path, bytes } of crudas) {
    const r = decodificar(bytes);
    if ('motivo' in r) rechazos.push(`error: ${path} ${r.motivo}. No se mide.`);
    else inputs.push({ path, text: r.texto });
  }
  // Con 2 y no con 1: el 1 dice que el texto tiene errores, y este no llegó a
  // leerse. Sin el uso, porque no es una opción mal escrita.
  if (rechazos.length > 0) {
    console.error([...rechazos, REMEDIO].join('\n'));
    process.exit(2);
  }

  // Una regla que se retira sin avisar deja un texto que pasó por permiso y no
  // por mérito, y desde fuera las dos cosas se ven igual.
  const cedidas = relevadas(tone, pasadas);
  if (cedidas.length > 0) {
    const por = [...new Set(cedidas.map((c) => c.por))].join(', ');
    console.log(`La pasada ${por} releva al tono ${tone} en el ritmo. Se retiran:`);
    for (const c of cedidas) console.log(`  ${c.regla}`);
    console.log('');
  }

  let errors = 0;
  const reports: string[] = [];

  for (const { path, text } of inputs) {
    if (text.trim() === '') {
      reports.push(`${path}: vacío`);
      continue;
    }
    const findings: Finding[] = check(text, { tone, pasadas });
    errors += findings.filter((f) => f.severity === 'error').length;
    reports.push(format(findings, path));
  }

  console.log(reports.join('\n\n'));
  process.exit(errors > 0 ? 1 : 0);
}

try {
  main();
} catch (err) {
  console.error(`error: ${(err as Error).message}\n`);
  console.error(USAGE);
  process.exit(2);
}
