// Las tres clases de regla que miden el ritmo por números.
//
// Existen porque seis de los once tonos de entonces declaraban su forma en cifras y ninguna
// clase anterior las medía. La prueba cruzada lo dijo en números: nueve columnas
// planas sobre catorce, y despues seis sobre once. Un tono sin reglas no
// discrimina, y un enrutamiento que lleva a un tono que no discrimina reparte
// texto entre skills que dan todas el mismo veredicto.
//
// Cada clase se prueba en las dos direcciones, que es lo único que separa una
// regla de una decoración: dispara sobre lo que dice cazar y calla sobre lo que
// no. Una regla estadística sin la segunda mitad marca todo y se deja de leer al
// segundo aviso.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check } from '../src/check.ts';
import { TONES } from '../src/rules.ts';
import { readSkill } from '../src/skills.ts';

/** Arma un texto con las longitudes pedidas, en un solo párrafo. */
function conLongitudes(largos: readonly number[]): string {
  return largos.map((n) => `${Array.from({ length: n }, () => 'palabra').join(' ')}.`).join(' ');
}

const solo = (texto: string, tone: string, regla: string) =>
  check(texto, { tone }).filter((f) => f.rule === regla);

describe('sentence-length-band: qué proporción del texto cae en una banda', () => {
  test('dispara cuando faltan las breves que el tono declara', () => {
    // freddy pide una de cada tres entre 3 y 10 palabras. Doce oraciones de
    // veinte no tienen ninguna.
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 20)), 'freddy', 'freddy-banda-corta');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 12 oraciones \(0 %\)/u);
    assert.match(f[0]!.message, /al menos el 33 %/u);
  });

  test('calla cuando la proporción se cumple', () => {
    const mezcla = [5, 20, 6, 22, 8, 25, 7, 21, 9, 24, 4, 19];
    assert.deepEqual(solo(conLongitudes(mezcla), 'freddy', 'freddy-banda-corta'), []);
  });

  test('el piso de oraciones impide el falso positivo sobre un texto corto', () => {
    // Cuatro oraciones largas no son un perfil, son cuatro oraciones. Sin piso,
    // cualquier párrafo suelto quedaría marcado.
    assert.deepEqual(solo(conLongitudes([20, 20, 20, 20]), 'freddy', 'freddy-banda-corta'), []);
  });

  test('la banda sin techo cuenta de su mínimo en adelante', () => {
    // bettatech pide un cuarto del texto por encima de 31 palabras.
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 22)), 'bettatech', 'bettatech-cuartil-largo');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /de 32 en adelante palabras/u);
  });
});

describe('sentence-length-mean: la media dentro de la banda declarada', () => {
  test('dispara por debajo de la banda', () => {
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 10)), 'bettatech', 'bettatech-media-oracion');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /La media es 10\.0 y la banda declarada va de 20 a 26/u);
  });

  test('dispara por encima de la banda', () => {
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => 40)), 'bettatech', 'bettatech-media-oracion');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /La media es 40\.0/u);
  });

  test('calla dentro de la banda', () => {
    assert.deepEqual(
      solo(conLongitudes(Array.from({ length: 12 }, () => 23)), 'bettatech', 'bettatech-media-oracion'),
      [],
    );
  });
});

