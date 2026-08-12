// Regenera `cobertura.ts` midiendo, no transcribiendo.
//
//   node --experimental-strip-types evals/gen.ts
//
// El registro tiene que salir de leer la prosa y las reglas, nunca de copiar a
// mano lo que uno cree que hay. Escribirlo a mano fue la primera versión y duró
// hasta que una reescritura de skill movió seis ítems y el archivo siguió
// afirmando lo de antes.
//
// El `estado` sí es juicio, y por eso se conserva: un ítem que ya estaba
// clasificado mantiene su clasificación. Los que aparecen nuevos entran como
// `criterio` y se imprimen al final, para revisarlos uno por uno en vez de
// dejarlos escondidos entre doscientos.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allRules } from '../src/rules.ts';
import { REPO_ROOT, allDeclarations, itemKey } from '../src/skills.ts';
import { SIN_REGLA } from './cobertura.ts';

const cubiertos = new Set(
  allRules().flatMap((r) => r.checklist.map((c) => itemKey(c.skill, c.item))),
);

const estadoPrevio = new Map(SIN_REGLA.map((e) => [itemKey(e.skill, e.item), e.estado]));

const nuevos: string[] = [];
const filas = allDeclarations()
  .filter((d) => !cubiertos.has(itemKey(d.skill, d.item)))
  .map((d) => {
    const clave = itemKey(d.skill, d.item);
    const estado = estadoPrevio.get(clave);
    if (!estado) nuevos.push(clave);
    return { ...d, estado: estado ?? 'criterio' };
  });

// Las comillas angulares y los apóstrofos abundan en los ítems. Se emiten con
// comillas dobles y se escapan solo esas, que es lo único que puede romper.
const cita = (s: string) => `"${s.replace(/\\/gu, '\\\\').replace(/"/gu, '\\"')}"`;

const cabecera = `// GENERADO por evals/gen.ts. Registro de qué declara la prosa y todavía no tiene
// regla. Es el equivalente de KNOWN_FINDINGS: falla en las dos direcciones.
//
//   mecanizable  se puede medir, falta construirlo
//   criterio     exige juicio sobre el contenido, ninguna regla lo va a cubrir
//   delegado     el ítem solo remite a la lista de otra skill
//
// \`origen\` dice de dónde salió: \`checklist\` de una lista de verificación del
// SKILL.md, \`patron\` de un catálogo numerado en \`references/\`.

export type Estado = 'mecanizable' | 'criterio' | 'delegado';
export type Origen = 'checklist' | 'patron';

export const SIN_REGLA: { skill: string; origen: Origen; item: string; estado: Estado }[] = [
`;

const cuerpo = filas
  .map(
    (f) =>
      `  { skill: '${f.skill}', origen: '${f.origen}', item: ${cita(f.item)}, estado: '${f.estado}' },`,
  )
  .join('\n');

writeFileSync(join(REPO_ROOT, 'evals', 'cobertura.ts'), `${cabecera}${cuerpo}\n];\n`, 'utf8');

const cuenta = (e: string) => filas.filter((f) => f.estado === e).length;
console.log(
  `declaraciones ${allDeclarations().length}, cubiertas ${cubiertos.size}, ` +
    `mecanizable ${cuenta('mecanizable')}, criterio ${cuenta('criterio')}, delegado ${cuenta('delegado')}`,
);
if (nuevos.length) {
  console.log(`\n${nuevos.length} ítems nuevos, todos como 'criterio'. Revisar:`);
  for (const n of nuevos) console.log(`  ${n}`);
}
