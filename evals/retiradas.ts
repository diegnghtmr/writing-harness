// Skills retiradas cuyo corpus sigue en el manifiesto.
//
// `src/corpus.ts` y `src/mediciones.ts` no se pueden regenerar: el corpus se
// borró y no vuelve. Su valor es ser el registro de lo que se midió el día que
// se midió, y ese registro no se corrige retirando filas, porque entonces deja
// de decir lo que pasó. Retirar una skill retira la skill, no la historia de su
// medición.
//
// La lista vive acá y no dentro del manifiesto por el mismo motivo: el
// manifiesto está fijado por la huella de su propio archivo, así que tocarlo
// para anotar algo posterior a la medición sería mentir sobre cuándo se midió.
//
// Vive en un solo archivo porque la leen dos gates. Repetirla en cada uno es el
// defecto que este repositorio existe para evitar: dos representaciones del
// mismo hecho que se desincronizan sin que nadie lo note.
//
// `evals/corpus.test.ts` la comprueba en tres direcciones: que ningún corpus
// quede huérfano sin estar declarado, que ninguna declarada siga viva, y que
// toda declarada tenga corpus que justificar.

export const RETIRADAS: ReadonlySet<string> = new Set([
  // Retiradas a petición del usuario. Se midieron sobre veinte transcripciones
  // cada una, y esa medición sigue en el manifiesto por lo dicho arriba.
  'kenway-writing',
  'medicendai-writing',
  'sekkyoku-writing',
]);

/** Si esta skill sigue teniendo prosa que leer. */
export function vive(skill: string): boolean {
  return !RETIRADAS.has(skill);
}
