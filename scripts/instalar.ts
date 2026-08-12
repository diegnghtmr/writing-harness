// Instala las skills enlazando, no copiando.
//
//   node scripts/instalar.ts               crea los enlaces
//   node scripts/instalar.ts --verificar   solo informa, no toca nada
//   node scripts/instalar.ts --desinstalar
//   ... --destino <ruta>                   para un anfitrión distinto
//
// Copiar reintroduciría el problema que este repo existe para resolver: dos
// representaciones de la misma regla que se separan sin que nadie lo note. Un
// enlace deja una sola casa. Se edita el repo y lo instalado ya cambió.
//
// En Windows se usa una junction de directorio, que no pide permisos de
// administrador. En Linux y macOS, un symlink normal.

import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { SKILLS_DIR, skillNames } from '../src/skills.ts';

// Directorio de skills de cada anfitrión conocido. No es una lista cerrada:
// `--destino` acepta cualquier ruta, y el formato SKILL.md lo lee cualquier
// herramienta que sepa leer markdown con frontmatter.
const ANFITRION_POR_DEFECTO = join(homedir(), '.claude', 'skills');

function parseArgs(argv: string[]): { modo?: string; destino: string } {
  let modo: string | undefined;
  let destino = ANFITRION_POR_DEFECTO;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--destino') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--destino necesita una ruta');
      destino = resolve(valor);
    } else if (modo === undefined) {
      modo = arg;
    } else {
      throw new Error(`argumento de más: ${arg}`);
    }
  }
  return { modo, destino };
}

const { modo: MODO, destino: DESTINO } = parseArgs(process.argv.slice(2));
const TIPO = platform() === 'win32' ? 'junction' : 'dir';

type Estado = 'enlazado' | 'enlazado-a-otro' | 'ocupado' | 'libre';

function estadoDe(name: string): { estado: Estado; apunta?: string } {
  const path = join(DESTINO, name);
  if (!existsSync(path) && !esEnlaceRoto(path)) return { estado: 'libre' };
  try {
    if (lstatSync(path).isSymbolicLink()) {
      const apunta = resolve(readlinkSync(path));
      const esperado = resolve(join(SKILLS_DIR, name));
      return { estado: apunta === esperado ? 'enlazado' : 'enlazado-a-otro', apunta };
    }
  } catch {
    // cae a ocupado
  }
  return { estado: 'ocupado' };
}

function esEnlaceRoto(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function verificar(): number {
  let problemas = 0;
  for (const name of skillNames()) {
    const { estado, apunta } = estadoDe(name);
    const detalle = apunta === undefined ? '' : `  -> ${apunta}`;
    console.log(`  ${estado.padEnd(16)} ${name}${detalle}`);
    if (estado === 'ocupado' || estado === 'enlazado-a-otro') problemas++;
  }
  return problemas;
}

function instalar(): number {
  mkdirSync(DESTINO, { recursive: true });
  let errores = 0;

  for (const name of skillNames()) {
    const path = join(DESTINO, name);
    const { estado } = estadoDe(name);

    if (estado === 'enlazado') {
      console.log(`  ya estaba      ${name}`);
      continue;
    }
    if (estado === 'ocupado') {
      // No se borra nada que no hayamos puesto nosotros.
      console.error(`  OCUPADO        ${name}  hay un directorio real ahí, no lo toco`);
      errores++;
      continue;
    }
    if (estado === 'enlazado-a-otro') unlinkSync(path);

    symlinkSync(join(SKILLS_DIR, name), path, TIPO);
    console.log(`  enlazado       ${name}`);
  }

  return errores;
}

function desinstalar(): number {
  for (const name of skillNames()) {
    const { estado } = estadoDe(name);
    if (estado === 'enlazado' || estado === 'enlazado-a-otro') {
      unlinkSync(join(DESTINO, name));
      console.log(`  quitado        ${name}`);
    } else if (estado === 'ocupado') {
      console.log(`  intacto        ${name}  no es un enlace nuestro`);
    }
  }
  return 0;
}

console.log(`destino: ${DESTINO}`);
console.log(`origen:  ${SKILLS_DIR}`);
console.log(`enlace:  ${TIPO}\n`);

let codigo = 0;
if (MODO === '--verificar') codigo = verificar();
else if (MODO === '--desinstalar') codigo = desinstalar();
else if (MODO === undefined) codigo = instalar();
else {
  console.error(`opción desconocida: ${MODO}`);
  console.error('uso: node scripts/instalar.ts [--verificar|--desinstalar] [--destino <ruta>]');
  codigo = 2;
}

if (codigo === 0 && MODO === undefined) {
  const enlazadas = skillNames().filter((n) => estadoDe(n).estado === 'enlazado').length;
  const total = readdirSync(DESTINO).length;
  console.log(`\n${enlazadas} de ${skillNames().length} enlazadas. ${total} entradas en el destino.`);
}
process.exit(codigo);
