// Instala el hook de pre-commit.
//
//   node scripts/instalar-hook.ts
//   node scripts/instalar-hook.ts --desinstalar
//
// Copia en vez de enlazar, al revés que `instalar.ts`. Los hooks de Git no
// siguen enlaces en todas las plataformas, y un hook que no corre es peor que
// no tenerlo: da la sensación de estar cubierto. El precio es que hay que
// reinstalarlo cuando el archivo cambia, y por eso el propio hook se compara
// con el origen y avisa.
//
// `core.hooksPath` no se toca: si el usuario lo configuró, mandar sobre eso
// sería secuestrarle la configuración.
//
// La ruta del directorio de hooks se le pregunta a git
// (`directorio-de-hooks.ts`), no se arma a mano: `.git` no siempre es una
// carpeta (un worktree enlazado lo deja como un archivo), y un
// `core.hooksPath` absoluto rompe un `join` ingenuo contra la raíz.

import { chmodSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../src/skills.ts';
import { directorioDeHooks } from './directorio-de-hooks.ts';

const desinstalar = process.argv.includes('--desinstalar');

let hooksDir: string;
try {
  hooksDir = directorioDeHooks(REPO_ROOT);
} catch (error) {
  // Un hook instalado en la carpeta equivocada es peor que ninguno: da la
  // sensación de estar cubierto sin correr nunca. Por eso esto no sigue en
  // silencio con un valor por defecto adivinado.
  console.error(`no se pudo resolver el directorio de hooks: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const origen = join(REPO_ROOT, 'scripts', 'pre-commit');
const destino = join(hooksDir, 'pre-commit');

if (desinstalar) {
  if (existsSync(destino)) {
    rmSync(destino);
    console.log(`desinstalado: ${destino}`);
  } else {
    console.log('no había hook instalado');
  }
  process.exit(0);
}

if (!existsSync(origen)) {
  console.error(`falta el origen: ${origen}`);
  process.exit(1);
}

if (existsSync(destino)) {
  const igual = readFileSync(destino, 'utf8') === readFileSync(origen, 'utf8');
  if (igual) {
    console.log('ya estaba instalado y coincide con el origen');
    process.exit(0);
  }
  // No se pisa en silencio. Puede ser un hook ajeno, o el nuestro modificado a
  // mano, y las dos cosas merecen que alguien mire antes.
  console.error(`ya hay un pre-commit distinto en ${destino}`);
  console.error('revisalo y borralo si sobra, o corré --desinstalar');
  process.exit(1);
}

copyFileSync(origen, destino);
chmodSync(destino, 0o755);
console.log(`instalado: ${destino}`);
console.log('para saltarlo en un commit concreto: git commit --no-verify');
