// Un generador no puede borrar un registro que no puede volver a producir.
//
// `src/corpus.ts` y `src/mediciones.ts` los escriben dos scripts que leen el
// corpus del disco. El corpus se borra en cuanto la skill está construida, así
// que la situación normal de este repositorio es tener el registro de trece
// corpus y ninguno de ellos a mano.
//
// Los dos scripts se escribieron con el corpus entero delante y reescribían el
// archivo completo. Nadie lo notó durante trece corpus porque nadie volvió a
// correrlos. Se notó al llegar el decimocuarto: `manifiesto.ts` habría dejado el
// registro con una fila y `medir.ts` habría reventado buscando en disco un
// archivo de un corpus borrado hace meses.
//
// La fusión es la respuesta, y este gate es lo que impide que se convierta en
// otra cosa. Falla en las dos direcciones a propósito: si deja de conservar lo
// ausente, se pierde el registro; si deja de reemplazar lo presente, una
// medición nueva no entra nunca y el archivo miente al revés.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { conservados, fusionarPorSkill } from '../scripts/fusion.ts';

type Fila = { skill: string; valor: number };

const previas: Fila[] = [
  { skill: 'atenas-writing', valor: 1 },
  { skill: 'atenas-writing', valor: 2 },
  { skill: 'solitario-writing', valor: 3 },
];

describe('la fusión conserva lo que ya no se puede medir', () => {
  test('un corpus ausente del disco sobrevive tal cual', () => {
    const nuevas: Fila[] = [{ skill: 'adria-sola-writing', valor: 9 }];
    const salida = fusionarPorSkill(previas, nuevas, new Set(['adria-sola-writing']));
    assert.deepEqual(salida, [
      { skill: 'adria-sola-writing', valor: 9 },
      { skill: 'atenas-writing', valor: 1 },
      { skill: 'atenas-writing', valor: 2 },
      { skill: 'solitario-writing', valor: 3 },
    ]);
  });

  test('medir un solo corpus no borra los otros doce', () => {
    // El caso exacto que se dio. Con la versión anterior, la salida habría sido
    // una fila.
    const doce: Fila[] = Array.from({ length: 12 }, (_, i) => ({ skill: `c${i}`, valor: i }));
    const salida = fusionarPorSkill(doce, [{ skill: 'nuevo', valor: 99 }], new Set(['nuevo']));
    assert.equal(salida.length, 13);
  });
});

describe('la fusión reemplaza lo que sí se midió', () => {
  test('un corpus presente en disco pierde sus filas viejas', () => {
    // La otra dirección. Sin esto, la fusión conservaría lo viejo junto a lo
    // nuevo y el archivo tendría dos verdades sobre el mismo corpus.
    const nuevas: Fila[] = [{ skill: 'atenas-writing', valor: 100 }];
    const salida = fusionarPorSkill(previas, nuevas, new Set(['atenas-writing']));
    assert.deepEqual(salida, [
      { skill: 'atenas-writing', valor: 100 },
      { skill: 'solitario-writing', valor: 3 },
    ]);
  });

  test('estar en disco decide, no producir filas', () => {
    // Un corpus presente que no produjo nada se lleva sus filas viejas, y eso
    // es correcto acá: quien tiene que delatar la carpeta vacía es el script,
    // antes de llegar hasta esta función. Si esto lo tapara, un corpus roto
    // pasaría por corpus intacto.
    const salida = fusionarPorSkill(previas, [], new Set(['atenas-writing']));
    assert.deepEqual(salida, [{ skill: 'solitario-writing', valor: 3 }]);
  });
});

describe('la fusión no reordena lo que no debe', () => {
  test('el orden dentro de un corpus se conserva', () => {
    // En `MEDICIONES` el orden interno es significativo: archivos, palabras,
    // signos, marcas, segundos. Un `sort` inestable lo barajaría y el archivo
    // seguiría siendo correcto pero dejaría de ser legible.
    const desordenables: Fila[] = [
      { skill: 'z-writing', valor: 1 },
      { skill: 'z-writing', valor: 2 },
      { skill: 'z-writing', valor: 3 },
      { skill: 'a-writing', valor: 4 },
    ];
    assert.deepEqual(
      fusionarPorSkill(desordenables, [], new Set()).map((f) => f.valor),
      [4, 1, 2, 3],
    );
  });
});

describe('lo conservado se puede nombrar', () => {
  test('devuelve las skills que esta corrida no volvió a medir', () => {
    assert.deepEqual(conservados(previas, new Set(['atenas-writing'])), ['solitario-writing']);
  });

  test('sin nada medido, todo queda conservado y sin repetir', () => {
    assert.deepEqual(conservados(previas, new Set()), ['atenas-writing', 'solitario-writing']);
  });

  test('con todo medido no queda nada que anunciar', () => {
    // El script solo imprime el aviso cuando hay algo que avisar. Un aviso que
    // sale siempre se deja de leer.
    assert.deepEqual(conservados(previas, new Set(['atenas-writing', 'solitario-writing'])), []);
  });
});
