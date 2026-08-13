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

/**
 * Términos que por separado son legítimos y juntos son una firma.
 *
 * El catálogo lo dice con todas las letras sobre el vocabulario de IA: «No
 * están prohibidas de forma absoluta, pero su acumulación es una firma. Cuando
 * veas varias en un mismo pasaje, reescribe». Modelarlo como prohibición plana
 * contradiría el texto que dice hacer cumplir.
 */
export type DensityRule = Common & {
  kind: 'pattern-density';
  /** Debe llevar los flags `g` y `u`. */
  pattern: RegExp;
  /** Cuántos términos distintos tolera un mismo párrafo. Se marca al superarlo. */
  maxDistinct: number;
};

/** Un rango de palabras por párrafo. Pertenece a la capa de tono. */
export type ParagraphLengthRule = Common & {
  kind: 'paragraph-length';
  min?: number;
  max?: number;
};

/**
 * Una racha de oraciones cortas seguidas. Es el staccato del patrón 32: una
 * frase breve destaca, una cadena de frases breves suena de fábrica.
 */
export type ShortSentenceRunRule = Common & {
  kind: 'short-sentence-run';
  /** Hasta cuántas palabras cuenta como oración corta. */
  shortWords: number;
  /** Cuántas cortas seguidas tolera. Se marca al superarlo. */
  maxRun: number;
};

/** Oraciones consecutivas que arrancan con la misma clase de fórmula. */
export type SentenceStartRunRule = Common & {
  kind: 'sentence-start-run';
  /** Se prueba contra el inicio de cada oración. Sin flag `g`. */
  pattern: RegExp;
  maxRun: number;
};

/** Párrafos que abren con una etiqueta breve. Es el patrón 37. */
export type ParagraphOpeningRule = Common & {
  kind: 'paragraph-opening';
  maxWords: number;
  /** Lo que hace de la apertura una etiqueta, normalmente la cópula. Sin flag `g`. */
  pattern: RegExp;
};

/**
 * Lo que el texto tiene que contener. Su ausencia es el defecto.
 *
 * Es el reverso de todas las demás. Un tono como fonda no se define solo por lo
 * que prohíbe: exige tuteo, preguntas retóricas y primera persona. Una regla que
 * solo sabe prohibir no puede comprobar eso.
 */
export type MustContainRule = Common & {
  kind: 'must-contain';
  /** Debe llevar los flags `g` y `u`. */
  pattern: RegExp;
  /** Cuántas coincidencias distintas hacen falta. */
  minDistinct: number;
  /** Solo se exige a textos de al menos esta cantidad de oraciones. */
  minSentences: number;
};

/** Proporción de oraciones que encajan en un patrón. */
export type RatioRule = Common & {
  kind: 'pattern-ratio';
  /** Se prueba contra cada oración. Sin flag `g`. */
  pattern: RegExp;
  /** Fracción máxima tolerada, de 0 a 1. */
  max: number;
  minSentences: number;
};

/**
 * Comillas inglesas usadas como primer nivel.
 *
 * No se puede con una regex: hay que recorrer el texto llevando la cuenta de si
 * se está dentro de unas angulares. En segundo nivel las inglesas son correctas,
 * y esa diferencia solo la ve un escaneo con estado.
 */
export type QuoteLevelRule = Common & {
  kind: 'quote-level';
};

/**
 * El texto debe alternar oraciones breves y largas, no igualarlas.
 *
 * Ni `camus-writing` ni `fonda-writing` declaran un número para esto: los dos
 * piden variar la longitud y ninguno dice cuánto. Los umbrales se toman
 * prestados del §4 de `humanizar-espanol`, que sí los fija: «oraciones breves
 * de seis a diez palabras junto a oraciones largas de veinticinco o más».
 *
 * Como el número es prestado y no declarado por el tono, estas reglas avisan y
 * no bloquean.
 */
export type LengthSpreadRule = Common & {
  kind: 'sentence-length-spread';
  /** Hasta cuántas palabras cuenta como breve. */
  shortWords: number;
  /** Desde cuántas cuenta como larga. */
  longWords: number;
  minSentences: number;
};

export type Rule =
  | PatternRule
  | SentenceLengthRule
  | DensityRule
  | ParagraphLengthRule
  | ShortSentenceRunRule
  | SentenceStartRunRule
  | ParagraphOpeningRule
  | MustContainRule
  | RatioRule
  | QuoteLevelRule
  | LengthSpreadRule;

/** Un tono es un conjunto de reglas propias más un nombre. Nada más. */
export type Tone = {
  id: string;
  /** Carpeta de la skill que lo declara. */
  skill: string;
  rules: Rule[];
};

// Marcas de tuteo y voseo. Se listan solo las inequívocas: «te» y «tu» quedan
// fuera porque aparecen en usos que no son interpelación directa.
//
// El voseo entra junto al tuteo. Las skills hablaban de «tutear», pero el ítem
// que esta lista hace cumplir pide «usted», y el voseo tampoco lo es. Dejarlo
// pasar habría abierto un agujero del tamaño de media Latinoamérica.
const MARCAS_DE_SEGUNDA_PERSONA = [
  // Tuteo
  'tú',
  'ti',
  'contigo',
  'tuyo',
  'tuya',
  'tuyos',
  'tuyas',
  'tienes',
  'puedes',
  'sabes',
  'quieres',
  'debes',
  'haces',
  'piensas',
  'fíjate',
  'acuérdate',
  // Voseo
  'vos',
  'sos',
  'tenés',
  'podés',
  'sabés',
  'querés',
  'debés',
  'hacés',
  'pensás',
  'decís',
  'venís',
  'fijate',
  'acordate',
];

