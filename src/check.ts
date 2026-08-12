// El verificador. Toma un texto entregado y devuelve lo que incumple.

import { BASE_RULES, PASADAS, TONES, type Rule, type Severity, assertRules } from './rules.ts';
import { countWords, lineAt, positionAt, splitParagraphs } from './text.ts';

export type Finding = {
  rule: string;
  severity: Severity;
  line: number;
  column: number;
  /** La línea completa donde cae el hallazgo, para poder verlo sin abrir el archivo. */
  excerpt: string;
  message: string;
  fix: string;
  source: string;
};

export type CheckOptions = {
  /** Identificador del tono. Si se omite, solo corre la capa base. */
  tone?: string;
  /** Pasadas opcionales, que solo corren si se piden. */
  pasadas?: readonly string[];
};

export function rulesFor(tone?: string, pasadas: readonly string[] = []): Rule[] {
  const out = [...BASE_RULES];

  if (tone !== undefined) {
    const t = TONES[tone];
    if (t === undefined) {
      throw new Error(`tono desconocido: ${tone}. Disponibles: ${Object.keys(TONES).join(', ')}`);
    }
    out.push(...t.rules);
  }

  for (const id of pasadas) {
    const pasada = PASADAS[id];
    if (pasada === undefined) {
      throw new Error(`pasada desconocida: ${id}. Disponibles: ${Object.keys(PASADAS).join(', ')}`);
    }
    out.push(...pasada.rules);
  }

  return out;
}

export function check(text: string, options: CheckOptions = {}): Finding[] {
  const rules = rulesFor(options.tone, options.pasadas);
  assertRules(rules);

  const findings: Finding[] = [];
  const at = (offset: number) => {
    const { line, column } = positionAt(text, offset);
    return { line, column, excerpt: lineAt(text, offset).trim() };
  };

  for (const rule of rules) {
    if (rule.kind === 'forbidden-pattern') {
      // La regex es compartida y lleva flag g, así que su lastIndex es estado.
      // Se clona para que dos textos seguidos no se pisen.
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          ...at(m.index),
          message: rule.message,
          fix: rule.fix,
          source: rule.source,
        });
        if (m[0] === '') re.lastIndex++;
      }
    }
  }

  const lengthRules = rules.filter((r) => r.kind === 'sentence-length');
  const densityRules = rules.filter((r) => r.kind === 'pattern-density');
  const paraRules = rules.filter((r) => r.kind === 'paragraph-length');
  const runRules = rules.filter((r) => r.kind === 'short-sentence-run');
  const startRules = rules.filter((r) => r.kind === 'sentence-start-run');
  const openingRules = rules.filter((r) => r.kind === 'paragraph-opening');

  const necesitaParrafos =
    lengthRules.length > 0 ||
    densityRules.length > 0 ||
    paraRules.length > 0 ||
    runRules.length > 0 ||
    startRules.length > 0 ||
    openingRules.length > 0;

  if (necesitaParrafos) {
    for (const paragraph of splitParagraphs(text)) {
      for (const sentence of paragraph.sentences) {
        for (const rule of lengthRules) {
          if (sentence.words > rule.max) {
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              ...at(sentence.offset),
              message: `${rule.message} Tiene ${sentence.words}.`,
              fix: rule.fix,
              source: rule.source,
            });
          }
        }
      }

      for (const rule of densityRules) {
        const re = new RegExp(rule.pattern.source, rule.pattern.flags);
        // Se cuentan términos distintos, no apariciones. Repetir una palabra
        // es otro problema, y no el que esta regla mide.
        const distintos = new Set(
          [...paragraph.text.matchAll(re)].map((m) => m[0].toLowerCase().replace(/\s+/gu, ' ')),
        );
        if (distintos.size > rule.maxDistinct) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            ...at(paragraph.offset),
            message: `${rule.message} Hay ${distintos.size}: ${[...distintos].sort().join(', ')}.`,
            fix: rule.fix,
            source: rule.source,
          });
        }
      }

      const palabras = countWords(paragraph.text);
      for (const rule of paraRules) {
        const corto = rule.min !== undefined && palabras < rule.min;
        const largo = rule.max !== undefined && palabras > rule.max;
        if (corto || largo) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            ...at(paragraph.offset),
            message: `${rule.message} Tiene ${palabras}.`,
            fix: rule.fix,
            source: rule.source,
          });
        }
      }

      // Las rachas no cruzan el corte de párrafo: un punto y aparte reinicia el
      // ritmo, y encadenar a través de él no es lo que describe el patrón.
      for (const rule of runRules) {
        let racha = 0;
        let inicio = paragraph.offset;
        for (const s of paragraph.sentences) {
          if (s.words <= rule.shortWords) {
            if (racha === 0) inicio = s.offset;
            racha++;
          } else {
            racha = 0;
          }
          if (racha === rule.maxRun + 1) {
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              ...at(inicio),
              message: `${rule.message} Hay ${rule.maxRun + 1} de ${rule.shortWords} palabras o menos.`,
              fix: rule.fix,
              source: rule.source,
            });
          }
        }
      }

      for (const rule of startRules) {
        let racha = 0;
        let inicio = paragraph.offset;
        for (const s of paragraph.sentences) {
          if (rule.pattern.test(s.text)) {
            if (racha === 0) inicio = s.offset;
            racha++;
          } else {
            racha = 0;
          }
          if (racha === rule.maxRun + 1) {
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              ...at(inicio),
              message: rule.message,
              fix: rule.fix,
              source: rule.source,
            });
          }
        }
      }

      const primera = paragraph.sentences[0];
      if (primera !== undefined) {
        for (const rule of openingRules) {
          if (primera.words <= rule.maxWords && rule.pattern.test(primera.text)) {
            const esLaPrimeraDelTexto = paragraph.offset === splitParagraphs(text)[0]?.offset;
            findings.push({
              rule: rule.id,
              severity: rule.severity,
              ...at(primera.offset),
              message: esLaPrimeraDelTexto
                ? `${rule.message} Y es la primera oración del texto, la más sensible de todas.`
                : rule.message,
              fix: rule.fix,
              source: rule.source,
            });
          }
        }
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function format(findings: Finding[], path: string): string {
  if (findings.length === 0) return `${path}: sin hallazgos`;
  const lines = findings.map((f) => {
    const head = `${path}:${f.line}:${f.column}  ${f.severity}  ${f.rule}  [${f.source}]`;
    return `${head}\n    ${f.message}\n    ${f.fix}\n    > ${f.excerpt}`;
  });
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.length - errors;
  lines.push(`\n${errors} error(es), ${warnings} advertencia(s)`);
  return lines.join('\n');
}
