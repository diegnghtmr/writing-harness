// CLI del verificador.
//
//   node src/cli.ts <archivo...> [--tono camus|fonda|catedra]
//   cat texto.txt | node src/cli.ts --tono camus
//
// Sale con 1 si hay errores, para poder encadenarlo en un hook o en CI.

import { readFileSync } from 'node:fs';
import { check, format, type Finding } from './check.ts';
import { PASADA_IDS, TONE_IDS } from './rules.ts';

const USAGE = `uso: node src/cli.ts <archivo...> [--tono <${TONE_IDS.join('|')}>]
                              [--pasada <${PASADA_IDS.join('|')}>]

Sin --tono corre solo la capa base, que es la normativa y rige siempre.
Con --tono añade las reglas de ese tono: longitudes, persona, ritmo.
Con --pasada añade el catálogo de esa pasada, que no corre solo. Igual que la
skill, humanizar se pide de forma explícita o no interviene.

Lee de la entrada estándar si no se pasa ningún archivo.`;

function parse(argv: string[]): { files: string[]; tone?: string; pasadas: string[] } {
  const files: string[] = [];
  const pasadas: string[] = [];
  let tone: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--tono' || arg === '-t') {
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
      pasadas.push(valor);
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
