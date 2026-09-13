// El texto se entrega en la respuesta, no en un archivo.
//
// Un agente cargó `redactar-espanol`, escribió el texto en un archivo de trabajo
// para poder medirlo, lo midió hasta que el verificador no encontró nada y cerró
// la tarea con un resumen. El texto no llegó nunca a la respuesta, así que el
// usuario no lo vio, y la línea del tono tampoco. El paso 5 decía «Se entrega el
// texto medido tal cual» y no decía dónde, y el agente tomó el archivo medido
// por la entrega.
//
// El paso dice ahora los dos casos. Si el usuario no pidió otro sitio, el texto
// va entero en la respuesta, y ni guardarlo en un archivo ni medirlo cuentan
// como entregarlo. Si pidió un archivo o dio un documento, el texto va ahí y la
// respuesta dice dónde, sin repetirlo: mostrarlo dos veces no sirve de nada. En
// los dos casos, la línea del tono y las advertencias van en la respuesta.
//
// Este gate comprueba que el paso siga diciendo esas cuatro cosas. No comprueba
// que un agente las cumpla: eso solo se ve leyendo lo que entregó.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENTRADA, readSkill } from '../src/skills.ts';

/** El número del paso que dice dónde va el texto. Los pasos 6 y 7 dicen qué más va en la respuesta. */
const ENTREGA = 5;

/**
 * Los pasos de «## 3. La entrega», cada uno plegado a una línea.
 *
 * Plegar importa: la prosa se envuelve a ochenta columnas, y reenvolver un paso
 * no cambia lo que dice. Un paso abre con `N. ` al margen y sigue en las líneas
 * sangradas. Termina en la primera línea en blanco, en una línea sin sangría o
 * en el paso siguiente, así que la prosa que viene después de la lista no se
 * cuenta como parte del último paso.
 */
