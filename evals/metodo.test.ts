// Las cuatro reglas del tono que le entrega al lector un método.
//
// Es el único tono cuyo corpus llegó partido en dos por la puntuación: ocho
// archivos la traen y doce no traen ni un signo. Sus dos reglas de longitud
// salen solo de los ocho, y por eso avisan en vez de bloquear. Las otras dos no
// dependen de la puntuación, que es lo que las hace las buenas.
//
// Cada una se prueba en las dos direcciones. Una regla que solo se prueba
// disparando es indistinguible de una que dispara siempre, y la que solo se
// prueba callando, de una que no mira nada.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { check } from '../src/check.ts';
import { TONES } from '../src/rules.ts';

/** Arma un texto con las longitudes pedidas, en un solo párrafo. */
function conLongitudes(largos: readonly number[]): string {
  return largos.map((n) => `${Array.from({ length: n }, () => 'palabra').join(' ')}.`).join(' ');
}

const solo = (texto: string, regla: string) =>
  check(texto, { tone: 'adria-sola' }).filter((f) => f.rule === regla);

describe('la mitad del texto cabe en catorce palabras', () => {
  test('dispara cuando no hay mitad breve', () => {
    const f = solo(conLongitudes(Array.from({ length: 10 }, () => 20)), 'adria-sola-mitad-breve');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /0 de 10 oraciones \(0 %\)/u);
    assert.match(f[0]!.message, /al menos el 50 %/u);
  });

  test('calla en el peor archivo del corpus, que da 50,8 %', () => {
    // El piso no es una media cómoda: es la proporción del archivo que menos
    // breves tiene de los ocho medidos. Si el gate lo pusiera por encima,
    // marcaría como defectuoso un texto igual al corpus del que salió.
    const mitad = [8, 20, 10, 22, 12, 25, 6, 21, 14, 30];
    assert.deepEqual(solo(conLongitudes(mitad), 'adria-sola-mitad-breve'), []);
  });

  test('justo por debajo de la mitad sí cae', () => {
    // Cuatro breves de diez. La frontera está donde la skill la declara.
    const casi = [8, 20, 10, 22, 12, 25, 20, 21, 30, 30];
    assert.equal(solo(conLongitudes(casi), 'adria-sola-mitad-breve').length, 1);
  });

  test('el piso de ocho oraciones evita marcar un párrafo suelto', () => {
    assert.deepEqual(solo(conLongitudes([20, 22, 25, 30]), 'adria-sola-mitad-breve'), []);
  });
});

describe('la media no abandona la banda de doce a diecinueve', () => {
  test('dispara por arriba: el texto dejó de mandar y volvió a exponer', () => {
    const f = solo(conLongitudes(Array.from({ length: 10 }, () => 30)), 'adria-sola-media-oracion');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /30/u);
  });

  test('dispara por abajo: el texto se quedó en la instrucción suelta', () => {
    assert.equal(
      solo(conLongitudes(Array.from({ length: 10 }, () => 6)), 'adria-sola-media-oracion').length,
      1,
    );
  });

  test('calla dentro de la banda', () => {
    const dentro = [6, 25, 8, 22, 10, 20, 7, 24, 9, 21];
    assert.deepEqual(solo(conLongitudes(dentro), 'adria-sola-media-oracion'), []);
  });

  test('la media y la banda no miden lo mismo, y por eso están las dos', () => {
    // Diez oraciones de dieciocho a veintiuna: media 18,6, dentro de la banda,
    // y ni una sola breve. La media la arrastra la cola y no ve una
    // distribución sin mitad corta; la banda no ve una deriva general. Este
    // caso salió de un texto de prueba real que pasó la primera y cayó en la
    // segunda.
    const plano = [21, 21, 21, 18, 17, 18, 17, 21, 16, 16];
    assert.deepEqual(solo(conLongitudes(plano), 'adria-sola-media-oracion'), []);
    assert.equal(solo(conLongitudes(plano), 'adria-sola-mitad-breve').length, 1);
  });
});

