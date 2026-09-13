// Cuánto se lleva camus de una batería de pedidos típicos.
//
// Una auditoría independiente pasó veinticuatro pedidos típicos por la lista de
// `redactar-espanol` y encontró camus en once. Casi la mitad de lo que se pide
// terminaba en el último paso, que es el que recoge lo que ningún paso anterior
// reclamó. Después del cambio de rutas, el enrutador da nueve de veinticuatro.
// Nada impedía volver atrás sin que nadie se enterara, ni que otro tono se
// volviera el nuevo recogedor.
//
// `evals/pedidos.ts` tiene la batería. Esto la pasa por `sugerirTono`, el mismo
// procedimiento que usa el CLI, y comprueba cuatro cosas: que cada pedido salga
// con el tono anotado, que camus no pase de su techo, que ningún otro tono pase
// del suyo y que la lista llegue a casi todos los tonos. El reparto sale como
// diagnóstico, para que la suite muestre las cifras y no solo el verde, y
// `npm run sesgo` lo imprime en tabla.
//
// Lo que no mide: cómo elige un agente los rasgos ni el paso. La batería fija
// los rasgos que un agente razonable declararía, y un agente real puede
// declarar otros.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { RASGOS, RUTA_IDS, sugerirTono } from '../src/enrutamiento.ts';
import { TONE_IDS } from '../src/rules.ts';
import { REPO_ROOT } from '../src/skills.ts';
import { PEDIDOS, type Rasgo, rasgosDe, reparto } from './pedidos.ts';

/**
 * El techo de camus: el 40 % de la batería.
 *
 * Contra el sesgo viejo. La auditoría encontró camus en once de veinticuatro,
 * el 46 %: el último paso volvía a ser el destino de todo lo que no era un
 * género marcado. Si vuelve a pasar de acá, alguna ruta dejó de reclamar lo
 * suyo y el último paso lo está recogiendo.
 */
const TECHO_CAMUS = 0.4;

/**
 * El techo de cualquier otro tono: el 20 %.
 *
 * Contra un recogedor nuevo. Si una ruta se ensancha hasta tragarse lo que
 * soltó camus, el techo de arriba sigue en verde y el sesgo solo se mudó.
 * Ningún tono que no sea el último paso tiene por qué llevarse uno de cada
 * cinco pedidos variados.
 */
const TECHO_OTRO = 0.2;

/**
 * Cuántos tonos, como mínimo, reciben algún pedido.
 *
 * Un tono al que ningún pedido típico llega es un tono que la lista no elige
 * nunca, y eso pasa cuando una ruta de arriba se come la condición de otra. No
 * se exigen los trece porque una batería de treinta y tantos pedidos puede
 * dejar fuera una forma rara sin que la lista esté mal.
 */
const MINIMO_DE_TONOS = 10;

/**
 * Cuántos pedidos, como mínimo, tiene la batería: los de la auditoría y doce más.
 *
 * Un techo en porcentaje sobre una batería que se achica mide cada vez menos,
 * y una batería vacía no mide nada.
 */
const MINIMO_DE_PEDIDOS = 36;

/** El último paso de la lista, que es camus: `assertRutas` lo exige. */
const ULTIMO = RUTA_IDS[RUTA_IDS.length - 1] as string;

type Cuenta = { tono: string; cuenta: number };

/** Si el último paso se lleva más que su techo. Justo en el techo, no. */
const ultimoDeMas = (filas: readonly Cuenta[], total: number): boolean =>
  (filas.find((f) => f.tono === ULTIMO)?.cuenta ?? 0) / total > TECHO_CAMUS;

/** Los tonos que no son el último paso y se llevan más que su techo. */
const recogedores = (filas: readonly Cuenta[], total: number): string[] =>
  filas.filter((f) => f.tono !== ULTIMO && f.cuenta / total > TECHO_OTRO).map((f) => f.tono);

/** Cuántos tonos reciben al menos un pedido. */
const alcanzados = (filas: readonly Cuenta[]): number => filas.filter((f) => f.cuenta > 0).length;

describe('reparto cuenta lo que el enrutador decide', () => {
  test('cuenta cada tono de la lista, también los que no reciben ninguno', () => {
    const filas = reparto([
      { pedido: 'a', rasgos: [], tono: 'camus' },
      { pedido: 'b', rasgos: ['divulgacion'], tono: 'fonda' },
      { pedido: 'c', rasgos: [], tono: 'camus' },
    ]);
    assert.deepEqual(filas.map((f) => f.tono).sort(), [...RUTA_IDS].sort());
    assert.deepEqual(filas[0], { tono: 'camus', cuenta: 2, porcentaje: 67, pedidos: ['a', 'c'] });
    assert.deepEqual(filas[1], { tono: 'fonda', cuenta: 1, porcentaje: 33, pedidos: ['b'] });
    assert.ok(filas.slice(2).every((f) => f.cuenta === 0 && f.porcentaje === 0));
  });

  test('cuenta por lo que responde el enrutador, no por lo anotado', () => {
    // Si contara el campo `tono`, los techos vigilarían la batería y no la lista.
    const [fila] = reparto([{ pedido: 'mal anotado', rasgos: ['divulgacion'], tono: 'camus' }]);
    assert.equal(fila?.tono, 'fonda');
  });

  test('ordena de más a menos, y los empates en el orden de la lista', () => {
    const filas = reparto([{ pedido: 'a', rasgos: ['epocal'], tono: 'han' }]);
    assert.equal(filas[0]?.tono, 'han');
    assert.deepEqual(
      filas.slice(1).map((f) => f.tono),
      RUTA_IDS.filter((t) => t !== 'han'),
    );
  });
});

