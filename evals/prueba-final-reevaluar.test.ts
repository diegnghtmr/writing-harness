// Volver a juzgar una serie ya publicada, sin correr ningún agente.
//
// Cambiar una comprobación y gastar otra corrida completa para ver qué dice es
// caro: horas y cuota. Lo que la corrida dejó publicado alcanza para recalcular
// casi todo. Lo que no se puede recalcular después, la huella de base.docx antes
// y después y el estado de git y de la copia, se conserva y se marca como
// conservado. Acá la carpeta publicada se arma a mano, y la sesión del agente
// la lee un lector falso que devuelve lo que habría leído el de verdad.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import type { Comprobacion } from '../scripts/prueba-final/comprobaciones.ts';
import { reevaluar, type DependenciasDeReevaluacion } from '../scripts/prueba-final/reevaluar.ts';
import { llamada, vacia } from '../scripts/prueba-final/transcripcion.ts';
import { variantes } from '../scripts/prueba-final/variantes.ts';

const raiz = mkdtempSync(join(tmpdir(), 'prueba-final-reevaluar-'));
after(() => rmSync(raiz, { recursive: true, force: true }));

const ENTRADA = 'En 2024 se encuestó a cincuenta y ocho docentes de la Universidad del Quindío. Desde los años noventa circula una idea sobre la escuela y sus voces.';
const SALIDA = 'Desde la década de 1990 circula una idea sobre la escuela y sus voces. En 2024 se encuestó a 58 docentes de la Universidad del Quindío.';
const SERIE = '2026-10-06T16:24:37.965Z';

const c = (numero: number, estado: Comprobacion['estado'], motivo = 'como estaba'): Comprobacion => ({ numero, nombre: `n${numero}`, estado, motivo });

let serie = 0;
/** Una carpeta con dos corridas publicadas por un ejecutor anterior, y su resumen. */
function publicada() {
  serie++;
  const carpeta = join(raiz, `mix-${serie}`, 'test-final');
  const corrida = (variante: string, id: string, viejas: Comprobacion[]) => {
    const dir = join(carpeta, 'falso', variante);
    mkdirSync(dir, { recursive: true });
    const staging = `C:\\temp\\pf-00000000-0000-4000-8000-00000000000${id}`;
    writeFileSync(join(dir, 'prompt.txt'), `Corrige el texto de \`${staging}\\entrada.md\` y guarda el resultado en \`${staging}\\salida.md\`.`);
    writeFileSync(join(dir, 'entrada.md'), ENTRADA);
    writeFileSync(join(dir, 'salida.md'), `${SALIDA}${variante === 'camus' ? ' Una frase más.' : ''}`);
    writeFileSync(join(dir, 'respuesta.txt'), 'x');
    writeFileSync(join(dir, 'stdout.txt'), '{}\n');
    writeFileSync(join(dir, 'transcripcion.jsonl'), '{}\n');
    const veredicto = {
      agente: 'falso',
      variante,
      estado: viejas.some((x) => x.estado === 'falla') ? 'falla' : 'pasa',
      comprobaciones: viejas,
      metadatos: { codigo: 0, vencido: false, inicio: SERIE, fin: SERIE, sesion: id },
    };
    writeFileSync(join(dir, 'veredicto.json'), JSON.stringify(veredicto));
  };
  const todas = (cambios: Record<number, Comprobacion>) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => cambios[n] ?? c(n, 'pasa'));
  // El ejecutor anterior no leía la década y daba por perdida una cifra que estaba.
  corrida('base', '1', todas({ 7: c(7, 'falla', 'faltan cifras 58') }));
  // Esta corrida tocó la copia: eso no se puede volver a mirar, y se conserva.
  corrida('camus', '2', todas({ 9: c(9, 'falla', 'borró de la copia: CLAUDE.md') }));
  writeFileSync(join(carpeta, 'resumen.json'), JSON.stringify({ fecha: SERIE, texto: { modo: 'fragmento', palabras: 24, secciones: [] }, docx: { antes: 'a', despues: 'a' } }));
  writeFileSync(join(carpeta, 'resumen.md'), '# viejo\n');
  return { carpeta, mix: join(raiz, `mix-${serie}`) };
}

/** Lo que habría leído el lector de verdad: las skills, la medición y la respuesta. */
function deps(medidos: [string, readonly string[]][] = [], avisos: string[] = []): DependenciasDeReevaluacion {
  return {
    verificar: (archivo, banderas) => {
      medidos.push([archivo, banderas]);
      return { codigo: 0, salida: 'sin hallazgos' };
    },
    parsear: (agente, variante, _archivos, staging) => {
      if (agente !== 'falso') return null;
      const v = variantes().find((x) => x.id === variante);
      const banderas = v?.banderas.join(' ') ?? '';
      const linea = v?.clase === 'base' ? 'No se aplicó ningún tono, porque el pedido es corregir.' : `Tono \`${v?.skill}\`, porque se pidió.`;
      return {
        ...vacia(),
        respuesta: `Quedó en \`${staging}\\salida.md\`. ${linea}`,
        llamadas: [
          ...['redactar-espanol', 'spanish-writing', ...(v?.skill ? [v.skill] : [])].map((s) => llamada('skill', { skill: s })),
          llamada('powershell', { command: `node writing-harness/src/cli.ts ${staging}\\salida.md ${banderas}` }, 0),
        ],
      };
    },
    ahora: () => new Date('2026-10-07T10:00:00.000Z'),
    avisar: (l) => avisos.push(l),
    cambiosDesde: () => [],
  };
}

