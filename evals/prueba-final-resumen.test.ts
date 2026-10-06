// El resumen de la prueba final: una matriz de agente por variante y la lista
// de lo que falló, con su motivo.
//
// La matriz es lo primero que se lee después de horas de corridas, así que cada
// celda tiene que decir lo suficiente para saber a dónde mirar: el estado y los
// números de las comprobaciones que lo causaron. Una celda que dice solo «falla»
// obliga a abrir cuarenta y cinco veredictos para encontrar el patrón.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Comprobacion, Estado } from '../scripts/prueba-final/comprobaciones.ts';
import {
  celda,
  codigoDeSalida,
  lineaDeTotales,
  resumenJson,
  resumenMarkdown,
  type Suite,
  type Veredicto,
} from '../scripts/prueba-final/resumen.ts';

const c = (numero: number, estado: Estado, motivo = 'motivo'): Comprobacion => ({ numero, nombre: `nombre ${numero}`, estado, motivo });

const veredicto = (agente: string, variante: string, cs: Comprobacion[], vencido = false, error: string | null = null): Veredicto => ({
  agente,
  variante,
  estado:
    error !== null ? 'error' : cs.some((x) => x.estado === 'falla') ? 'falla' : cs.some((x) => x.estado === 'aviso') ? 'aviso' : 'pasa',
  error,
  serie: '2026-10-06T00:00:00.000Z',
  comprobaciones: cs,
  metadatos: {
    version: '1.0',
    modelo: null,
    duracionMs: 1000,
    duracionAgenteMs: null,
    codigo: 0,
    vencido,
    costo: null,
    sesion: null,
    inicio: '2026-10-06T00:00:00.000Z',
    fin: '2026-10-06T00:00:01.000Z',
    copia: { archivos: 2, huella: 'f'.repeat(64) },
    engram: `prueba-final-20261006-000000-${agente}-${variante}`,
  },
});

const suite = (veredictos: Veredicto[], despues = 'abc'): Suite => ({
  fecha: '2026-10-06T00:00:00.000Z',
  carpeta: 'C:\\r\\mix\\test-final',
  texto: { modo: 'fragmento', palabras: 785, secciones: [{ titulo: 'Resumen', palabras: 162 }, { titulo: '1. Introducción', palabras: 623 }] },
  docx: { antes: 'abc', despues },
  agentes: ['copilot', 'grok'],
  omitidos: [],
  series: { copilot: '2026-10-06T00:00:00.000Z', grok: '2026-10-06T00:00:00.000Z' },
  variantes: ['base', 'camus'],
  veredictos,
});

const CUOTA = 'cuota agotada (RESOURCE_EXHAUSTED 429), vuelve en 156h37m';

describe('una celda de la matriz', () => {
  test('el estado y los números que lo causan', () => {
    assert.equal(celda(veredicto('a', 'b', [c(1, 'pasa'), c(2, 'pasa')])), 'pasa');
    assert.equal(celda(veredicto('a', 'b', [c(1, 'pasa'), c(8, 'aviso'), c(5, 'aviso')])), 'aviso: 5, 8');
    assert.equal(celda(veredicto('a', 'b', [c(4, 'falla'), c(8, 'aviso'), c(6, 'falla')])), 'falla: 4, 6');
  });

  test('un tiempo agotado se dice en la celda, y una corrida que no está también', () => {
    assert.equal(celda(veredicto('a', 'b', [c(2, 'falla')], true)), 'falla: 2, tiempo agotado');
    assert.equal(celda(undefined), 'sin correr');
  });

  test('un error del agente se dice con su motivo, no como una falla', () => {
    assert.equal(celda(veredicto('agy', 'fonda', [c(1, 'pasa'), c(6, 'sin evaluar')], false, CUOTA)), `error: ${CUOTA}`);
    assert.equal(celda(veredicto('a', 'b', [c(1, 'pasa')], true, 'tiempo agotado')), 'error: tiempo agotado', 'sin repetir el tiempo');
  });

  test('una falla en lo que sí se evalúa queda a la vista junto al error', () => {
    assert.equal(celda(veredicto('a', 'b', [c(9, 'falla'), c(6, 'sin evaluar')], false, CUOTA)), `error: ${CUOTA}; falla: 9`);
  });

  test('una barra vertical en el motivo no rompe la tabla', () => {
    assert.equal(celda(veredicto('a', 'b', [], false, 'a | b')), 'error: a \\| b');
  });
});

describe('las cuentas', () => {
  test('pasan, avisos, fallas y errores del agente, por separado', () => {
    const vs = [
      veredicto('copilot', 'fonda', [c(7, 'falla')]),
      veredicto('grok', 'fonda', [c(10, 'aviso')]),
      veredicto('agy', 'fonda', [c(6, 'sin evaluar')], false, CUOTA),
    ];
    assert.equal(lineaDeTotales(vs), '3 corridas: 0 pasan, 1 aviso, 1 falla, 1 error del agente');
    assert.equal(lineaDeTotales([veredicto('a', 'b', [c(1, 'pasa')])]), '1 corrida: 1 pasa, 0 avisos, 0 fallas, 0 errores del agente');
  });
});

