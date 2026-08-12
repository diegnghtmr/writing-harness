// Lectura de las skills como fuente de verdad de la prosa.
//
// El test de correspondencia necesita saber qué reglas declara cada skill. Las
// declara de dos maneras, y hay que leer las dos:
//
//   1. Listas de verificación en el SKILL.md, como ítems numerados que empiezan
//      por «¿» y terminan en «?».
//   2. Catálogos en `references/`, como patrones numerados con encabezado
//      `### N. Título`.
//
// La segunda existe porque `humanizar-espanol` no declara ni un solo ítem
// numerado: sus reglas son los 37 patrones del catálogo, y su lista de entrega
// es una oración en prosa. Leer solo el SKILL.md dejaba fuera del gate a la
// skill con más reglas de todas.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SKILLS_DIR = join(REPO_ROOT, 'skills');

/** Cómo declara la prosa una regla. */
export type Origen = 'checklist' | 'patron';

export type Declaracion = {
  skill: string;
  origen: Origen;
  /** Número tal como aparece en la prosa. Es informativo: renumerar no rompe nada. */
  number: number;
  /**
   * Texto literal. Para `checklist`, la pregunta completa. Para `patron`, el
   * título del encabezado. No colisionan: una pregunta siempre abre con «¿».
   */
  item: string;
  /** Archivo relativo a la carpeta de la skill. */
  file: string;
  line: number;
};

/** Alias histórico. Una declaración de checklist es una declaración más. */
export type ChecklistItem = Declaracion;

/**
 * Carpetas de skill que de verdad tienen un `SKILL.md`.
 *
 * El filtro no es cosmético. Una carpeta a medio crear, sin su `SKILL.md`,
 * hacía reventar el lector con ENOENT y se llevaba puesto el gate entero. Una
 * skill en construcción no puede tumbar la verificación de las demás.
 */
export function skillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(SKILLS_DIR, e.name, 'SKILL.md')))
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
export function checklistItems(name: string): Declaracion[] {
  const lines = readSkill(name).split(/\r?\n/u);
  const items: Declaracion[] = [];

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
      origen: 'checklist',
      number: Number(opener[1]),
      item: text,
      file: 'SKILL.md',
      line: i + 1,
    });
    i = j;
  }

  return items;
}

/**
 * Extrae los patrones numerados de los catálogos en `references/`.
 *
 * Un patrón es un encabezado `### N. Título`. El índice en prosa que suele
 * abrir esos archivos usa `N)` en vez de `### N.`, así que no interfiere.
 */
export function cataloguePatterns(name: string): Declaracion[] {
  const dir = join(SKILLS_DIR, name, 'references');
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .flatMap((f) => {
      const lines = readFileSync(join(dir, f), 'utf8').split(/\r?\n/u);
      const out: Declaracion[] = [];
      for (let i = 0; i < lines.length; i++) {
        const m = /^###\s+(\d+)\.\s+(.+?)\s*$/u.exec(lines[i] as string);
        if (!m) continue;
        out.push({
          skill: name,
          origen: 'patron',
          number: Number(m[1]),
          item: m[2] as string,
          file: join('references', f).replace(/\\/gu, '/'),
          line: i + 1,
        });
      }
      return out;
    });
}

/** Todo lo que una skill declara, por las dos vías. */
export function declarations(name: string): Declaracion[] {
  return [...checklistItems(name), ...cataloguePatterns(name)];
}

export function allDeclarations(): Declaracion[] {
  return skillNames().flatMap(declarations);
}

/** Alias histórico. */
export const allChecklistItems = allDeclarations;

/** Clave estable de un ítem: la skill y su texto, nunca el número. */
export function itemKey(skill: string, item: string): string {
  return `${skill} :: ${item}`;
}
