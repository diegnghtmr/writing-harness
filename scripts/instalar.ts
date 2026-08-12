// Instala las skills enlazando, no copiando.
//
//   node scripts/instalar.ts             crea los enlaces
//   node scripts/instalar.ts --verificar solo informa, no toca nada
//   node scripts/instalar.ts --desinstalar
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

const DESTINO = join(homedir(), '.claude', 'skills');
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

const modo = process.argv[2];
console.log(`destino: ${DESTINO}`);
console.log(`origen:  ${SKILLS_DIR}`);
console.log(`enlace:  ${TIPO}\n`);

let codigo = 0;
if (modo === '--verificar') codigo = verificar();
else if (modo === '--desinstalar') codigo = desinstalar();
else if (modo === undefined) codigo = instalar();
else {
  console.error(`opción desconocida: ${modo}`);
  codigo = 2;
}

if (codigo === 0 && modo === undefined) {
  const enlazadas = skillNames().filter((n) => estadoDe(n).estado === 'enlazado').length;
  const total = readdirSync(DESTINO).length;
  console.log(`\n${enlazadas} de ${skillNames().length} enlazadas. ${total} entradas en el destino.`);
}
process.exit(codigo);
