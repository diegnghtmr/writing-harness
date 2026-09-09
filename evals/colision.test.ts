// Un tono no puede pedir con una regla lo que la base castiga con otra.
//
// El defecto ocurrió. `triangulacion-conectores-variados` exige cinco enlaces
// distintos de un repertorio de veintiséis, y dos de esos veintiséis eran «en
// síntesis» y «en definitiva», que la base rechaza como `cierres-anunciados`
// con severidad error. El corpus medido los usa, así que entraron al repertorio
// por la vía correcta (se midieron) y nadie los cruzó contra la base.
//
// Quien escribiera un texto de ese tono podía cumplir la regla del tono y
// ganarse dos errores de la base por hacerlo. No es una contradicción que
// bloquee nada (había veinticuatro alternativas más), pero sí una instrucción
// que se contradice a sí misma, que es peor: el que la lee no sabe cuál obedecer.
//
// El censo que lo encontró es el que corre acá, y encontró exactamente esos dos
// casos en las listas de tono de entonces. Ahora corre siempre.
//
// **Por qué la base gana y no el tono.** Un tono se suma a la base y no la
// corrige; está escrito en la sección 2 de cada skill de tono. De modo que
// cuando el corpus de un tono trae un rasgo que la base prohíbe, lo que se hace
// es sacarlo del tono y decir en la prosa que se sacó, no abrirle una excepción.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check, rulesFor } from '../src/check.ts';
import { TONE_IDS, TONES } from '../src/rules.ts';

/**
 * Las alternativas literales de un `must-contain`.
 *
 * Solo se quedan las que son texto llano. Una alternativa con clases o
 * cuantificadores no se puede convertir en frase de prueba sin inventarle un
 * ejemplo, y un ejemplo inventado probaría lo que uno quisiera.
 */
function alternativasLiterales(re: RegExp): string[] {
  // La lista va donde el patrón la ponga. La primera versión de esta función
  // recortaba a mano el prefijo `\b(?:` y el sufijo `)\b`, que era la única
  // forma que existía entonces, y cuando llegó un patrón anclado con `^(?:…)`
  // seguido de `(?:,|\s)` los recortes no encajaron: el cuerpo quedó entero, y
  // al partirlo por barras la primera alternativa salió pegada al prefijo y la
  // última al sufijo. Las dos dejaban de parecer texto llano y el filtro las
  // tiraba, de modo que el censo no probaba nunca ni «no obstante» ni «de lo
  // contrario» sobre las dos reglas que este archivo acababa de incorporar.
  //
  // Se descubrió leyendo, no con el canario, y por una razón que conviene
  // guardar: el canario planta «en definitiva», que cae en mitad de la lista y
  // por eso sobrevivía al recorte. Un canario plantado en el medio no prueba
  // los extremos.
  //
  // Ahora la lista se saca del primer grupo del patrón, esté donde esté, y las
  // clases de un carácter con sus variantes de acento se resuelven a su primera
  // opción en vez de descartarse: «adem[áa]s» vale «además», que es una frase de
  // prueba legítima y no un ejemplo inventado.
  const grupo = /\(\?:([^)]*)\)/u.exec(re.source);
  const cuerpo = grupo ? (grupo[1] as string) : re.source;
  return cuerpo
    .split('|')
    .map((a) =>
      a
        // Una clase de acentos vale su primera opción: «adem[áa]s» es «además».
        .replace(/\[(.)[^\]]*\]/gu, '$1')
        // Y el separador de palabras vale un espacio: «me\s+consta» es «me
        // consta». Sin esto, catorce de las veintiséis alternativas de
        // `fonda-primera-persona` no se probaban nunca, que es un hueco anterior
        // a este archivo y del mismo tamaño que el que lo motivó.
        .replace(/\\s\+/gu, ' '),
    )
    .filter((a) => /^[a-záéíóúñü ]+$/iu.test(a));
}

