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
    assert.equal(rulesFor().length, 8);
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

describe('capa de pasada', () => {
  const conSenales = 'Los expertos señalan que sin más preámbulo hay que actuar.';

  test('el catálogo no corre solo', () => {
    // humanizar-espanol es una pasada, no un tono. La skill solo se activa si
    // se pide con esas palabras, y el verificador hace lo mismo.
    assert.deepEqual(check(conSenales), []);
  });

  test('corre cuando se lo pide', () => {
    const f = check(conSenales, { pasadas: ['humanizar'] });
    assert.deepEqual(
      f.map((x) => x.rule).sort(),
      ['atribuciones-vagas', 'senalizacion'],
    );
  });

  test('una pasada inexistente falla en vez de pasar en silencio', () => {
    assert.throws(() => check('texto', { pasadas: ['inventada'] }), /pasada desconocida/u);
  });

  test('los artefactos de chatbot se marcan', () => {
    const f = check('Aquí tienes el resumen. Avísame si querés que amplíe.', {
      pasadas: ['humanizar'],
    });
    assert.equal(f.filter((x) => x.rule === 'artefactos-de-chatbot').length, 2);
  });

  test('el relleno especulativo se marca', () => {
    const f = check('Se cree que mantiene un perfil bajo.', { pasadas: ['humanizar'] });
    assert.equal(f.filter((x) => x.rule === 'avisos-de-corte').length, 2);
  });

  test('lo dudoso se marca como advertencia, no como error', () => {
    const f = check('El museo se erige como referencia en el ámbito.', { pasadas: ['humanizar'] });
    const copula = f.find((x) => x.rule === 'evitacion-de-copula');
    assert.equal(copula?.severity, 'warning');
  });

  test('«Mira» queda fuera de las aperturas retóricas a propósito', () => {
    // El catálogo la lista, pero como palabra suelta es un verbo corriente y
    // marcaría media prosa legítima. Una regla que grita en falso deja de leerse.
    assert.deepEqual(check('Mira el gráfico de la página 4.', { pasadas: ['humanizar'] }), []);
    assert.equal(
      check('Seamos sinceros, el dato no cambia.', { pasadas: ['humanizar'] }).length,
      1,
    );
  });
});

describe('reglas estructurales', () => {
  const conPasada = { pasadas: ['humanizar'] } as const;

  test('dos oraciones cortas seguidas son ritmo, tres son staccato', () => {
    // El SKILL.md fija los dos números: «no encadenar más de dos oraciones
    // cortas» y «oraciones breves de seis a diez palabras».
    const dos = 'Llegó tarde. No importó. Después de esa demora el comité decidió posponer la votación hasta el jueves siguiente.';
    assert.deepEqual(check(dos, conPasada).filter((x) => x.rule === 'staccato'), []);

    const tres = 'Llegó tarde. No importó. Nadie dijo nada. Después de esa demora el comité decidió posponer la votación hasta el jueves.';
    const f = check(tres, conPasada).filter((x) => x.rule === 'staccato');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Hay 3 de 10 palabras o menos\./u);
  });

  test('la racha no cruza el corte de párrafo', () => {
    // Un punto y aparte reinicia el ritmo. Encadenar a través de él no es lo
    // que describe el patrón.
    const repartido = 'Llegó tarde. No importó.\n\nNadie dijo nada. Tampoco hacía falta.';
    assert.deepEqual(check(repartido, conPasada).filter((x) => x.rule === 'staccato'), []);
  });

  test('el párrafo que abre con etiqueta corta y cópula se marca', () => {
    const f = check('La sociedad es la estructura. Designa el conjunto de personas que conviven en un territorio y mantienen relaciones estables.', conPasada);
    const ap = f.filter((x) => x.rule === 'apertura-de-etiqueta');
    assert.equal(ap.length, 1);
    assert.match(ap[0]!.message, /la primera oración del texto/u);
  });

  test('una apertura larga no se marca aunque lleve cópula', () => {
    const largo = 'Cuando hablamos de sociedad nos referimos al entramado de relaciones que es sostenido por quienes conviven en un territorio.';
    assert.deepEqual(check(largo, conPasada).filter((x) => x.rule === 'apertura-de-etiqueta'), []);
  });

  test('una frase corta dentro del párrafo es legítima', () => {
    // El patrón 37 dice: «Si quieres una frase corta, ponla dentro del párrafo,
    // no al inicio».
    const dentro = 'Cuando hablamos de sociedad nos referimos al entramado de relaciones estables entre personas. Eso es todo.';
    assert.deepEqual(check(dentro, conPasada).filter((x) => x.rule === 'apertura-de-etiqueta'), []);
  });

  test('dos oraciones seguidas que abren con conector formal se marcan', () => {
    const f = check('Además, el dato confirma la hipótesis previa del estudio. Asimismo, el margen de error resulta menor que el declarado.');
    assert.equal(f.filter((x) => x.rule === 'conectores-de-molde-seguidos').length, 1);
  });

  test('un conector formal aislado no se marca', () => {
    // `que-preservar.md` lo dice: un solo «sin embargo» no delata nada.
    const f = check('Sin embargo, el dato confirma la hipótesis. El margen resulta menor que el declarado en el informe.');
    assert.deepEqual(f.filter((x) => x.rule === 'conectores-de-molde-seguidos'), []);
  });

  test('el markdown en el texto entregado se marca', () => {
    const f = check('- **Rendimiento:** mejora el tiempo de respuesta.');
    assert.ok(f.filter((x) => x.rule === 'markdown-en-entrega').length > 0);
  });

  test('el gerundio apilado se marca solo colgado tras coma', () => {
    const colgado = check('La paleta usa azules y verdes, reflejando el vínculo con la tierra.', conPasada);
    assert.equal(colgado.filter((x) => x.rule === 'gerundios-apilados').length, 1);

    const alInicio = check('Reflejando lo anterior, el comité aprobó el cambio propuesto en la sesión.', conPasada);
    assert.deepEqual(alInicio.filter((x) => x.rule === 'gerundios-apilados'), []);
  });

  test('el paralelismo negativo se marca como advertencia', () => {
    const f = check('No solo importa el ritmo sino también la atmósfera del conjunto.', conPasada);
    const par = f.find((x) => x.rule === 'paralelismos-negativos');
    assert.equal(par?.severity, 'warning');
  });

  test('el párrafo largo es error y el corto advertencia', () => {
    const largo = `${'palabra '.repeat(160)}final.`;
    const fLargo = check(largo, { tone: 'camus' }).find((x) => x.rule === 'parrafo-maximo');
    assert.equal(fLargo?.severity, 'error');

    const corto = 'Un párrafo breve de transición que no llega a las cincuenta palabras.';
    const fCorto = check(corto, { tone: 'camus' }).find((x) => x.rule === 'parrafo-minimo');
    assert.equal(fCorto?.severity, 'warning');
  });

  test('catedra no hereda los límites de párrafo de camus', () => {
    const corto = 'Un párrafo breve de transición que no llega a las cincuenta palabras.';
    assert.deepEqual(check(corto, { tone: 'catedra' }), []);
  });
});

