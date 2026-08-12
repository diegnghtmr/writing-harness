import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { check, rulesFor } from '../src/check.ts';
import { REPO_ROOT } from '../src/skills.ts';
import { countWords, splitParagraphs, splitSentences } from '../src/text.ts';

const fixture = (name: string) =>
  readFileSync(join(REPO_ROOT, 'evals', 'fixtures', name), 'utf8');

describe('segmentación de texto plano', () => {
  test('separa párrafos por línea en blanco', () => {
    const p = splitParagraphs('Uno.\n\nDos.\n\n\nTres.');
    assert.equal(p.length, 3);
    assert.deepEqual(p.map((x) => x.text), ['Uno.', 'Dos.', 'Tres.']);
  });

  test('una abreviatura no corta la oración', () => {
    // Sin esto, «cap. 1, p. 89» contaría como tres oraciones de dos palabras,
    // y las métricas de longitud darían cualquier cosa.
    const s = splitSentences('Marx lo dice en El capital, cap. 1, p. 89. La distinción importa.');
    assert.equal(s.length, 2);
    assert.match(s[0]!.text, /p\. 89\.$/u);
  });

  test('una inicial suelta tampoco corta', () => {
    const s = splitSentences('Traducción de J. Á. Valente. Alianza publicó esa versión.');
    assert.equal(s.length, 2);
  });

  test('la cola sin punto final cuenta como oración', () => {
    const s = splitSentences('Primera oración. Segunda sin cerrar');
    assert.equal(s.length, 2);
    assert.equal(s[1]!.text, 'Segunda sin cerrar');
  });

  test('cuenta palabras separadas por espacio', () => {
    assert.equal(countWords('  tres  palabras exactas '), 3);
    assert.equal(countWords('   '), 0);
  });
});

describe('capa base', () => {
  test('la raya se marca en todas sus formas', () => {
    const f = check('Uno — dos. Tres – cuatro. Cinco -- seis.');
    const raya = f.filter((x) => x.rule === 'no-raya');
    assert.equal(raya.length, 3);
  });

  test('el guion entre palabras es legítimo y no se marca', () => {
    const f = check('Un enfoque teórico-práctico sobre el análisis histórico-social.');
    assert.deepEqual(f, []);
  });

  test('el punto y coma se marca', () => {
    const f = check('No es evidente; exige distinguir.');
    assert.equal(f.filter((x) => x.rule === 'no-punto-y-coma').length, 1);
  });

  test('el hallazgo trae línea, columna y la línea completa', () => {
    const f = check('Primera línea.\nSegunda con — raya.');
    assert.equal(f.length, 1);
    assert.equal(f[0]!.line, 2);
    assert.equal(f[0]!.excerpt, 'Segunda con — raya.');
    assert.ok(f[0]!.fix.length > 0, 'un hallazgo sin arreglo propuesto no sirve');
  });

  test('la capa base corre sin elegir tono', () => {
    assert.equal(rulesFor().length, 6);
  });

  test('el andamiaje vacío se marca', () => {
    const f = check('Es importante destacar que los datos muestran una caída.');
    assert.equal(f.filter((x) => x.rule === 'andamiaje-vacio').length, 1);
  });

  test('las aperturas de molde se marcan', () => {
    const f = check('En la actualidad, hoy en día, el fenómeno crece.');
    assert.equal(f.filter((x) => x.rule === 'aperturas-de-molde').length, 2);
  });

  test('los cierres anunciados se marcan', () => {
    const f = check('En conclusión, el modelo funciona.');
    assert.equal(f.filter((x) => x.rule === 'cierres-anunciados').length, 1);
  });

  test('los emojis y los hashtags se marcan, pero no una numeración', () => {
    const conEmoji = check('El resultado fue bueno 🎉 y se publicó en #ciencia.');
    assert.equal(conEmoji.filter((x) => x.rule === 'emojis-y-hashtags').length, 2);
    assert.deepEqual(check('La opción #1 quedó descartada.'), []);
  });

  test('una frase prohibida dentro de otra palabra no se marca', () => {
    // Sin los lookarounds sobre \p{L}, el límite de palabra de JavaScript
    // parte los acentos y «síntesis» dispararía «en síntesis».
    assert.deepEqual(check('La síntesis del capítulo es breve.'), []);
    assert.deepEqual(check('Resumiendo mal se pierde información.').length > 0, true);
  });

  test('la frase prohibida se detecta aunque cambie el espaciado', () => {
    const f = check('Es  importante\ndestacar que sí.');
    assert.equal(f.filter((x) => x.rule === 'andamiaje-vacio').length, 1);
  });
});

describe('capa de tono', () => {
  const larga =
    'Como dentro de una sociedad mercantil los seres humanos producen de manera separada e independiente, y como el carácter social de ese trabajo solo se manifiesta al intercambiar mercancías que son resultado del trabajo concreto y heterogéneo de muchos productores distintos, se hace necesario igualar los distintos tipos de trabajo.';

  test('camus marca la oración que pasa de 30 palabras', () => {
    const f = check(larga, { tone: 'camus' });
    const largas = f.filter((x) => x.rule === 'oracion-maxima');
    assert.equal(largas.length, 1);
    assert.match(largas[0]!.message, /Tiene \d+\./u);
  });

  test('sin tono, esa misma oración no se mide', () => {
    // Las longitudes son decisión de tono, no norma. La base no opina.
    assert.deepEqual(check(larga), []);
  });

  test('catedra tolera la oración larga a propósito', () => {
    assert.deepEqual(check(larga, { tone: 'catedra' }), []);
  });

  test('un tono inexistente falla en vez de pasar en silencio', () => {
    assert.throws(() => check('texto', { tone: 'inventado' }), /tono desconocido/u);
  });
});

describe('fixtures', () => {
  test('el fixture sucio incumple lo que dice incumplir', () => {
    const f = check(fixture('sucio.txt'), { tone: 'camus' });
    const porRegla = new Map<string, number>();
    for (const x of f) porRegla.set(x.rule, (porRegla.get(x.rule) ?? 0) + 1);
    assert.deepEqual(
      Object.fromEntries([...porRegla].sort()),
      { 'no-punto-y-coma': 1, 'no-raya': 2, 'oracion-maxima': 1 },
    );
  });

  test('el fixture limpio no da ningún hallazgo', () => {
    // Es la mitad que de verdad protege: sin ella, una regla demasiado ancha
    // pasaría los tests marcando todo.
    assert.deepEqual(check(fixture('limpio.txt'), { tone: 'camus' }), []);
  });

  test('los dos fixtures dicen lo mismo, y solo cambia la forma', () => {
    const palabras = (s: string) =>
      s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/u).filter(Boolean);
    const limpio = new Set(palabras(fixture('limpio.txt')));
    const comunes = palabras(fixture('sucio.txt')).filter((w) => limpio.has(w));
    assert.ok(
      comunes.length / palabras(fixture('sucio.txt')).length > 0.6,
      'el fixture limpio se alejó del sucio: dejó de ser la misma prosa arreglada',
    );
  });
});
