// Antes de correr: las skills instaladas tienen que ser las del repositorio.
//
// Cada agente lee su propia copia de las skills, no la del repositorio, y esa
// copia la mantiene el usuario a mano. Una serie corrida con una copia vieja
// prueba las skills de antes y publica el resultado como si fuera de las de
// ahora, y nada en el veredicto lo delata. Por eso, antes de lanzar un agente,
// cada archivo de cada skill del arnés se compara byte a byte con la copia de
// cada agente elegido, finales de línea incluidos. Si algo falta, difiere o
// sobra, la serie no corre.
//
// La prueba no sincroniza nada: esos directorios son del usuario, y escribir
// en ellos para que una corrida pase sería probar lo que la prueba acaba de
// poner ahí.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Comparacion = {
  directorio: string;
  /** Archivos del arnés que no están en la copia, relativos a `skills/`. */
  faltan: string[];
  /** Archivos que están en los dos lados con bytes distintos. */
  distintos: string[];
  /** Archivos de la copia, dentro de una skill del arnés, que el arnés no tiene. */
  sobran: string[];
  /** La huella de lo que lee el agente: cada archivo del arnés tal como está en su copia. */
  huella: string;
};

export type ComparacionDeAgente = { agente: string; comparacion: Comparacion };

const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

/** Las skills del arnés: lo que git rastrea bajo `skills/`, relativo a esa carpeta y en orden. */
export function skillsDelArnes(rastreados: readonly string[]): string[] {
  return rastreados
    .map((r) => r.replace(/\\/gu, '/'))
    .filter((r) => r.startsWith('skills/'))
    .map((r) => r.slice('skills/'.length))
    .sort();
}

const esArchivo = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

/** Los archivos de una carpeta, relativos a ella. Sigue los enlaces, que es como las lee un agente. */
function archivosDe(dir: string): string[] {
  const out: string[] = [];
  const recorrer = (d: string, prefijo: string) => {
    for (const nombre of readdirSync(d)) {
      const p = join(d, nombre);
      let st;
      try {
        st = statSync(p);
      } catch {
        // Un enlace roto no es un archivo que el agente pueda leer.
        continue;
      }
      if (st.isDirectory()) recorrer(p, `${prefijo}${nombre}/`);
      else if (st.isFile()) out.push(`${prefijo}${nombre}`);
    }
  };
  if (existsSync(dir)) recorrer(dir, '');
  return out;
}

/** Compara las skills del arnés, relativas a `<arnes>/skills`, con su copia en `directorio`. */
export function compararInstaladas(arnes: string, rastreadas: readonly string[], directorio: string): Comparacion {
  // Una rastreada que se borró sin commit ya no es del arnés: si la copia la
  // tiene, sobra.
  const skills = rastreadas.filter((r) => esArchivo(join(arnes, 'skills', ...r.split('/'))));
  const faltan: string[] = [];
  const distintos: string[] = [];
  const lineas: string[] = [];
  for (const r of [...skills].sort()) {
    const instalado = join(directorio, ...r.split('/'));
    if (!esArchivo(instalado)) {
      faltan.push(r);
      lineas.push(`${r}\tfalta\n`);
      continue;
    }
    const copia = readFileSync(instalado);
    lineas.push(`${r}\t${sha256(copia)}\n`);
    if (!copia.equals(readFileSync(join(arnes, 'skills', ...r.split('/'))))) distintos.push(r);
  }
  const propias = new Set(skills);
  const sobran = [...new Set(skills.map((r) => r.split('/')[0] as string))]
    .flatMap((skill) => archivosDe(join(directorio, skill)).map((a) => `${skill}/${a}`))
    .filter((r) => !propias.has(r))
    .sort();
  return { directorio, faltan, distintos, sobran, huella: sha256(lineas.join('')) };
}

const coinciden = (c: Comparacion) => c.faltan.length + c.distintos.length + c.sobran.length === 0;

/** Una línea por agente: si su copia coincide, o cuánto difiere. */
export function lineasDeInstaladas(cs: readonly ComparacionDeAgente[]): string[] {
  return cs.map(({ agente, comparacion: c }) => {
    if (coinciden(c)) return `  ${agente}: ${c.directorio}, iguales al repositorio.`;
    const partes = [
      c.faltan.length > 0 ? `faltan ${c.faltan.length}` : null,
      c.distintos.length > 0 ? `${c.distintos.length} ${c.distintos.length === 1 ? 'distinto' : 'distintos'}` : null,
      c.sobran.length > 0 ? `sobran ${c.sobran.length}` : null,
    ].filter((x) => x !== null);
    return `  ${agente}: ${c.directorio}, ${partes.join(', ')}.`;
  });
}

/** El mensaje que detiene la serie, con cada archivo por agente, o null si todo coincide. */
export function errorDeInstaladas(cs: readonly ComparacionDeAgente[]): string | null {
  const malas = cs.filter((x) => !coinciden(x.comparacion));
  if (malas.length === 0) return null;
  const lineas = ['las skills instaladas no coinciden con las del repositorio, y la serie probaría otras:'];
  for (const { agente, comparacion: c } of malas) {
    lineas.push(`  ${agente}, en ${c.directorio}:`);
    for (const r of c.faltan) lineas.push(`    falta: ${r}`);
    for (const r of c.distintos) lineas.push(`    distinto: ${r}`);
    for (const r of c.sobran) lineas.push(`    sobra: ${r}`);
  }
  lineas.push('Hay que sincronizar primero esas copias con skills/ del arnés. La prueba no escribe en esos directorios.');
  return lineas.join('\n');
}