describe('long-sentence-run: la cadena de oraciones largas', () => {
  test('dispara con cuatro largas seguidas, que fonseca prohíbe', () => {
    const f = solo(conLongitudes([35, 35, 35, 35]), 'fonseca', 'fonseca-cuatro-largas');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Hay 4 de 30 palabras o más/u);
  });

  test('calla con tres, que es lo que tolera', () => {
    assert.deepEqual(solo(conLongitudes([35, 35, 35, 8]), 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('una breve en medio corta la racha', () => {
    assert.deepEqual(solo(conLongitudes([35, 35, 8, 35, 35]), 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('la racha no cruza el corte de párrafo', () => {
    // Un punto y aparte reinicia el ritmo, igual que en la racha corta. Sin
    // esto, dos párrafos que abren y cierran largo se marcarían como cadena.
    const dos = `${conLongitudes([35, 35])}\n\n${conLongitudes([35, 35])}`;
    assert.deepEqual(solo(dos, 'fonseca', 'fonseca-cuatro-largas'), []);
  });

  test('dotcsv tolera menos: dos largas seguidas ya exigen una corta', () => {
    assert.equal(solo(conLongitudes([35, 35, 35]), 'dotcsv', 'dotcsv-largas-seguidas').length, 1);
    assert.deepEqual(solo(conLongitudes([35, 35, 8]), 'dotcsv', 'dotcsv-largas-seguidas'), []);
  });
});

// El tono nuevo pide longitud donde los otros doce la acotan, asi que sus dos
// reglas de oracion se prueban al reves que las de arriba: lo que dispara es un
// texto demasiado corto, no uno demasiado largo.
describe('triangulacion: el primer tono que exige periodo largo', () => {
  const LARGA = 34;
  const CORTA = 12;

  test('dispara cuando el texto se queda en afirmaciones sueltas', () => {
    // Doce oraciones de doce palabras: ninguna pasa de treinta, y el tono pide
    // que una de cada cinco lo haga.
    const f = solo(conLongitudes(Array.from({ length: 12 }, () => CORTA)), 'triangulacion', 'triangulacion-oracion-larga');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 12 oraciones \(0 %\)/u);
  });

  test('calla cuando el periodo largo esta', () => {
    // Cinco de doce por encima de treinta, holgadamente sobre el piso del 20 %.
    const mezcla = [LARGA, CORTA, LARGA, CORTA, LARGA, CORTA, LARGA, CORTA, LARGA, CORTA, CORTA, CORTA];
    assert.deepEqual(solo(conLongitudes(mezcla), 'triangulacion', 'triangulacion-oracion-larga'), []);
  });

  test('la media dispara por los dos lados, que es lo que hace una banda', () => {
    const corto = solo(conLongitudes(Array.from({ length: 12 }, () => 14)), 'triangulacion', 'triangulacion-media-oracion');
    assert.equal(corto.length, 1, 'una media de 14 esta por debajo del piso de 21');
    const largo = solo(conLongitudes(Array.from({ length: 12 }, () => 40)), 'triangulacion', 'triangulacion-media-oracion');
    assert.equal(largo.length, 1, 'una media de 40 pasa el techo de 32');
    assert.deepEqual(
      solo(conLongitudes(Array.from({ length: 12 }, () => 26)), 'triangulacion', 'triangulacion-media-oracion'),
      [],
      'una media de 26 es la del corpus y no puede marcarse',
    );
  });

  test('el parrafo lleva piso y no techo, al reves que los demas tonos', () => {
    // La otra mitad de lo mismo. `camus` marca el parrafo que pasa de 150
    // palabras; este marca el que no llega a 40.
    const corto = check('Una afirmacion corta que no sostiene nada de nada.', { tone: 'triangulacion' })
      .filter((f) => f.rule === 'triangulacion-parrafo-desarrolla');
    assert.equal(corto.length, 1);
    const largo = check(conLongitudes([30, 30]), { tone: 'triangulacion' })
      .filter((f) => f.rule === 'triangulacion-parrafo-desarrolla');
    assert.deepEqual(largo, [], 'sesenta palabras pasan el piso de cuarenta');
  });

  test('paragraph-length-spread: marca los parrafos que miden todos lo mismo', () => {
    // El defecto real, reducido: ocho parrafos del mismo tamano. El corpus del
    // que salen las cifras de este tono reparte los suyos entre 26 y 301
    // palabras, con una variacion del 48 %.
    const parrafo = conLongitudes([30, 30, 30, 30]);
    const uniforme = Array.from({ length: 8 }, () => parrafo).join('\n\n');
    const f = solo(uniforme, 'triangulacion', 'triangulacion-parrafo-disperso');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Var[íi]an un 0 %/u);
  });

  test('paragraph-length-spread: calla en cuanto uno rompe el patron', () => {
    // La otra direccion, y con el margen justo: siete parrafos iguales y uno
    // corto bastan. La regla pide que algo se salga, no una dispersion alta.
    const parrafo = conLongitudes([30, 30, 30, 30]);
    const variado = [...Array.from({ length: 7 }, () => parrafo), conLongitudes([12])].join('\n\n');
    assert.deepEqual(solo(variado, 'triangulacion', 'triangulacion-parrafo-disperso'), []);
  });

  test('paragraph-length-spread: no mide un texto de pocos parrafos', () => {
    // Con menos de seis la cifra es ruido. Cinco parrafos identicos pasan, y es
    // deliberado: en un texto corto no hay nada que dispersar.
    const parrafo = conLongitudes([30, 30, 30, 30]);
    const pocos = Array.from({ length: 5 }, () => parrafo).join('\n\n');
    assert.deepEqual(solo(pocos, 'triangulacion', 'triangulacion-parrafo-disperso'), []);
  });

  test('paragraph-length-spread: una linea suelta no cuenta como parrafo corto', () => {
    // El canario. Si contara, un titulo o una firma inflarian la dispersion
    // justo en los textos que no la tienen, y la regla se volveria decorativa.
    const parrafo = conLongitudes([30, 30, 30, 30]);
    const conTitulo = ['Sobre el asunto', ...Array.from({ length: 8 }, () => parrafo)].join('\n\n');
    assert.equal(solo(conTitulo, 'triangulacion', 'triangulacion-parrafo-disperso').length, 1);
  });

  test('la glosa entre parentesis se pide, y la referencia no cuenta como glosa', () => {
    // Doce oraciones largas sin un solo parentesis: el defecto real, porque el
    // texto que este arnes producia con este tono traia cero glosas y el corpus
    // trae 63, una cada 194 palabras.
    const sinGlosa = conLongitudes(Array.from({ length: 12 }, () => 26));
    assert.equal(solo(sinGlosa, 'triangulacion', 'triangulacion-glosa').length, 1);

    // El canario, y hace falta: el corpus trae 67 parentesis de referencia y 35
    // de glosa, con el mismo signo. Sin distinguirlos, un texto que solo cite
    // fuentes pasaria como si estuviera glosando.
    const soloCitas = sinGlosa + ' Una afirmacion con fuente (Ibid., p. 19) y otra (op. cit.) y otra mas (2012, p. 94).';
    assert.equal(solo(soloCitas, 'triangulacion', 'triangulacion-glosa').length, 1);

    const conGlosa = sinGlosa + ' Las formas (gestalten) ordenan el caos sensible en fenomenos (percepciones).';
    assert.deepEqual(solo(conGlosa, 'triangulacion', 'triangulacion-glosa'), []);
  });

  test('el adverbio en -mente se pide variado, no repetido', () => {
    const base = conLongitudes(Array.from({ length: 12 }, () => 26));
    assert.equal(solo(base, 'triangulacion', 'triangulacion-adverbio-variado').length, 1);

    // Cuatro veces el mismo no alcanza, que es justo el vicio del rasgo: el
    // corpus trae 63 formas distintas para 97 apariciones.
    const repetido = base + ' Ciertamente. Ciertamente. Ciertamente. Ciertamente.';
    assert.equal(solo(repetido, 'triangulacion', 'triangulacion-adverbio-variado').length, 1);

    const variado = base + ' Requiere inexorablemente. Delimita ciertamente. Organiza instantaneamente. Gradua puntualmente.';
    assert.deepEqual(solo(variado, 'triangulacion', 'triangulacion-adverbio-variado'), []);
  });

  test('el repertorio de conectores se mide por variedad y no por cantidad', () => {
    // Doce oraciones que abren siempre con el mismo enlace. Hay densidad y no
    // hay repertorio, y es justo la muletilla que la seccion 8 de la skill
    // llama metodo con aspecto de metodo.
    const uno = Array.from({ length: 12 }, () => 'Por ende ' + Array.from({ length: 25 }, () => 'palabra').join(' ') + '.').join(' ');
    const f = solo(uno, 'triangulacion', 'triangulacion-conectores-variados');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Se esperaban 5, hay 1/u);

    const varios = ['Por ende', 'No obstante', 'En consecuencia', 'De hecho', 'Del mismo modo', 'En suma']
      .map((c) => c + ' ' + Array.from({ length: 25 }, () => 'palabra').join(' ') + '.')
      .concat(Array.from({ length: 6 }, () => conLongitudes([25])))
      .join(' ');
    assert.deepEqual(solo(varios, 'triangulacion', 'triangulacion-conectores-variados'), []);
  });
});

describe('paragraph-opening-ratio: cuántos párrafos declaran su relación con el anterior', () => {
  const parrafo = conLongitudes([30, 30]);
  const conEnlace = (enlace: string) => `${enlace}, ${conLongitudes([30, 30])}`;

  test('dispara cuando ningún párrafo abre con conector', () => {
    // El defecto real. Con la §6.2 escrita solo en prosa, tres textos seguidos
    // salieron con uno de cada ocho contra el 32,2 % del corpus.
    const plano = Array.from({ length: 8 }, () => parrafo).join('\n\n');
    const f = solo(plano, 'triangulacion', 'triangulacion-parrafo-encadenado');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 7 p[áa]rrafos, 0 %/u);
    assert.match(f[0]!.message, /el m[íi]nimo es 16 %/u);
  });

  test('calla cuando la proporción se cumple', () => {
    const encadenado = [
      parrafo,
      conEnlace('No obstante'),
      parrafo,
      parrafo,
      conEnlace('Por el contrario'),
      parrafo,
      parrafo,
      parrafo,
    ].join('\n\n');
    assert.deepEqual(solo(encadenado, 'triangulacion', 'triangulacion-parrafo-encadenado'), []);
  });

  test('el primer párrafo no entra en la cuenta, porque no tiene anterior', () => {
    // El canario del denominador. Ocho párrafos con el único enlace en el
    // primero: ese enlace no declara ninguna relación, ya que no hay nada
    // antes, y contarlo dejaría pasar un texto que no encadena nada.
    const soloElPrimero = [conEnlace('No obstante'), ...Array.from({ length: 7 }, () => parrafo)].join('\n\n');
    const f = solo(soloElPrimero, 'triangulacion', 'triangulacion-parrafo-encadenado');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 7 p[áa]rrafos/u);
  });

  test('«según» y «pese a» no cuentan como enlace, porque enmarcan y no encadenan', () => {
    // El inventario es estrecho a propósito. Los dos abren oración con aire de
    // conector y no dicen nada sobre el párrafo anterior; premiarlos volvería la
    // regla un detector de aperturas formales.
    const enmarcado = [
      parrafo,
      conEnlace('Según el autor citado'),
      conEnlace('Pese a lo anterior'),
      parrafo,
      parrafo,
      parrafo,
      parrafo,
      parrafo,
    ].join('\n\n');
    assert.equal(solo(enmarcado, 'triangulacion', 'triangulacion-parrafo-encadenado').length, 1);
  });

  test('no mide un texto de pocos párrafos', () => {
    const pocos = Array.from({ length: 6 }, () => parrafo).join('\n\n');
    assert.deepEqual(solo(pocos, 'triangulacion', 'triangulacion-parrafo-encadenado'), []);
  });

  test('una línea suelta no cuenta como párrafo sin encadenar', () => {
    // Mismo canario que en la dispersión: un título en el denominador bajaría
    // la proporción de un texto que sí encadena.
    const conTitulo = [
      'Sobre el asunto',
      parrafo,
      conEnlace('No obstante'),
      parrafo,
      parrafo,
      conEnlace('En consecuencia'),
      parrafo,
      parrafo,
    ].join('\n\n');
    assert.deepEqual(solo(conTitulo, 'triangulacion', 'triangulacion-parrafo-encadenado'), []);
  });
});

describe('pattern-ratio-floor: el piso que la base no puede dar', () => {
  test('dispara cuando el texto no lleva punto y coma', () => {
    const sinJunta = conLongitudes(Array.from({ length: 12 }, () => 26));
    const f = solo(sinJunta, 'triangulacion', 'triangulacion-punto-y-coma');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 12 oraciones, 0 %/u);
    assert.match(f[0]!.message, /el m[íi]nimo es 8 %/u);
  });

  test('calla con uno solo cada doce oraciones', () => {
    const doce = Array.from({ length: 11 }, () => conLongitudes([26])).join(' ');
    const conJunta = `${doce} La mente ordena la realidad para interpretarla; apoyandose en lo que el sujeto ya cree saber.`;
    assert.deepEqual(solo(conJunta, 'triangulacion', 'triangulacion-punto-y-coma'), []);
  });

  test('no mide un texto de pocas oraciones', () => {
    const pocas = conLongitudes(Array.from({ length: 11 }, () => 26));
    assert.deepEqual(solo(pocas, 'triangulacion', 'triangulacion-punto-y-coma'), []);
  });

  test('el piso del tono deja sitio bajo el techo de la base', () => {
    // Un tono no puede pedir lo que la base castiga. El piso está en el 8 % y
    // `spanish-writing` §6.7 pone el techo en el 20 %: un texto que cumpla el
    // piso justo no puede estar disparando el techo, y este canario lo fija.
    const doce = Array.from({ length: 11 }, () => conLongitudes([26])).join(' ');
    const conJunta = `${doce} La mente ordena la realidad para interpretarla; apoyandose en lo que el sujeto ya cree saber.`;
    assert.deepEqual(
      check(conJunta, { tone: 'triangulacion' }).filter((f) => f.rule === 'punto-y-coma-abusado'),
      [],
    );

    // Y la otra mitad, sin la cual el canario anterior no comprueba nada: el
    // techo de la base existe y dispara de verdad cuando se lo pasa.
    const abusado = Array.from({ length: 12 }, () => 'Una afirmacion cualquiera; y su continuacion.').join(' ');
    assert.equal(
      check(abusado, { tone: 'triangulacion' }).filter((f) => f.rule === 'punto-y-coma-abusado').length,
      1,
    );
  });
});

describe('ahora los trece tonos discriminan', () => {
  test('ninguno se queda sin reglas', () => {
    // Es la condición que hacía caducar el motivo del enrutamiento, y por eso
    // se comprueba también acá: es el hecho que estas reglas vinieron a cambiar.
    const sinReglas = Object.values(TONES).filter((t) => t.rules.length === 0).map((t) => t.id);
    assert.deepEqual(sinReglas, []);
  });

  test('atenas se queda con una sola regla de ritmo, y es correcto', () => {
    // Es el único que casi no dispara sobre prosa real, y no es un hueco. Su
    // §6.5 dice que su corpus no permite medir oraciones: «Cualquier cifra de
    // oración o de párrafo extraída de ahí sería un artefacto del
    // transcriptor», y añade que «no hay techo fijo de oración».
    //
    // Lo único que declara es cualitativo, la alternancia de tramos largos con
    // golpes cortos, y eso es exactamente lo que su regla mide. Ponerle una
    // banda o una media sería inventar una medición que la skill se niega a
    // hacer, que es peor que no tener regla.
    const reglas = TONES.atenas?.rules ?? [];
    assert.deepEqual(reglas.map((r) => r.kind), ['sentence-length-spread']);
    const fuente = readSkill('atenas-writing');
    assert.match(fuente, /sería un artefacto del\s+transcriptor/u);
    assert.match(fuente, /no hay\s+techo fijo de oración/u);
  });

  test('cada tono marca algo sobre un texto plano que no es de nadie', () => {
    // Doce oraciones iguales de quince palabras: sin breves, sin largas, sin
    // alternancia. Ningún tono declara esa forma, así que ninguno debería
    // certificarla en silencio.
    const plano = conLongitudes(Array.from({ length: 12 }, () => 15));
    const mudos = Object.keys(TONES).filter((id) => {
      const propias = new Set(TONES[id]?.rules.map((r) => r.id));
      return !check(plano, { tone: id }).some((f) => propias.has(f.rule));
    });
    assert.deepEqual(
      mudos,
      [],
      'estos tonos no dijeron nada sobre un texto sin forma, así que su capa no está midiendo',
    );
  });
});