describe('la batería de pedidos típicos', () => {
  const filas = reparto();
  const total = PEDIDOS.length;

  test('el reparto, tono por tono', (t) => {
    t.diagnostic(`${total} pedidos`);
    for (const f of filas) t.diagnostic(`${f.tono} ${f.cuenta}/${total} (${f.porcentaje} %)`);
    assert.equal(
      filas.reduce((n, f) => n + f.cuenta, 0),
      total,
    );
  });

  test(`tiene al menos ${MINIMO_DE_PEDIDOS} pedidos, y cada rasgo existe`, () => {
    assert.ok(total >= MINIMO_DE_PEDIDOS, `la batería tiene ${total} pedidos`);
    // El enrutador ignora un rasgo que no conoce, así que uno mal escrito
    // mandaría el pedido al último paso sin que nada lo dijera.
    const inventados = PEDIDOS.flatMap((p) =>
      p.rasgos.filter((r) => !RASGOS.includes(r as Rasgo)).map((r) => `${p.pedido}: ${r}`),
    );
    assert.deepEqual(inventados, []);
  });

  test('(a) cada pedido sale con el tono anotado', () => {
    const cambiados = PEDIDOS.map((p) => ({ p, sale: sugerirTono(rasgosDe(p)).tono }))
      .filter(({ p, sale }) => sale !== p.tono)
      .map(({ p, sale }) => `${p.pedido}: anotado ${p.tono}, sale ${sale}`);
    assert.deepEqual(cambiados, [], 'estos pedidos cambiaron de tono: si el cambio de ruta es a propósito, se anota el nuevo');
  });

  test(`(b) ${ULTIMO} no se lleva más del ${TECHO_CAMUS * 100} %`, () => {
    const c = filas.find((f) => f.tono === ULTIMO);
    assert.ok(!ultimoDeMas(filas, total), `${ULTIMO} se lleva ${c?.cuenta}/${total} (${c?.porcentaje} %)`);
  });

  test(`(c) ningún otro tono se lleva más del ${TECHO_OTRO * 100} %`, () => {
    assert.deepEqual(recogedores(filas, total), [], 'estos tonos se volvieron recogedores');
  });

  test(`(d) la batería llega al menos a ${MINIMO_DE_TONOS} de los ${TONE_IDS.length} tonos`, () => {
    const sinPedidos = filas.filter((f) => f.cuenta === 0).map((f) => f.tono);
    assert.ok(alcanzados(filas) >= MINIMO_DE_TONOS, `ningún pedido llega a: ${sinPedidos.join(', ')}`);
  });
});

describe('los techos caen cuando tienen que caer', () => {
  // El canario. Prueba las comprobaciones con repartos inventados, no la batería.
  const fila = (tono: string, cuenta: number): Cuenta => ({ tono, cuenta });

  test('camus cae con quince de treinta y seis, y pasa justo en el techo', () => {
    assert.ok(ultimoDeMas([fila(ULTIMO, 15)], 36));
    assert.ok(!ultimoDeMas([fila(ULTIMO, 14)], 36));
    assert.ok(!ultimoDeMas([fila(ULTIMO, 4)], 10));
  });

  test('un recogedor nuevo cae, y camus no cuenta como uno', () => {
    assert.deepEqual(recogedores([fila(ULTIMO, 20), fila('fonda', 8), fila('han', 7)], 36), ['fonda']);
  });

  test('una batería que llega a nueve tonos cae', () => {
    const nueve = RUTA_IDS.map((t, i) => fila(t, i < 9 ? 1 : 0));
    assert.ok(alcanzados(nueve) < MINIMO_DE_TONOS);
  });
});

describe('npm run sesgo imprime el mismo reparto', () => {
  test('package.json lo declara', () => {
    const paquete = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    assert.equal(paquete.scripts.sesgo, 'node scripts/sesgo.ts');
  });

  test('una fila por tono, con la misma cuenta y los mismos pedidos que el gate', () => {
    const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'sesgo.ts')], {
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(r.status, 0, r.stderr);
    for (const f of reparto()) {
      assert.match(r.stdout, new RegExp(`^${f.tono} +${f.cuenta}/${PEDIDOS.length} +${f.porcentaje} %`, 'mu'), f.tono);
      for (const p of f.pedidos) assert.ok(r.stdout.includes(p), `la tabla no lista «${p}»`);
    }
  });
});
