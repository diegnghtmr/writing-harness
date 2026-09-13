// El nombre de la skill vale por el identificador.
//
// Un agente que acababa de cargar `camus-writing` corrió el verificador con
// `--tono camus-writing` y recibió «tono desconocido», porque el CLI solo
// aceptaba `camus`. Una persona cometió el mismo error. El nombre que uno acaba
// de leer en la skill es el que escribe, así que ahora vale: en `--tono`, todo
// `<id>-writing` vale por `<id>`, y en `--pasada`, `humanizar-espanol` vale por
// `humanizar`.
//
// Lo que no cambia: un valor que no es ni el identificador ni el nombre de la
// skill sigue saliendo con 2 y con la lista de los que valen.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { PASADAS, PASADA_IDS, TONE_IDS } from '../src/rules.ts';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');

/**
 * Doce oraciones iguales de quince palabras, en un solo párrafo.
 *
 * Es el texto plano de `evals/ritmo.test.ts`, que exige que cada tono diga algo
 * sobre él. Acá importa por eso: cada tono lo marca citando su propia skill, así
 * que dos tonos nunca dan la misma salida, y un nombre que se resolviera al tono
 * equivocado se vería. Con los textos de `evals/fixtures/`, dos tonos salían
 * igual que sin tono, y la comparación no los habría distinguido.
 */
const PLANO = Array.from({ length: 12 }, () => `${Array.from({ length: 15 }, () => 'palabra').join(' ')}.`).join(' ');

let dir: string;
let texto: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'alias-'));
  texto = join(dir, 'plano.txt');
  writeFileSync(texto, `${PLANO}\n`, 'utf8');
});

after(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

type Corrida = { codigo: number | null; salida: string; errores: string };

// Cada corrida arranca un proceso, y el canario de abajo repite las de los
// identificadores. Se guardan para no pagarlas dos veces.
const corridas = new Map<string, Corrida>();

function corre(args: string[]): Corrida {
  const clave = JSON.stringify(args);
  const guardada = corridas.get(clave);
  if (guardada !== undefined) return guardada;
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', shell: false });
  const corrida = { codigo: r.status, salida: r.stdout, errores: r.stderr };
  corridas.set(clave, corrida);
  return corrida;
}

/** La primera línea del error, que dice qué se rechazó y qué vale. Debajo va el uso entero. */
const primeraLinea = (errores: string) => errores.split(/\r?\n/u)[0] ?? '';

describe('--tono acepta el nombre de la skill', () => {
  test('cada tono, pedido como <id>-writing, da la misma salida y el mismo código que como <id>', () => {
    for (const id of TONE_IDS) {
      const corto = corre([texto, '--tono', id]);
      assert.notEqual(corto.codigo, 2, `${id}: el identificador mismo no se aceptó: ${corto.errores}`);
      assert.deepEqual(corre([texto, '--tono', `${id}-writing`]), corto, `${id}-writing no se comporta como ${id}`);
    }
  });

  test('la forma corta -t también lo acepta', () => {
    assert.deepEqual(corre([texto, '-t', 'camus-writing']), corre([texto, '--tono', 'camus']));
  });

  test('el texto de prueba distingue cada tono de los demás', () => {
    // El canario de la comparación de arriba. Si dos tonos dieran la misma
    // salida sobre este texto, un nombre resuelto al otro pasaría igual.
    const salidas = new Set(TONE_IDS.map((id) => corre([texto, '--tono', id]).salida));
    assert.equal(salidas.size, TONE_IDS.length);
  });
});

describe('--pasada acepta el nombre de la skill', () => {
  test('cada pasada, pedida por el nombre de su skill, da la misma salida y el mismo código', () => {
    for (const id of PASADA_IDS) {
      const skill = PASADAS[id]?.skill as string;
      const corto = corre([texto, '--tono', 'camus', '--pasada', id]);
      assert.notEqual(corto.codigo, 2, `${id}: el identificador mismo no se aceptó: ${corto.errores}`);
      assert.deepEqual(
        corre([texto, '--tono', 'camus', '--pasada', skill]),
        corto,
        `${skill} no se comporta como ${id}`,
      );
    }
  });

  test('con los dos nombres a la vez, el aviso de lo relevado nombra los identificadores', () => {
    // Ese aviso imprime el tono y la pasada. Si el nombre se aceptara sin
    // traducirlo, el aviso diría otra cosa, o el verificador ni llegaría a medir.
    assert.deepEqual(
      corre([texto, '--tono', 'camus-writing', '--pasada', 'humanizar-espanol']),
      corre([texto, '--tono', 'camus', '--pasada', 'humanizar']),
    );
  });

  test('pedirla por los dos nombres no la aplica dos veces', () => {
    for (const id of PASADA_IDS) {
      const skill = PASADAS[id]?.skill as string;
      assert.deepEqual(corre([texto, '--pasada', id, '--pasada', skill]), corre([texto, '--pasada', id]));
    }
  });
});

describe('lo que no es ni el identificador ni el nombre de la skill sigue fallando', () => {
  function rechazado(args: string[], mensaje: string, valen: readonly string[]): void {
    const r = corre([texto, ...args]);
    assert.equal(r.codigo, 2, `${args.join(' ')} salió con ${r.codigo}`);
    assert.equal(r.salida, '', 'no se midió nada, así que no puede haber veredicto');
    const linea = primeraLinea(r.errores);
    assert.ok(linea.includes(mensaje), `el error no dice «${mensaje}»: ${linea}`);
    assert.deepEqual(/Disponibles: ([^.]+)\./u.exec(linea)?.[1]?.split(', '), [...valen], linea);
    assert.match(linea, /nombre de su skill/u, 'el error no dice que también vale el nombre de la skill');
  }

  test('un tono inventado, con el sufijo o sin él', () => {
    rechazado(['--tono', 'inventado'], 'tono desconocido: inventado.', TONE_IDS);
    rechazado(['--tono', 'inventado-writing'], 'tono desconocido: inventado-writing.', TONE_IDS);
  });

  test('el nombre de la base no es el de un tono', () => {
    rechazado(['--tono', 'spanish-writing'], 'tono desconocido: spanish-writing.', TONE_IDS);
  });

  test('el nombre de una skill no vale en la opción de la otra capa', () => {
    rechazado(['--tono', 'humanizar-espanol'], 'tono desconocido: humanizar-espanol.', TONE_IDS);
    rechazado(['--pasada', 'camus-writing'], 'pasada desconocida: camus-writing.', PASADA_IDS);
  });

  test('una pasada inventada', () => {
    rechazado(['--pasada', 'inventada'], 'pasada desconocida: inventada.', PASADA_IDS);
  });
});

describe('la ayuda lo dice', () => {
  test('--help dice que las dos opciones aceptan el nombre de la skill', () => {
    const r = corre(['--help']);
    assert.equal(r.codigo, 0, r.errores);
    assert.match(r.salida.replace(/\s+/gu, ' '), /--tono y --pasada aceptan también el nombre de su skill/u);
  });
});