describe('volver a juzgar una serie publicada', () => {
  const p = publicada();
  const medidos: [string, readonly string[]][] = [];
  const r = reevaluar({ carpeta: p.carpeta, mix: p.mix, reales: [p.mix] }, deps(medidos));
  const nuevo = (variante: string) => JSON.parse(readFileSync(join(p.carpeta, 'falso', variante, 'veredicto.json'), 'utf8'));

  test('dice qué cambió en cada corrida: el estado y las comprobaciones que lo causan', () => {
    assert.deepEqual(r.cambios, [
      { agente: 'falso', variante: 'base', antes: 'falla: 7', despues: 'pasa' },
      { agente: 'falso', variante: 'camus', antes: 'falla: 9', despues: 'falla: 9' },
    ]);
  });

  test('recalcula con las comprobaciones de hoy, la undécima incluida', () => {
    const v = nuevo('base');
    assert.equal(v.estado, 'pasa');
    assert.equal(v.comprobaciones.length, 11);
    assert.equal(v.comprobaciones.find((x: Comprobacion) => x.numero === 7).estado, 'pasa');
  });

  test('lo que no se puede volver a mirar se conserva y queda marcado', () => {
    const v = nuevo('camus');
    const nueve = v.comprobaciones.find((x: Comprobacion) => x.numero === 9);
    assert.equal(nueve.estado, 'falla');
    assert.equal(nueve.conservada, true);
    assert.match(nueve.motivo, /borró de la copia: CLAUDE\.md/u);
    assert.equal(v.comprobaciones.find((x: Comprobacion) => x.numero === 1).conservada, true);
    assert.equal(v.comprobaciones.find((x: Comprobacion) => x.numero === 2).conservada, undefined);
  });

  test('el verificador de hoy mide la salida publicada con las opciones de la variante, y la respuesta con la base', () => {
    const camus = variantes().find((x) => x.id === 'camus');
    assert.deepEqual(medidos, [
      [join(p.carpeta, 'falso', 'base', 'salida.md'), []],
      [join(p.carpeta, 'falso', 'base', 'respuesta.txt'), []],
      [join(p.carpeta, 'falso', 'camus', 'salida.md'), camus?.banderas],
      [join(p.carpeta, 'falso', 'camus', 'respuesta.txt'), []],
    ]);
  });

  test('lo anterior pasa al historial antes de reescribir, y el resumen se rehace', () => {
    const historial = join(p.carpeta, 'historial', '2026-10-07T10-00-00-000Z-reevaluacion');
    assert.deepEqual(readdirSync(historial).sort(), ['falso', 'resumen.json', 'resumen.md']);
    const viejo = JSON.parse(readFileSync(join(historial, 'falso', 'base', 'veredicto.json'), 'utf8'));
    assert.equal(viejo.estado, 'falla');
    const md = readFileSync(join(p.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /^- Corridas: 2\. Pasan 1, con aviso 0, con falla 1, con error del agente 0\.$/mu);
    assert.equal(nuevo('base').serie, SERIE, 'la serie es la de la corrida, no la de la reevaluación');
    assert.equal(r.codigo, 1);
  });

  test('el resumen rehecho marca las corridas que no registran con qué se probaron', () => {
    const md = readFileSync(join(p.carpeta, 'resumen.md'), 'utf8');
    assert.match(md, /^\| base \| pasa \[sin traza\] \|$/mu);
    assert.equal(r.suite.vigencia?.['falso/camus']?.estado, 'desconocida');
  });
});

describe('la vigencia al volver a juzgar', () => {
  test('una corrida con traza que un cambio posterior alcanza queda desactualizada', () => {
    const p = publicada();
    const archivo = join(p.carpeta, 'falso', 'camus', 'veredicto.json');
    const v = JSON.parse(readFileSync(archivo, 'utf8'));
    v.metadatos.traza = { arnes: { commit: 'a'.repeat(40), sucio: false, sucios: {} }, mix: {}, docx: '', instaladas: null };
    writeFileSync(archivo, JSON.stringify(v));
    const r = reevaluar(
      { carpeta: p.carpeta, mix: p.mix, reales: [p.mix] },
      { ...deps(), cambiosDesde: () => ['skills/camus-writing/SKILL.md'] },
    );
    assert.equal(r.suite.vigencia?.['falso/camus']?.estado, 'desactualizada');
    assert.match(readFileSync(join(p.carpeta, 'resumen.md'), 'utf8'), /^\| camus \| falla: 9 \[desactualizada\] \|$/mu);
  });
});

describe('lo que no se puede volver a juzgar', () => {
  test('una corrida de un agente sin lector se conserva tal cual, y se avisa', () => {
    const p = publicada();
    const otro = join(p.carpeta, 'otro', 'base');
    mkdirSync(otro, { recursive: true });
    const conservado = { agente: 'otro', variante: 'base', estado: 'aviso', comprobaciones: [c(8, 'aviso')], metadatos: { codigo: 0, vencido: false } };
    writeFileSync(join(otro, 'veredicto.json'), JSON.stringify(conservado));
    const avisos: string[] = [];
    const r = reevaluar({ carpeta: p.carpeta, mix: p.mix, reales: [p.mix] }, deps([], avisos));
    assert.ok(avisos.some((l) => /otro\/base/u.test(l)), avisos.join('\n'));
    assert.equal(JSON.parse(readFileSync(join(otro, 'veredicto.json'), 'utf8')).estado, 'aviso');
    assert.ok(r.cambios.some((x) => x.agente === 'otro' && x.antes === x.despues));
  });

  test('una carpeta sin corridas publicadas no se toca', () => {
    const vacia = join(raiz, 'vacia');
    mkdirSync(vacia, { recursive: true });
    assert.throws(() => reevaluar({ carpeta: vacia, mix: raiz, reales: [] }, deps()), /veredicto\.json/u);
    assert.ok(!existsSync(join(vacia, 'historial')));
  });
});