// Segunda persona del plural peninsular. Pronombre, posesivo y morfología
// verbal. El átono «os» no entra en esta lista: como palabra suelta es
// ambigua en textos que citan latín o siglas, y va aparte con su propio
// contexto.
const MARCAS_PENINSULARES = [
  'vosotros',
  'vosotras',
  'vuestro',
  'vuestra',
  'vuestros',
  'vuestras',
  'habéis',
  'tenéis',
  'sois',
  'podéis',
  'queréis',
  'hacéis',
  'estáis',
  'sabéis',
  'veis',
  'vais',
  // «venís» y «decís» son a la vez plural peninsular y voseo. Los cubre
  // `tratamiento-de-usted`, que los nombra por lo que son en América.
  'estabais',
  'teníais',
  'podíais',
  'seríais',
  'tendréis',
  'podréis',
  'seréis',
  'habréis',
  'hagáis',
  'tengáis',
  'seáis',
  'podáis',
  'sepáis',
  'queráis',
  'os lo',
  'os la',
  'os he',
  'os han',
  'os voy',
  'os dejo',
  'os cuento',
  'os digo',
  'os pido',
  'os quiero',
  'os invito',
  'os recuerdo',
  'os parece',
  'os gusta',
  'os haya',
  'se os',
];

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
        item: '¿No queda ninguna raya ni guion largo en el texto?',
      },
      // El catálogo de señales de IA la declara por su cuenta. Es la misma
      // prohibición, y esta regla la hace cumplir para las dos.
      { skill: 'humanizar-espanol', item: 'La raya (—) calcada del inglés: elimínala' },
    ],
  },
  // El punto y coma estuvo prohibido y ya no lo está. La prohibición era una
  // decisión de casa, no una norma, y la RAE lo describe en la Ortografía
  // (2010) § 3.3.3. Lo que se mide ahora es el uso, en tres reglas: dos de
  // forma, que son inequívocas, y una de frecuencia, que es la que vigila el
  // abuso.
  {
    id: 'punto-y-coma-mayuscula',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Después de punto y coma va minúscula, salvo nombre propio. Un patrón
    // amplio del tipo `;\s+\p{Lu}` marcaría «...; España decidió otra cosa»,
    // que es correcto. Por eso solo entran palabras que nunca son nombre
    // propio, con la misma lógica con que `coloquialismos` dejó fuera «de
    // una»: más vale marcar menos que dejar de leerse.
    pattern:
      /;\s+(?:El|La|Los|Las|Un|Una|Unos|Unas|Es|Son|Era|Eran|Se|No|Sin|Por|Para|Esto|Esta|Este|Estos|Estas|Eso|Esa|Ese|Cuando|Aunque|Pero|Además|Ahora|Lo|Le|Les|Su|Sus|Al|Del|De|Si|Que|Como|Más|Menos|También|Tampoco|Todo|Toda|Todos|Todas|Nunca|Siempre|Hay|Hubo|Nada|Nadie|Cada|Otro|Otra|Otros|Otras|Tras|Desde|Hasta|Entre|Sobre|Bajo|Ante)(?!\p{L})/gu,
    message: 'Mayúscula después de punto y coma.',
    fix: 'Va minúscula, salvo nombre propio. Si lo que sigue es una oración nueva y sin relación estrecha con la anterior, el signo correcto es el punto.',
    source: 'spanish-writing §6.7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿El punto y coma va seguido de minúscula y pegado a la palabra anterior?',
      },
    ],
  },
  {
    id: 'punto-y-coma-espaciado',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Espacio delante, o ninguno detrás. El punto y coma al final de línea es
    // legítimo y por eso el segundo caso exige una letra pegada.
    pattern: /\s;|;(?=\p{L})/gu,
    message: 'Espaciado incorrecto del punto y coma.',
    fix: 'Va pegado a la palabra anterior y separado de la siguiente por un espacio: «no es pobreza; es precisión».',
    source: 'spanish-writing §6.7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿El punto y coma va seguido de minúscula y pegado a la palabra anterior?',
      },
    ],
  },
  {
    id: 'punto-y-coma-abusado',
    kind: 'pattern-ratio',
    severity: 'warning',
    pattern: /;/u,
    // Se cuentan oraciones que lo llevan, no apariciones. La diferencia
    // importa: una enumeración de miembros con comas internas acumula quince
    // punto y coma dentro de una sola oración y es el primer uso correcto del
    // §6.7. Una regla que contara apariciones por párrafo marcaría justo el
    // caso bueno.
    //
    // El techo sale de medir el §6.7 contra prosa que lo usa bien: el
    // catálogo de `humanizar-espanol` va en 0,066 y esta base en 0,003. Un
    // quinto deja sitio de sobra y solo se alcanza cuando el signo dejó de
    // separar y se volvió pausa decorativa. Por ser un número elegido y no
    // declarado por la RAE, avisa en vez de bloquear.
    max: 0.2,
    minSentences: 8,
    message: 'El punto y coma aparece en más de una de cada cinco oraciones.',
    fix: 'Dejarlo donde separa miembros con comas internas o une dos oraciones de relación estrecha. En el resto, punto y oración nueva, o dos puntos si el segundo miembro explica al primero.',
    source: 'spanish-writing §6.7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿El punto y coma aparece en menos de una de cada cinco oraciones?',
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
      { skill: 'fonda-writing', item: '¿Se evitó recapitular lo dicho y anunciar el cierre como cierre?' },
      {
        skill: 'catedra-writing',
        item: '¿El cierre remata en una consecuencia breve, sin recapitular ni anunciarse como cierre?',
      },
    ],
  },
  {
    id: 'signos-de-apertura',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Mira hacia atrás buscando el signo de apertura sin cruzar otro cierre.
    // Así «¿Vienes? Esperamos» no arrastra el ¿ a la oración siguiente.
    pattern: /(?<![¿¡][^?!¿¡]{0,300})[?!]/gu,
    message: 'Signo de cierre sin su apertura. El español exige ¿ y ¡.',
    fix: 'Abrir la interrogación o la exclamación donde empieza, no donde empieza la oración.',
    source: 'spanish-writing §4.4',
    checklist: [{ skill: 'spanish-writing', item: '¿Los signos ¿ y ¡ tienen apertura?' }],
  },
  {
    id: 'puntuacion-dentro-de-comillas',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: /[.,]»/gu,
    message: 'La puntuación va fuera de las comillas de cierre.',
    fix: 'Correcto: «Esto es un ejemplo». Incorrecto: «Esto es un ejemplo.»',
    source: 'spanish-writing §6.3',
    checklist: [
      { skill: 'spanish-writing', item: '¿La puntuación va fuera de las comillas de cierre?' },
    ],
  },
  {
    id: 'haber-impersonal',
    kind: 'forbidden-pattern',
    severity: 'error',
    // «Habían llegado» y «hubieron terminado» son perfectos legítimos, así que
    // solo se marca el impersonal seguido de cuantificador o sustantivo, que es
    // donde la concordancia sobra.
    pattern:
      /\bhan\s+habido\b|\bhabrían\s+habido\b|\b(?:habían|hubieron)\s+(?:muchos|muchas|varios|varias|algunos|algunas|pocos|pocas|unos|unas|bastantes|demasiados|demasiadas|más|menos|dos|tres|cuatro|cinco|problemas|casos|personas|razones|motivos)\b/giu,
    message: 'El «haber» impersonal no concuerda: va siempre en singular.',
    fix: '«Había muchas personas», «hubo problemas», «ha habido cambios».',
    source: 'spanish-writing §4.1',
    checklist: [{ skill: 'spanish-writing', item: '¿«Haber» impersonal está en singular?' }],
  },
  {
    id: 'calcos-del-ingles',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'hacer sentido',
      'hace sentido',
      'hacen sentido',
      'hizo sentido',
      'aplicar para',
      'aplicó para',
      'aplicaron para',
      'aplicaré para',
      'en orden de',
      'bajo circunstancias',
      'bajo estas circunstancias',
      'jugar un papel',
      'juega un papel',
      'juegan un papel',
      'jugó un papel',
    ]),
    message: 'Calco del inglés.',
    fix: '«Tener sentido», «postularse a», «para lograr», «en estas circunstancias», «desempeñar un papel».',
    source: 'spanish-writing §5.5 y §5.6',
    checklist: [{ skill: 'spanish-writing', item: '¿No hay calcos del inglés?' }],
  },
  {
    id: 'pasiva-perifrastica',
    kind: 'forbidden-pattern',
    // Advertencia: §5.1 la limita, no la prohíbe. Se justifica cuando el agente
    // es relevante y se quiere enfatizar.
    severity: 'warning',
    pattern:
      /\b(?:fue|fueron|es|son|era|eran|será|serán|ha\s+sido|han\s+sido)\s+\p{L}+(?:ado|ada|ados|adas|ido|ida|idos|idas)\s+por\b/giu,
    message: 'Pasiva perifrástica: el español prefiere la activa o la pasiva refleja.',
    fix: '«El estudio fue realizado por los investigadores» es «Los investigadores realizaron el estudio» o «Se realizó el estudio».',
    source: 'spanish-writing §5.1',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿Se prefiere voz activa o pasiva refleja sobre la pasiva perifrástica?',
      },
    ],
  },
  {
    id: 'mayusculas-de-calendario',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Solo cuando va precedido de palabra o coma, para no marcar el inicio de
    // oración, donde la mayúscula sí corresponde.
    pattern:
      /[\p{Ll},]\s+(?:Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo|Primavera|Verano|Otoño|Invierno)(?!\p{L})/gu,
    message: 'Meses, días y estaciones van en minúscula en español.',
    fix: '«15 de enero de 2024», «el lunes pasado», «en invierno».',
    source: 'spanish-writing §7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿Las mayúsculas son correctas (meses, días, gentilicios en minúscula)?',
      },
    ],
  },
  {
    id: 'dequeismo-y-queismo',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      // Dequeísmo: «de» donde el verbo no lo rige.
      'pienso de que',
      'creo de que',
      'opino de que',
      'considero de que',
      'dijo de que',
      'resulta de que',
      'me dijo de que',
      'pensamos de que',
      'creemos de que',
      // Queísmo: falta el «de» que el régimen exige.
      'me olvidé que',
      'se olvidó que',
      'nos olvidamos que',
      'estoy seguro que',
      'estamos seguros que',
      'me acuerdo que',
      'se dio cuenta que',
      'me di cuenta que',
      'a pesar que',
      'con el fin que',
      'en caso que',
    ]),
    message: 'Dequeísmo o queísmo.',
    fix: 'Sustituir la cláusula por «eso» o «de eso». Si funciona con «de eso», hace falta «de que».',
    source: 'spanish-writing §4.6',
    checklist: [{ skill: 'spanish-writing', item: '¿No hay dequeísmo ni queísmo?' }],
  },
  {
    id: 'numeros-en-espanol',
    kind: 'forbidden-pattern',
    severity: 'error',
    // El punto decimal, no el de millar. En Colombia «1.000» es correcto y
    // «3.14» no, así que se distinguen por la cantidad de dígitos: un grupo de
    // millar tiene exactamente tres.
    pattern: /\d+\.\d{1,2}(?!\d)|\d%/gu,
    message: 'Convención de números ajena al español.',
    fix: 'Separador decimal, coma: 3,14. Millares con punto: 1.000. Porcentaje con espacio: 25 %.',
    source: 'spanish-writing §8',
    checklist: [
      { skill: 'spanish-writing', item: '¿Los números siguen las convenciones del español?' },
    ],
  },
  {
    id: 'mayusculas-de-titulo',
    kind: 'forbidden-pattern',
    severity: 'error',
    // El delator del calco inglés es la palabra funcional en mayúscula entre
    // dos palabras plenas también en mayúscula.
    pattern:
      /\p{Lu}\p{Ll}+\s+(?:Y|O|De|Del|La|El|Los|Las|En|Con|Para|Por|Un|Una|Sobre|Entre|Al)\s+\p{Lu}\p{Ll}/gu,
    message: 'Mayúscula de título calcada del inglés.',
    fix: 'En español solo van en mayúscula la primera palabra y los nombres propios: «Negociaciones estratégicas y alianzas globales».',
    source: 'spanish-writing §7',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿Los encabezados usan mayúscula solo en la primera palabra y en los nombres propios?',
      },
      { skill: 'humanizar-espanol', item: 'Mayúsculas de título en encabezados' },
    ],
  },
  {
    id: 'comillas-de-primer-nivel',
    kind: 'quote-level',
    severity: 'error',
    message: 'Comillas inglesas usadas como primer nivel.',
    fix: 'El primer nivel son las angulares « ». Las inglesas quedan para el segundo, anidadas dentro de aquellas.',
    source: 'spanish-writing §6.3',
    checklist: [
      { skill: 'spanish-writing', item: '¿Las comillas son angulares « » como primer nivel?' },
    ],
  },
  {
    id: 'markdown-en-entrega',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Negrita, cursiva con asteriscos, encabezados y viñetas con rótulo. El
    // guion de viñeta suelto queda fuera: en prosa entregada es un guion.
    pattern: /\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|^#{1,6}\s|^\s*[-*+]\s+\*\*/gmu,
    message: 'Markdown en el texto entregado: negrita, cursiva, encabezado o lista con rótulo.',
    fix: 'Convertir a prosa corrida. «- **Rendimiento:** mejora» es «La actualización mejora el rendimiento».',
    source: 'spanish-writing §12.1',
    checklist: [
      { skill: 'spanish-writing', item: '¿No hay markdown, asteriscos ni negritas?' },
      { skill: 'humanizar-espanol', item: 'Abuso de negrita' },
      { skill: 'humanizar-espanol', item: 'Listas con encabezado en negrita y dos puntos' },
      // catedra lo repite en su propia lista. Es la misma prohibición. fonda
      // dejó de repetirlo al reescribirse, porque duplicaba el ítem 10 de la
      // base, así que ahí no queda nada que reclamar.
      { skill: 'catedra-writing', item: '¿No hay markdown ni asteriscos en el texto entregado?' },
    ],
  },
  {
    id: 'conectores-de-molde-seguidos',
    kind: 'sentence-start-run',
    severity: 'error',
    // El catálogo lo dice de las «oraciones consecutivas», y la base repite que
    // no se arranca dos veces seguidas con un conector formal. Por eso el techo
    // de racha es 1: se marca a partir de la segunda.
    maxRun: 1,
    pattern:
      /^(?:además|asimismo|por otro lado|por su parte|en este sentido|cabe destacar que|cabe señalar que|por consiguiente|de igual manera|de igual forma|en consecuencia|no obstante|sin embargo)\b/iu,
    message: 'Conectores de molde al inicio de oraciones consecutivas.',
    fix: 'Variar el conector, moverlo dentro de la oración o suprimirlo. Muchas transiciones son implícitas: la oración siguiente retoma un término de la anterior.',
    source: 'spanish-writing §10.4',
    checklist: [
      { skill: 'spanish-writing', item: '¿Los conectores son variados y no se repiten en párrafos contiguos?' },
      { skill: 'humanizar-espanol', item: 'Conectores de molde al inicio de oración' },
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
  {
    id: 'artefacto-de-canal',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Casi todos los corpus de tono son habla grabada para un canal, y traen
    // encima una capa que pertenece al medio y no al autor. Doce skills la
    // descartaban cada una por su cuenta, con su propia lista. Acá vive una
    // vez, en la base, porque la prueba del §11.10 no depende del tono: si la
    // frase deja de tener sentido leída en una página, era del canal.
    //
    // La deixis de pantalla («acá vemos», «este gráfico») no entra: en un
    // texto con figuras numeradas es legítima, y distinguir las dos exige leer
    // el documento entero.
    pattern: frases([
      'suscríbete',
      'suscríbanse',
      'suscribirse al canal',
      'dale like',
      'denle like',
      'un me gusta',
      'la campanita',
      'activen la campanita',
      'en los comentarios',
      'déjenlo en los comentarios',
      'coméntenme',
      'nos vemos en el próximo',
      'hasta el próximo video',
      'bienvenidos al canal',
      'bienvenidos a un nuevo',
      'en el video de hoy',
      'en este video',
      'en el video de la semana pasada',
      'el video de hoy',
      'link en la descripción',
      'enlace en la descripción',
      'lo dejo en la descripción',
      'lo dejo abajo',
      'patrocinado por',
      'gracias a nuestro patrocinador',
      'el patrocinador de hoy',
      'código de descuento',
      'quédense hasta el final',
      'quédate hasta el final',
      'aviso de spoiler',
      'alerta de spoiler',
      'sin spoilers',
      // Quedaron fuera «antes de empezar», «ahora les cuento» y «ya les voy a
      // contar». En un ensayo son marcadores de discurso legítimos, y una
      // regla que marca lo legítimo se deja de leer.
    ]),
    message: 'Artefacto de canal: pertenece al video, no al texto.',
    fix: 'Suprimirlo. Si cargaba una idea del argumento, decirla sin la referencia al canal. La prueba: si la frase pierde sentido leída en una página, era del canal.',
    source: 'spanish-writing §11.10',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿El texto quedó libre de artefactos de canal: saludo, despedida, petición de apoyo, patrocinio, deixis de pantalla y promesa de revelación?',
      },
    ],
  },
  {
    id: 'espanol-peninsular',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Vivió un tiempo dentro de `catedra`, que era la única skill que lo
    // declaraba. Subió a la base cuando el §9.1 lo convirtió en norma de toda
    // la lengua, y desde entonces reclama los dos ítems.
    //
    // Solo entra la morfología, que no admite duda. El léxico del §9.1
    // («vale», «coger», «tío») queda fuera a propósito: «coger» es corriente
    // en varios países americanos, «vale» tiene usos que no son muletilla y
    // «tío» es un pariente antes que un vocativo. Marcarlos produciría el
    // falso positivo que hace que se deje de leer la salida.
    pattern: frases(MARCAS_PENINSULARES),
    message: 'Segunda persona del plural peninsular. El español de esta base es americano.',
    fix: 'Pasar a «ustedes» con verbo en tercera del plural: «pueden», «tienen», «son», «están». El imperativo es «miren», «fíjense», «denle».',
    source: 'spanish-writing §9.1',
    // Seis skills lo declaran además de la base, porque seis modelos medidos
    // eran peninsulares o mezclaban. Todas describen la misma prohibición y una
    // sola regla las reclama: es lo que prueba que hay una casa y no seis.
    checklist: [
      { skill: 'spanish-writing', item: '¿No hay formas de «vosotros» ni léxico peninsular?' },
      {
        skill: 'catedra-writing',
        item: '¿No se usa español peninsular (sin «vosotros», sin «coger» con sentido de «tomar», sin «vale» como muletilla)?',
      },
      {
        skill: 'bettatech-writing',
        item: '¿La interpelación al lector es sostenida y de usted, sin tuteo, sin «vos» y sin ninguna forma de «vosotros»?',
      },
      {
        skill: 'dotcsv-writing',
        item: '¿Se evitan el «vosotros» y el léxico peninsular, sin excepción, y el lector queda tratado de usted?',
      },
      {
        skill: 'fonseca-writing',
        item: '¿Están ausentes el tuteo, que en el material medido solo aparece en bloques de autopromoción, y toda forma de «vosotros»?',
      },
      {
        skill: 'kenway-writing',
        item: '¿El lector queda tratado de usted, sin tuteo y sin ninguna forma de vosotros?',
      },
      {
        skill: 'sekkyoku-writing',
        item: '¿Se interpela al lector de usted, sin tuteo y sin ninguna forma de segunda persona del plural peninsular?',
      },
      {
        skill: 'schiavenato-writing',
        item: '¿Queda descartado el tuteo al público y también el «vosotros»?',
      },
    ],
  },
  {
    id: 'tratamiento-de-usted',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Antes eran dos reglas de tono, `camus-sin-tuteo` y `catedra-sin-tuteo`,
    // porque solo esos dos tonos renunciaban a interpelar. Al volverse norma
    // de la base, una sola regla las sustituye y reclama los tres ítems. Tres
    // reglas idénticas habrían marcado tres veces cada «tú».
    pattern: frases(MARCAS_DE_SEGUNDA_PERSONA),
    message: 'Tuteo o voseo. El tratamiento al lector es «usted» o «ustedes».',
    fix: 'Pasar a «usted» con verbo en tercera del singular, o suprimir la interpelación y escribir en impersonal.',
    source: 'spanish-writing §9.2',
    // Diez skills declaran el tratamiento. Ninguna lo declara igual, porque
    // cada modelo medido trataba a su público a su manera, y todas terminan en
    // la misma prohibición. La regla cubre la mitad prohibitiva de cada ítem;
    // la mitad que pide sostener la interpelación es criterio y no la cubre
    // nadie, igual que pasaba cuando esto vivía dentro de camus.
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿El tratamiento al lector es «usted» o «ustedes», sin tuteo ni voseo?',
      },
      {
        skill: 'camus-writing',
        item: '¿Se usa tercera persona o primera del plural, sin tutear al lector?',
      },
      { skill: 'catedra-writing', item: '¿Se usa «nosotros» inclusivo y no «tú»?' },
      {
        skill: 'atenas-writing',
        item: '¿El público recibe tratamiento de «ustedes», sin alternar con el tuteo ni con el vos?',
      },
      {
        skill: 'atenas-writing',
        item: '¿La generalización va con «uno» y no queda ninguna marca de «tú», ni siquiera impersonal?',
      },
      {
        skill: 'bettatech-writing',
        item: '¿La interpelación al lector es sostenida y de usted, sin tuteo, sin «vos» y sin ninguna forma de «vosotros»?',
      },
      {
        skill: 'dotcsv-writing',
        item: '¿Se evitan el «vosotros» y el léxico peninsular, sin excepción, y el lector queda tratado de usted?',
      },
      {
        skill: 'fonseca-writing',
        item: '¿Están ausentes el tuteo, que en el material medido solo aparece en bloques de autopromoción, y toda forma de «vosotros»?',
      },
      {
        skill: 'freddy-writing',
        item: '¿El tratamiento es «usted» o «ustedes», y el elegido se sostiene en todo el texto?',
      },
      {
        skill: 'kenway-writing',
        item: '¿El lector queda tratado de usted, sin tuteo y sin ninguna forma de vosotros?',
      },
      {
        skill: 'sekkyoku-writing',
        item: '¿Se interpela al lector de usted, sin tuteo y sin ninguna forma de segunda persona del plural peninsular?',
      },
      {
        skill: 'schiavenato-writing',
        item: '¿Queda descartado el tuteo al público y también el «vosotros»?',
      },
      {
        skill: 'dotcsv-writing',
        item: '¿Se reserva la primera persona del plural para el recorrido y el trato de usted para el lector?',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Capa de tono: se elige exactamente una.
// ---------------------------------------------------------------------------

/** El mismo criterio para los dos tonos que piden variar la longitud. */
function variaLongitud(id: string, skill: string, item: string, seccion: string): Rule {
  return {
    id,
    kind: 'sentence-length-spread',
    severity: 'warning',
    shortWords: 10,
    longWords: 25,
    minSentences: 6,
    message: 'Las oraciones están igualadas: falta contraste entre breves y largas.',
    fix: 'Alternar de verdad. Una oración de seis a diez palabras junto a otra de veinticinco o más, no todas en la misma banda.',
    source: `${skill} ${seccion}`,
    checklist: [{ skill, item }],
  };
}

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
      {
        id: 'parrafo-maximo',
        kind: 'paragraph-length',
        severity: 'error',
        // §5.1 dice «Máximo: 150 palabras en casos excepcionales». Es un techo.
        max: 150,
        message: 'El párrafo supera las 150 palabras.',
        fix: 'Partirlo. La extensión recomendada es de 50 a 100 palabras.',
        source: 'camus-writing §5.1',
        checklist: [
          { skill: 'camus-writing', item: '¿Los párrafos tienen entre 50 y 150 palabras?' },
        ],
      },
      {
        id: 'parrafo-minimo',
        kind: 'paragraph-length',
        // Advertencia y no error: §5.1 llama a 50 «extensión recomendada», no
        // mínimo. Un párrafo corto de transición es legítimo, un texto entero
        // de párrafos cortos no.
        severity: 'warning',
        min: 50,
        message: 'El párrafo queda por debajo de las 50 palabras recomendadas.',
        fix: 'Desarrollarlo o fundirlo con el vecino, salvo que sea una transición deliberada.',
        source: 'camus-writing §5.1',
        checklist: [
          { skill: 'camus-writing', item: '¿Los párrafos tienen entre 50 y 150 palabras?' },
        ],
      },
      variaLongitud(
        'camus-varia-longitud',
        'camus-writing',
        '¿Se varía la longitud de las oraciones en lugar de igualarlas?',
        '§5.2',
      ),
    ],
  },
  fonda: {
    id: 'fonda',
    skill: 'fonda-writing',
    rules: [
      // Fonda es el único tono que se define por lo que exige y no por lo que
      // prohíbe. Sin `must-contain` sus tres ítems eran incomprobables.
      {
        id: 'fonda-interpela',
        kind: 'must-contain',
        severity: 'warning',
        // El corpus de este modelo tutea, y hasta la sección 9.2 de la base
        // esta regla exigía tuteo. Lo que se conserva es la interpelación
        // sostenida, que es el rasgo del tono; lo que cambia es la forma, que
        // es de la base. Los imperativos de tercera admiten lectura de
        // subjuntivo subordinado, y eso solo produce falsos presentes: una
        // regla `must-contain` que se equivoca de más deja de avisar, no avisa
        // de más.
        pattern: frases([
          'usted',
          'ustedes',
          'fíjese',
          'fíjense',
          'piense',
          'piensen',
          'imagine',
          'imaginen',
          'observe',
          'observen',
          'considere',
          'consideren',
          'pregúntese',
          'pregúntense',
          'recuerde',
          'recuerden',
        ]),
        minDistinct: 2,
        minSentences: 6,
        message: 'El texto no interpela al lector, y este tono se dirige a él.',
        fix: 'Interpelar de usted y de forma sostenida, no una vez y nunca más: «fíjese en», «piense en», «como usted sabe».',
        source: 'fonda-writing §4.1',
        checklist: [
          {
            skill: 'fonda-writing',
            item: '¿Se interpela al lector de usted, con paso a «ustedes» solo al dirigirse al público?',
          },
        ],
      },
      {
        id: 'fonda-primera-persona',
        kind: 'must-contain',
        severity: 'warning',
        pattern: frases([
          'a mi juicio',
          'creo que',
          'me parece',
          'hemos visto',
          'podemos preguntar',
          'volvamos a',
          'veamos',
          'pasemos a',
        ]),
        minDistinct: 1,
        minSentences: 6,
        message: 'Falta la voz del autor: ni opinión en primera persona ni recorrido en plural.',
        fix: '«A mi juicio», «creo que» para la posición propia. «Hemos visto», «volvamos a» para recorrer el argumento con el lector.',
        source: 'fonda-writing §4.1',
        checklist: [
          {
            skill: 'fonda-writing',
            item: '¿Aparece el yo de quien escribe con sus dudas, sus errores y su juicio?',
          },
        ],
      },
      variaLongitud(
        'fonda-varia-longitud',
        'fonda-writing',
        '¿Hay periodos largos por acumulación cortados por oraciones mínimas?',
        '§5.3',
      ),
    ],
  },
  catedra: {
    id: 'catedra',
    skill: 'catedra-writing',
    rules: [
      {
        id: 'coloquialismos',
        kind: 'forbidden-pattern',
        severity: 'error',
        // «fíjate» y «¿te das cuenta?», que el §11.2 también nombra, ya los
        // marca `catedra-sin-tuteo`. Acá quedan los que no son de segunda
        // persona. «O sea» entra porque la propia base lo declara informal.
        // «De una» quedó fuera después de que marcara «dentro de una sociedad
        // mercantil». Como coloquialismo rioplatense existe, pero como
        // preposición más artículo aparece en cualquier párrafo, y una regla
        // que marca eso deja de leerse al tercer falso positivo.
        pattern: frases([
          'bueno pues',
          'o sea',
          'un montón',
          'ni modo',
          'qué chévere',
          'la verdad que',
          'a lo bestia',
        ]),
        message: 'Coloquialismo en un texto de cátedra.',
        fix: 'Sustituir por la formulación analítica. «O sea» es «es decir».',
        source: 'catedra-writing §11.2',
        checklist: [
          {
            skill: 'catedra-writing',
            item: '¿No hay coloquialismos, humor ni anécdotas personales?',
          },
        ],
      },
      {
        id: 'reformuladores-presentes',
        kind: 'must-contain',
        severity: 'warning',
        // §3.2 llama a la repetición pedagógica «obligatoria para toda idea
        // central», y §9.1 fija el patrón: formulación, reformulación con «es
        // decir», consecuencia con «por tanto». Por eso se piden dos distintos.
        pattern: frases([
          'es decir',
          'dicho de otro modo',
          'en otras palabras',
          'lo que significa que',
          'esto es',
          'por tanto',
          'por consiguiente',
          'de ahí que',
          'así pues',
        ]),
        minDistinct: 2,
        minSentences: 6,
        message: 'Faltan dispositivos de reformulación variados, que son el esqueleto de este tono.',
        fix: 'Formular la idea, reformularla con «es decir» o equivalente, y cerrar con la consecuencia con «por tanto».',
        source: 'catedra-writing §9.1',
        checklist: [
          {
            skill: 'catedra-writing',
            item: '¿Los dispositivos de reformulación («es decir», «por tanto») están presentes y variados?',
          },
        ],
      },
    ],
  },

  // Los diez tonos siguientes se declaran sin reglas propias. El verificador ya
  // los acepta, así que su capa base y su enrutamiento funcionan, y sus ítems
  // quedan registrados en la cobertura como lo que son: criterio sin medir.
  freddy: { id: 'freddy', skill: 'freddy-writing', rules: [] },
  fonseca: { id: 'fonseca', skill: 'fonseca-writing', rules: [] },
  dotcsv: { id: 'dotcsv', skill: 'dotcsv-writing', rules: [] },
  // Único tono con reglas propias fuera de camus, fonda y catedra, y por un
  // motivo: es el único cuyo corpus es prosa escrita por el autor. Los otros
  // doce se midieron sobre habla transcrita, donde la puntuación la pone el
  // transcriptor y ninguna cifra de oración es atribuible.
  han: {
    id: 'han',
    skill: 'han-writing',
    rules: [
      {
        id: 'han-oracion-maxima',
        kind: 'sentence-length',
        severity: 'error',
        // Medido: máximo 40 palabras en 96 oraciones, mediana 16. La versión
        // anterior de la skill afirmaba un techo de 30 y la prosa real lo pasa
        // seis veces, así que el número es el medido y no el heredado.
        max: 40,
        message: 'La oración supera las 40 palabras.',
        fix: 'Partirla. La mediana medida del modelo es de 16 palabras y su mitad central va de 11 a 22.',
        source: 'han-writing §4',
        checklist: [
          {
            skill: 'han-writing',
            item: '¿Ninguna oración pasa de cuarenta palabras y la mitad central del texto se mantiene entre once y veintidós?',
          },
        ],
      },
      {
        id: 'han-staccato',
        kind: 'short-sentence-run',
        severity: 'error',
        // Lo mismo que mide `staccato` en la pasada, con los mismos números,
        // pero reclamando el ítem de esta skill. La pasada solo corre cuando se
        // la pide, y este tono necesita el tope siempre: la racha máxima medida
        // en el modelo es de dos, y el defecto que más se le imita es
        // encadenarlas. Correr tono y pasada juntos marca dos veces, que es el
        // precio de que cada capa haga cumplir lo suyo.
        shortWords: 10,
        maxRun: 2,
        message: 'Más de dos oraciones cortas seguidas.',
        fix: 'Fundirlas por subordinación o coordinación. Una frase breve golpea porque alrededor hay frases que no lo son.',
        source: 'han-writing §15',
        checklist: [
          {
            skill: 'han-writing',
            item: '¿No hay más de dos oraciones cortas seguidas sin una oración larga que las corte?',
          },
        ],
      },
      {
        id: 'han-copula',
        kind: 'pattern-ratio',
        severity: 'warning',
        // La cópula es el motor de la frase sentenciosa, que es la caricatura
        // con que se imita a este autor. Medida real: 28,1 % de las oraciones.
        // El techo es la mitad, que es lo que el ítem pide con la palabra
        // «mayoría», y deja sitio de sobra sobre lo medido.
        //
        // Se excluye la perífrasis progresiva («está creciendo»), donde
        // «estar» es auxiliar y no cópula. Sin ese descarte la regla marca
        // prosa que no define nada.
        pattern:
          /(?<!\p{L})(?:es|son|era|eran|fue|fueron|será|serán|está|están|estaba|estaban)(?!\p{L})(?!\s+\p{L}+ndo(?!\p{L}))/iu,
        max: 0.5,
        minSentences: 8,
        message: 'Más de la mitad de las oraciones se apoyan en «ser» o «estar».',
        fix: 'Pasar a verbo pleno de acción, de transformación o de supresión. En el modelo, siete de cada diez oraciones lo hacen.',
        source: 'han-writing §7',
        checklist: [
          {
            skill: 'han-writing',
            item: '¿La mayoría de las oraciones se apoya en un verbo pleno y no en «ser» ni en «estar»?',
          },
        ],
      },
      {
        id: 'han-cantidad-sin-cifra',
        kind: 'forbidden-pattern',
        severity: 'error',
        // El modelo no usa una sola cifra como prueba en 96 oraciones, y ese
        // es el rasgo: afirma sin medir. El defecto aparece cuando esa renuncia
        // se disfraza de cantidad, que es lo peor de los dos mundos.
        pattern: frases([
          'dimensiones epidémicas',
          'proporciones epidémicas',
          'cada vez más',
          'cada vez menos',
          'de forma exponencial',
          'de manera exponencial',
          'a niveles nunca vistos',
          'como nunca antes',
          'una cantidad ingente',
          'un número incalculable',
          'incontables',
          'infinidad de',
        ]),
        message: 'Cantidad afirmada sin cifra.',
        fix: 'O se da la cifra, o se suprime la cuantificación y se afirma el cambio sin fingir que se midió.',
        source: 'han-writing §9',
        checklist: [
          {
            skill: 'han-writing',
            item: '¿El texto queda libre de cantidades sin cifra, del tipo «dimensiones epidémicas» o «cada vez más»?',
          },
        ],
      },
    ],
  },
  bettatech: { id: 'bettatech', skill: 'bettatech-writing', rules: [] },
  schiavenato: { id: 'schiavenato', skill: 'schiavenato-writing', rules: [] },
  medicendai: { id: 'medicendai', skill: 'medicendai-writing', rules: [] },
  sekkyoku: { id: 'sekkyoku', skill: 'sekkyoku-writing', rules: [] },
  kenway: { id: 'kenway', skill: 'kenway-writing', rules: [] },
  atenas: { id: 'atenas', skill: 'atenas-writing', rules: [] },
  solitario: { id: 'solitario', skill: 'solitario-writing', rules: [] },
};

