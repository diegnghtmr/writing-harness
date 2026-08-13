// El verificador. Toma un texto entregado y devuelve lo que incumple.

import {
  BASE_RULES,
  PASADAS,
  TONES,
  type Dominio,
  type Rule,
  type Severity,
  assertRules,
} from './rules.ts';
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

/**
 * Las tres capas, compuestas en el orden en que mandan.
 *
 * La base corre siempre y no cede nada. Encima va el tono, si se pidió uno.
 * Encima van las pasadas, si se pidió alguna, y una pasada puede relevar al
 * tono en lo que declare: cuando el usuario pide humanizar de forma explícita,
 * la pasada decide el ritmo y las reglas de ritmo del tono se retiran.
 *
 * Esa precedencia estaba escrita en `camus-writing` §3.1 y no en el código,
 * así que humanizar un texto académico devolvía once errores de `oracion-maxima`
 * y el arreglo propuesto deshacía la humanización. Las tres combinaciones
 * posibles quedan cubiertas: sin pasada no cambia nada, con pasada y sin tono no
 * hay a quién relevar, y con tono y pasada gana la pasada en su dominio.
 */
export function rulesFor(tone?: string, pasadas: readonly string[] = []): Rule[] {
  const activas = pasadas.map((id) => {
    const pasada = PASADAS[id];
    if (pasada === undefined) {
      throw new Error(`pasada desconocida: ${id}. Disponibles: ${Object.keys(PASADAS).join(', ')}`);
    }
    return pasada;
  });

  const relevados = new Set<Dominio>(activas.flatMap((p) => p.anula));
  const out = [...BASE_RULES];

  if (tone !== undefined) {
    const t = TONES[tone];
    if (t === undefined) {
      throw new Error(`tono desconocido: ${tone}. Disponibles: ${Object.keys(TONES).join(', ')}`);
    }
    out.push(...t.rules.filter((r) => r.gobierna === undefined || !relevados.has(r.gobierna)));
  }

  for (const pasada of activas) out.push(...pasada.rules);

  return out;
}

/**
 * Qué reglas del tono se retiraron por haber pedido una pasada, y cuál lo hizo.
 *
 * Existe para que la decisión se pueda ver desde fuera. Un texto al que se le
 * relajó el techo de oración sin decirlo se parece demasiado a un texto que
 * pasó porque nadie lo miró.
 */
export function relevadas(tone?: string, pasadas: readonly string[] = []): { regla: string; por: string }[] {
  if (tone === undefined) return [];
  const t = TONES[tone];
  if (t === undefined) return [];
  const out: { regla: string; por: string }[] = [];
  for (const id of pasadas) {
    const pasada = PASADAS[id];
    if (pasada === undefined) continue;
    for (const r of t.rules) {
      if (r.gobierna !== undefined && pasada.anula.includes(r.gobierna)) {
        out.push({ regla: r.id, por: pasada.id });
      }
    }
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

  const protegidas = zonasProtegidas(text);
  const protegido = (i: number) => protegidas.some(([a, b]) => i >= a && i < b);


  for (const rule of rules) {
    if (rule.kind === 'forbidden-pattern') {
      // La regex es compartida y lleva flag g, así que su lastIndex es estado.
      // Se clona para que dos textos seguidos no se pisen.
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        // Las excepciones se comparan respetando mayúsculas, que es lo único
        // que separa la sigla «TI» del pronombre «ti».
        if (protegido(m.index) || rule.excepciones?.includes(m[0])) {
          if (m[0] === '') re.lastIndex++;
          continue;
        }
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

  // Reglas que miran el texto entero, no un párrafo ni una oración.
  const todasLasOraciones = splitParagraphs(text).flatMap((p) => p.sentences);

  for (const rule of rules) {
    if (rule.kind === 'must-contain') {
      if (todasLasOraciones.length < rule.minSentences) continue;
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      const distintos = new Set([...text.matchAll(re)].map((m) => m[0].toLowerCase()));
      if (distintos.size < rule.minDistinct) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          ...at(0),
          message: `${rule.message} Se esperaban ${rule.minDistinct}, hay ${distintos.size}.`,
          fix: rule.fix,
          source: rule.source,
        });
      }
    }

    if (rule.kind === 'pattern-ratio') {
      if (todasLasOraciones.length < rule.minSentences) continue;
      const encajan = todasLasOraciones.filter((s) => rule.pattern.test(s.text));
      const fraccion = encajan.length / todasLasOraciones.length;
      if (fraccion > rule.max) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          ...at(encajan[0]?.offset ?? 0),
          message: `${rule.message} ${encajan.length} de ${todasLasOraciones.length} oraciones, ${Math.round(fraccion * 100)} %.`,
          fix: rule.fix,
          source: rule.source,
        });
      }
    }

    if (rule.kind === 'sentence-length-spread') {
      if (todasLasOraciones.length < rule.minSentences) continue;
      const breves = todasLasOraciones.filter((s) => s.words <= rule.shortWords).length;
      const largas = todasLasOraciones.filter((s) => s.words >= rule.longWords).length;
      if (breves === 0 || largas === 0) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          ...at(0),
          message: `${rule.message} ${breves} de ${rule.shortWords} palabras o menos, ${largas} de ${rule.longWords} o más.`,
          fix: rule.fix,
          source: rule.source,
        });
      }
    }

    if (rule.kind === 'quote-level') {
      for (const offset of comillasDePrimerNivel(text)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          ...at(offset),
          message: rule.message,
          fix: rule.fix,
          source: rule.source,
        });
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Tramos del texto que no se lintean como prosa española.
 *
 * Una URL lleva `?` en su cadena de consulta, `#` en su fragmento y puntos
 * decimales en cualquier parte, así que dispara los signos de apertura, los
 * hashtags y las convenciones de número sin que nada de eso sea prosa. Un
 * fragmento de código entre acentos graves tiene el mismo problema.
 *
 * Lo encontró un agente al escribir una sección de fuentes: todas sus URLs de
 * video quedaban marcadas por el `?v=`.
 */
function zonasProtegidas(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /(?:https?:\/\/|www\.)\S+|`[^`\n]+`/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push([m.index, m.index + m[0].length]);
  }
  return out;
}

/**
 * Desplazamientos de las comillas inglesas usadas en primer nivel.
 *
 * Recorre el texto llevando la cuenta de las angulares abiertas. Dentro de unas
 * angulares, las inglesas son el segundo nivel y son correctas. Fuera, no. Esa
 * diferencia no la expresa ninguna regex, y por eso este escaneo existe.
 */
function comillasDePrimerNivel(text: string): number[] {
  const out: number[] = [];
  let dentro = 0;
  let abierta = -1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '«') dentro++;
    else if (c === '»') dentro = Math.max(0, dentro - 1);
    else if (c === '"' || c === '“' || c === '”') {
      if (dentro > 0) continue;
      // Se marca el par, no cada comilla suelta, para no duplicar el hallazgo.
      if (abierta === -1) abierta = i;
      else {
        out.push(abierta);
        abierta = -1;
      }
    }
  }
  return out;
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
