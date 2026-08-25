// Las cifras de apariciones que la prosa enuncia, contra la tabla que se midió.
//
// LO QUE ESTE ARCHIVO DOCUMENTA ES UN DEFECTO PROPIO, y conviene leerlo antes de
// usar `EXPRESIONES` para nada.
//
// La tabla se contó buscando cada expresión como literal, con un solo espacio
// entre sus palabras. El cuerpo de una transcripción no está escrito así: viene
// partido en líneas de subtítulo, cada una con su marca `**[mm:ss]**`, y una
// expresión de dos palabras cae con frecuencia a caballo entre dos líneas. Al
// quitar la marca queda un salto de línea en medio, y «por ejemplo» con un salto
// dentro no coincide con «por ejemplo».
//
// El resultado se mide acá abajo: las expresiones de una sola palabra coinciden
// con la prosa siete de cada diez veces, y las de dos o más, una de cada ocho, y
// siempre por debajo. La prosa es la que tiene razón en las de varias palabras.
//
// No se puede arreglar. El corpus se borró, `src/mediciones.ts` está fijado por
// su huella y no hay con qué volver a medir. Queda escrito para que nadie lea
// esas cifras como exactas, y probado para que el día que alguien vuelva a
// tener un corpus sepa qué tiene que salir distinto.
//
// El emparejamiento sí quedó resuelto. El convenio de la prosa es «X» N, la
// expresión y después la cifra. Costó dos intentos: el primero admitía ochenta
// caracteres de holgura y asignaba el mismo número a dos expresiones; el segundo
// probó N «X», que es el convenio al revés, y en una lista emparejaba cada cifra
// con la expresión siguiente.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DE_UNA_PALABRA as deUnaPalabra,
  DE_VARIAS as deVarias,
  PARES,
  exactos,
} from './registro.ts';

describe('las cifras de apariciones se pueden emparejar con lo medido', () => {
  test('146 pares, 61 exactos', () => {
    // Congelados. Si cambian, o se reescribió una cifra de la prosa o alguien
    // tocó la tabla, y las dos cosas merecen mirarse.
    // Bajaron al retirarse kenway, medicendai y sekkyoku: eran 170 y 68 con las
    // catorce skills de tono. La tabla no cambió, cambió cuánta prosa la cita.
    assert.equal(PARES.length, 146);
    assert.equal(exactos(PARES), 61);
  });

  test('el emparejamiento no se desplaza dentro de una lista', () => {
    // La prueba de que el convenio es «X» N y no N «X». En dotcsv la prosa
    // escribe «aquí» 340. «vale» 113. «bueno» 92. Con el convenio al revés,
    // «vale» se llevaba el 340 de «aquí», y así toda la lista corrida.
    const dotcsv = new Map(
      PARES.filter((p) => p.skill === 'dotcsv-writing').map((p) => [p.expresion, p.prosa]),
    );
    assert.equal(dotcsv.get('vale'), 113);
    assert.equal(dotcsv.get('bueno'), 92);
    assert.equal(dotcsv.get('claro'), 79);
  });
});

describe('la tabla cuenta de menos las expresiones de varias palabras', () => {
  test('las de una palabra coinciden mucho más a menudo', () => {
    const unaPalabra = exactos(deUnaPalabra) / deUnaPalabra.length;
    const varias = exactos(deVarias) / deVarias.length;
    assert.ok(unaPalabra > 0.6, `las de una palabra coinciden ${(unaPalabra * 100).toFixed(0)} %`);
    assert.ok(varias < 0.2, `las de varias coinciden ${(varias * 100).toFixed(0)} %`);
    assert.ok(
      unaPalabra > varias * 3,
      'la diferencia entre una palabra y varias dejó de ser la que se midió',
    );
  });

  test('y cuando difieren, es casi siempre por debajo', () => {
    // Si el defecto fuese ruido, sobrarían tantas veces como faltarían. No es
    // ruido: es una expresión que el conteo no supo encontrar.
    const difieren = deVarias.filter((p) => p.prosa !== p.medido);
    const pordebajo = difieren.filter((p) => p.medido < p.prosa).length;
    assert.ok(
      pordebajo / difieren.length > 0.85,
      `solo ${pordebajo} de ${difieren.length} van por debajo`,
    );
  });

  test('ninguna expresión de una palabra puede partirse, y se nota', () => {
    // El mecanismo del defecto, dicho como comprobación: una palabra suelta no
    // cabe a caballo entre dos líneas de subtítulo, así que su cuenta no sufre.
    for (const p of deUnaPalabra) {
      assert.doesNotMatch(p.expresion, /\s/u);
    }
    assert.ok(deUnaPalabra.length > 70);
  });
});
