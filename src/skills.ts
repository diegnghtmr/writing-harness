// Lectura de las skills como fuente de verdad de la prosa.
//
// El test de correspondencia necesita saber qué reglas declara cada SKILL.md.
// Las declara en sus listas de verificación, como ítems numerados que empiezan
// por «¿» y terminan en «?». Este módulo los extrae para poder cotejarlos
// contra `rules.ts`.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SKILLS_DIR = join(REPO_ROOT, 'skills');

export type ChecklistItem = {
  skill: string;
  /** Número tal como aparece en la prosa. Es informativo: renumerar no rompe nada. */
  number: number;
  /** Texto del ítem, con los saltos de línea del original ya unidos. */
  item: string;
  line: number;
};

export function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function readSkill(name: string): string {
  return readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8');
}

/**
 * Extrae los ítems numerados de las listas de verificación.
 *
 * Un ítem abre con `<n>. ¿` y puede continuar en las líneas siguientes hasta el
 * `?` de cierre. Las continuaciones van indentadas, así que se unen con un
 * espacio simple para obtener el texto en una sola línea.
 */
export function checklistItems(name: string): ChecklistItem[] {
  const lines = readSkill(name).split(/\r?\n/u);
  const items: ChecklistItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const opener = /^\s*(\d+)\.\s+(¿.*)$/u.exec(lines[i] as string);
    if (!opener) continue;

    let text = (opener[2] as string).trim();
    let j = i;
    while (!text.endsWith('?') && j + 1 < lines.length) {
      j++;
      const next = (lines[j] as string).trim();
      if (next === '') break;
      text = `${text} ${next}`;
    }
    if (!text.endsWith('?')) continue;

    items.push({
      skill: name,
      number: Number(opener[1]),
      item: text,
      line: i + 1,
    });
    i = j;
  }

  return items;
}

export function allChecklistItems(): ChecklistItem[] {
  return skillNames().flatMap(checklistItems);
}

/** Clave estable de un ítem: la skill y su texto, nunca el número. */
export function itemKey(skill: string, item: string): string {
  return `${skill} :: ${item}`;
}
