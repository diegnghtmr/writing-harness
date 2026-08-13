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

import { chmodSync, copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT } from '../src/skills.ts';

const desinstalar = process.argv.includes('--desinstalar');

function directorioDeHooks(): string {
  const configurado = (() => {
    try {
      return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      }).trim();
    } catch {
      return '';
    }
  })();
  if (configurado) return join(REPO_ROOT, configurado);
  return join(REPO_ROOT, '.git', 'hooks');
}

const origen = join(REPO_ROOT, 'scripts', 'pre-commit');
const destino = join(directorioDeHooks(), 'pre-commit');

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