/** Los errores que la capa base sola le pone a una frase. */
function erroresDeLaBase(frase: string): string[] {
  return check(frase, { rules: rulesFor() })
    .filter((h) => h.severity === 'error')
    .map((h) => h.rule);
}

/** La frase mínima en que probar una alternativa: el enlace y algo detrás. */
const enFrase = (a: string) => `${a[0]?.toUpperCase()}${a.slice(1)}, el asunto quedó dicho.`;

/**
 * Las clases de regla que premian, que son las que pueden chocar con la base.
 *
 * Una regla que prohíbe no choca nunca: sumar una prohibición a otra no
 * contradice a nadie. La que choca es la que EXIGE, porque puede exigir algo que
 * la base castiga, y entonces el que lea las dos capas no sabe cuál obedecer.
 *
 * **Este conjunto empezó teniendo solo `must-contain` y el hueco se usó.** Al
 * agregarse dos clases nuevas que también premian, una de ellas entró con «en
 * definitiva» en su inventario, que la base rechaza con severidad error, y este
 * gate pasó en verde porque no la miraba. La lección va en el nombre: lo que
 * decide si una regla entra acá no es su clase, es si premia.
 */
const CLASES_QUE_PREMIAN = new Set(['must-contain', 'pattern-ratio-floor', 'paragraph-opening-ratio']);

