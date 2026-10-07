// Segmentación de texto plano.
//
// El entregable no lleva markdown: `spanish-writing` §12.1 lo prohíbe. Así que
// acá no hay AST ni parser de markup, solo párrafos separados por línea en
// blanco y oraciones separadas por puntuación terminal. Es menos potente que un
// AST y es lo correcto para lo que de verdad se entrega.

export type Span = {
  /** Desplazamiento en caracteres desde el inicio del texto. */
  offset: number;
  text: string;
};

export type Sentence = Span & {
  /** Palabras contadas como secuencias separadas por espacio en blanco. */
  words: number;
};

export type Paragraph = Span & {
  sentences: Sentence[];
};

export type Position = { line: number; column: number };

/** Convierte un desplazamiento en línea y columna, ambas base 1. */
export function positionAt(text: string, offset: number): Position {
  let line = 1;
  let lastBreak = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lastBreak = i;
    }
  }
  return { line, column: offset - lastBreak };
}

/**
 * El texto en NFC, y para cada desplazamiento de esa forma el que le corresponde
 * en el original. Las reglas miden la forma compuesta, pero quien lee un hallazgo
 * busca la posición en su archivo, donde cada tilde aparte es un carácter más.
 *
 * Se normaliza por tramos de una letra con sus marcas combinantes. Si la suma de
 * los tramos no da la normalización del texto entero, que solo pasa con
 * composiciones entre dos letras base que el español no usa, las posiciones se
 * calculan sobre la forma compuesta: un desplazamiento de esa forma aplicado al
 * original podría caer en otra línea.
 */
export function enNfc(original: string): { text: string; fuente: string; aOriginal: (offset: number) => number } {
  const text = original.normalize('NFC');
  const sinCambio = { text, fuente: text, aOriginal: (offset: number) => offset };
  if (text === original) return sinCambio;
  const tramos = original.match(/\P{M}\p{M}*|\p{M}+/gsu) ?? [];
  const mapa: number[] = [];
  let unido = '';
  let pos = 0;
  for (const tramo of tramos) {
    const compuesto = tramo.normalize('NFC');
    for (let i = 0; i < compuesto.length; i++) mapa.push(pos);
    unido += compuesto;
    pos += tramo.length;
  }
  mapa.push(original.length);
  if (unido !== text) return sinCambio;
  return { text, fuente: original, aOriginal: (offset) => mapa[Math.min(Math.max(offset, 0), mapa.length - 1)]! };
}

/** Devuelve la línea completa que contiene el desplazamiento, sin el salto. */
export function lineAt(text: string, offset: number): string {
  const start = text.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
  const end = text.indexOf('\n', offset);
  return text.slice(start, end === -1 ? text.length : end);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/u).length;
}

// Un punto no siempre termina una oración. Estas son las abreviaturas que de
// verdad aparecen en los géneros que cubren las skills: citas académicas,
// tratamientos y referencias normativas.
const ABBREVIATIONS = [
  'p',
  'pp',
  'cap',
  'ed',
  'eds',
  'vol',
  'núm',
  'num',
  'fig',
  'art',
  'trad',
  'coord',
  'comp',
  'op',
  'cit',
  'etc',
  'ss',
  'sr',
  'sra',
  'dr',
  'dra',
  'lic',
  'ing',
  'av',
  'ej',
];

function endsWithAbbreviation(text: string): boolean {
  const m = /([\p{L}]+)\.$/u.exec(text.trimEnd());
  if (!m) return false;
  const word = (m[1] as string).toLowerCase();
  // Una inicial suelta («J. Á. Valente») tampoco cierra oración.
  if (word.length === 1) return true;
  return ABBREVIATIONS.includes(word);
}

/**
 * Parte un párrafo en oraciones. Termina en `.`, `?`, `!` o `…`, saltando las
 * abreviaturas conocidas. El signo de cierre queda dentro de la oración.
 */
export function splitSentences(paragraph: string, base = 0): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const terminal = /[.?!…]/gu;
  let m: RegExpExecArray | null;

  while ((m = terminal.exec(paragraph)) !== null) {
    let end = m.index + 1;
    // Absorbe los signos de cierre que van pegados: «...», ».», «!»
    while (end < paragraph.length && /["»')\]….]/u.test(paragraph[end] as string)) {
      end++;
    }
    const candidate = paragraph.slice(start, end);
    if (endsWithAbbreviation(candidate)) continue;

    const text = candidate.trim();
    if (text !== '') {
      const lead = candidate.length - candidate.trimStart().length;
      out.push({ offset: base + start + lead, text, words: countWords(text) });
    }
    start = end;
    terminal.lastIndex = end;
  }

  // Cola sin puntuación terminal. Cuenta igual: una oración sin punto final
  // sigue siendo una oración, y suele ser justamente la que hay que medir.
  const tail = paragraph.slice(start).trim();
  if (tail !== '') {
    const lead = paragraph.slice(start).length - paragraph.slice(start).trimStart().length;
    out.push({ offset: base + start + lead, text: tail, words: countWords(tail) });
  }

  return out;
}

/** Parte el texto en párrafos separados por al menos una línea en blanco. */
export function splitParagraphs(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  const re = /(?:\r?\n[ \t]*){2,}/gu;
  let start = 0;

  const push = (chunk: string, at: number) => {
    const body = chunk.trim();
    if (body === '') return;
    const lead = chunk.length - chunk.trimStart().length;
    const offset = at + lead;
    out.push({ offset, text: body, sentences: splitSentences(body, offset) });
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    push(text.slice(start, m.index), start);
    start = m.index + m[0].length;
  }
  push(text.slice(start), start);

  return out;
}
