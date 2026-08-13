// Las cifras que la documentación enuncia son las que el código mide.
//
// Este gate existe porque el defecto ya ocurrió. `AGENTS.md` llegó a decir 95
// declaraciones cuando había 282, y 202 de criterio cuando eran 199; el README
// decía dos capas, tres tonos y 62 de 95 cuando ya eran tres capas, catorce
// tonos y 83 de 282. Nadie lo notó porque la documentación no la comprueba
// nadie: se escribe una vez y envejece sola.
//
// Es la misma idea que el test de correspondencia, aplicada a la prosa que
// describe el producto en vez de a la que declara sus reglas.
//
// **Cada cifra se comprueba dentro de su afirmación, no suelta en el archivo.**
// La primera versión de este test buscaba el número en cualquier parte, y pasó
// limpio con el README envejecido a mano: «61 reglas» aparecía dos veces, se
// cambió una y la otra sostuvo la aserción. Un gate que se conforma con que el
// número exista en alguna parte no comprueba nada. Ahora se recogen todas las
// apariciones de cada afirmación y se exige que digan lo mismo, así que dos
// menciones que se contradigan también fallan.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { CORPUS } from '../src/corpus.ts';
import { EXPRESIONES, MEDICIONES, POR_ARCHIVO } from '../src/mediciones.ts';
import { TONE_IDS, allRules } from '../src/rules.ts';
import { REPO_ROOT, allDeclarations, itemKey, skillNames } from '../src/skills.ts';
import { SIN_REGLA } from './cobertura.ts';

/**
 * Lee el documento con los espacios en blanco colapsados.
 *
 * La prosa va justificada a ochenta columnas, así que una afirmación cae partida
 * entre dos líneas en cuanto alguien añade una palabra antes. Un gate que
 * depende de dónde cae el salto no vigila el contenido, vigila el formato, y se
 * rompe cada vez que se reescribe un párrafo sin cambiar nada de lo que dice.
 *
 * Pasó dos veces mientras se escribía esto, y la segunda con la misma frase.
 */
const lee = (nombre: string) => readFileSync(join(REPO_ROOT, nombre), 'utf8');
const llano = (texto: string) => texto.replace(/\s+/gu, ' ');
const README = llano(lee('README.md'));
const AGENTS = llano(lee('AGENTS.md'));
const README_CRUDO = lee('README.md');
const AGENTS_CRUDO = lee('AGENTS.md');

const reglas = allRules();
const cubiertas = new Set(
  reglas.flatMap((r) => r.checklist.map((c) => itemKey(c.skill, c.item))),
).size;
const criterio = SIN_REGLA.filter((e) => e.estado === 'criterio').length;
const archivosDeCorpus = CORPUS.reduce((n, c) => n + c.archivos.length, 0);

/**
 * Comprueba que todas las veces que la prosa hace una afirmación diga la misma
 * cifra, y que sea la medida.
 *
 * `patron` tiene que capturar el número en su primer grupo. Cero apariciones es
 * un fallo: significa que la afirmación desapareció del documento, y una
 * afirmación que se borra es tan invisible como una que envejece.
 */
function afirma(texto: string, patron: RegExp, esperado: number, donde: string): void {
  const dichas = [...texto.matchAll(patron)].map((m) => Number((m[1] as string).replace(/[.,]/gu, '')));
  assert.ok(dichas.length > 0, `${donde}: la afirmación no aparece`);
  assert.deepEqual(
    [...new Set(dichas)],
    [esperado],
    `${donde}: la prosa dice ${[...new Set(dichas)].join(' y ')}, la medición dice ${esperado}`,
  );
}

