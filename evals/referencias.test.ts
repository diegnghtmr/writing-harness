// Una skill que se remite a su «sección 5» tiene que tener una sección 5.
//
// El defecto ocurrió al ampliar `triangulacion-writing`: entraron dos secciones
// nuevas en el medio, las nueve siguientes corrieron de número, y dos frases
// quedaron apuntando a donde ya no había nada. Una decía «la sección 13 da el
// detalle» cuando el detalle había pasado a la 17, y la otra mandaba a la 5 lo
// que estaba en la 7. Nadie lo habría notado leyendo de corrido, y ninguno de
// los 312 tests de entonces lo miraba.
//
// **Este gate no habría cazado ninguno de esos dos, y conviene decirlo antes
// que cualquier otra cosa.** Se probó rompiéndolo con el defecto real y siguió
// en verde: después del renumerado existían una sección 13 y una sección 5,
// otras, así que las dos referencias apuntaban a algo que estaba ahí y no era
// lo que se citaba. Un número que existe no se distingue de un número que
// corresponde sin leer las dos secciones, y eso es juicio.
//
// Lo que sí caza es la referencia colgada, que es el caso frecuente cuando se
// agrega al final en vez de en el medio: «la sección 21» en un documento de
// diecisiete. Roto así, falla. Vale lo que vale, ni más.
//
// **Por qué solo «sección N» y no «§N».** El § se usa en esta casa para citar
// otro documento: `spanish-writing §6.7`, `humanizar-espanol §3`. Contarlo
// dentro del mismo documento marcaba once referencias legítimas de la base
// contra normas externas. La palabra entera, en cambio, es siempre interna,
// salvo cuando la frase dice de quién es: «la sección 9.2 de la base». Ese
// «de la» es la única excepción y está medida: sin excluirlo, el censo daba
// siete falsos positivos en siete skills distintas, todos de la misma forma.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readSkill, skillNames } from '../src/skills.ts';

/**
 * Las secciones que un documento tiene, por su número.
 *
 * Se leen de los encabezados y no de un índice, porque un índice es otra cosa
 * que se puede desincronizar y entonces habría que atarlo también.
 */
export function seccionesDe(md: string): Set<string> {
  return new Set([...md.matchAll(/^#{2,4}\s+(\d+(?:\.\d+)*)\./gmu)].map((m) => m[1] as string));
}

/**
 * Las referencias internas rotas de un documento.
 *
 * El grupo final captura el «de la base» que convierte la referencia en
 * externa. Cuando está, la referencia no es a este documento y se salta.
 */
export function referenciasRotas(md: string): string[] {
  const secciones = seccionesDe(md);
  const plano = md.replace(/\s+/gu, ' ');
  const patron =
    /secci(?:ón|on)(?:es)?\s+(\d+(?:\.\d+)*)(?:\s*,\s*(\d+(?:\.\d+)*))?(?:\s+y\s+(\d+(?:\.\d+)*))?(\s+de\s+(?:la|l)\b)?/giu;
  const rotas: string[] = [];
  for (const m of plano.matchAll(patron)) {
    if (m[4]) continue;
    for (const n of [m[1], m[2], m[3]]) {
      if (n && !secciones.has(n)) rotas.push(`${n}, en «${m[0].trim()}»`);
    }
  }
  return rotas;
}

describe('las referencias internas de cada skill apuntan a algo', () => {
  test('ninguna skill se remite a una sección que no tiene', () => {
    const rotas = skillNames().flatMap((s) =>
      referenciasRotas(readSkill(s)).map((r) => `${s}: sección ${r}`),
    );
    assert.deepEqual(rotas, [], 'estas referencias apuntan a secciones que no existen');
  });

  test('el detector encuentra la referencia colgada', () => {
    // El canario: la referencia a un número que el documento no tiene.
    const md = '## 3. Qué se midió\n\nLa sección 21 da el detalle.\n\n## 17. Fuentes\n';
    assert.deepEqual(referenciasRotas(md), ['21, en «sección 21»']);
  });

  test('el detector no ve la referencia que apunta a la sección equivocada', () => {
    // El límite, escrito como test para que no se olvide. Las dos referencias
    // que motivaron este archivo eran de esta clase y pasan en verde. Un test
    // que dijera lo contrario haría creer que están cubiertas.
    const md = '## 3. Qué se midió\n\nLa sección 13 da el detalle.\n\n## 13. Otra cosa\n\n## 17. Fuentes\n';
    assert.deepEqual(referenciasRotas(md), []);
  });

  test('el detector no marca la referencia que sí existe', () => {
    const md = '## 3. Qué se midió\n\nLa sección 17 da el detalle.\n\n## 17. Fuentes\n';
    assert.deepEqual(referenciasRotas(md), []);
  });

  test('el detector deja pasar la referencia a otro documento', () => {
    // Sin esto marcaba siete skills que estaban bien. La frase entera importa:
    // «la sección 9.2 de la base» habla de `spanish-writing`, no de sí misma.
    const md = '## 1. Rol\n\nLa sección 9.2 de la base prohíbe los encabezados.\n';
    assert.deepEqual(referenciasRotas(md), []);
  });

  test('el detector lee de verdad los encabezados', () => {
    // Si `seccionesDe` devolviera un conjunto vacío, el primer test fallaría
    // por todos lados; si devolviera todo, pasaría sin comprobar nada.
    const tri = seccionesDe(readSkill('triangulacion-writing'));
    assert.ok(tri.has('17'), 'no encontró la sección 17');
    assert.ok(tri.has('5.3'), 'no encontró la subsección 5.3');
    assert.ok(!tri.has('99'));
  });

  test('la referencia múltiple se lee entera', () => {
    // «las secciones 5, 6 y 9» son tres referencias en una frase. Leer solo la
    // primera dejaba dos sin comprobar.
    const md = '## 5. A\n\n## 6. B\n\nCon los movimientos de las secciones 5, 6 y 9.\n';
    assert.deepEqual(referenciasRotas(md), ['9, en «secciones 5, 6 y 9»']);
  });
});