describe('densidad de vocabulario de IA', () => {
  // El catálogo es explícito: «No están prohibidas de forma absoluta, pero su
  // acumulación es una firma». Modelarlo como prohibición plana contradiría el
  // texto que la regla dice hacer cumplir.
  const opts = { pasadas: ['humanizar'] } as const;

  test('dos términos no alcanzan', () => {
    const f = check('El paradigma es robusto.', opts);
    assert.deepEqual(f.filter((x) => x.rule === 'vocabulario-de-ia'), []);
  });

  test('tres términos distintos en un párrafo sí', () => {
    const f = check('El paradigma robusto permite abordar el problema.', opts);
    const d = f.filter((x) => x.rule === 'vocabulario-de-ia');
    assert.equal(d.length, 1);
    assert.match(d[0]!.message, /Hay 3: abordar, paradigma, robusto\./u);
  });

  test('repetir el mismo término no cuenta como acumulación', () => {
    // Se miden términos distintos. Repetir una palabra es otro problema.
    const f = check('El paradigma es un paradigma y sigue siendo un paradigma.', opts);
    assert.deepEqual(f.filter((x) => x.rule === 'vocabulario-de-ia'), []);
  });

  test('se mide por párrafo, no por texto entero', () => {
    const repartido = 'El paradigma manda.\n\nEs robusto.\n\nHay que abordar eso.';
    assert.deepEqual(check(repartido, opts).filter((x) => x.rule === 'vocabulario-de-ia'), []);
  });
});

describe('fixtures', () => {
  test('el fixture sucio incumple lo que dice incumplir', () => {
    const f = check(fixture('sucio.txt'), { tone: 'camus', pasadas: ['humanizar'] });
    const porRegla = new Map<string, number>();
    for (const x of f) porRegla.set(x.rule, (porRegla.get(x.rule) ?? 0) + 1);
    assert.deepEqual(
      Object.fromEntries([...porRegla].sort()),
      {
        'apertura-de-etiqueta': 1,
        'no-punto-y-coma': 1,
        'no-raya': 2,
        'oracion-maxima': 1,
        staccato: 1,
      },
    );
  });

  test('el fixture limpio no da ningún hallazgo', () => {
    // Es la mitad que de verdad protege: sin ella, una regla demasiado ancha
    // pasaría los tests marcando todo.
    assert.deepEqual(check(fixture('limpio.txt'), { tone: 'camus', pasadas: ['humanizar'] }), []);
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
