// Los ejemplos de un tono son del asunto de su corpus.
//
// El defecto que esto cierra ocurrió y lo encontró una persona leyendo. Una
// skill ilustró sus quince movimientos con ejemplos sobre un asunto ajeno al
// corpus con el que se midió, y como ese asunto era el mismo de la batería de
// pruebas del proyecto, quien escribía la prueba encontraba en la skill
// párrafos terminados y los reusaba. Tres textos seguidos repitieron sus
// frases. El aislamiento de la prueba funcionaba; la fuga estaba en la skill.
//
// Lo que hace falta entender para leer este archivo: el arnés no puede inferir
// de qué habla un corpus que ya se borró, así que el asunto se declara. La
// razón larga está en `evals/asuntos.ts`, junto con las dos maneras de
// inferirlo que se probaron y fallaron.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CORPUS } from '../src/corpus.ts';
import { TONES } from '../src/rules.ts';
import { readSkill } from '../src/skills.ts';
import { ASUNTOS, PISO, SIN_DECLARAR, muestrasDe, tocanElAsunto } from './asuntos.ts';

/**
 * Los tonos que tienen corpus, que son los únicos a los que esta regla alcanza.
 *
 * `camus-writing` no lo tiene: se construyó sobre prosa publicada y no sobre un
 * corpus reunido, así que no hay asunto de corpus que declarar. Se filtra por el
 * manifiesto y no por una lista de excepciones, para que el día que ese tono
 * reciba un corpus entre solo por existir su renglón.
 */
const conCorpus = new Set(CORPUS.map((c) => c.skill));
const tonos = Object.values(TONES)
  .map((t) => t.skill)
  .filter((s) => conCorpus.has(s));
const declarados = new Map(ASUNTOS.map((a) => [a.skill, a]));
const sinDeclarar = new Set(SIN_DECLARAR.map((s) => s.skill));

