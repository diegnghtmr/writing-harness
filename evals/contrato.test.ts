// El contrato de evidencia, y que este repositorio lo cumpla.
//
// El contrato vive dos veces, acá y en el repositorio de diapositivas, y las dos
// copias son idénticas en su bloque normativo. No hay import entre los dos: lo
// que se comparte son cuatro nombres, y cada lado los aplica con su propia
// máquina.
//
// Este archivo hace las dos comprobaciones que corresponden a este lado. Que el
// bloque no cambió, y que las mediciones lo cumplen. La segunda es la que evita
// que el contrato se vuelva un adorno: un documento que nadie comprueba dice lo
// que a cada uno le convenga que diga.
//
// Lo que este test NO puede hacer es notar que la otra copia se movió. Eso no
// tiene arreglo sin acoplar los dos repositorios, y acoplarlos costaría más de
// lo que resuelve. Lo que sí se consigue es que ningún cambio sea silencioso: si
// alguien toca el bloque de un lado, ese lado falla, y las dos huellas
// declaradas dejan de coincidir a la vista de cualquiera.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { CORPUS } from '../src/corpus.ts';
import { MEDICIONES } from '../src/mediciones.ts';
import { REPO_ROOT } from '../src/skills.ts';

/** La huella del bloque normativo. La otra copia declara esta misma. */
const HUELLA = 'b0cde722813e6f5818b65d17ca6e318ab2af758a943f8ef69c60656340bba774';
const VERSION = 'v1';

const contrato = readFileSync(join(REPO_ROOT, 'contrato-de-evidencia.md'), 'utf8').replace(
  /\r\n/gu,
  '\n',
);

function bloqueNormativo(texto: string): string {
  const m = new RegExp(
    `<!-- EVIDENCE-CONTRACT ${VERSION} BEGIN -->\\n([\\s\\S]*?)<!-- EVIDENCE-CONTRACT ${VERSION} END -->`,
    'u',
  ).exec(texto);
  assert.ok(m, 'el contrato perdió sus marcadores');
  return m[1] as string;
}

describe('el contrato de evidencia', () => {
  test('el bloque normativo coincide con su huella', () => {
    // Para cambiarlo: editarlo, pegar acá el valor que este test reporte como
    // recibido, y llevar el mismo bloque y la misma huella a la otra copia. Si
    // solo se hace una de las dos cosas, las dos huellas dejan de coincidir y
    // eso es exactamente lo que hay que ver.
    assert.equal(
      createHash('sha256').update(bloqueNormativo(contrato), 'utf8').digest('hex'),
      HUELLA,
    );
  });

  test('el bloque está en inglés y la explicación en español', () => {
    // No es capricho. Obligar a que la explicación coincidiera habría hecho que
    // uno de los dos repositorios escribiera en el idioma del otro. Lo que tiene
    // que ser idéntico es la forma, no el comentario.
    const bloque = bloqueNormativo(contrato);
    for (const campo of ['claim', 'method', 'sources', 'unit']) {
      assert.match(bloque, new RegExp(`^${campo}\\s`, 'mu'), `falta el campo ${campo}`);
    }
    assert.doesNotMatch(bloque, /[áéíóúñ¿¡]/iu, 'el bloque normativo lleva acentos españoles');
    const fuera = contrato.replace(bloque, '');
    assert.match(fuera, /[áéíóúñ]/iu, 'la explicación de este lado va en español');
  });

  test('el contrato no nombra al otro repositorio', () => {
    // Nombrarlo sería el primer paso para depender de él. El contrato describe
    // una disciplina, no una relación entre dos rutas.
    assert.doesNotMatch(contrato, /open-slide|github\.com|npm/iu);
  });
});

describe('las mediciones cumplen el contrato', () => {
  test('las cuatro casillas vienen llenas en cada medición', () => {
    // `afirmacion` es claim, `regla` es method, `fuente` y `archivos` son
    // sources, `unidad` es unit. Los nombres son de este lado; la forma es la
    // del contrato.
    const vacias = MEDICIONES.filter(
      (m) =>
        m.afirmacion.trim() === '' ||
        m.regla.trim() === '' ||
        m.unidad.trim() === '' ||
        m.archivos < 1,
    ).map((m) => m.id);
    assert.deepEqual(vacias, []);
  });

  test('el método dice cómo, no qué se quería', () => {
    // Un método tiene que poder correrse otra vez. Una regla que solo enuncia
    // la intención deja la cifra igual de incomprobable que si no dijera nada,
    // y encima con aspecto de estar justificada.
    for (const m of MEDICIONES) {
      assert.ok(m.regla.length > 30, `${m.id} tiene una regla demasiado corta para ser repetible`);
      assert.doesNotMatch(
        m.regla,
        /(?<!\p{L})(?:aproximadamente|más o menos|alrededor de|se estim)/iu,
        `${m.id} describe una estimación en lugar de un método`,
      );
    }
  });

  test('las fuentes están fijadas por contenido, no por nombre', () => {
    // Es lo que el bloque exige para las fuentes que pueden desaparecer, y la
    // del corpus desapareció. Cada archivo que una medición cuenta tiene su
    // sha256 en el manifiesto, así que la fuente sigue identificada aunque ya no
    // exista ningún archivo con ese nombre.
    const conHuella = new Map(CORPUS.map((c) => [c.skill, c.archivos.filter((a) => a.sha256)]));
    for (const m of MEDICIONES) {
      const archivos = conHuella.get(m.skill) ?? [];
      assert.ok(archivos.length >= m.archivos, `${m.id} cuenta archivos que el manifiesto no fija`);
    }
  });
});