function pasosDeLaEntrega(md: string): Map<number, string> {
  const pasos = new Map<number, string>();
  const desde = md.search(/^## 3\. La entrega\s*$/mu);
  if (desde === -1) return pasos;
  const resto = md.slice(desde + 1);
  const hasta = resto.search(/^## /mu);
  const seccion = hasta === -1 ? resto : resto.slice(0, hasta);
  let actual: number | undefined;
  for (const linea of seccion.split(/\r?\n/u)) {
    const abre = /^(\d+)\.\s+(.*)$/u.exec(linea);
    if (abre) {
      actual = Number(abre[1]);
      pasos.set(actual, (abre[2] as string).trim());
    } else if (actual !== undefined && /^\s+\S/u.test(linea)) {
      pasos.set(actual, `${pasos.get(actual)} ${linea.trim()}`);
    } else {
      actual = undefined;
    }
  }
  return pasos;
}

/** Lo que el paso de la entrega tiene que decir, cada cosa con las frases que la dicen. */
const AFIRMACIONES: readonly { dice: string; frases: readonly RegExp[] }[] = [
  {
    dice: 'si el usuario no pidió otro sitio, el texto va completo y tal cual en la respuesta',
    frases: [
      /Si el usuario no pidió ponerlo en otro sitio, el texto medido va completo y tal cual en la respuesta al usuario/u,
    ],
  },
  {
    dice: 'ni guardarlo en un archivo ni medirlo es entregarlo, y la tarea no termina antes',
    frases: [
      /guardarlo en un archivo, aunque sea para medirlo, no es entregarlo, y medirlo tampoco/u,
      /la tarea no termina hasta que el texto está en la respuesta/u,
    ],
  },
  {
    dice: 'si pidió un archivo o dio un documento, el texto va ahí y la respuesta dice dónde, sin repetirlo',
    frases: [
      /Si el usuario pidió guardarlo en un archivo, o dio un documento para que fuera en él, el texto va ahí tal cual/u,
      /la respuesta dice dónde quedó, sin repetirlo/u,
    ],
  },
  {
    dice: 'en los dos casos, la línea del tono y las advertencias van en la respuesta',
    frases: [/En los dos casos, la respuesta lleva la línea del tono y las advertencias que queden/u],
  },
];

/** Las afirmaciones que un paso no dice. */
const faltan = (paso: string): string[] =>
  AFIRMACIONES.filter((a) => !a.frases.every((f) => f.test(paso))).map((a) => a.dice);

const PASOS = pasosDeLaEntrega(readSkill(ENTRADA));

describe('la entrega dice dónde va el texto', () => {
  test('el paso 5 dice las cuatro cosas', () => {
    const paso = PASOS.get(ENTREGA);
    assert.ok(paso !== undefined, `«${ENTRADA}» perdió el paso ${ENTREGA} de la entrega`);
    assert.deepEqual(faltan(paso), [], `el paso ${ENTREGA} de «${ENTRADA}» dejó de decir esto`);
  });

  test('los pasos 6 y 7 siguen siendo la línea del tono y las advertencias', () => {
    // El paso 5 dice que las dos van en la respuesta en los dos casos. Si los
    // pasos se renumeran o se mueven, esa frase apunta a otra cosa.
    assert.match(PASOS.get(ENTREGA + 1) ?? '', /^Elegido el tono, se dice cuál y por qué en una línea\./u);
    assert.match(PASOS.get(ENTREGA + 2) ?? '', /^Cada advertencia que quede se nombra aparte/u);
  });
});

describe('el gate falla cuando tiene que fallar', () => {
  const doc = (...pasos: string[]) =>
    `# Entrada\n\n## 2. El tono\n\n5. No es este paso.\n\n## 3. La entrega\n\n${pasos.join('\n')}\n\nProsa después de la lista.\n`;

  /** Reenvuelve un paso con otro número de palabras por línea, con la sangría de la lista. */
  const envolver = (n: number, texto: string, palabrasPorLinea: number): string => {
    const palabras = texto.split(' ');
    const lineas: string[] = [];
    for (let i = 0; i < palabras.length; i += palabrasPorLinea) {
      lineas.push(palabras.slice(i, i + palabrasPorLinea).join(' '));
    }
    return `${n}. ${lineas.join('\n   ')}`;
  };

  const paso = PASOS.get(ENTREGA) ?? '';

  test('encuentra el paso aunque esté envuelto en otro sitio, y con CRLF', () => {
    for (const ancho of [3, 7, 40]) {
      const md = doc('4. Otro paso.', envolver(ENTREGA, paso, ancho), '6. Otro más.');
      assert.equal(pasosDeLaEntrega(md).get(ENTREGA), paso, `envuelto a ${ancho} palabras`);
      assert.equal(pasosDeLaEntrega(md.replace(/\n/gu, '\r\n')).get(ENTREGA), paso, `con CRLF, a ${ancho}`);
    }
  });

  test('la frase que dejó el texto en un archivo no dice ninguna de las cuatro', () => {
    const vieja = 'Se entrega el texto medido tal cual, en prosa llana y con el formato de entrega de la base.';
    assert.deepEqual(
      faltan(vieja),
      AFIRMACIONES.map((a) => a.dice),
    );
  });

  test('caza cada frase que se borre del paso', () => {
    for (const a of AFIRMACIONES) {
      for (const f of a.frases) {
        const mutante = paso.replace(f, '');
        assert.notEqual(mutante, paso, `la frase ${f.source} no está en el paso`);
        assert.ok(faltan(mutante).includes(a.dice), `borrar ${f.source} no hizo fallar «${a.dice}»`);
      }
    }
  });

  test('no toma la prosa que sigue a la lista como parte del paso', () => {
    const md = doc('5. Se entrega el texto medido tal cual.').replace(
      'Prosa después de la lista.',
      paso,
    );
    assert.equal(pasosDeLaEntrega(md).get(ENTREGA), 'Se entrega el texto medido tal cual.');
  });

  test('no toma un paso 5 de otra sección', () => {
    assert.equal(pasosDeLaEntrega(doc('4. Solo hay cuatro.')).get(ENTREGA), undefined);
  });
});
