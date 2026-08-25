// El frontmatter de cada skill, contra lo que el instalador de skills acepta.
//
// Una skill se sube como archivo y del otro lado hay un validador que la puede
// rechazar. Ese validador no vive acá y no se puede correr desde acá, así que
// sus límites se copian, y una copia se desincroniza: lo que este archivo
// comprueba es lo que se sabía el día que se escribió.
//
// Se escribió el día que seis de las catorce skills fueron rechazadas al
// subirlas, todas por lo mismo: `description` no puede pasar de 1024
// caracteres. Ninguna lo sabía, porque el límite no estaba escrito en ninguna
// parte de este repositorio y la descripción es el único campo que crece solo,
// cada vez que un tono aprende a distinguirse mejor de sus hermanos.
//
// **La cuenta es sobre el valor plegado, no sobre los bytes del archivo.** Las
// descripciones se escriben con un escalar `>` de YAML, que une las líneas con
// un espacio. Contar el bloque crudo daría de más por cada salto y de menos por
// cada sangría, y las dos veces por un motivo que no le importa a nadie del
// otro lado.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readSkill, skillNames } from '../src/skills.ts';

/** Lo que el instalador acepta. Copiado de su mensaje de error, no deducido. */
const MAXIMO_DESCRIPCION = 1024;

/**
 * El valor de un campo del frontmatter, plegado como lo pliega YAML.
 *
 * Entiende el escalar simple en la misma línea y el bloque `>`, que son las dos
 * formas que este repositorio usa. Devuelve `null` si el campo no está, que es
 * distinto de estar vacío y por eso se comprueba aparte: el instalador exige
 * que el nombre y la descripción existan.
 */
export function campoDeFrontmatter(md: string, campo: string): string | null {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(md);
  if (!fm) return null;
  const lineas = (fm[1] as string).split(/\r?\n/u);
  const i = lineas.findIndex((l) => l.startsWith(`${campo}:`));
  if (i === -1) return null;

  const cabeza = (lineas[i] as string).slice(campo.length + 1).trim();
  if (cabeza !== '' && !['>', '|', '>-', '|-'].includes(cabeza)) {
    return cabeza.replace(/^["']|["']$/gu, '');
  }

  const cuerpo: string[] = [];
  for (let j = i + 1; j < lineas.length; j++) {
    // Una línea sin sangría cierra el bloque: es el campo siguiente.
    if (/^\S/u.test(lineas[j] as string)) break;
    cuerpo.push((lineas[j] as string).trim());
  }
  // `>` pliega: las líneas se unen con un espacio.
  return cuerpo.join(' ').trim();
}

const largo = (s: string) => [...s].length;

describe('el frontmatter trae lo que el instalador exige', () => {
  test('cada skill declara nombre y descripción', () => {
    const faltan = skillNames().flatMap((n) => {
      const md = readSkill(n);
      return ['name', 'description']
        .filter((c) => {
          const v = campoDeFrontmatter(md, c);
          return v === null || v === '';
        })
        .map((c) => `${n}: falta ${c}`);
    });
    assert.deepEqual(faltan, []);
  });

  test('el nombre del frontmatter es el de la carpeta', () => {
    // Si no coinciden, la skill se instala con un nombre y se invoca con otro.
    const distintos = skillNames()
      .map((n) => [n, campoDeFrontmatter(readSkill(n), 'name')] as const)
      .filter(([n, declarado]) => declarado !== n)
      .map(([n, declarado]) => `${n} declara ${declarado}`);
    assert.deepEqual(distintos, []);
  });
});

describe('ninguna descripción pasa el techo del instalador', () => {
  test('las catorce caben en 1024 caracteres', () => {
    const pasadas = skillNames()
      .map((n) => [n, largo(campoDeFrontmatter(readSkill(n), 'description') ?? '')] as const)
      .filter(([, n]) => n > MAXIMO_DESCRIPCION)
      .map(([skill, n]) => `${skill}: ${n}`);
    assert.deepEqual(
      pasadas,
      [],
      `estas descripciones las rechaza el instalador, que corta en ${MAXIMO_DESCRIPCION}`,
    );
  });

  test('y ninguna queda tan cerca del techo que el próximo retoque la pase', () => {
    // Aviso, no límite. El instalador corta en 1024 y este margen no es suyo:
    // es lo que hace que agregar una frase a una descripción sea una decisión y
    // no una sorpresa al subir. `atenas` llegó a quedar a veinte caracteres.
    const MARGEN = 60;
    const alFilo = skillNames()
      .map((n) => [n, largo(campoDeFrontmatter(readSkill(n), 'description') ?? '')] as const)
      .filter(([, n]) => n > MAXIMO_DESCRIPCION - MARGEN)
      .map(([skill, n]) => `${skill}: ${n}, a ${MAXIMO_DESCRIPCION - n} del techo`);
    assert.deepEqual(alFilo, []);
  });
});

describe('la cuenta es la del valor plegado', () => {
  // El canario. Sin esto, los tres tests de arriba pasan aunque el lector no
  // entienda el escalar `>` y devuelva siempre una cadena vacía.
  const CON_BLOQUE = ['---', 'name: x', 'description: >', '  una línea', '  y otra', '---', ''].join('\n');

  test('un bloque «>» se pliega con un espacio, no con un salto', () => {
    assert.equal(campoDeFrontmatter(CON_BLOQUE, 'description'), 'una línea y otra');
  });

  test('un escalar en la misma línea se lee tal cual', () => {
    assert.equal(campoDeFrontmatter('---\nname: x\ndescription: corta\n---\n', 'description'), 'corta');
    assert.equal(campoDeFrontmatter('---\nname: x\ndescription: "entre comillas"\n---\n', 'description'), 'entre comillas');
  });

  test('el bloque termina donde empieza el campo siguiente', () => {
    // Sin el corte, la descripción se comía el resto del frontmatter y toda
    // medición de largo daba de más.
    const dos = ['---', 'description: >', '  primera', '  segunda', 'name: x', '---', ''].join('\n');
    assert.equal(campoDeFrontmatter(dos, 'description'), 'primera segunda');
    assert.equal(campoDeFrontmatter(dos, 'name'), 'x');
  });

  test('un campo ausente da null, y eso no es lo mismo que vacío', () => {
    assert.equal(campoDeFrontmatter('---\nname: x\n---\n', 'description'), null);
    assert.equal(campoDeFrontmatter('sin frontmatter', 'name'), null);
  });

  test('cuenta caracteres y no bytes', () => {
    // Las descripciones van en español, con acentos y comillas angulares. En
    // UTF-8 esos ocupan dos bytes, y contar bytes rechazaría descripciones que
    // el instalador acepta.
    assert.equal(largo('ñ«»á'), 4);
    assert.equal(Buffer.byteLength('ñ«»á', 'utf8'), 8);
  });
});
