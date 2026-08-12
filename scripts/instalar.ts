// Instala las skills enlazando, no copiando.
//
//   node scripts/instalar.ts                     enlaza en el destino por defecto
//   node scripts/instalar.ts --todos             enlaza en todos los anfitriones presentes
//   node scripts/instalar.ts --destino <ruta>    enlaza en un destino concreto
//   node scripts/instalar.ts --verificar         solo informa, no toca nada
//   node scripts/instalar.ts --desinstalar       quita los enlaces que puso este script
//   node scripts/instalar.ts --reemplazar        aparta un directorio real que estorbe
//
// Copiar reintroduciría el problema que este repo existe para resolver: dos
// representaciones de la misma regla que se separan sin que nadie lo note. Un
// enlace deja una sola casa. Se edita el repo y lo instalado ya cambió.
//
// El destino por defecto es `~/.agents/skills`, la convención de varios
// clientes. Cada herramienta mantiene además su propio directorio, y `--todos`
// enlaza en los que existan.
//
// En Windows se usa una junction de directorio, que no pide permisos de
// administrador. En Linux y macOS, un symlink normal.

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  renameSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { SKILLS_DIR, skillNames } from '../src/skills.ts';

const HOME = homedir();

/** Convención entre clientes. Es el destino por defecto. */
const DESTINO_POR_DEFECTO = join(HOME, '.agents', 'skills');

/**
 * Directorios propios de cada herramienta. No es una lista cerrada ni una
 * afirmación sobre qué lee cada una: son las rutas que se han visto en uso.
 * `--todos` enlaza solo en las que ya existan, nunca las crea.
 */
const ANFITRIONES = [
  join(HOME, '.agents', 'skills'),
  join(HOME, '.claude', 'skills'),
  join(HOME, '.codex', 'skills'),
  join(HOME, '.copilot', 'skills'),
  join(HOME, '.cursor', 'skills'),
  join(HOME, '.codeium', 'windsurf', 'skills'),
  join(HOME, '.config', 'opencode', 'skills'),
];

const TIPO = platform() === 'win32' ? 'junction' : 'dir';

type Estado = 'enlazado' | 'enlazado-a-otro' | 'ocupado' | 'libre';

type Opciones = {
  modo: 'instalar' | 'verificar' | 'desinstalar';
  destinos: string[];
  reemplazar: boolean;
};

const USO = `uso: node scripts/instalar.ts [--verificar|--desinstalar]
                              [--todos | --destino <ruta>]
                              [--reemplazar]

Por defecto enlaza en ${DESTINO_POR_DEFECTO}
--todos enlaza además en los directorios de cada herramienta que ya existan.
--reemplazar aparta un directorio real que ocupe el nombre, renombrándolo a
             <nombre>.reemplazado. Nunca borra nada.`;

function parseArgs(argv: string[]): Opciones {
  let modo: Opciones['modo'] = 'instalar';
  let reemplazar = false;
  let todos = false;
  const destinos: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--verificar') modo = 'verificar';
    else if (arg === '--desinstalar') modo = 'desinstalar';
    else if (arg === '--reemplazar') reemplazar = true;
    else if (arg === '--todos') todos = true;
    else if (arg === '--destino') {
      const valor = argv[++i];
      if (valor === undefined) throw new Error('--destino necesita una ruta');
      destinos.push(resolve(valor));
    } else if (arg === '--help' || arg === '-h') {
      console.log(USO);
      process.exit(0);
    } else throw new Error(`opción desconocida: ${arg}`);
  }

  if (todos) destinos.push(...ANFITRIONES.filter((d) => existsSync(d)));
  if (destinos.length === 0) destinos.push(DESTINO_POR_DEFECTO);

  return { modo, destinos: [...new Set(destinos)], reemplazar };
}

