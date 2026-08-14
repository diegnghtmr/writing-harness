// CLI del verificador.
//
//   node src/cli.ts <archivo...> [--tono <id>] [--pasada humanizar]
//   cat texto.txt | node src/cli.ts --tono camus
//   node src/cli.ts --enrutar juridico
//
// Sale con 1 si hay errores, para poder encadenarlo en un hook o en CI.
//
// `--enrutar` es la excepción: no mide nada y no lee ningún archivo. Responde
// qué tono corresponde a una petición y por qué. Está acá porque el
// enrutamiento tiene que poder consultarse desde fuera, igual que todo lo
// demás: si hiciera falta que una skill lo invocara, la respuesta no sería
// darle la invocación.

import { readFileSync } from 'node:fs';
import { check, format, relevadas, type Finding } from './check.ts';
import { RASGOS, type Rasgos, RUTAS, sugerirTono } from './enrutamiento.ts';
import { PASADA_IDS, TONE_IDS } from './rules.ts';

const USAGE = `uso: node src/cli.ts <archivo...> [--tono <${TONE_IDS.join('|')}>]
                              [--pasada <${PASADA_IDS.join('|')}>]
     node src/cli.ts --enrutar <rasgo,rasgo,...>

Sin --tono corre solo la capa base, que es la normativa y rige siempre.
Con --tono añade las reglas de ese tono: longitudes, persona, ritmo.
Con --pasada añade el catálogo de esa pasada, que no corre solo. Igual que la
skill, humanizar se pide de forma explícita o no interviene.

Pedir una pasada puede relevar al tono en lo que esa pasada gobierna. humanizar
gobierna el ritmo, así que con --pasada humanizar las reglas de longitud del
tono se retiran y mandan las de la pasada. La capa base no cede nunca nada.
Cuando eso ocurre, se dice cuáles se retiraron y por qué.

--enrutar no mide ningún texto: responde qué tono corresponde a una petición y
por qué, recorriendo la lista de spanish-writing §3 en orden. Siempre devuelve
uno. Rasgos: ${RASGOS.join(', ')}.

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
  console.log(`  Paso ${posicion} de ${RUTAS.length} de la lista de spanish-writing §3.`);
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
      tone = argv[++i];
      if (tone === undefined) throw new Error('--tono necesita un valor');
      if (!TONE_IDS.includes(tone)) {
        throw new Error(`tono desconocido: ${tone}. Disponibles: ${TONE_IDS.join(', ')}`);
      }
    } else if (arg === '--pasada' || arg === '-p') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--pasada necesita un valor');
      if (!PASADA_IDS.includes(valor)) {
        throw new Error(`pasada desconocida: ${valor}. Disponibles: ${PASADA_IDS.join(', ')}`);
      }
      // Repetirla no la aplica dos veces. Sin esto, sus reglas entraban dos
      // veces en la lista y `assertRules` abortaba con «regla duplicada», que es
      // un mensaje interno sobre un error del usuario.
      if (!pasadas.includes(valor)) pasadas.push(valor);
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

function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const { files, tone, pasadas } = parse(process.argv.slice(2));
  const inputs: { path: string; text: string }[] =
    files.length > 0
      ? files.map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      : [{ path: '(entrada estándar)', text: readStdin() }];

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