describe('el README dice lo que el código mide', () => {
  test('las cifras estructurales', () => {
    afirma(README, /(\d+) reglas/gu, reglas.length, 'README, reglas');
    afirma(README, /(\d+) declaraciones/gu, allDeclarations().length, 'README, declaraciones');
    afirma(README, /cubierto \| \*\*(\d+)\*\*/gu, cubiertas, 'README, cubiertas');
    afirma(README, /criterio \| (\d+) \|/gu, criterio, 'README, criterio');
    afirma(
      README,
      /`forbidden-pattern` cubre (\d+)/gu,
      reglas.filter((r) => r.kind === 'forbidden-pattern').length,
      'README, reglas de patrón',
    );
  });

  test('las cifras del corpus', () => {
    afirma(README, /(\d+) corpus · \d+ archivos/gu, CORPUS.length, 'README, corpus');
    afirma(README, /\d+ corpus · (\d+) archivos/gu, archivosDeCorpus, 'README, archivos');
    afirma(README, /(\d+) mediciones · \d+ archivos/gu, MEDICIONES.length, 'README, mediciones');
    afirma(README, /\d+ mediciones · (\d+) archivos/gu, POR_ARCHIVO.length, 'README, medidos');
    afirma(README, /([\d.]+) expresiones contadas/gu, EXPRESIONES.length, 'README, expresiones');
  });

  test('las cuentas escritas con letra', () => {
    // Van con letra porque la base lo pide para las cantidades bajas. Que vayan
    // con letra no las exime de ser ciertas.
    const LETRA: Record<number, string> = { 11: 'once', 13: 'trece', 14: 'catorce', 16: 'dieciséis' };
    const tipos = new Set(reglas.map((r) => r.kind)).size;
    const pares: [number, RegExp, string][] = [
      [skillNames().length, /(\p{L}+) skills en tres capas/u, 'skills'],
      // Las dos salen de la misma oración de §Enrutamiento, que las enuncia
      // juntas: «Trece de los catorce reconstruyen la forma de exponer de un
      // autor concreto».
      [TONE_IDS.length, /de los (\p{L}+) reconstruyen/u, 'tonos'],
      [TONE_IDS.length - 1, /(\p{L}+) de los \p{L}+ reconstruyen/u, 'tonos de autor'],
      [tipos, /se reparten en (\p{L}+) tipos/u, 'tipos de regla'],
    ];
    for (const [n, patron, que] of pares) {
      const m = patron.exec(README);
      assert.ok(m, `${que}: la afirmación no aparece en el README`);
      assert.equal((m[1] as string).toLowerCase(), LETRA[n], `${que}: la medición dice ${n}`);
    }
  });

  test('no quedó ninguna afirmación de las viejas', () => {
    // Cada una fue verdad y dejó de serlo. Nombrarlas es más barato que volver a
    // descubrirlas.
    for (const vieja of [
      /organizadas en dos capas/u,
      /El nombre del repositorio es provisional/u,
      /\b62 de 95\b/u,
      /\bdoce tonos\b/u,
    ]) {
      assert.doesNotMatch(README, vieja, `el README conserva una afirmación retirada`);
    }
  });
});

describe('AGENTS.md dice lo que el código mide', () => {
  test('las cifras que enuncia', () => {
    afirma(AGENTS, /De las (\d+) declaraciones/gu, allDeclarations().length, 'AGENTS, declaraciones');
    afirma(AGENTS, /\*\*(\d+) exigen juicio/gu, criterio, 'AGENTS, criterio');
    afirma(AGENTS, /(\d+) corpus, \d+ archivos/gu, CORPUS.length, 'AGENTS, corpus');
    afirma(AGENTS, /\d+ corpus, (\d+) archivos/gu, archivosDeCorpus, 'AGENTS, archivos');
    afirma(AGENTS, /(\d+) mediciones sobre \d+ archivos/gu, MEDICIONES.length, 'AGENTS, mediciones');
    afirma(AGENTS, /\d+ mediciones sobre (\d+) archivos/gu, POR_ARCHIVO.length, 'AGENTS, medidos');
    afirma(AGENTS, /las ([\d.]+) expresiones/gu, EXPRESIONES.length, 'AGENTS, expresiones');
    afirma(
      AGENTS,
      /(\d+) aparecen en él/gu,
      EXPRESIONES.filter((e) => e.veces > 0).length,
      'AGENTS, expresiones presentes',
    );
    afirma(
      AGENTS,
      /(\d+) que dan cero/gu,
      EXPRESIONES.filter((e) => e.veces === 0).length,
      'AGENTS, expresiones ausentes',
    );
  });

  test('los diagramas no usan etiquetas que no rendericen en todas partes', () => {
    // No se parsea mermaid acá: eso exigiría una dependencia, y este
    // repositorio no tiene ninguna. Los cinco diagramas se validaron con el
    // propio mermaid antes de entrar, y el validador se probó con uno roto a
    // propósito. Lo que queda vigilado es lo que sí se puede sin dependencias.
    //
    // `<b>` e `<i>` solo se ven si el visor tiene las etiquetas HTML
    // activadas, y salen literales si no. `<br/>` funciona igual en los dos
    // casos, así que es el único que se admite.
    for (const [nombre, texto] of [
      ['README.md', README_CRUDO],
      ['AGENTS.md', AGENTS_CRUDO],
    ] as const) {
      const bloques = [...texto.matchAll(/```mermaid\n([\s\S]*?)```/gu)].map((m) => m[1] as string);
      const aperturas = (texto.match(/```mermaid/gu) ?? []).length;
      assert.equal(bloques.length, aperturas, `${nombre}: un bloque mermaid quedó sin cerrar`);
      for (const b of bloques) {
        assert.doesNotMatch(b, /<\/?(?:b|i|strong|em)>/u, `${nombre}: etiqueta que puede no renderizar`);
      }
    }
    assert.equal((README_CRUDO.match(/```mermaid/gu) ?? []).length, 5);
    assert.equal((AGENTS_CRUDO.match(/```mermaid/gu) ?? []).length, 1);
  });

  test('CLAUDE.md sigue siendo un puntero y no una copia', () => {
    const claude = lee('CLAUDE.md');
    assert.ok(claude.length < 500, 'CLAUDE.md creció: una copia se desincroniza, un puntero no');
    assert.match(claude, /AGENTS\.md/u);
  });
});