function estadoDe(destino: string, name: string): { estado: Estado; apunta?: string } {
  const path = join(destino, name);
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return { estado: 'libre' };
  }
  if (stat.isSymbolicLink()) {
    let apunta: string;
    try {
      apunta = resolve(readlinkSync(path));
    } catch {
      return { estado: 'enlazado-a-otro' };
    }
    const esperado = resolve(join(SKILLS_DIR, name));
    return { estado: apunta === esperado ? 'enlazado' : 'enlazado-a-otro', apunta };
  }
  return { estado: 'ocupado' };
}

function verificar(destino: string): number {
  let problemas = 0;
  for (const name of skillNames()) {
    const { estado, apunta } = estadoDe(destino, name);
    console.log(`  ${estado.padEnd(16)} ${name}${apunta === undefined ? '' : `  -> ${apunta}`}`);
    if (estado === 'ocupado' || estado === 'enlazado-a-otro') problemas++;
  }
  return problemas;
}

function instalar(destino: string, reemplazar: boolean): number {
  mkdirSync(destino, { recursive: true });
  let errores = 0;

  for (const name of skillNames()) {
    const path = join(destino, name);
    const { estado } = estadoDe(destino, name);

    if (estado === 'enlazado') {
      console.log(`  ya estaba      ${name}`);
      continue;
    }
    // Ocupado por un directorio real, o por un enlace que apunta a otra parte.
    // Los dos casos son ajenos: no los puso este script, así que no los toca
    // salvo que se lo pidan de forma explícita.
    if (estado === 'ocupado' || estado === 'enlazado-a-otro') {
      const que = estado === 'ocupado' ? 'un directorio real' : 'un enlace a otra parte';
      if (!reemplazar) {
        console.error(`  AJENO          ${name}  hay ${que} ahí. --reemplazar lo aparta`);
        errores++;
        continue;
      }
      if (estado === 'enlazado-a-otro') {
        // Quitar el enlace no toca su destino, pero se dice cuál era.
        console.log(`  desenlazado    ${name}  apuntaba a ${estadoDe(destino, name).apunta}`);
        unlinkSync(path);
      } else {
        const apartado = `${path}.reemplazado`;
        if (existsSync(apartado)) {
          console.error(`  AJENO          ${name}  ya hay un ${name}.reemplazado, resolvelo a mano`);
          errores++;
          continue;
        }
        renameSync(path, apartado);
        console.log(`  apartado       ${name}  -> ${name}.reemplazado`);
      }
    }

    symlinkSync(join(SKILLS_DIR, name), path, TIPO);
    console.log(`  enlazado       ${name}`);
  }

  return errores;
}

function desinstalar(destino: string): number {
  for (const name of skillNames()) {
    const { estado, apunta } = estadoDe(destino, name);
    // Solo se quita lo que apunta a este repositorio. Un enlace ajeno con el
    // mismo nombre no lo pusimos nosotros y no nos toca quitarlo.
    if (estado === 'enlazado') {
      unlinkSync(join(destino, name));
      console.log(`  quitado        ${name}`);
    } else if (estado === 'enlazado-a-otro') {
      console.log(`  intacto        ${name}  es un enlace ajeno a ${apunta}`);
    } else if (estado === 'ocupado') {
      console.log(`  intacto        ${name}  es un directorio real ajeno`);
    }
  }
  return 0;
}

let codigo = 0;
try {
  const { modo, destinos, reemplazar } = parseArgs(process.argv.slice(2));
  console.log(`origen: ${SKILLS_DIR}`);
  console.log(`enlace: ${TIPO}\n`);

  for (const destino of destinos) {
    console.log(`${destino}`);
    if (modo === 'verificar') codigo += verificar(destino);
    else if (modo === 'desinstalar') codigo += desinstalar(destino);
    else codigo += instalar(destino, reemplazar);

    if (modo === 'instalar') {
      const enlazadas = skillNames().filter((n) => estadoDe(destino, n).estado === 'enlazado').length;
      console.log(`  ${enlazadas} de ${skillNames().length} enlazadas, ${readdirSync(destino).length} entradas en total`);
    }
    console.log('');
  }
} catch (err) {
  console.error(`error: ${(err as Error).message}\n`);
  console.error(USO);
  codigo = 2;
}

process.exit(codigo);