export const TONE_IDS = Object.keys(TONES);

// ---------------------------------------------------------------------------
// Capa de pasada: opcional, se pide de forma explícita.
//
// El catálogo de señales de IA pertenece a `humanizar-espanol`, que no es un
// tono sino una pasada sobre un texto ya redactado. Por eso estas reglas no
// corren solas: el verificador las aplica con `--pasada humanizar`, igual que
// la skill solo se activa cuando el usuario la pide con esas palabras.
//
// Cada regla cita el patrón del catálogo que hace cumplir. Las listas están
// tomadas literalmente de `references/patrones-de-ia.md`.
// ---------------------------------------------------------------------------

const p = (n: string): ChecklistRef[] => [{ skill: 'humanizar-espanol', item: n }];

const SENALES_IA: Rule[] = [
  {
    id: 'inflacion-de-significancia',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'juega un papel crucial',
      'juega un papel fundamental',
      'juega un papel clave',
      'constituye un pilar',
      'marca un antes y un después',
      'representa un hito',
      'refleja una tendencia más amplia',
      'deja una huella imborrable',
      'sienta las bases de',
    ]),
    message: 'Inflación de significancia: infla la importancia de un detalle.',
    fix: 'Decir qué hizo, cuándo y con qué efecto. Si el instituto se fundó en 1989, eso es el dato.',
    source: 'humanizar-espanol, patrón 1',
    checklist: p('Inflación de significancia, legado y tendencias amplias'),
  },
  {
    id: 'lenguaje-promocional',
    kind: 'forbidden-pattern',
    // Advertencia y no error: «fascinante» o «imponente» pueden ser la palabra
    // exacta en un texto concreto. El catálogo los llama «palabras a vigilar»,
    // no prohibidas.
    severity: 'warning',
    pattern: frases([
      'rico patrimonio cultural',
      'vibrante',
      'imponente',
      'impresionante',
      'fascinante',
      'enclavado en el corazón de',
      'enclavada en el corazón de',
      'de visita obligada',
      'joya escondida',
      'belleza sin igual',
    ]),
    message: 'Lenguaje promocional: pierde el tono neutro.',
    fix: 'Sustituir por lo que se puede comprobar. En vez de «vibrante enclave», decir qué tiene.',
    source: 'humanizar-espanol, patrón 4',
    checklist: p('Lenguaje promocional o publicitario'),
  },
  {
    id: 'atribuciones-vagas',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'los expertos señalan',
      'los expertos creen',
      'los expertos coinciden',
      'diversos estudios demuestran',
      'según algunos observadores',
      'se ha comprobado que',
      'es bien sabido que',
    ]),
    message: 'Atribución vaga: adjudica una opinión a una autoridad sin nombre.',
    fix: 'Nombrar la fuente con año y obra, o suprimir la afirmación.',
    source: 'humanizar-espanol, patrón 5',
    checklist: p('Atribuciones vagas y comodines'),
  },
  {
    id: 'secciones-de-molde',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'a pesar de sus logros',
      'pese a estos desafíos',
      'pese a estos retos',
      'de cara al futuro',
    ]),
    message: 'Sección de molde: el apartado formulaico de retos con repunte optimista.',
    fix: 'Decir qué pasó y cuándo. El tráfico aumentó tras abrir tres parques en 2015.',
    source: 'humanizar-espanol, patrón 6',
    checklist: p('Secciones de molde «Retos y perspectivas futuras»'),
  },
  {
    id: 'vocabulario-de-ia',
    kind: 'pattern-density',
    severity: 'warning',
    // El catálogo es explícito: «No están prohibidas de forma absoluta, pero su
    // acumulación es una firma. Cuando veas varias en un mismo pasaje». Por eso
    // se mide por párrafo y por términos distintos, no por aparición suelta.
    maxDistinct: 2,
    pattern: frases([
      'fomentar',
      'potenciar',
      'abordar',
      'panorama',
      'ámbito',
      'en aras de',
      'matices',
      'entramado',
      'tejido social',
      'crisol',
      'sumergirse',
      'adentrarse en',
      'desentrañar',
      'arrojar luz',
      'piedra angular',
      'de vanguardia',
      'robusto',
      'integral',
      'holístico',
      'sinergia',
      'paradigma',
      'multifacético',
      'invaluable',
      'crucial',
      'pivotal',
      'subrayar',
      'realzar',
    ]),
    message: 'Acumulación de vocabulario de IA en un mismo párrafo.',
    fix: 'Reescribir con vocabulario llano y preciso. Una de estas palabras no dice nada; tres seguidas son una firma.',
    source: 'humanizar-espanol, patrón 7',
    checklist: p('Vocabulario de IA en español'),
  },
  {
    id: 'evitacion-de-copula',
    kind: 'forbidden-pattern',
    // Advertencia: «constituye» y «representa» tienen usos legítimos que solo
    // el contexto distingue. La regla señala, no sentencia.
    severity: 'warning',
    pattern: frases(['se erige como', 'se posiciona como', 'funge como', 'se alza como']),
    message: 'Evitación de la cópula: rodea un «es» simple con una construcción recargada.',
    fix: 'Usar «es» o «tiene». La galería es el espacio del colectivo y tiene cuatro salas.',
    source: 'humanizar-espanol, patrón 8',
    checklist: p('Evitación de la cópula «ser» o «estar»'),
  },
  {
    id: 'abstraccion-comodin',
    kind: 'forbidden-pattern',
    severity: 'warning',
    pattern: frases([
      'diversos aspectos',
      'múltiples factores',
      'en términos de',
      'a nivel de',
      'distintas perspectivas',
      'una serie de elementos',
    ]),
    message: 'Abstracción comodín: nombra una categoría en vez del concepto.',
    fix: 'Sustituir por los conceptos concretos. La interacción social depende de la confianza y la reciprocidad.',
    source: 'humanizar-espanol, patrón 18',
    checklist: p('Abstracción comodín'),
  },
  {
    id: 'artefactos-de-chatbot',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'espero que esto te sea de ayuda',
      'espero que te sirva',
      'tienes toda la razón',
      'quieres que',
      'te gustaría que',
      'aquí tienes',
      'avísame si',
    ]),
    message: 'Artefacto de conversación: texto de respuesta de chatbot pegado como contenido.',
    fix: 'Suprimirlo. El contenido empieza donde empieza el contenido.',
    source: 'humanizar-espanol, patrón 24',
    checklist: p('Artefactos de conversación con el chatbot'),
  },
  {
    id: 'avisos-de-corte',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'hasta mi última actualización',
      'según la información disponible',
      'aunque los detalles son escasos',
      'mantiene un perfil bajo',
      'prefiere mantener su vida privada',
      'probablemente creció en',
      'se cree que',
    ]),
    message: 'Aviso de corte o relleno especulativo: disfraza una conjetura de hecho.',
    fix: 'Decir qué no se sabe, o suprimir la frase. Nunca inventar el relleno.',
    source: 'humanizar-espanol, patrón 25',
    checklist: p('Avisos de corte de conocimiento y relleno especulativo'),
  },
  {
    id: 'tono-servil',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases(['excelente pregunta', 'gran pregunta', 'es un punto magnífico', 'punto magnífico']),
    message: 'Tono servil: adula al lector en vez de responderle.',
    fix: 'Ir al punto. Los factores económicos que mencionas son pertinentes acá.',
    source: 'humanizar-espanol, patrón 26',
    checklist: p('Tono servil o adulador'),
  },
  {
    id: 'frases-de-relleno',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'con el fin de lograr esto',
      'debido al hecho de que',
      'en el caso de que',
      'tiene la capacidad de',
      'en este momento',
    ]),
    message: 'Frase de relleno: dice con seis palabras lo que se dice con una.',
    fix: '«Debido al hecho de que llovía» es «porque llovía». «Tiene la capacidad de procesar» es «puede procesar».',
    source: 'humanizar-espanol, patrón 27',
    checklist: p('Frases de relleno'),
  },
  {
    id: 'tropos-de-autoridad',
    kind: 'forbidden-pattern',
    // Advertencia: «en realidad» y «en el fondo» aparecen sueltos en prosa
    // legítima. El delator es el racimo, no la aparición.
    severity: 'warning',
    pattern: frases([
      'la verdadera pregunta es',
      'en el fondo',
      'en esencia',
      'lo que de verdad importa',
      'el meollo del asunto',
    ]),
    message: 'Tropo de autoridad: simula cortar el ruido para llegar a una verdad profunda.',
    fix: 'Decir la cosa sin ceremonia. Lo que sigue a estas fórmulas suele ser un punto corriente.',
    source: 'humanizar-espanol, patrón 30',
    checklist: p('Tropos de autoridad persuasiva'),
  },
  {
    id: 'senalizacion',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'vamos a explorar',
      'desglosemos esto',
      'esto es lo que necesitas saber',
      'adentrémonos en',
      'sin más preámbulo',
    ]),
    message: 'Señalización: anuncia lo que va a hacer en lugar de hacerlo.',
    fix: 'Hacerlo. En vez de «vamos a explorar cómo funciona el caché», explicar cómo funciona.',
    source: 'humanizar-espanol, patrón 31',
    checklist: p('Señalización y anuncios'),
  },
  {
    id: 'notoriedad-y-cobertura',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'ha sido reseñado en numerosos medios',
      'cuenta con una amplia presencia en redes',
      'reconocido a nivel nacional e internacional',
      'de renombre internacional',
      'ampliamente reconocido',
      'goza de gran prestigio',
    ]),
    message: 'Énfasis indebido en notoriedad: enumera medios y prestigio sin contexto.',
    fix: 'Sustituir por lo que dijo, dónde y cuándo. «En una entrevista de 2024 en El País sostuvo que…».',
    source: 'humanizar-espanol, patrón 2',
    checklist: p('Énfasis indebido en notoriedad y cobertura mediática'),
  },
  {
    id: 'exceso-de-atenuacion',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'podría posiblemente',
      'posiblemente podría',
      'tal vez podría',
      'quizás podría',
      'tal vez tendría',
      'quizás tendría',
      'podría llegar a ser',
      'podría eventualmente',
    ]),
    message: 'Exceso de atenuación: dos o tres capas de duda sobre la misma afirmación.',
    fix: 'Dejar una sola. «La política puede afectar a los resultados».',
    source: 'humanizar-espanol, patrón 28',
    checklist: p('Exceso de atenuación'),
  },
  {
    id: 'conclusiones-positivas',
    kind: 'forbidden-pattern',
    severity: 'error',
    pattern: frases([
      'el futuro es prometedor',
      'vienen tiempos emocionantes',
      'un paso en la dirección correcta',
      'camino hacia la excelencia',
      'sin duda seguirá creciendo',
      'el futuro se presenta prometedor',
    ]),
    message: 'Conclusión positiva genérica: un repunte optimista que no dice nada.',
    fix: 'Sustituir por el hecho concreto. «La empresa prevé abrir dos sedes más el año próximo».',
    source: 'humanizar-espanol, patrón 29',
    checklist: p('Conclusiones positivas genéricas'),
  },
  {
    id: 'pasiva-mecanica',
    kind: 'pattern-ratio',
    severity: 'warning',
    // El catálogo no prohíbe la pasiva refleja: dice que el español académico
    // la usa con naturalidad y que el defecto es «su uso mecánico y repetido en
    // cada oración». El umbral traduce ese «en cada oración» a dos tercios, y
    // por ser una lectura y no un número declarado, se marca como advertencia.
    pattern: /^\s*se\s+\p{L}+|\b(?:fue|fueron|es|son|era|eran)\s+\p{L}+(?:ado|ada|ados|adas|ido|ida|idos|idas)\b/iu,
    max: 0.66,
    minSentences: 4,
    message: 'Pasiva e impersonal en cadena.',
    fix: 'Alternar con la voz activa donde aclare quién hace qué. «Se observó un incremento al analizar los datos».',
    source: 'humanizar-espanol, patrón 13',
    checklist: p('Pasiva e impersonal mecánico excesivos'),
  },
  {
    id: 'gerundios-apilados',
    kind: 'forbidden-pattern',
    severity: 'error',
    // El delator es la posición: el gerundio colgado tras una coma, al final de
    // la oración, para añadir hondura falsa. Uno de estos verbos al inicio de
    // una oración es prosa normal y queda fuera.
    pattern:
      /,\s*(?:destacando|reflejando|subrayando|contribuyendo a|consolidándose como|posicionándose como)\b|,\s*lo que pone de manifiesto\b/giu,
    message: 'Gerundio apilado: cuelga un participio de presente para simular profundidad.',
    fix: 'Cortar la oración y decir quién hace qué. «La obra usa azules y verdes. El arquitecto los eligió para evocar la costa».',
    source: 'humanizar-espanol, patrón 3',
    checklist: p('Gerundios apilados que simulan profundidad'),
  },
  {
    id: 'paralelismos-negativos',
    kind: 'forbidden-pattern',
    severity: 'warning',
    // «no solo… sino también» tiene usos legítimos. El catálogo habla de abuso,
    // así que la regla señala y no sentencia.
    pattern: /\bno\s+solo\b[^.?!]{0,80}\bsino\b|\bno\s+se\s+trata\s+de\b[^.?!]{0,80}\bsino\b/giu,
    message: 'Paralelismo negativo: la construcción «no solo… sino» usada como molde.',
    fix: 'Afirmar directamente. «El ritmo intenso refuerza el tono agresivo de la canción».',
    source: 'humanizar-espanol, patrón 9',
    checklist: p('Paralelismos negativos y negaciones de cola'),
  },
  {
    id: 'staccato',
    kind: 'short-sentence-run',
    severity: 'error',
    // El SKILL.md fija los dos números: «no encadenar más de dos oraciones
    // cortas» y «oraciones breves de seis a diez palabras».
    shortWords: 10,
    maxRun: 2,
    message: 'Racha de oraciones cortas seguidas.',
    fix: 'Fundir la mayoría en una o dos oraciones largas con subordinación, y dejar una breve suelta para el contraste.',
    source: 'humanizar-espanol, patrón 32',
    checklist: p('Efectismo manufacturado, staccato y aforismos'),
  },
  {
    id: 'apertura-de-etiqueta',
    kind: 'paragraph-opening',
    severity: 'error',
    maxWords: 10,
    // La cópula con sustantivo abstracto es la continuación más previsible que
    // existe. El catálogo lo llama «perplejidad mínima».
    pattern: /\b(?:es|son|era|eran|fue|fueron|será|serán|consiste en|se define como)\b/iu,
    message: 'Apertura de etiqueta: el párrafo abre con una frase corta y declarativa con cópula.',
    fix: 'Entrar en marcha: con una subordinada, un dato o una oración media que ya desarrolle la idea. Si querés una frase corta, ponela dentro del párrafo.',
    source: 'humanizar-espanol, patrón 37',
    checklist: p('Apertura corta de etiqueta'),
  },
  {
    id: 'aperturas-retoricas',
    kind: 'forbidden-pattern',
    severity: 'error',
    // El catálogo incluye «Mira» en la lista. Queda fuera a propósito: como
    // palabra suelta es un verbo corriente y marcaría media prosa legítima.
    // Una regla que grita en falso deja de leerse.
    pattern: frases(['seamos sinceros', 'la verdad es que', 'el caso es que', 'honestamente']),
    message: 'Apertura retórica: falsa confidencia para fabricar cercanía.',
    fix: 'Decir la cosa sin preámbulo. «Que valga la pena depende de cuánto lo uses».',
    source: 'humanizar-espanol, patrón 33',
    checklist: p('Aperturas retóricas conversacionales'),
  },
];

