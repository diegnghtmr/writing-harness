// Las reglas como datos.
//
// Cada regla es un objeto plano y tipado, sin comportamiento y sin build. Es la
// misma decisión que se tomó con `ChartTheme` en open-slide, y por el mismo
// motivo: una regla tiene que poder leerse, compararse y exportarse sin
// ejecutar nada.
//
// `checklist` es lo que ata cada regla a la prosa que la enuncia. El test de
// correspondencia falla si una regla reclama un ítem que ya no existe en el
// SKILL.md, y falla si un ítem de la prosa no lo reclama nadie. Sin esa atadura
// las dos representaciones divergen, que es exactamente el bicho que ya nos
// mordió con la raya y con el punto y coma.

export type Severity = 'error' | 'warning';

/**
 * Referencia a lo que una skill declara y esta regla hace cumplir.
 *
 * Puede ser un ítem de checklist del SKILL.md o un patrón numerado de un
 * catálogo en `references/`. Una misma regla suele reclamar los dos, porque la
 * base y el catálogo de señales de IA describen la misma prohibición desde
 * lados distintos. Reclamarlos juntos es lo que prueba que hay una sola casa.
 */
export type ChecklistRef = {
  /** Carpeta de la skill, tal cual: `spanish-writing`, `camus-writing`, ... */
  skill: string;
  /** Texto literal del ítem o del título del patrón, sin el número. */
  item: string;
};

/**
 * Arma un patrón a partir de una lista de frases literales.
 *
 * No se usa `\b`: con acentos, el límite de palabra de JavaScript trata la «ó»
 * como frontera y parte «inflación» por la mitad. Los lookarounds sobre
 * `\p{L}` sí respetan el español.
 */
function frases(lista: readonly string[]): RegExp {
  const alternativas = lista
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/ /gu, '\\s+'))
    .join('|');
  return new RegExp(`(?<!\\p{L})(?:${alternativas})(?!\\p{L})`, 'giu');
}

type Common = {
  id: string;
  severity: Severity;
  message: string;
  /** Qué hacer en su lugar. Va en la salida, porque señalar sin arreglar no sirve. */
  fix: string;
  /** Sección de la skill que enuncia la regla. */
  source: string;
  checklist: ChecklistRef[];
};

/** Un patrón que no debe aparecer en el texto entregado. */
export type PatternRule = Common & {
  kind: 'forbidden-pattern';
  /** Debe llevar los flags `g` y `u`. `assertRules` lo verifica. */
  pattern: RegExp;
};

/** Un techo de palabras por oración. Pertenece a la capa de tono. */
export type SentenceLengthRule = Common & {
  kind: 'sentence-length';
  max: number;
};

export type Rule = PatternRule | SentenceLengthRule;

/** Un tono es un conjunto de reglas propias más un nombre. Nada más. */
export type Tone = {
  id: string;
  /** Carpeta de la skill que lo declara. */
  skill: string;
  rules: Rule[];
};

// ---------------------------------------------------------------------------
// Capa base: rige siempre, con cualquier tono.
// ---------------------------------------------------------------------------

