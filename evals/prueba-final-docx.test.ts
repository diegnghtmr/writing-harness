// La prueba final con agentes empieza por sacar el texto de un docx, y lo saca
// sin dependencias: el repositorio no tiene ninguna y no iba a estrenarlas para
// leer un zip.
//
// Lo que se comprueba acá es lo que puede romperse sin que nadie lo vea. Un
// lector de zip que solo sabe abrir entradas guardadas falla con el primer docx
// de verdad, que viene comprimido. Un extractor que junta todos los `<w:t>` del
// documento mete en el texto el cuadro del diagrama, y dos veces, porque Word
// lo guarda en dos versiones. Y una selección por número de párrafo se corre en
// cuanto alguien agrega una línea en blanco al documento: por eso el fragmento
// se elige por el título y su estilo, y si no los encuentra no adivina.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check } from '../src/check.ts';
import { entradasDelZip, extraerDelZip, parrafosDelDocx, parrafosDelXml } from '../scripts/prueba-final/docx.ts';
import { ErrorDeUso } from '../scripts/prueba-final/errores.ts';
import { comoTexto, completo, fragmento } from '../scripts/prueba-final/fragmento.ts';
import { CUERPO, construirDocx, construirZip, dibujo, p } from './fixtures/prueba-final/docx.ts';

const bytes = (s: string) => new TextEncoder().encode(s);
const leer = (b: Uint8Array) => new TextDecoder().decode(b);

describe('el lector de zip', () => {
  const zip = construirZip([
    { nombre: 'guardada.txt', datos: bytes('sin comprimir'), comprimir: false },
    { nombre: 'word/document.xml', datos: bytes('comprimida con deflate, acción'), comprimir: true },
  ]);

  test('lista las entradas del directorio central con su método', () => {
    assert.deepEqual(
      entradasDelZip(zip).map((e) => [e.nombre, e.metodo]),
      [
        ['guardada.txt', 0],
        ['word/document.xml', 8],
      ],
    );
  });

  test('abre una entrada guardada y una comprimida, byte a byte', () => {
    assert.equal(leer(extraerDelZip(zip, 'guardada.txt')), 'sin comprimir');
    assert.equal(leer(extraerDelZip(zip, 'word/document.xml')), 'comprimida con deflate, acción');
  });

  test('una entrada que no está se nombra en el error', () => {
    assert.throws(() => extraerDelZip(zip, 'word/otra.xml'), /word\/otra\.xml/u);
  });

  test('lo que no es un zip se rechaza, no se lee como vacío', () => {
    assert.throws(() => entradasDelZip(bytes('esto no es un zip, es un texto')), /zip/u);
  });
});

describe('los párrafos del documento', () => {
  const parrafos = parrafosDelXml(`<w:document><w:body>${CUERPO}</w:body></w:document>`);
  const textos = parrafos.map((x) => x.texto);

  test('un párrafo junta sus runs y desescapa las entidades', () => {
    assert.ok(textos.includes('Revisamos cincuenta y ocho artículos publicados entre 2020 y 2025 en Scopus.'));
    assert.ok(textos.includes('Ricoeur (1996) la llamó identidad narrativa & algo más.'));
    const [uno] = parrafosDelXml(
      '<w:body><w:p><w:r><w:t>a&lt;b &#233;&#xE9; &quot;c&quot; &apos;d&apos;</w:t><w:tab/><w:t>e</w:t></w:r></w:p></w:body>',
    );
    assert.equal(uno?.texto, 'a<b éé "c" \'d\' e');
  });

  test('el nivel de título sale del estilo, y el rótulo en negrita cuenta como título', () => {
    const nivel = (t: string) => parrafos.find((x) => x.texto === t)?.nivel;
    assert.equal(nivel('Resumen'), 1, 'un rótulo corto, entero en negrita, es un título');
    assert.equal(nivel('Abstract'), 1);
    assert.equal(nivel('1. Introducción'), 1, 'Ttulo11 es nivel 1');
    assert.equal(nivel('1.1. Un subtítulo'), 2, 'Ttulo21 es nivel 2');
    assert.equal(nivel('Palabras clave: Narrativa; Escuela.'), 0, 'en negrita solo a medias no es título');
    assert.equal(nivel('Ricoeur (1996) la llamó identidad narrativa & algo más.'), 0);
    // El título del documento está en negrita y es largo: no es un rótulo.
    assert.equal(parrafos[0]?.nivel, 0);
  });

  test('el nivel también sale del nivel de esquema y de los estilos de Word en inglés', () => {
    const [a, b] = parrafosDelXml(
      '<w:body><w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>Tres</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>Dos</w:t></w:r></w:p></w:body>',
    );
    assert.equal(a?.nivel, 3);
    assert.equal(b?.nivel, 2);
  });

  test('los párrafos de una tabla quedan marcados, y los de un cuadro de texto no salen', () => {
    const enTabla = parrafos.filter((x) => x.enTabla).map((x) => x.texto);
    assert.deepEqual(enTabla, ['Carácter autoorganizado', 'Del caos al orden']);
    assert.ok(!textos.some((t) => t.includes('cuadro')), 'el texto del cuadro se coló');
  });

  test('un párrafo vacío no cuenta', () => {
    assert.ok(textos.every((t) => t.trim() !== ''));
  });

  test('un dibujo con texto al lado deja el texto y suelta el del cuadro', () => {
    // El run va antes del último cierre: el primero es el del párrafo del cuadro.
    const xml = `<w:body>${dibujo('del cuadro').replace(/<\/w:p>$/u, '<w:r><w:t>Figura 1</w:t></w:r></w:p>')}</w:body>`;
    assert.deepEqual(
      parrafosDelXml(xml).map((x) => x.texto),
      ['Figura 1'],
    );
  });

  test('el docx se lee entero, desde el zip', () => {
    const desdeDocx = parrafosDelDocx(construirDocx(CUERPO));
    assert.deepEqual(desdeDocx, parrafos);
  });
});