export type Pasada = { id: string; skill: string; rules: Rule[] };

export const PASADAS: Record<string, Pasada> = {
  humanizar: { id: 'humanizar', skill: 'humanizar-espanol', rules: SENALES_IA },
};

export const PASADA_IDS = Object.keys(PASADAS);

/** Todas las reglas declaradas, de cualquier capa. */
export function allRules(): Rule[] {
  return [
    ...BASE_RULES,
    ...Object.values(TONES).flatMap((t) => t.rules),
    ...Object.values(PASADAS).flatMap((p2) => p2.rules),
  ];
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
    if (r.kind === 'forbidden-pattern' || r.kind === 'pattern-density' || r.kind === 'must-contain') {
      if (!r.pattern.flags.includes('g')) {
        throw new Error(`la regla ${r.id} necesita el flag g`);
      }
      if (!r.pattern.flags.includes('u')) {
        throw new Error(`la regla ${r.id} necesita el flag u`);
      }
    }
    if (r.kind === 'pattern-density' && r.maxDistinct < 1) {
      throw new Error(`la regla ${r.id} necesita un maxDistinct de al menos 1`);
    }
    // Estas dos se prueban con `.test` contra cada oración. Con el flag `g`,
    // `lastIndex` es estado compartido y el resultado alterna entre llamadas.
    if (r.kind === 'sentence-start-run' || r.kind === 'paragraph-opening' || r.kind === 'pattern-ratio') {
      if (r.pattern.flags.includes('g')) {
        throw new Error(`la regla ${r.id} no puede llevar el flag g`);
      }
    }
    if (r.kind === 'paragraph-length' && r.min === undefined && r.max === undefined) {
      throw new Error(`la regla ${r.id} necesita al menos un límite`);
    }
  }
}