describe('el texto le manda hacer algo al lector', () => {
  const relleno = conLongitudes([8, 9, 7, 10, 8, 9]);

  test('dispara sobre un texto que solo expone', () => {
    const f = solo(relleno, 'adria-sola-manda-hacer');
    assert.equal(f.length, 1);
    assert.match(f[0]!.message, /Se esperaban 2, hay 0/u);
  });

  test('un solo imperativo no basta: el tono pide un método, no un consejo', () => {
    assert.equal(solo(`Anote la palabra. ${relleno}`, 'adria-sola-manda-hacer').length, 1);
  });

  test('calla con dos imperativos distintos de usted', () => {
    assert.deepEqual(
      solo(`Anote la palabra. Practique cada día. ${relleno}`, 'adria-sola-manda-hacer'),
      [],
    );
  });

  test('el plural de usted también cuenta', () => {
    // El tono admite dirigirse a un colectivo, y la base lo resuelve con
    // «ustedes». Si la regla solo viera el singular, un texto correcto para
    // un grupo saldría marcado.
    assert.deepEqual(
      solo(`Anoten la palabra. Practiquen cada día. ${relleno}`, 'adria-sola-manda-hacer'),
      [],
    );
  });

  test('el piso de seis oraciones evita exigirle un método a dos frases', () => {
    assert.deepEqual(solo('Una frase suelta. Y otra.', 'adria-sola-manda-hacer'), []);
  });

  test('calla sobre el vocabulario corriente de una instrucción', () => {
    // El caso que delató la primera lista, y por eso está escrito literal. Es
    // un método de verdad, con siete imperativos distintos, y la regla
    // reconocía uno solo porque la lista se había traducido verbo por verbo del
    // corpus en vez de cubrir cómo se dan instrucciones en español.
    //
    // En un `must-contain`, una lista corta no calla: avisa en falso sobre el
    // texto que hace exactamente lo que la regla exige. Ese es el error caro, y
    // ninguna de las pruebas anteriores lo veía porque todas usaban verbos que
    // ya estaban en la lista.
    const metodo = [
      'Busque la fecha de la licencia y no la del edificio.',
      'Pida el documento en la oficina de planeación de su municipio.',
      'Consulte el estudio de microzonificación y localice su predio.',
      'Mire los muros de la planta baja en lugar de la fachada.',
      'Recorra el piso completo y cuente las columnas que encuentre.',
      'Lleve lo que reunió a un ingeniero y pregunte una sola cosa.',
    ].join(' ');
    assert.deepEqual(solo(metodo, 'adria-sola-manda-hacer'), []);
  });
});

describe('la promesa de transformación no se traslada', () => {
  test('caza la fórmula del corpus y sus vecinas', () => {
    for (const frase of [
      'El método lo lleva al nivel superior.',
      'Esto le cambiará la vida.',
      'Esto cambiará su vida.',
      'Va a transformar su vida.',
      'Así consigue la vida que sueña.',
      'Después nunca volverá a ser igual.',
    ]) {
      assert.equal(solo(frase, 'adria-sola-promesa-inflada').length, 1, frase);
    }
  });

  test('caza también la persona que la base ya prohíbe', () => {
    // «tu vida» no lleva marca de tuteo, así que `tratamiento-de-usted` no la
    // ve. Sin las dos personas en la lista, la promesa entera se colaba por ahí.
    assert.equal(solo('Esto cambiará tu vida.', 'adria-sola-promesa-inflada').length, 1);
  });

  test('calla sobre lo que el tono sí pide decir', () => {
    // La sustitución que la regla propone: qué va a poder hacer el lector, en
    // cuánto tiempo y con qué trabajo. Si esto se marcara, la regla no tendría
    // arreglo posible.
    const bueno = 'A las cuatro semanas va a sostener una conversación de diez minutos sin releer.';
    assert.deepEqual(solo(bueno, 'adria-sola-promesa-inflada'), []);
  });

  test('avisa y no bloquea, porque la primera admite lectura literal', () => {
    // Un texto sobre grados, jerarquías o un videojuego tiene niveles de
    // verdad. Bloquear ahí sería marcar prosa legítima, y una regla que grita
    // en falso se deja de leer.
    const f = solo('El aprendiz pasa al nivel superior del escalafón.', 'adria-sola-promesa-inflada');
    assert.equal(f.length, 1);
    assert.equal(f[0]!.severity, 'warning');
  });
});

describe('las cuatro reglas están declaradas como el tono dice', () => {
  test('dos gobiernan el ritmo de oración y dos no gobiernan nada', () => {
    // Las dos de longitud las releva `--pasada humanizar`; las otras dos no,
    // porque la persona y el léxico no son ritmo. Sin esto, pedir humanizar
    // sobre un texto de este tono se llevaría por delante el imperativo, que es
    // lo único que lo define.
    const porDominio = Object.fromEntries(
      (TONES['adria-sola']?.rules ?? []).map((r) => [r.id, r.gobierna ?? 'ninguno']),
    );
    assert.deepEqual(porDominio, {
      'adria-sola-mitad-breve': 'ritmo-de-oracion',
      'adria-sola-media-oracion': 'ritmo-de-oracion',
      'adria-sola-manda-hacer': 'ninguno',
      'adria-sola-promesa-inflada': 'ninguno',
    });
  });

  test('ninguna bloquea, y eso también es una decisión', () => {
    // Las de longitud, porque su cifra viene de la puntuación de un
    // transcriptor y no del autor. Las otras dos, porque un texto puede
    // exponer antes de mandar y porque la promesa admite lectura literal.
    const severidades = new Set((TONES['adria-sola']?.rules ?? []).map((r) => r.severity));
    assert.deepEqual([...severidades], ['warning']);
  });
});
