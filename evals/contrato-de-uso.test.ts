// Cada skill abre con su contrato de uso: lo que una skill de Gentleman
// Programming pone primero (activación, reglas duras, decisiones, pasos,
// entrega y referencias), en un bloque corto antes de la sección 1.
//
// El contrato de uso no reemplaza nada. Resume el cuerpo y apunta, con
// «(sección N)», a donde está el detalle; el gate de referencias internas
// comprueba que esos punteros lleguen a una sección que existe. Lo que este
// archivo vigila es la forma: que el bloque esté, en su lugar, con sus partes en
// orden, y que cada regla dura diga dónde se sostiene.
//
// Va delante porque lo que está al principio es lo que un agente lee seguro.
// En las corridas con agentes reales, un catálogo de referencias se abrió en
// muy pocas de ellas aunque la skill pedía leerlo entero.
//
// No es el contrato de evidencia, que tiene su propio archivo.

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { SKILLS_DIR, readSkill, skillNames } from '../src/skills.ts';

const ENCABEZADO = '## Contrato de uso';
const PARTES = ['Activación', 'Reglas duras', 'Decisiones', 'Pasos', 'Entrega'];
const OPCIONAL = 'Referencias';
const AVISO = 'Este contrato resume las secciones numeradas: ellas mandan y se leen enteras.';

/**
 * La skill con saltos de línea LF.
 *
 * El repositorio fija LF para las skills, pero una copia de trabajo en Windows
 * puede traer CRLF, y entonces ningún `$` ni `\n` de abajo coincidiría: la
 * skill parecería no tener contrato por culpa de la plataforma.
 */
const leer = (n: string) => readSkill(n).replace(/\r\n/gu, '\n');

/** El bloque del contrato de uso, de su encabezado al siguiente `## `. */
export function contratoDe(md: string): string | null {
  const m = /^## Contrato de uso\n([\s\S]*?)(?=^## )/mu.exec(md);
  return m ? (m[1] as string) : null;
}

/** Los encabezados `### ` del contrato, en orden. */
function partesDe(contrato: string): string[] {
  return [...contrato.matchAll(/^### (.+)$/gmu)].map((m) => (m[1] as string).trim());
}

/** El texto de una parte del contrato, hasta la parte siguiente. */
function parte(contrato: string, nombre: string): string {
  const m = new RegExp(`^### ${nombre}\\n([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, 'mu').exec(contrato);
  return m ? (m[1] as string) : '';
}

/** Las viñetas de una parte, cada una con sus líneas de continuación unidas. */
function vinetas(texto: string): string[] {
  return texto
    .split(/^- /mu)
    .slice(1)
    .map((v) => v.replace(/\s+/gu, ' ').trim());
}

const tieneReferencias = (n: string) => existsSync(join(SKILLS_DIR, n, 'references'));

describe('cada skill abre con su contrato de uso', () => {
  test('hay skills que revisar', () => {
    // Todas las pruebas de abajo recorren skillNames() y esperan una lista de
    // faltas vacía. Sin skills, pasarían sin comprobar nada.
    assert.ok(skillNames().length > 0);
  });

  test('el contrato dice que no reemplaza al cuerpo', () => {
    // El riesgo de poner un resumen delante es que un agente lea el resumen y
    // se detenga. La frase va primero, antes de la activación.
    const sinAviso = skillNames().filter((n) => !(contratoDe(leer(n)) ?? '').trimStart().startsWith(AVISO));
    assert.deepEqual(sinAviso, []);
  });

  test('el contrato está una sola vez y antes de la sección 1', () => {
    const mal = skillNames().flatMap((n) => {
      const md = leer(n);
      const veces = md.split('\n').filter((l) => l === ENCABEZADO).length;
      if (veces !== 1) return [`${n}: ${veces} contratos`];
      const contrato = md.search(/^## Contrato de uso$/mu);
      const primera = md.search(/^## 1\./mu);
      return primera !== -1 && contrato < primera ? [] : [`${n}: el contrato no va antes de la sección 1`];
    });
    assert.deepEqual(mal, []);
  });

  test('sus partes son las de la forma, en orden', () => {
    const mal = skillNames().flatMap((n) => {
      const contrato = contratoDe(leer(n)) ?? '';
      const esperadas = tieneReferencias(n) ? [...PARTES, OPCIONAL] : PARTES;
      const partes = partesDe(contrato);
      return partes.join(' / ') === esperadas.join(' / ') ? [] : [`${n}: ${partes.join(' / ')}`];
    });
    assert.deepEqual(mal, []);
  });

  test('cada regla dura dice en qué sección se sostiene', () => {
    // Sin el puntero, una regla del contrato sería una regla nueva escrita en
    // el lugar más leído de la skill, y nadie podría comprobar que el cuerpo la
    // dice.
    const sueltas = skillNames().flatMap((n) =>
      vinetas(parte(contratoDe(leer(n)) ?? '', 'Reglas duras'))
        .filter((v) => !/\(secci(?:ón|ones) [^)]+\)\.?$/u.test(v))
        .map((v) => `${n}: ${v.slice(0, 60)}…`),
    );
    assert.deepEqual(sueltas, []);
  });

  test('las reglas duras no son una ni una lista entera', () => {
    const fuera = skillNames().flatMap((n) => {
      const cuantas = vinetas(parte(contratoDe(leer(n)) ?? '', 'Reglas duras')).length;
      return cuantas >= 3 && cuantas <= 12 ? [] : [`${n}: ${cuantas}`];
    });
    assert.deepEqual(fuera, []);
  });

  test('las decisiones son una tabla de situación y acción', () => {
    const sinTabla = skillNames().filter(
      (n) => !/^\| Situación \| Acción \|\n\| --- \| --- \|\n\|/mu.test(parte(contratoDe(leer(n)) ?? '', 'Decisiones')),
    );
    assert.deepEqual(sinTabla, []);
  });

  test('los pasos van numerados desde 1 y sin saltos', () => {
    const mal = skillNames().flatMap((n) => {
      const numeros = [...parte(contratoDe(leer(n)) ?? '', 'Pasos').matchAll(/^(\d+)\. /gmu)].map((m) =>
        Number(m[1]),
      );
      const seguidos = numeros.length > 0 && numeros.every((x, i) => x === i + 1);
      return seguidos ? [] : [`${n}: ${numeros.join(',')}`];
    });
    assert.deepEqual(mal, []);
  });

  test('las referencias nombran cada archivo que la skill trae', () => {
    const faltan = skillNames()
      .filter(tieneReferencias)
      .flatMap((n) => {
        const texto = parte(contratoDe(leer(n)) ?? '', OPCIONAL);
        return readdirSync(join(SKILLS_DIR, n, 'references'))
          .filter((f) => !texto.includes(f))
          .map((f) => `${n}: ${f}`);
      });
    assert.deepEqual(faltan, []);
  });
});
