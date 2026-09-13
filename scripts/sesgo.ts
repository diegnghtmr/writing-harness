// El reparto de la batería de pedidos típicos entre los tonos, en una tabla.
//
//   npm run sesgo
//
// Imprime lo mismo que `evals/sesgo.test.ts` deja como diagnóstico: por cada
// tono, cuántos pedidos le tocan, qué parte de la batería son y cuáles. Lee
// `evals/pedidos.ts`, que es la única lista. Si el gate y esto leyeran listas
// distintas, cada uno daría una cifra y ninguna sería la de la batería.
//
// No decide nada y no sale con error: mirar el reparto no es el gate. Los
// techos y sus motivos viven en el test.

import { PEDIDOS, reparto } from '../evals/pedidos.ts';

const filas = reparto();
const total = PEDIDOS.length;

const anchoTono = Math.max('tono'.length, ...filas.map((f) => f.tono.length));
const anchoCuenta = Math.max('pedidos'.length, `${total}/${total}`.length);
const anchoPorcentaje = '100 %'.length;
// Los pedidos que siguen al primero van debajo, alineados con él.
const sangria = ' '.repeat(anchoTono + 2 + anchoCuenta + 2 + anchoPorcentaje + 2);

console.log(`${'tono'.padEnd(anchoTono)}  ${'pedidos'.padEnd(anchoCuenta)}  ${'%'.padStart(anchoPorcentaje)}  cuáles`);
for (const f of filas) {
  const [primero = '', ...resto] = f.pedidos;
  const cuenta = `${f.cuenta}/${total}`.padEnd(anchoCuenta);
  const porcentaje = `${f.porcentaje} %`.padStart(anchoPorcentaje);
  console.log(`${f.tono.padEnd(anchoTono)}  ${cuenta}  ${porcentaje}  ${primero}`.trimEnd());
  for (const p of resto) console.log(`${sangria}${p}`);
}

const alcanzados = filas.filter((f) => f.cuenta > 0).length;
console.log(`\n${total} pedidos. ${alcanzados} de los ${filas.length} tonos reciben alguno.`);