describe('los ejemplos de un tono son del asunto de su corpus', () => {
  test('cada tono está declarado o registrado como deuda, y nunca las dos cosas', () => {
    // Es la mitad que obliga a un tono nuevo. Quien agregue uno tiene que
    // declarar de qué habla su corpus, porque la única alternativa es entrar en
    // `SIN_DECLARAR`, y ese archivo dice que ahí no entra nadie nuevo.
    const huerfanos = tonos.filter((s) => !declarados.has(s) && !sinDeclarar.has(s));
    assert.deepEqual(
      huerfanos,
      [],
      'un tono sin asunto declarado y sin registrar como deuda: declaralo en evals/asuntos.ts',
    );

    const dobles = tonos.filter((s) => declarados.has(s) && sinDeclarar.has(s));
    assert.deepEqual(dobles, [], 'un tono no puede estar declarado y registrado como deuda a la vez');
  });

  test('el registro de deuda no nombra skills que no existen', () => {
    // Sin esto, una skill retirada dejaría su renglón y la lista parecería más
    // corta de lo que es al mirarla contra los tonos vivos.
    const fantasmas = [...sinDeclarar].filter((s) => !tonos.includes(s));
    assert.deepEqual(fantasmas, [], 'sobra un renglón en SIN_DECLARAR');
  });

  test('la lista de deuda está congelada y solo puede encoger', () => {
    // EL AGUJERO QUE ESTO CIERRA. `evals/asuntos.ts` dice que la lista solo
    // puede encoger y que un tono nuevo no entra ahí, y eso era prosa: nada lo
    // impedía. Cualquiera podía saltarse el gate entero copiando un renglón,
    // porque los otros dos tests solo comprueban que un tono esté en una lista o
    // en la otra, no en cuál merece estar.
    //
    // Congelada por contenido, no por longitud: cambiar un nombre por otro
    // conserva la cuenta y no conserva el hecho.
    assert.deepEqual([...sinDeclarar].sort(), [
      'adria-sola-writing',
      'atenas-writing',
      'bettatech-writing',
      'catedra-writing',
      'dotcsv-writing',
      'fonda-writing',
      'fonseca-writing',
      'freddy-writing',
      'han-writing',
      'schiavenato-writing',
      'solitario-writing',
    ]);
  });

  test('cada tono declarado llega al piso', () => {
    for (const a of ASUNTOS) {
      const md = readSkill(a.skill);
      const { total, tocan } = tocanElAsunto(md, a.raices);
      const share = total ? tocan / total : 0;
      assert.ok(
        share >= PISO,
        `${a.skill}: ${tocan} de ${total} muestras tocan el asunto, ${Math.round(share * 100)} %, ` +
          `y el piso es ${Math.round(PISO * 100)} %`,
      );
    }
  });

  test('una declaración con raíces que no aparecen nunca es una declaración falsa', () => {
    // El canario de la declaración. Sin él, se puede pasar el gate anterior
    // escribiendo raíces tan generales que casen con cualquier prosa, o tan
    // sueltas que no casen con nada y bajar el piso hasta que dé igual.
    for (const a of ASUNTOS) {
      const md = readSkill(a.skill).toLowerCase();
      const muertas = a.raices.filter((r) => !md.includes(r.toLowerCase()));
      assert.deepEqual(
        muertas,
        [],
        `${a.skill}: estas raíces no aparecen en la skill, así que no declaran nada: ${muertas.join(', ')}`,
      );
    }
  });

  test('el detector separa un ejemplo del asunto de uno ajeno', () => {
    // La prueba en las dos direcciones, que es lo único que distingue una regla
    // de una decoración. El texto de la izquierda es la forma que tenía la
    // skill cuando el defecto estaba vivo.
    const raices = ['mentira', 'verdad', 'engañ'];

    const ajeno = [
      '> La magnitud registrada, cercana a 6,2, perfila un movimiento moderado y no',
      '> anticipa por sí sola ningún nivel de daño en las edificaciones.',
      '',
      '> La norma obliga a quien pide licencia y no alcanza a quien construye sin',
      '> ella, y ello desplaza el problema del calendario a la cobertura.',
    ].join('\n');
    const propio = [
      '> La definición corriente perfila el acto por su contenido y no anticipa por',
      '> sí sola ninguna intención de quien emite la mentira.',
      '',
      '> La verdad se construye entre disciplinas y muta con el momento, y ello',
      '> vuelve inviable exigir que quien engaña sepa que lo dicho es falso.',
    ].join('\n');

    // Dos bloques en cada texto, porque las líneas seguidas de un bloque son una
    // sola muestra. Contar por línea daría cuatro y media proporción en el
    // segundo, que es el defecto que este mismo test destapó.
    assert.equal(tocanElAsunto(ajeno, raices).total, 2);
    assert.equal(tocanElAsunto(ajeno, raices).tocan, 0);
    assert.equal(tocanElAsunto(propio, raices).total, 2);
    assert.equal(tocanElAsunto(propio, raices).tocan, 2);
  });

  test('las tres formas de muestra del repositorio se recogen', () => {
    // Si `muestrasDe` solo viera una de las tres, el gate mediría una fracción
    // de la skill y daría por buena la parte que no mira. Las skills del
    // repositorio usan las tres, y no todas usan la misma.
    const md = [
      '> Un bloque con mayor que, que tiene más de seis palabras contadas.',
      '',
      'Una tabla con «un fragmento entre comillas angulares de suficiente largo» dentro.',
      '',
      'Incorrecto: una muestra del par incorrecto con sus seis palabras cumplidas.',
      'Correcto: una muestra del par correcto con sus seis palabras cumplidas.',
    ].join('\n');
    assert.equal(muestrasDe(md).length, 4);
  });

  test('una cita de una expresión suelta no cuenta como muestra', () => {
    // El piso de seis palabras. Una skill nombra sus piezas entre comillas
    // decenas de veces («cuyo», «ya que»), y contarlas como muestras hundiría
    // la proporción de cualquier skill que explique bien su léxico.
    const md = 'El registro elige «ya que» sobre «porque», y «cuyo» sobre la perífrasis.';
    assert.deepEqual(muestrasDe(md), []);
  });
});