export const BASE_RULES: Rule[] = [
  {
    id: 'no-raya',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Raya, semirraya y el doble guion que la imita. El guion simple entre
    // palabras («teórico-práctico») es legítimo y queda fuera a propósito.
    pattern: /[—–]|(?<![\p{L}\d-])--(?![\p{L}\d-])/gu,
    message: 'La raya y el guion largo están prohibidos en todo tono y todo género.',
    fix: 'Sustituir por punto y oración nueva, coma para un inciso breve, dos puntos para una explicación, o paréntesis.',
    source: 'spanish-writing §6.6',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿No queda ninguna raya, guion largo ni punto y coma en el texto?',
      },
      // El catálogo de señales de IA la declara por su cuenta. Es la misma
      // prohibición, y esta regla la hace cumplir para las dos.
      { skill: 'humanizar-espanol', item: 'La raya (—) calcada del inglés: elimínala' },
    ],
  },
  {
    id: 'no-punto-y-coma',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: /;/gu,
    message: 'El punto y coma está prohibido.',
    fix: 'Sustituir por punto y oración nueva, por coma si la relación es breve, o por dos puntos si el segundo miembro explica al primero.',
    source: 'spanish-writing §6.7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿No queda ninguna raya, guion largo ni punto y coma en el texto?',
      },
    ],
  },
  {
    id: 'andamiaje-vacio',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'es importante destacar que',
      'es importante señalar que',
      'cabe destacar que',
      'cabe señalar que',
      'cabe resaltar que',
      'cabe mencionar que',
      'vale la pena mencionar que',
      'vale la pena destacar que',
      'resulta fundamental subrayar que',
      'resulta importante destacar que',
    ]),
    message: 'Andamiaje vacío: anuncia que algo importa en lugar de decirlo.',
    fix: 'Suprimir la fórmula sin sustituto. «Es importante destacar que los datos muestran una caída» es «Los datos muestran una caída».',
    source: 'spanish-writing §11.7',
    checklist: [
      { skill: 'spanish-writing', item: '¿El vocabulario evita las palabras y expresiones prohibidas?' },
      { skill: 'humanizar-espanol', item: 'Andamiaje vacío' },
    ],
  },
  {
    id: 'aperturas-de-molde',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'en la actualidad',
      'hoy en día',
      'a lo largo de la historia',
      'desde tiempos inmemoriales',
      'en un mundo cada vez más',
      'en un mundo donde',
      'en la era digital',
    ]),
    message: 'Apertura de molde: una generalidad de calendario en vez del asunto.',
    fix: 'Empezar por lo concreto. Si el dato es de 2019, decir 2019.',
    source: 'spanish-writing §11.8',
    checklist: [
      { skill: 'spanish-writing', item: '¿No hay introducciones ni cierres genéricos?' },
      { skill: 'humanizar-espanol', item: 'Aperturas de molde' },
    ],
  },
  {
    id: 'cierres-anunciados',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'en conclusión',
      'para concluir',
      'para cerrar',
      'en resumen',
      'en síntesis',
      'para finalizar',
      'en definitiva',
      'resumiendo',
    ]),
    message: 'Cierre anunciado: declara que cierra en vez de cerrar.',
    fix: 'El último párrafo cierra por su contenido. Retomar la idea central sin anunciarse.',
    source: 'spanish-writing §11.5',
    checklist: [
      { skill: 'spanish-writing', item: '¿No hay introducciones ni cierres genéricos?' },
      { skill: 'humanizar-espanol', item: 'Cierres anunciados' },
    ],
  },
  {
    id: 'emojis-y-hashtags',
    kind: 'forbidden-pattern',
    // Un emoji real, o una almohadilla seguida de letra. `#1` es una
    // numeración legítima y queda fuera a propósito.
    pattern: /\p{Extended_Pictographic}|(?<![\p{L}\d])#\p{L}/gu,
    severity: 'error',
    message: 'Emojis y hashtags están prohibidos en todo texto entregado.',
    fix: 'Suprimirlos. Si el emoji cargaba sentido, decirlo con palabras.',
    source: 'spanish-writing §12.1',
    checklist: [
      { skill: 'spanish-writing', item: '¿No hay emojis ni hashtags?' },
      { skill: 'humanizar-espanol', item: 'Emojis' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Capa de tono: se elige exactamente una.
// ---------------------------------------------------------------------------

export const TONES: Record<string, Tone> = {
  camus: {
    id: 'camus',
    skill: 'camus-writing',
    rules: [
      {
        id: 'oracion-maxima',
        kind: 'sentence-length',
        severity: 'error',
        // camus-writing §5.2 recomienda 25 y obliga a dividir por encima de 30.
        // El techo medible es 30; 25 es preferencia, no incumplimiento.
        max: 30,
        message: 'La oración supera las 30 palabras.',
        fix: 'Dividirla. La extensión recomendada es 25 palabras.',
        source: 'camus-writing §5.2',
        checklist: [
          { skill: 'camus-writing', item: '¿Las oraciones no superan las 30 palabras?' },
        ],
      },
    ],
  },
  fonda: { id: 'fonda', skill: 'fonda-writing', rules: [] },
  catedra: { id: 'catedra', skill: 'catedra-writing', rules: [] },
};

export const TONE_IDS = Object.keys(TONES);

/** Todas las reglas declaradas, de cualquier capa. */
export function allRules(): Rule[] {
  return [...BASE_RULES, ...Object.values(TONES).flatMap((t) => t.rules)];
}

/**
 * Comprobaciones de forma sobre las propias reglas. Una regla mal declarada
 * falla en silencio al medir, así que se verifica antes de usarla.
 */
export function assertRules(rules: Rule[] = allRules()): void {
  const seen = new Set<string>();
  for (const r of rules) {
    if (seen.has(r.id)) throw new Error(`regla duplicada: ${r.id}`);
    seen.add(r.id);
    if (r.checklist.length === 0) {
      throw new Error(`la regla ${r.id} no reclama ningún ítem de checklist`);
    }
    if (r.kind === 'forbidden-pattern') {
      if (!r.pattern.flags.includes('g')) {
        throw new Error(`la regla ${r.id} necesita el flag g`);
      }
      if (!r.pattern.flags.includes('u')) {
        throw new Error(`la regla ${r.id} necesita el flag u`);
      }
    }
  }
}