describe('el fragmento: Resumen e Introducción, por título', () => {
  const parrafos = parrafosDelDocx(construirDocx(CUERPO));
  const f = fragmento(parrafos);

  test('va del Resumen hasta antes del apartado 2, sin el Abstract', () => {
    assert.equal(
      f.texto,
      [
        'Resumen',
        'Revisamos cincuenta y ocho artículos publicados entre 2020 y 2025 en Scopus.',
        'Palabras clave: Narrativa; Escuela.',
        '1. Introducción',
        'Ricoeur (1996) la llamó identidad narrativa & algo más.',
        '1.1. Un subtítulo',
        'Bolívar (2014) puso la narrativa en el centro.',
      ].join('\n\n') + '\n',
    );
    assert.doesNotMatch(f.texto, /Abstract|Keywords|Procedimiento/u);
  });

  test('cuenta las palabras de cada sección y del total', () => {
    assert.deepEqual(
      f.secciones.map((s) => [s.titulo, s.palabras]),
      [
        ['Resumen', 17],
        ['1. Introducción', 22],
      ],
    );
    assert.equal(f.palabras, 39);
    assert.equal(f.modo, 'fragmento');
  });

  test('no depende de la posición: una línea más al principio no corre nada', () => {
    const corrido = parrafosDelDocx(construirDocx(p('Una línea más al principio.') + CUERPO));
    assert.equal(fragmento(corrido).texto, f.texto);
  });

  test('sin el título del Resumen, falla como error de uso y lo nombra', () => {
    const sin = parrafos.filter((x) => x.texto !== 'Resumen');
    assert.throws(
      () => fragmento(sin),
      (e: unknown) => e instanceof ErrorDeUso && /Resumen/u.test(e.message),
    );
  });

  test('sin el título de la Introducción, también', () => {
    const sin = parrafos.filter((x) => x.texto !== '1. Introducción');
    assert.throws(
      () => fragmento(sin),
      (e: unknown) => e instanceof ErrorDeUso && /Introducción/u.test(e.message),
    );
  });

  test('un párrafo llano que dice «Resumen» no es el título', () => {
    // Elegir por texto sin mirar el estilo encontraría la palabra en cualquier
    // párrafo que la contenga sola.
    const llano = parrafos.map((x) => (x.texto === 'Resumen' ? { ...x, nivel: 0 } : x));
    assert.throws(() => fragmento(llano), ErrorDeUso);
  });
});

describe('el documento completo y la forma del texto', () => {
  const parrafos = parrafosDelDocx(construirDocx(CUERPO));

  test('el completo deja fuera las tablas y conserva lo demás en orden', () => {
    const c = completo(parrafos);
    assert.equal(c.modo, 'completo');
    assert.match(c.texto, /^Voces que habitan/u);
    assert.match(c.texto, /Abstract[\s\S]*Procedimiento[\s\S]*Cerramos\.\n$/u);
    assert.doesNotMatch(c.texto, /Carácter autoorganizado|Del caos/u);
  });

  test('los títulos van como líneas llanas, sin #', () => {
    assert.doesNotMatch(comoTexto(parrafos), /^#/mu);
  });

  test('el porqué: el verificador rechaza un # al principio de línea como error', () => {
    // Si el texto de entrada llevara los títulos en Markdown, un agente que los
    // conserva tal cual saldría con error en la comprobación del verificador,
    // y la falla sería del ejecutor y no del agente.
    const hallazgos = check('# Resumen\n\nUn texto corto y correcto.\n', { pasadas: [] });
    assert.ok(hallazgos.some((h) => h.rule === 'markdown-en-entrega' && h.severity === 'error'));
  });
});
