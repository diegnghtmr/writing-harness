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
import { celda, codigoDeSalida, resumenJson, resumenMarkdown, type Suite, type Veredicto } from '../scripts/prueba-final/resumen.ts';

const c = (numero: number, estado: Estado, motivo = 'motivo'): Comprobacion => ({ numero, nombre: `nombre ${numero}`, estado, motivo });

const veredicto = (agente: string, variante: string, cs: Comprobacion[], vencido = false): Veredicto => ({
  agente,
  variante,
  estado: cs.some((x) => x.estado === 'falla') ? 'falla' : cs.some((x) => x.estado === 'aviso') ? 'aviso' : 'pasa',
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
  },
});

const suite = (veredictos: Veredicto[], despues = 'abc'): Suite => ({
  fecha: '2026-10-06T00:00:00.000Z',
  carpeta: 'C:\\r\\mix\\test-final',
  texto: { modo: 'fragmento', palabras: 785, secciones: [{ titulo: 'Resumen', palabras: 162 }, { titulo: '1. Introducción', palabras: 623 }] },
  docx: { antes: 'abc', despues },
  agentes: ['copilot', 'grok'],
  variantes: ['base', 'camus'],
  veredictos,
});

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

  test('la leyenda nombra las diez comprobaciones', () => {
    for (let n = 1; n <= 10; n++) assert.match(md, new RegExp(`^${n}\\. `, 'mu'), `falta la ${n}`);
  });

  test('sin fallas, lo dice en vez de dejar la sección vacía', () => {
    const limpio = resumenMarkdown(suite([veredicto('copilot', 'base', [c(1, 'pasa')])]));
    assert.match(limpio, /## Fallas\n\nNinguna\./u);
  });
});

describe('el resumen en JSON y el código de salida', () => {
  test('sale con 1 si alguna corrida falló, y con 0 si solo hubo avisos', () => {
    assert.equal(codigoDeSalida([veredicto('a', 'b', [c(8, 'aviso')])]), 0);
    assert.equal(codigoDeSalida([veredicto('a', 'b', [c(8, 'aviso')]), veredicto('a', 'c', [c(3, 'falla')])]), 1);
  });

  test('el JSON lleva los totales, el código y cada veredicto entero', () => {
    const vs = [veredicto('copilot', 'base', [c(4, 'falla')]), veredicto('grok', 'base', [c(1, 'pasa')])];
    const j = resumenJson(suite(vs));
    assert.deepEqual(j.totales, { pasa: 1, aviso: 0, falla: 1 });
    assert.equal(j.codigo, 1);
    assert.deepEqual(j.veredictos, vs);
  });
});
