// El manifiesto está bien formado.
//
// Este gate protege algo que ningún otro protege. `cobertura.ts` se regenera en
// cada commit y el CI comprueba que no difiera, así que una edición a mano se
// delata sola. `corpus.ts` no: para regenerarlo hace falta el corpus, el corpus
// no está en el repositorio y va a desaparecer. Una edición a mano ahí no la
// nota nadie.
//
// Por eso se comprueba la forma, y por eso los recuentos están grabados. No son
// una meta: son el registro de lo que se midió el día que se midió. Si cambian,
// el cambio tiene que ser deliberado y venir de haber vuelto a correr
// `scripts/manifiesto.ts` con el corpus delante.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { CORPUS } from '../src/corpus.ts';
import { REPO_ROOT, skillNames } from '../src/skills.ts';

const archivos = CORPUS.flatMap((c) => c.archivos);

describe('el manifiesto no se editó a mano', () => {
  test('el archivo entero coincide con su huella', () => {
    // Las comprobaciones de forma cazan al descuidado, no al decidido. Un
    // recuento cambiado se delata contra los totales, pero un sha256 sustituido
    // por otros 64 hexadecimales con buena pinta no lo nota nadie, y con el
    // corpus borrado ya no hay contra qué comparar.
    //
    // Así que la huella del manifiesto es el manifiesto. Cualquier edición lo
    // rompe, incluida la de esta cabecera.
    //
    // Para actualizarla: volver a correr `scripts/manifiesto.ts` con el corpus
    // delante y pegar acá el valor que este test reporte como recibido.
    //
    // Los finales de línea se normalizan porque Git puede entregar el archivo
    // con CRLF en Windows, y una huella que depende del sistema operativo no es
    // una huella.
    const bytes = readFileSync(join(REPO_ROOT, 'src', 'corpus.ts'), 'utf8').replace(/\r\n/gu, '\n');
    assert.equal(
      createHash('sha256').update(bytes, 'utf8').digest('hex'),
      '0a0a745ee005ac0139fee216a35f7ea706095ce5b4f85b2d4b3c4dc361353bda',
    );
  });
});

describe('el manifiesto del corpus está bien formado', () => {
  test('13 corpus, 305 archivos, 961 220 palabras', () => {
    assert.equal(CORPUS.length, 13);
    assert.equal(archivos.length, 305);
    assert.equal(
      archivos.reduce((n, a) => n + (a.palabras ?? 0), 0),
      961220,
    );
  });

  test('cada corpus corresponde a una skill que existe', () => {
    // Un corpus que no corresponde a ninguna skill puede ser una skill futura,
    // y también puede ser una que se renombró dejando su huella apuntando a un
    // nombre muerto. Las dos merecen mirarse.
    const skills = new Set(skillNames());
    assert.deepEqual(
      CORPUS.map((c) => c.skill).filter((s) => !skills.has(s)),
      [],
    );
  });

  test('las rutas no se repiten dentro de un corpus', () => {
    for (const c of CORPUS) {
      const rutas = c.archivos.map((a) => a.ruta);
      assert.equal(new Set(rutas).size, rutas.length, `${c.skill} repite una ruta`);
    }
  });

  test('los archivos vienen ordenados', () => {
    // El generador ordena. Si un archivo aparece fuera de sitio es que alguien
    // lo insertó a mano.
    for (const c of CORPUS) {
      const rutas = c.archivos.map((a) => a.ruta);
      assert.deepEqual(rutas, [...rutas].sort(), `${c.skill} tiene sus archivos desordenados`);
    }
  });

  test('cada archivo trae un sha256 de verdad y un tamaño positivo', () => {
    for (const a of archivos) {
      assert.match(a.sha256, /^[0-9a-f]{64}$/u, `${a.ruta} no trae un sha256`);
      assert.ok(a.bytes > 0, `${a.ruta} pesa ${a.bytes} bytes`);
    }
  });

  test('solo la prosa trae recuento de palabras', () => {
    // Un PDF son bytes comprimidos y un JSON es estructura. Contar sus palabras
    // daría un número que parece una medición y no lo es.
    const conPalabras = archivos.filter((a) => a.palabras !== undefined);
    const sinPalabras = archivos.filter((a) => a.palabras === undefined);
    assert.deepEqual(
      conPalabras.filter((a) => !a.ruta.endsWith('.md')),
      [],
    );
    assert.deepEqual(
      sinPalabras.map((a) => a.ruta).sort(),
      ['Byung_Chul_Han_La_Sociedad_del_Cansancio_CAPITULOS_1_2.pdf', 'manifest.json'],
    );
  });

  test('la fecha de medición es una fecha ISO', () => {
    for (const c of CORPUS) {
      assert.match(c.medido, /^\d{4}-\d{2}-\d{2}$/u, `${c.skill} no trae fecha`);
    }
  });

  test('el único contenido repetido es apparatus, no una transcripción', () => {
    // 305 archivos y 302 hashes distintos. La diferencia es `PENDING.md`, el
    // mismo archivo de 121 bytes en cuatro corpus. Si algún día un hash
    // repetido cae sobre un archivo numerado, es una transcripción contada dos
    // veces y la cifra que salga de ahí está inflada.
    const porHash = new Map<string, string[]>();
    for (const c of CORPUS) {
      for (const a of c.archivos) {
        porHash.set(a.sha256, [...(porHash.get(a.sha256) ?? []), `${c.skill}/${a.ruta}`]);
      }
    }
    const repetidos = [...porHash.values()].filter((xs) => xs.length > 1);
    const transcripcionesRepetidas = repetidos
      .flat()
      .filter((r) => /\/\d\d-/u.test(r))
      .sort();
    assert.deepEqual(transcripcionesRepetidas, []);
    assert.equal(porHash.size, 302);
  });
});