describe('ningún tono premia lo que la base prohíbe', () => {
  test('cada alternativa de una regla que premia pasa la capa base', () => {
    const colisiones = TONE_IDS.flatMap((id) => {
      const tono = TONES[id];
      if (!tono) return [];
      return tono.rules.flatMap((r) =>
        !CLASES_QUE_PREMIAN.has(r.kind)
          ? []
          : alternativasLiterales(r.pattern).flatMap((a) => {
              const errores = erroresDeLaBase(enFrase(a));
              return errores.length ? [`${r.id}: «${a}» choca con ${errores.join(', ')}`] : [];
            }),
      );
    });
    assert.deepEqual(
      colisiones,
      [],
      'estas reglas de tono exigen usar algo que la base rechaza con severidad error',
    );
  });

  test('ninguna clase que premia se queda fuera del censo', () => {
    // El canario del conjunto, que es lo que faltaba la primera vez. Sin él,
    // agregar una clase nueva que premie deja este gate mirando a otro lado y
    // pasando en verde, que es exactamente lo que ocurrió.
    //
    // La prueba de si una clase premia es corta: ¿puede un texto pasar de
    // incumplirla a cumplirla AGREGANDO algo? Si sí, premia.
    // Se decide clase por clase y a mano, no por cómo se llama. La primera
    // versión miraba el sufijo del nombre, `-floor` o `-ratio`, que es una
    // convención de bautismo y no un hecho sobre la regla: una clase nueva que
    // premiara y se llamara de otro modo se habría escapado igual, que es el
    // defecto que este canario viene a impedir.
    const PROHIBEN = new Set([
      'forbidden-pattern',
      'pattern-density',
      'pattern-ratio',
      'quote-level',
      'paragraph-opening',
      'sentence-start-run',
      'short-sentence-run',
      'long-sentence-run',
      'sentence-length',
      'sentence-length-band',
      'sentence-length-mean',
      'sentence-length-spread',
      'paragraph-length',
      'paragraph-length-spread',
    ]);
    const clases = new Set(TONE_IDS.flatMap((id) => TONES[id]?.rules ?? []).map((r) => r.kind));
    const fuera = [...clases].filter((k) => !CLASES_QUE_PREMIAN.has(k) && !PROHIBEN.has(k));
    assert.deepEqual(
      fuera,
      [],
      'estas clases premian y el censo no las mira: agregalas a CLASES_QUE_PREMIAN',
    );
  });

  test('el lector de alternativas no pierde ni la primera ni la última', () => {
    // El canario que faltaba, y el que habría ahorrado el defecto. El de más
    // abajo planta una colisión en mitad de la lista, y una lista mal recortada
    // pierde los extremos y conserva el medio: pasaba en verde con nueve
    // alternativas de cuarenta y seis sin probar.
    //
    // Se prueban las dos formas de patrón que conviven en el repositorio,
    // porque el defecto fue exactamente que una función escrita para una de
    // ellas se aplicó a la otra sin que nadie lo notara.
    const anclado = /^(?:no obstante|adem[áa]s|de lo contrario)(?:,|\s)/iu;
    assert.deepEqual(alternativasLiterales(anclado), ['no obstante', 'además', 'de lo contrario']);

    const conFrontera = /(?:en consecuencia|por ende|en suma)/iu;
    assert.deepEqual(alternativasLiterales(conFrontera), ['en consecuencia', 'por ende', 'en suma']);

    // Y sobre las reglas de verdad, la comprobación acotada al defecto: si el
    // primero o el último de la lista es texto llano, tiene que estar censado.
    // No se exige que estén todos, porque una alternativa con cuantificador
    // («me parec\p{L}*») no se puede convertir en frase sin inventarle un
    // ejemplo, y un ejemplo inventado probaría lo que uno quisiera.
    const llana = (a: string) =>
      /^[a-záéíóúñü ]+$/iu.test(a.replace(/\[(.)[^\]]*\]/gu, '$1').replace(/\\s\+/gu, ' '));
    for (const id of TONE_IDS) {
      for (const r of TONES[id]?.rules ?? []) {
        if (!CLASES_QUE_PREMIAN.has(r.kind)) continue;
        const grupo = /\(\?:([^)]*)\)/u.exec(r.pattern.source);
        if (!grupo) continue;
        const crudas = (grupo[1] as string).split('|');
        const censadas = new Set(alternativasLiterales(r.pattern));
        for (const extremo of [crudas[0] as string, crudas[crudas.length - 1] as string]) {
          if (!llana(extremo)) continue;
          const limpia = extremo.replace(/\[(.)[^\]]*\]/gu, '$1').replace(/\\s\+/gu, ' ');
          assert.ok(censadas.has(limpia), `${r.id}: «${limpia}» está en el patrón y no en el censo`);
        }
      }
    }
  });

  test('el censo encuentra la colisión cuando la hay', () => {
    // El canario, y hace falta: un test que solo diga «no hay colisiones» pasa
    // igual de verde si el detector dejó de detectar. Se planta la que había.
    assert.deepEqual(erroresDeLaBase(enFrase('en síntesis')), ['cierres-anunciados']);
    assert.deepEqual(erroresDeLaBase(enFrase('en definitiva')), ['cierres-anunciados']);
  });

  test('el censo no marca un enlace que la base sí acepta', () => {
    // La otra dirección. Si `erroresDeLaBase` empezara a marcar cualquier cosa,
    // el primer test fallaría por todos lados y nadie sabría por qué.
    for (const a of ['no obstante', 'de manera que', 'en suma', 'por consiguiente']) {
      assert.deepEqual(erroresDeLaBase(enFrase(a)), [], a);
    }
  });

  test('el lector de alternativas lee de verdad el patrón', () => {
    // Si esta función devolviera una lista vacía, el primer test pasaría en
    // verde sin haber comprobado nada. Se ata a un patrón real.
    const conectores = TONES['triangulacion']?.rules.find(
      (r) => r.id === 'triangulacion-conectores-variados',
    );
    assert.ok(conectores && conectores.kind === 'must-contain');
    const alts = alternativasLiterales(conectores.pattern);
    assert.ok(alts.length > 15, `solo leyó ${alts.length} alternativas`);
    assert.ok(alts.includes('no obstante'));
    assert.ok(!alts.includes('en síntesis'), 'se quitó del repertorio y no puede volver');
  });
});