describe('el resumen en Markdown', () => {
  const vs = [
    veredicto('copilot', 'base', [c(1, 'pasa'), c(4, 'falla', 'no cargó spanish-writing')]),
    veredicto('grok', 'base', [c(1, 'pasa'), c(8, 'aviso', '70 palabras de 100')]),
    veredicto('copilot', 'camus', [c(1, 'pasa')]),
  ];
  const md = resumenMarkdown(suite(vs));

  test('una fila por variante y una columna por agente, en el orden pedido', () => {
    assert.match(md, /^\| Variante \| copilot \| grok \|$/mu);
    assert.match(md, /^\| base \| falla: 4 \| aviso: 8 \|$/mu);
    assert.match(md, /^\| camus \| pasa \| sin correr \|$/mu);
    assert.ok(md.indexOf('| base |') < md.indexOf('| camus |'));
  });

  test('las fallas y los avisos, cada uno con su corrida, su número y su motivo', () => {
    assert.match(md, /## Fallas[\s\S]*- copilot, base, 4 \(nombre 4\): no cargó spanish-writing/u);
    assert.match(md, /## Avisos[\s\S]*- grok, base, 8 \(nombre 8\): 70 palabras de 100/u);
  });

  test('el texto, sus palabras y la huella del documento', () => {
    assert.match(md, /fragmento, 785 palabras \(Resumen 162, 1\. Introducción 623\)/u);
    assert.match(md, /base\.docx.*no cambió/u);
    assert.match(resumenMarkdown(suite(vs, 'xyz')), /base\.docx.*cambió/u);
  });

  test('la leyenda nombra las once comprobaciones, con los datos nuevos al final', () => {
    for (let n = 1; n <= 11; n++) assert.match(md, new RegExp(`^${n}\\. `, 'mu'), `falta la ${n}`);
    assert.match(md, /^11\. datos nuevos$/mu);
  });

  test('sin fallas, lo dice en vez de dejar la sección vacía', () => {
    const limpio = resumenMarkdown(suite([veredicto('copilot', 'base', [c(1, 'pasa')])]));
    assert.match(limpio, /## Fallas\n\nNinguna\./u);
    assert.match(limpio, /## Errores del agente\n\nNinguno\./u);
  });

  test('los errores del agente van en su propia sección y en su propia cuenta', () => {
    const conError = resumenMarkdown(
      suite([...vs, veredicto('grok', 'camus', [c(1, 'pasa'), c(6, 'sin evaluar', 'no terminó')], false, CUOTA)]),
    );
    assert.match(conError, /^\| camus \| pasa \| error: cuota agotada/mu);
    assert.match(conError, new RegExp(`## Errores del agente\\n\\n- grok, camus: ${CUOTA.replace(/[()]/gu, '\\$&')}`, 'u'));
    assert.match(conError, /^- Corridas: 4\. Pasan 1, con aviso 1, con falla 1, con error del agente 1\.$/mu);
    // Una comprobación sin evaluar no es una falla ni un aviso.
    assert.doesNotMatch(conError, /grok, camus, 6/u);
  });

  test('una matriz que junta series distintas dice la fecha de la serie de cada agente', () => {
    const juntas = resumenMarkdown({
      ...suite(vs),
      series: { copilot: '2026-10-06T16:24:37.965Z', grok: '2026-10-08T09:05:00.000Z' },
    });
    assert.match(juntas, /^\| Variante \| copilot \(serie 2026-10-06 16:24\) \| grok \(serie 2026-10-08 09:05\) \|$/mu);
    assert.match(juntas, /^- Series: copilot del 2026-10-06T16:24:37\.965Z, grok del 2026-10-08T09:05:00\.000Z\.$/mu);
    // Una sola serie no repite su fecha en cada columna.
    assert.match(md, /^\| Variante \| copilot \| grok \|$/mu);
  });

  test('dice qué agentes corrieron y cuáles quedaron fuera', () => {
    assert.match(md, /^- Agentes: copilot, grok\.$/mu);
    const parcial = resumenMarkdown({ ...suite(vs), omitidos: ['agy'] });
    assert.match(parcial, /^- Agentes: copilot, grok\. Quedaron fuera: agy\.$/mu);
  });
});

describe('el resumen en JSON y el código de salida', () => {
  test('sale con 1 si alguna corrida falló, y con 0 si solo hubo avisos', () => {
    assert.equal(codigoDeSalida([veredicto('a', 'b', [c(8, 'aviso')])]), 0);
    assert.equal(codigoDeSalida([veredicto('a', 'b', [c(8, 'aviso')]), veredicto('a', 'c', [c(3, 'falla')])]), 1);
  });

  test('un error del agente no es una corrida limpia: sale con 1', () => {
    assert.equal(codigoDeSalida([veredicto('a', 'b', [c(1, 'pasa')], false, CUOTA)]), 1);
  });

  test('el JSON lleva los totales, el código y cada veredicto entero', () => {
    const vs = [
      veredicto('copilot', 'base', [c(4, 'falla')]),
      veredicto('grok', 'base', [c(1, 'pasa')]),
      veredicto('agy', 'base', [c(6, 'sin evaluar')], false, CUOTA),
    ];
    const j = resumenJson({ ...suite(vs), omitidos: ['otro'] });
    assert.deepEqual(j.totales, { pasa: 1, aviso: 0, falla: 1, error: 1 });
    assert.equal(j.codigo, 1);
    assert.deepEqual(j.veredictos, vs);
    assert.equal(j.veredictos[2]?.error, CUOTA);
    assert.deepEqual(j.omitidos, ['otro']);
  });
});
