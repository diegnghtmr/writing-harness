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
import { ENTRADA, readSkill, skillNames } from '../src/skills.ts';

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

  test('cada skill declara autor y versión en metadata', () => {
    // La forma de las skills de Gentleman Programming, que este arnés adopta:
    // `metadata` con `author` y `version`. No hay `license` porque el
    // repositorio no declara una, y escribirla sería inventarla.
    const faltan = skillNames().flatMap((n) => {
      const metadata = campoDeFrontmatter(readSkill(n), 'metadata') ?? '';
      return ['author', 'version']
        .filter((c) => !new RegExp(`(?:^|\\s)${c}:\\s*\\S`, 'u').test(metadata))
        .map((c) => `${n}: falta metadata.${c}`);
    });
    assert.deepEqual(faltan, []);
  });
});

describe('ninguna descripción pasa el techo del instalador', () => {
  // Sin cifra en el nombre a propósito. Decía «las catorce» y al llegar la
  // decimoquinta skill quedó mintiendo, aunque la aserción de abajo nunca
  // dependió de ese número: recorre las que hay. Un nombre de test es prosa, y
  // envejece igual que la del README.
  test('todas caben en 1024 caracteres', () => {
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

describe('cada skill sigue siendo alcanzable por su nombre', () => {
  // La descripción no es adorno: es la superficie por la que un modelo elige
  // qué skill cargar. Recortarla para que quepa puede llevarse justamente eso,
  // y no lo dice ningún gate de largo.
  //
  // Pasó al recortar las seis que el instalador rechazaba: se fueron dieciocho
  // disparadores entrecomillados y cuatro quedaron sin dueño, entre ellos los
  // dos más específicos que existen. `atenas` perdió el nombre de su canal y
  // `catedra` perdió su propio nombre. Un usuario que escribiera «estilo
  // Secreto de Atenas» dejaba de tener a qué acertar.
  //
  // Lo que esto comprueba es lo mínimo automatizable: que cada skill conserve
  // al menos un disparador que no comparte con ninguna otra. Juzgar si el
  // disparador es el bueno sigue siendo lectura.
  const disparadores = (skill: string): string[] => {
    const d = campoDeFrontmatter(readSkill(skill), 'description') ?? '';
    // Solo las citas de la parte de invocación, que es donde viven. Las de la
    // descripción del registro, como «ustedes» o «nosotros», no son
    // disparadores y las comparten varias skills con todo derecho.
    // El ancla cubre las tres formas que el repositorio usa para abrir esa
    // parte. Con solo dos, `humanizar-espanol` daba cero disparadores y este
    // gate la reportaba como inalcanzable cuando es la que más tiene.
    const desde = d.search(/Úsese|Disparar|También con/u);
    if (desde === -1) return [];
    return [...d.slice(desde).matchAll(/«([^»]+)»/gu)].map((m) => (m[1] as string).toLowerCase());
  };

  // `spanish-writing` queda fuera y conviene decir por qué en vez de omitirla.
  // Es la base: corre siempre, no se elige, y no declara ni una frase de
  // invocación. Un disparador propio no le haría falta y exigírselo obligaría a
  // inventarle uno.
  const CON_DISPARADOR = () => skillNames().filter((s) => s !== 'spanish-writing');

  test('ninguna queda sin un disparador propio', () => {
    const todos = new Map<string, number>();
    for (const s of CON_DISPARADOR()) {
      for (const f of new Set(disparadores(s))) todos.set(f, (todos.get(f) ?? 0) + 1);
    }
    const sinPropio = CON_DISPARADOR().filter(
      (s) => !disparadores(s).some((f) => todos.get(f) === 1),
    );
    assert.deepEqual(
      sinPropio,
      [],
      'estas skills solo se invocan con frases que otra también reclama',
    );
  });

  /**
   * El disparador con el que se pide cada tono por el nombre de su modelo.
   *
   * Va como lista y no como heurística porque la primera versión fue heurística
   * y no servía: aceptaba cualquier frase que empezara por «tono de», así que
   * `dotcsv` podía perder «estilo DotCSV» y seguir pasando gracias a «tono de
   * divulgación técnica», que además comparte con otra skill. Una lista dice
   * exactamente qué se perdería.
   *
   * `camus` y `solitario` no están, y no es un olvido. `camus` es el último paso
   * de la lista y se pide por la voz, no por el nombre. `solitario` nunca declaró
   * uno. Que falten está escrito acá para que sea una decisión visible y no un
   * hueco: el día que alguien les escriba el suyo, entra en esta lista.
   */
  const POR_SU_NOMBRE: Record<string, string> = {
    'adria-sola-writing': 'estilo adrià solà',
    'atenas-writing': 'estilo secreto de atenas',
    'bettatech-writing': 'en estilo bettatech',
    'catedra-writing': 'tono de cátedra',
    'dotcsv-writing': 'estilo dotcsv',
    'fonda-writing': 'estilo fonda',
    'fonseca-writing': 'estilo fonseca',
    'freddy-writing': 'tono freddy',
    'han-writing': 'tono han',
    'schiavenato-writing': 'en estilo schiavenato',
  };

  test('los diez que se piden por su nombre lo conservan', () => {
    const perdidos = Object.entries(POR_SU_NOMBRE)
      .filter(([skill, frase]) => !disparadores(skill).includes(frase))
      .map(([skill, frase]) => `${skill}: ya no se puede pedir con «${frase}»`);
    assert.deepEqual(perdidos, []);
  });

  test('la lista no nombra skills que ya no existen', () => {
    // La otra dirección. Una entrada que sobrevive a su skill convierte la lista
    // en folclore y el test de arriba en un verde que no comprueba nada.
    const vivas = new Set(skillNames());
    assert.deepEqual(Object.keys(POR_SU_NOMBRE).filter((s) => !vivas.has(s)), []);
  });

  test('el extractor mira la parte de invocación y no la de descripción', () => {
    // Sin el corte, «ustedes» y «spanish-writing» contarían como disparadores
    // compartidos y el primer test daría verde por el motivo equivocado.
    const d = 'Trato de «ustedes». Hereda de «spanish-writing». Úsese con «tono X».';
    const citas = [...d.slice(d.search(/Úsese|Disparar|También con/u)).matchAll(/«([^»]+)»/gu)];
    assert.deepEqual(citas.map((m) => m[1]), ['tono X']);
  });
});

describe('la entrada se pide con frases que ninguna otra skill reclama', () => {
  // «redacta un texto» y «corrige este texto» abren el modo redactar y el modo
  // corregir; la de traducir es la que agrega este cambio. Ninguna de las tres
  // sirve si otra skill también la dispara: un anfitrión que la lea ahí no
  // sabría cuál cargar primero.
  const FRASES_DE_LA_ENTRADA = ['redacta un texto', 'corrige este texto', 'traduce este texto al español'];

  test('cada frase vive en la entrada y en ninguna otra skill', () => {
    for (const frase of FRASES_DE_LA_ENTRADA) {
      const conFrase = skillNames().filter((n) =>
        (campoDeFrontmatter(readSkill(n), 'description') ?? '').toLowerCase().includes(frase),
      );
      assert.deepEqual(conFrase, [ENTRADA], `«${frase}» tendría que vivir solo en la entrada`);
    }
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
