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

/**
 * Aspecto del texto que una regla gobierna, cuando otra capa puede relevarla.
 *
 * Existe uno solo y basta para lo que hay que resolver. `camus-writing` §3.1
 * dice, por escrito, que cuando el usuario pide humanizar de forma explícita la
 * pasada decide el ritmo por encima del tono. Esa precedencia estaba declarada
 * en la prosa y no en el código, así que humanizar un texto académico producía
 * once errores de `oracion-maxima` y el arreglo que el propio verificador
 * proponía deshacía la humanización. Este campo es lo que hace cierta la frase.
 *
 * Solo se declara en la capa de tono. La base no cede nada: §3.1 dice que una
 * skill de tono nunca puede contradecirla, y una pasada tampoco.
 */
export type Dominio = 'ritmo-de-oracion' | 'ritmo-de-parrafo';

/**
 * Qué dominio gobierna cada clase de regla.
 *
 * Empezó siendo un dominio solo, `ritmo`, y era demasiado grueso. Metía en el
 * mismo saco el techo de oración, que `humanizar-espanol` sí releva porque su
 * §4 manda fundir cadenas de breves, y el techo de párrafo, sobre el que esa
 * skill no dice ningún número. El resultado se pudo reproducir: un párrafo de
 * cuatrocientas palabras perdía el `parrafo-maximo` de camus y ninguna regla de
 * la pasada lo miraba.
 *
 * Con dos dominios, una pasada releva lo que de verdad gobierna y deja en pie lo
 * demás. Hoy ninguna releva el párrafo.
 */
export const DOMINIO_POR_CLASE = {
  'sentence-length': 'ritmo-de-oracion',
  'sentence-length-spread': 'ritmo-de-oracion',
  'short-sentence-run': 'ritmo-de-oracion',
  'long-sentence-run': 'ritmo-de-oracion',
  'sentence-length-band': 'ritmo-de-oracion',
  'sentence-length-mean': 'ritmo-de-oracion',
  'paragraph-length': 'ritmo-de-parrafo',
  'paragraph-length-spread': 'ritmo-de-parrafo',
} as const satisfies Record<string, Dominio>;



type Common = {
  id: string;
  severity: Severity;
  message: string;
  /** Qué hacer en su lugar. Va en la salida, porque señalar sin arreglar no sirve. */
  fix: string;
  /** Sección de la skill que enuncia la regla. */
  source: string;
  checklist: ChecklistRef[];
  /**
   * Qué aspecto gobierna, para que una pasada pueda relevarla.
   *
   * Obligatorio en toda regla de tono de las clases de `DOMINIO_POR_CLASE`, y
   * prohibido en cualquier otra. `assertDominios` lo comprueba en las dos
   * direcciones: una regla de ritmo sin marcar sobreviviría a la pasada y
   * volvería a pedir lo contrario que ella.
   */
  gobierna?: Dominio;
};

/** Un patrón que no debe aparecer en el texto entregado. */
export type PatternRule = Common & {
  kind: 'forbidden-pattern';
  /** Debe llevar los flags `g` y `u`. `assertRules` lo verifica. */
  pattern: RegExp;
  /**
   * Coincidencias literales que no son hallazgo, comparadas con mayúsculas.
   *
   * `frases()` compila sin distinguir mayúsculas, y eso hace que la sigla «TI»
   * coincida con el pronombre «ti» y «SOS» con el voseo «sos». La primera
   * solución fue descartar en el motor toda coincidencia de dos a cuatro letras
   * escrita enteramente en mayúsculas, y era demasiado ancha: dejaba escapar
   * «TÚ», «VOS», «SOIS» y «VEIS» de reglas que no admiten excepción. Esta lista
   * nombra las excepciones una por una y no toca nada más.
   */
  excepciones?: readonly string[];
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
 * Cuánto tienen que diferir entre sí los párrafos de un texto.
 *
 * Existe porque una media y un piso no bastan para describir un ritmo, y el
 * defecto que cierra ocurrió: un texto escrito con esta clase de regla ausente
 * salió con ocho párrafos de entre 104 y 139 palabras, una variación del 9 %,
 * mientras el corpus del que salían esas cifras reparte los suyos entre 26 y
 * 301, con una variación del 48 %. Las dos medias eran parecidas; los dos
 * ritmos, no.
 *
 * Se mide con el coeficiente de variación, es decir, la desviación típica
 * dividida por la media, porque la comparación tiene que sobrevivir a que un
 * tono escriba párrafos de sesenta palabras y otro de doscientas. Una razón
 * entre el más largo y el más corto la decidirían dos párrafos solos; el
 * coeficiente los usa todos.
 */
export type ParagraphSpreadRule = Common & {
  kind: 'paragraph-length-spread';
  /** Coeficiente de variación mínimo, de 0 a 1. Se marca por debajo. */
  minVariation: number;
  /** Por debajo de esta cantidad de párrafos la cifra es ruido y no se mide. */
  minParagraphs: number;
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

/**
 * Una racha de oraciones largas seguidas. El reverso del staccato.
 *
 * `fonseca-writing` §4.2 lo dice como prohibición: «Nunca cuatro largas
 * seguidas». `dotcsv-writing` §6.4 lo dice como exigencia: «Dos oraciones
 * largas seguidas exigen una corta después». Son la misma forma vista desde los
 * dos lados, y ninguna clase de regla anterior la medía: `short-sentence-run`
 * caza la cadena de breves y dejaba pasar la cadena de largas, que es el
 * defecto contrario y también aplana el ritmo.
 */
export type LongSentenceRunRule = Common & {
  kind: 'long-sentence-run';
  /** Desde cuántas palabras cuenta como oración larga. */
  longWords: number;
  /** Cuántas largas seguidas tolera. Se marca al superarlo. */
  maxRun: number;
};

/**
 * Qué proporción del texto cae dentro de una banda de longitud.
 *
 * Es la clase que faltaba para hacer cumplir lo que las skills declaran con más
 * frecuencia y nadie medía. `freddy-writing` pide «una de cada tres oraciones
 * entre tres y diez palabras». `dotcsv-writing`, «las breves son alrededor de
 * una de cada cuatro». `fonseca-writing`, «la mitad del texto por debajo de
 * quince». `bettatech-writing` da sus dos cuartiles. Todas son la misma medida
 * con distintos límites.
 *
 * Es advertencia y no error a propósito: una proporción sobre pocas oraciones
 * es ruido, y por eso `minSentences` existe. Un perfil que no se cumple no es
 * una falta, es una señal de que el texto no tiene la forma que dice tener.
 */
export type LengthBandRule = Common & {
  /** Límite inferior en palabras, inclusive. */
  min: number;
  /** Límite superior en palabras, inclusive. `Infinity` para no poner techo. */
  max: number;
  kind: 'sentence-length-band';
  /** Proporción mínima del total que tiene que caer dentro de la banda. */
  minShare?: number;
  /**
   * Proporción máxima, para las skills que declaran la banda como minoría.
   *
   * `han-writing` §4 lo dice con las dos mitades: «La oración corta existe y es
   * minoría. Una de cada seis baja de diez palabras. No es el ritmo del texto,
   * es su acento». Con solo un piso, un texto hecho enteramente de frases cortas
   * pasaba, y ese es justo el defecto que la sección 15 llama letanía.
   */
  maxShare?: number;
  minSentences: number;
};

/**
 * La media de palabras por oración, dentro de la banda que la skill declara.
 *
 * Solo `bettatech-writing` §10 la enuncia como rango cerrado, y con un motivo
 * medido: «Las medias por archivo van de 20,4 a 26,3, una banda muy estrecha
 * que ningún texto del corpus abandona». Una mediana la aproxima
 * `sentence-length-band`; una media no, porque la arrastra la cola.
 */
export type MeanLengthRule = Common & {
  kind: 'sentence-length-mean';
  min: number;
  max: number;
  minSentences: number;
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
  | ParagraphSpreadRule
  | ShortSentenceRunRule
  | LongSentenceRunRule
  | LengthBandRule
  | MeanLengthRule
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
  // Imperativos de segunda del plural. El §9.1 de la base los nombra uno por
  // uno y esta lista no los tenía, así que la prosa declaraba una prohibición
  // que el dato no hacía cumplir. Es el defecto exacto que el gate existe para
  // encontrar, y se le escapó porque el gate ata regla e ítem, no regla y
  // contenido del ítem.
  //
  // No se usa un patrón de sufijo `-ad`, `-ed` ni `-id`: chocaría con
  // «verdad», «pared», «Madrid» y media lengua. Solo entran formas verbales
  // que no admiten otra lectura.
  'mirad',
  'fijaos',
  'fijaros',
  'apoyadlo',
  'apoyadla',
  'dadle',
  'dadme',
  'dadnos',
  'escribidme',
  'escuchad',
  'pensad',
  'recordad',
  'imaginad',
  'dejadme',
  'dejadlo',
  'venid',
  'poned',
  'haced',
  'tomad',
  'esperad',
  'perdonad',
  'sabed',
  'atended',
  'seguidme',
  'contadme',
  'decidme',
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
  // Los portadores invisibles son el único defecto del catálogo que no se
  // detecta leyendo, y por eso son el caso más claro de algo que solo una
  // máquina puede vigilar. Van en la base y no en la pasada: un carácter de
  // ancho cero está mal se haya pedido humanizar o no, y la pasada solo corre
  // cuando el usuario la nombra.
  //
  // Se parten en dos reglas y la línea que las separa es normativa, no de
  // gusto. Lo que no se ve nunca hace falta en español y es error. Los espacios
  // que sí existen en tipografía son advertencia, porque el contexto decide, y
  // dos de ellos quedan fuera del patrón: la § 9 de la base pide el fino como
  // separador de miles y el duro para que no se parta un «25 %». Una regla que
  // los marcara estaría contradiciendo a la capa que dice ser.
  {
    id: 'sin-portadores-invisibles',
    kind: 'forbidden-pattern',
    severity: 'error',
    // Ancho cero y uniones, marcas y aislamientos bidireccionales, blando y
    // CGJ, los tres que el estándar dibuja en blanco, los caracteres de
    // etiqueta y los no caracteres de todos los planos.
    // Van con escape y no con el carácter puesto, y no es estilo: pegados de
    // verdad, esta línea se vería como un par de corchetes vacíos y nadie
    // podría revisar qué prohíbe ni notar que alguien le quitó uno.
    pattern: new RegExp(
      '[\\u200B-\\u200F\\u2060-\\u2065\\uFEFF\\u00AD\\u034F\\u061C]' +
        '|[\\u202A-\\u202E\\u2066-\\u2069]' +
        '|[\\u180E\\u180F\\u3164\\uFFA0]' +
        '|[\\u{E0000}-\\u{E007F}]' +
        '|[\\uFDD0-\\uFDEF\\uFFFE\\uFFFF]',
      'gu',
    ),
    message:
      'Carácter invisible en esta columna. No se ve al leerlo, y rompe la búsqueda, el conteo de palabras y la comparación entre versiones.',
    fix: 'Borrarlo. No se sustituye por nada: si el hueco pedía un espacio, va un espacio normal.',
    source: 'spanish-writing §6.8',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿No queda ningún carácter invisible: ancho cero, marca bidireccional, etiqueta, no carácter o espacio exótico sin uso normativo?',
      },
      // El catálogo de señales de IA lo declara por su cuenta, igual que la
      // raya. Una prohibición, una regla, dos skills que la enuncian.
      { skill: 'humanizar-espanol', item: 'Caracteres invisibles: bórralos' },
    ],
  },
  {
    id: 'espacio-exotico',
    kind: 'forbidden-pattern',
    severity: 'warning',
    // Todo lo que ocupa como un espacio sin serlo, menos los dos que la norma
    // pide. U+2009 (fino) y U+00A0 (duro) están deliberadamente fuera del
    // rango: el primero por el separador de miles, el segundo por el «25 %».
    // El rango salta del U+2008 al U+200A a propósito: en medio está el fino.
    pattern: new RegExp('[\\u2000-\\u2008\\u200A\\u202F\\u205F\\u3000]', 'gu'),
    message:
      'Espacio que no es el espacio normal y que la norma no pide acá. Suele venir de copiar y pegar.',
    fix: 'Sustituir por un espacio normal, o decir en la entrega por qué este texto lo necesita.',
    source: 'spanish-writing §6.8',
    checklist: [
      {
        skill: 'spanish-writing',
        item: '¿No queda ningún carácter invisible: ancho cero, marca bidireccional, etiqueta, no carácter o espacio exótico sin uso normativo?',
      },
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
    // que es correcto. Por eso solo entran palabras que nunca abren un nombre
    // propio, con la misma lógica con que `coloquialismos` dejó fuera «de una».
    //
    // La primera versión de esta lista traía los artículos y los indefinidos, y
    // eso era el mismo error que dice evitar: «El Salvador», «La Habana», «Los
    // Andes», «Al Pacino», «El extranjero», «Un mundo feliz». El artículo es
    // justamente la palabra que más nombres propios y más títulos abre en
    // español. Fuera los doce: El, La, Los, Las, Un, Una, Unos, Unas, Al, Del,
    // De y Lo.
    pattern:
      /;\s+(?:Es|Son|Era|Eran|Se|No|Sin|Por|Para|Esto|Esta|Este|Estos|Estas|Eso|Esa|Ese|Cuando|Aunque|Pero|Además|Ahora|Le|Les|Su|Sus|Si|Que|Como|Más|Menos|También|Tampoco|Todo|Toda|Todos|Todas|Nunca|Siempre|Hay|Hubo|Nada|Nadie|Cada|Otro|Otra|Otros|Otras|Tras|Desde|Hasta|Entre|Sobre|Bajo|Ante)(?!\p{L})/gu,
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
        item: '¿El punto y coma aparece en no más de una de cada cinco oraciones?',
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
      // La mitad de este ítem la hace cumplir esta regla y la otra mitad
      // `triangulacion-conectores-variados`: aquella exige el repertorio ancho
      // y esta impide encadenar dos del mismo molde. El ítem pide las dos cosas
      // en una sola frase, así que lo reclaman las dos reglas.
      {
        skill: 'triangulacion-writing',
        item: '¿Los conectores son muchos y variados, sin que ninguno se repita al abrir dos oraciones seguidas?',
      },
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
      'dale un me gusta',
      'denle un me gusta',
      'la campanita',
      'activen la campanita',
      // «en los comentarios» a secas quedó fuera: marcaba «el editor puso sus
      // objeciones en los comentarios del manuscrito», que no tiene nada que
      // ver con un canal. Lo mismo con «código de descuento», legítimo en
      // cualquier texto sobre comercio. Se conservan las formas que solo
      // existen para gestionar un canal.
      'en los comentarios del video',
      'déjenlo en los comentarios',
      'comenten abajo',
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
      {
        // Es el corpus donde más pesa: diecinueve de sus veinte piezas cierran
        // con la liturgia del canal y trae 142 apariciones en total.
        skill: 'adria-sola-writing',
        item: '¿El texto quedó libre de los artefactos de canal del modelo: saludo, credencial de presentación, petición de apoyo y despedida?',
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
        skill: 'schiavenato-writing',
        item: '¿Queda descartado el tuteo al público y también el «vosotros»?',
      },
      // Estas dos enuncian la prohibición entera en un solo ítem, así que las
      // reclaman las dos reglas. `solitario` la declaraba desde hace tiempo y
      // no la reclamaba nadie: quedaba anotada como criterio, es decir como
      // algo que solo una persona puede juzgar, cuando dos reglas ya la medían.
      {
        skill: 'solitario-writing',
        item: '¿El lector queda tratado de usted o de ustedes, sin tuteo, sin voseo y sin ninguna forma peninsular?',
      },
      {
        skill: 'adria-sola-writing',
        item: '¿El lector queda tratado de usted o de ustedes, sin tuteo, sin voseo y sin ninguna forma peninsular?',
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
    // «TI» es tecnologías de la información y «SOS» es una señal de auxilio.
    // Las dos son corrientes en la clase de texto que estas skills producen.
    excepciones: ['TI', 'SOS'],
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
        skill: 'schiavenato-writing',
        item: '¿Queda descartado el tuteo al público y también el «vosotros»?',
      },
      {
        skill: 'dotcsv-writing',
        item: '¿Se reserva la primera persona del plural para el recorrido y el trato de usted para el lector?',
      },
      // Las mismas dos de la regla anterior: un solo ítem que prohíbe el tuteo,
      // el voseo y lo peninsular a la vez.
      {
        skill: 'solitario-writing',
        item: '¿El lector queda tratado de usted o de ustedes, sin tuteo, sin voseo y sin ninguna forma peninsular?',
      },
      {
        skill: 'adria-sola-writing',
        item: '¿El lector queda tratado de usted o de ustedes, sin tuteo, sin voseo y sin ninguna forma peninsular?',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Capa de tono: se elige exactamente una.
// ---------------------------------------------------------------------------

/** El mismo criterio para los cinco tonos que piden variar la longitud. */
function variaLongitud(id: string, skill: string, item: string, seccion: string): Rule {
  return {
    id,
    kind: 'sentence-length-spread',
    gobierna: 'ritmo-de-oracion',
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
        gobierna: 'ritmo-de-oracion',
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
        gobierna: 'ritmo-de-parrafo',
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
        gobierna: 'ritmo-de-parrafo',
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
        source: 'fonda-writing §6.1',
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
        // El ítem pide «el yo de quien escribe con sus dudas, sus errores y su
        // juicio», y esto se escribió como una lista cerrada de ocho frases.
        // Una prueba real lo delató: un texto con «yo pienso que», «me di
        // cuenta», «no estoy seguro» y «me parecería» quedaba reportado como
        // texto sin voz de autor. La última ni siquiera fallaba por olvido,
        // sino porque «me parece» iba con límite de palabra y «parecería»
        // sigue con letra.
        //
        // Ahora el patrón cubre las tres cosas que el ítem nombra: el juicio,
        // la duda y el recorrido en plural. Se escribe a mano y no con
        // `frases()` porque hace falta la cola flexible de «me parec...».
        pattern:
          /(?<!\p{L})(?:yo|creo|creemos|pienso|opino|sostengo|considero|dudo|sospecho|reconozco|admito|me\s+parec\p{L}*|me\s+di\s+cuenta|me\s+consta|a\s+mi\s+juicio|a\s+mi\s+modo\s+de\s+ver|en\s+mi\s+opinión|para\s+mí|no\s+sé|no\s+estoy\s+segur[oa]|hemos\s+visto|volvamos\s+a|veamos|pasemos\s+a|podemos\s+preguntar|vamos\s+a\s+ver)(?!\p{L})/giu,
        minDistinct: 1,
        minSentences: 6,
        message: 'Falta la voz del autor: ni opinión en primera persona ni recorrido en plural.',
        fix: '«Creo que», «a mi juicio», «me parece», «no estoy seguro» para la posición y la duda propias. «Hemos visto», «volvamos a» para recorrer el argumento con el lector.',
        source: 'fonda-writing §6.1',
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
        '§7',
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

  // Los tonos que siguen tuvieron sus reglas de ritmo mecanizadas. El verificador
  // los acepta, así que su capa base y su enrutamiento funcionan, y sus ítems
  // quedan registrados en la cobertura como lo que son: criterio sin medir.
  freddy: {
    id: 'freddy',
    skill: 'freddy-writing',
    rules: [
      {
        // §6.4: «Una de cada tres oraciones debe caer entre tres y diez
        // palabras. Es la proporción medida y es la que produce el ritmo».
        id: 'freddy-banda-corta',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 3,
        max: 10,
        minShare: 1 / 3,
        minSentences: 9,
        message: 'Faltan oraciones breves: este tono se dice en voz alta y su ritmo lo dan las cortas.',
        fix: 'Partir alguna larga y dejar el remate suelto. «Ahí están los datos». «Eso es todo, problema resuelto».',
        source: 'freddy-writing §6.4',
        checklist: [
          {
            skill: 'freddy-writing',
            item: '¿Una de cada tres oraciones cae entre tres y diez palabras?',
          },
        ],
      },
      variaLongitud(
        'freddy-varia-longitud',
        'freddy-writing',
        '¿Alternan oraciones largas y cortas en lugar de encadenar longitudes parecidas?',
        '§6.4',
      ),
    ],
  },
  fonseca: {
    id: 'fonseca',
    skill: 'fonseca-writing',
    rules: [
      {
        // §4.1: «El 52,6 % de las oraciones queda por debajo de 15 palabras».
        // La mediana medida es 14, así que la banda es la mitad del texto en 14
        // o menos. Se mide la proporción y no la mediana porque es lo que el
        // ítem enuncia, y porque una proporción dice dónde falla.
        id: 'fonseca-mitad-breve',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 14,
        minShare: 0.5,
        minSentences: 8,
        message: 'El texto no tiene la mitad de sus oraciones por debajo de quince palabras.',
        fix: 'Bajar la mediana partiendo periodos. Este registro vive por debajo de quince y se estira solo para enumerar.',
        source: 'fonseca-writing §4.1',
        checklist: [
          {
            skill: 'fonseca-writing',
            item: '¿La mediana de oración del texto queda cerca de 14 palabras, con la mitad del texto por debajo de 15?',
          },
        ],
      },
      {
        // §4.2, y lo dice como prohibición: «Nunca cuatro largas seguidas».
        id: 'fonseca-cuatro-largas',
        kind: 'long-sentence-run',
        gobierna: 'ritmo-de-oracion',
        severity: 'error',
        longWords: 30,
        maxRun: 3,
        message: 'Cadena de oraciones largas seguidas.',
        fix: 'Cortar con una breve que ordene. Dos o tres breves y después una larga, no cuatro largas en fila.',
        source: 'fonseca-writing §4.2',
        checklist: [
          {
            skill: 'fonseca-writing',
            item: '¿Se alternan tramos breves con una oración larga que ordena, sin cuatro largas seguidas ni una ristra de cortas fuera de un remate?',
          },
        ],
      },
    ],
  },
  dotcsv: {
    id: 'dotcsv',
    skill: 'dotcsv-writing',
    rules: [
      {
        // §6.4: «La oración breve, de menos de 10 palabras, cierra el tramo y
        // fija la idea», y el ítem pide que sean una de cada cuatro.
        id: 'dotcsv-un-cuarto-breve',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 9,
        minShare: 0.25,
        minSentences: 8,
        message: 'Faltan oraciones breves que cierren tramo: son una de cada cuatro en este registro.',
        fix: 'Después de cada tramo largo, una oración de menos de diez palabras que fije la idea.',
        source: 'dotcsv-writing §6.4',
        checklist: [
          {
            skill: 'dotcsv-writing',
            item: '¿Después de cada tramo largo hay una oración breve, y las breves son alrededor de una de cada cuatro?',
          },
        ],
      },
      {
        // §6.4: «Dos oraciones largas seguidas exigen una corta después».
        id: 'dotcsv-largas-seguidas',
        kind: 'long-sentence-run',
        gobierna: 'ritmo-de-oracion',
        severity: 'error',
        longWords: 30,
        maxRun: 2,
        message: 'Tres oraciones largas seguidas sin una breve que descargue.',
        fix: 'Meter la oración breve que el tramo pide. Dos largas seguidas ya exigen una corta después.',
        source: 'dotcsv-writing §6.4',
        checklist: [
          {
            skill: 'dotcsv-writing',
            item: '¿Después de cada tramo largo hay una oración breve, y las breves son alrededor de una de cada cuatro?',
          },
        ],
      },
    ],
  },
  // Fue durante mucho tiempo el único con reglas propias fuera de camus, fonda
  // y catedra, y por un
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
        gobierna: 'ritmo-de-oracion',
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
        // §4: «La oración corta existe y es minoría. Una de cada seis baja de
        // diez palabras. No es el ritmo del texto, es su acento».
        //
        // Son las dos mitades del ítem y por eso la regla trae piso y techo. El
        // piso se pone en la mitad de lo medido y el techo en el doble, que es
        // la banda dentro de la cual la cifra sigue describiendo un acento. Sin
        // el techo, la letanía que la sección 15 prohíbe pasaba entera.
        id: 'han-banda-corta',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 9,
        minShare: 1 / 12,
        maxShare: 1 / 3,
        minSentences: 8,
        message: 'La proporción de oraciones breves se salió de la banda: acá son acento, no ritmo.',
        fix: 'Una de cada seis baja de diez palabras. Ni ninguna, que borra el acento, ni tantas que el texto se vuelva letanía.',
        source: 'han-writing §4',
        checklist: [
          {
            skill: 'han-writing',
            item: '¿Las oraciones de menos de diez palabras se quedan alrededor de una de cada seis, sin llegar a ser el ritmo del texto?',
          },
        ],
      },
      {
        id: 'han-staccato',
        kind: 'short-sentence-run',
        gobierna: 'ritmo-de-oracion',
        severity: 'error',
        // Lo mismo que mide `staccato` en la pasada, con los mismos números,
        // pero reclamando el ítem de esta skill. La pasada solo corre cuando se
        // la pide, y este tono necesita el tope siempre: la racha máxima medida
        // en el modelo es de dos, y el defecto que más se le imita es
        // encadenarlas. Correr tono y pasada juntos marca una sola vez, porque la
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
        // Tres ramas, y cada una existe porque una versión anterior sin ella
        // salió mal. Vale la pena dejar el registro completo.
        //
        // Primera versión: una sola lista con dos filtros globales. Contaba «el
        // son cubano» y «esta era digital», que son sustantivos, e inflaba la
        // proporción.
        //
        // Segunda versión: un descarte por determinante previo aplicado a
        // TODOS los verbos, y un filtro de gerundio escrito `\p{L}+ndo`. Peor
        // que la primera. El determinante global mataba «Esta es la clave» y
        // «Este es el problema», que son justo la oración sentenciosa que la
        // regla existe para contar; el filtro `ndo` no describe un gerundio
        // sino cualquier palabra acabada en esas letras, así que «es profundo»
        // y «es blando» también salían.
        //
        // Esta versión reparte el filtro según lo que cada forma admite:
        //
        // Rama uno, sin filtro. «es», «fue», «fueron», «será», «serán» y
        // «eran» no son homógrafos de sustantivo y no forman perífrasis
        // progresiva. No hay nada que descartar.
        //
        // Rama dos, con determinante. «son» y «era» son las dos únicas formas
        // que coinciden con un sustantivo español, y solo ahí tiene sentido
        // mirar lo que va delante. Queda un residuo conocido: «esa era la
        // razón» se descarta y es cópula. Se acepta, porque el error va en la
        // dirección segura para una regla que mide un techo.
        //
        // Rama tres, con gerundio. La perífrasis progresiva es «estar» más
        // gerundio y nunca «ser» más gerundio, así que el filtro solo tiene
        // sentido sobre las formas de «estar». Por eso «es blando» vuelve a
        // contar, que es lo correcto.
        pattern: new RegExp(
          '(?<!\\p{L})(?:' +
            '(?:es|fue|fueron|será|serán|eran)' +
            '|(?<!(?:el|la|un|una|esta|este|esa|ese|del|al|otra|otro|nuestra|nuestro|su|sus)\\s)(?:son|era)' +
            '|(?:está|están|estaba|estaban)(?!\\s+\\p{L}*(?:ando|iendo|yendo)(?!\\p{L}))' +
            ')(?!\\p{L})',
          'iu',
        ),
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
          // El libro dice «dimensiones pandémicas», no «epidémicas». La regla
          // nació para cubrir esa aparición y no la cubría: el único ejemplo
          // que la skill cita como justificación se le escapaba entero.
          'dimensiones pandémicas',
          'proporciones pandémicas',
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
  bettatech: {
    id: 'bettatech',
    skill: 'bettatech-writing',
    rules: [
      {
        // §10: «Las medias por archivo van de 20,4 a 26,3, una banda muy
        // estrecha que ningún texto del corpus abandona».
        id: 'bettatech-media-oracion',
        kind: 'sentence-length-mean',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 20,
        max: 26,
        minSentences: 10,
        message: 'La media de oración se salió de la banda que este registro no abandona.',
        fix: 'Si va corta, encadenar el razonamiento hasta su consecuencia. Si va larga, cortar las conclusiones y las definiciones.',
        source: 'bettatech-writing §10',
        checklist: [
          {
            skill: 'bettatech-writing',
            item: '¿La media de palabras por oración queda entre 20 y 26, con un cuarto del texto por debajo de 14 y un cuarto por encima de 31?',
          },
        ],
      },
      {
        id: 'bettatech-cuartil-breve',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 13,
        minShare: 0.25,
        minSentences: 10,
        message: 'Falta el cuartil breve: un cuarto del texto va por debajo de catorce palabras.',
        fix: 'Las conclusiones y las definiciones van cortas. Ahí es donde este registro baja.',
        source: 'bettatech-writing §10',
        checklist: [
          {
            skill: 'bettatech-writing',
            item: '¿La media de palabras por oración queda entre 20 y 26, con un cuarto del texto por debajo de 14 y un cuarto por encima de 31?',
          },
        ],
      },
      {
        id: 'bettatech-cuartil-largo',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 32,
        max: Number.POSITIVE_INFINITY,
        minShare: 0.25,
        minSentences: 10,
        message: 'Falta el cuartil largo: un cuarto del texto pasa de treinta y una palabras.',
        fix: 'Las unidades largas enumeran condiciones o encadenan un razonamiento hasta su consecuencia. Sin ellas el mecanismo no se explica.',
        source: 'bettatech-writing §10',
        checklist: [
          {
            skill: 'bettatech-writing',
            item: '¿La media de palabras por oración queda entre 20 y 26, con un cuarto del texto por debajo de 14 y un cuarto por encima de 31?',
          },
        ],
      },
    ],
  },
  schiavenato: {
    id: 'schiavenato',
    skill: 'schiavenato-writing',
    rules: [
      {
        id: 'schiavenato-relleno-oral',
        kind: 'forbidden-pattern',
        severity: 'error',
        // La sección 6.2 cuenta el habla del modelo y saca de ahí tres reglas
        // de traslado. La tercera elimina los rellenos que no articulan nada, y
        // es la que esta regla hace cumplir.
        //
        // De la lista de la sección entran solo los que no admiten otra
        // lectura. Quedan fuera «listo», «claro», «cierto» y «no sé», que son
        // adjetivo, adjetivo, sustantivo y afirmación legítima antes que
        // muletilla. «Es que» y «pues» entran solo en arranque de oración, que
        // es donde el §6.2 los sitúa; a mitad de frase «pues» es una
        // conjunción causal correcta y marcarla sería un error.
        pattern: new RegExp(
          '(?:^|(?<=[.!?…]["»)\\]]?\\s{1,3}))(?:[EeÉé]s que|[Pp]ues)(?!\\p{L})' +
            '|(?<!\\p{L})(?:[Oo] sea|[Dd]igamos|[Oo]bviamente|[Rr]ealmente|[Bb]ásicamente)(?!\\p{L})',
          'gmu',
        ),
        message: 'Relleno oral que no articula nada.',
        fix: 'Suprimirlo. Si la oración pierde el enlace, el enlace era «entonces», «pero» o «porque», que este tono sí conserva.',
        source: 'schiavenato-writing §6.2',
        checklist: [
          {
            skill: 'schiavenato-writing',
            item: '¿Están fuera los rellenos orales del modelo, del tipo «es que» de arranque, «pues», «o sea», «listo», «obviamente» y «realmente», y «entonces» quedó por debajo de una aparición cada quinientas palabras?',
          },
        ],
      },
      {
        id: 'schiavenato-palabra-repetida',
        kind: 'forbidden-pattern',
        severity: 'warning',
        // El ítem 16 nombra cinco cosas y esta regla cubre una: la repetición
        // inmediata de palabra, que en el habla es énfasis y en el texto es un
        // tropiezo. Las otras cuatro no se pueden medir hoy y conviene decirlo.
        //
        // Los emojis ya los marca la base. Los enlaces no se pueden marcar con
        // una regla de patrón, porque el motor protege las URL para no
        // lintearlas como prosa. Las mayúsculas enfáticas chocarían con las
        // siglas, que en un texto jurídico abundan. Y la grosería exige una
        // lista que cambia de país en país.
        //
        // Avisa en vez de bloquear: «muy muy» es un tropiezo casi siempre, y
        // casi siempre no es nunca.
        //
        // El separador es espacio horizontal y no `\s`. Con `\s` la regla
        // cruzaba el corte de párrafo y marcaba un título que acaba en una
        // palabra seguido del párrafo que empieza con esa misma palabra, que
        // es una coincidencia de maquetación y no una repetición. Se pierde
        // «muy\nmuy» partido por un salto de línea, y es un precio barato.
        pattern: /(?<!\p{L})(\p{L}{2,})[ \t]+\1(?!\p{L})/giu,
        message: 'Palabra repetida de inmediato.',
        fix: 'En el habla es énfasis y en el texto es un tropiezo. Suprimir la segunda, o cambiarla por la palabra que de verdad intensifica.',
        source: 'schiavenato-writing §5.5',
        checklist: [
          {
            skill: 'schiavenato-writing',
            item: '¿Quedan fuera del cuerpo del texto las marcas de redes y de habla, como emojis, mayúsculas enfáticas, groserías, repetición inmediata de palabra y enlaces?',
          },
        ],
      },
    ],
  },
  atenas: {
    id: 'atenas',
    skill: 'atenas-writing',
    rules: [
      variaLongitud(
        'atenas-varia-longitud',
        'atenas-writing',
        '¿El texto alterna tramos largos de análisis con golpes cortos de énfasis?',
        '§6',
      ),
    ],
  },
  solitario: {
    id: 'solitario',
    skill: 'solitario-writing',
    rules: [
      {
        // §7.4 mide dos veces y las dos coinciden en esto: el 30,2 % de las
        // oraciones reconstruidas queda por debajo de 12 palabras, y el 25 % en
        // los pasajes declamados. Se toma el mínimo de las dos, que es lo que
        // se puede afirmar de cualquier texto de este tono.
        id: 'solitario-cuarto-breve',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 11,
        minShare: 0.25,
        minSentences: 8,
        message: 'Faltan oraciones breves: este tono golpea con ellas entre los periodos de argumento.',
        fix: 'Dejar caer la afirmación corta después del razonamiento largo, en lugar de igualar todas las oraciones.',
        source: 'solitario-writing §7.4',
        checklist: [
          {
            skill: 'solitario-writing',
            item: '¿Al menos una de cada cuatro oraciones queda por debajo de doce palabras, alternando con los periodos largos del argumento?',
          },
        ],
      },
      variaLongitud(
        'solitario-varia-longitud',
        'solitario-writing',
        '¿Al menos una de cada cuatro oraciones queda por debajo de doce palabras, alternando con los periodos largos del argumento?',
        '§7.4',
      ),
    ],
  },
  // El único cuyo corpus llegó partido en dos por la puntuación: ocho archivos
  // la traen y doce no traen ni un signo. Las dos reglas de longitud salen solo
  // de los ocho, y su §3 lo declara antes que ninguna cifra. Las otras dos no
  // dependen de la puntuación, y por eso son las que mandan.
  'adria-sola': {
    id: 'adria-sola',
    skill: 'adria-sola-writing',
    rules: [
      {
        // §4.1: «El 57,5 % queda en 14 o menos», y la proporción por archivo va
        // del 50,8 % al 67,9 %. Ninguno de los ocho baja de la mitad, así que
        // el piso es la mitad y no una media que se pueda compensar entre
        // tramos. Se mide la proporción y no la mediana porque una proporción
        // dice además dónde falla.
        id: 'adria-sola-mitad-breve',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 0,
        max: 14,
        minShare: 0.5,
        minSentences: 8,
        message: 'El texto no tiene la mitad de sus oraciones en catorce palabras o menos.',
        fix: 'Partir periodos. Este registro avanza en unidades que caben en una respiración y se estira solo para enumerar o para encadenar una consecuencia.',
        source: 'adria-sola-writing §4.1',
        checklist: [
          {
            skill: 'adria-sola-writing',
            item: '¿La mitad de las oraciones queda en catorce palabras o menos, con la mediana cerca de doce?',
          },
        ],
      },
      {
        // §4.2: «Las medias por archivo van de 12,8 a 18,5 palabras». La banda
        // hace lo que la mediana no puede: la media la arrastra la cola, así
        // que una media dentro de la banda dice que las largas están y que no
        // se comieron el texto.
        id: 'adria-sola-media-oracion',
        kind: 'sentence-length-mean',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 12,
        max: 19,
        minSentences: 10,
        message: 'La media de oración se salió de la banda que este registro no abandona.',
        fix: 'Si va corta, el texto se quedó en la instrucción suelta y falta explicar por qué el paso está ahí. Si va larga, dejó de mandar y volvió a exponer.',
        source: 'adria-sola-writing §4.2',
        checklist: [
          {
            skill: 'adria-sola-writing',
            item: '¿La media de palabras por oración queda entre doce y diecinueve, que es la banda que ningún archivo del corpus abandona?',
          },
        ],
      },
      {
        // El rasgo que define el tono y el mejor medido, porque no depende de
        // la puntuación: una marca de segunda persona cada 32,7 palabras sobre
        // las 63.402 completas.
        //
        // Lo que se comprueba no es que el texto hable del lector, sino que le
        // mande hacer algo. Por eso el patrón son imperativos de acción y no
        // los de consideración que pide `fonda-interpela`: un texto que invita
        // a fijarse y a pensar cumple aquel tono y no cumple este.
        //
        // Van en usted porque la base lo exige en su §9.2, aunque el corpus
        // tutee sin excepción. Se traslada el imperativo, no su morfología.
        // Varias de estas formas coinciden con un subjuntivo subordinado, y eso
        // solo produce falsos presentes: una regla `must-contain` que se
        // equivoca de más deja de avisar, no avisa de más.
        //
        // El error contrario sí importa, y esta lista empezó cometiéndolo. Tenía
        // dieciocho verbos, todos traducidos uno a uno de los que el corpus usa
        // tuteando, y el primer texto que se escribió con este tono salió
        // marcado: era un método entero de cuatro pasos, con «busque», «pida»,
        // «consulte», «mire», «recorra», «lleve» y «pregunte», y la regla
        // reconoció uno solo. En un `must-contain` la lista corta no calla, que
        // sería barato: avisa en falso sobre un texto que hace justo lo que la
        // regla pide. No se puede derivar por morfología, porque el imperativo
        // de usted es el subjuntivo y cualquier sustantivo acabado en «e» lo
        // parecería, así que la lista se enumera y crece cuando se descubre que
        // le falta un verbo corriente de instrucción.
        id: 'adria-sola-manda-hacer',
        kind: 'must-contain',
        severity: 'warning',
        pattern: frases([
          'empiece',
          'empiecen',
          'deje de',
          'dejen de',
          'anote',
          'anoten',
          'apunte',
          'apunten',
          'pregúntese',
          'pregúntense',
          'pregunte',
          'pregunten',
          'sustituya',
          'sustituyan',
          'reemplace',
          'reemplacen',
          'practique',
          'practiquen',
          'repita',
          'repitan',
          'elija',
          'elijan',
          'escriba',
          'escriban',
          'construya',
          'construyan',
          'defina',
          'definan',
          'pruebe',
          'prueben',
          'aplique',
          'apliquen',
          'mida',
          'midan',
          'grábese',
          'grábense',
          'busque',
          'busquen',
          'pida',
          'pidan',
          'consulte',
          'consulten',
          'revise',
          'revisen',
          'compare',
          'comparen',
          'mire',
          'miren',
          'lea',
          'lean',
          'recorra',
          'recorran',
          'lleve',
          'lleven',
          'localice',
          'localicen',
          'calcule',
          'calculen',
          'marque',
          'marquen',
          'guarde',
          'guarden',
          'cambie',
          'cambien',
          'ponga',
          'pongan',
          'saque',
          'saquen',
          'siga',
          'sigan',
          'decida',
          'decidan',
          'elimine',
          'eliminen',
          'dedique',
          'dediquen',
          'evite',
          'eviten',
          'recuerde',
          'recuerden',
          'tome',
          'tomen',
          'use',
          'usen',
          'haga',
          'hagan',
        ]),
        minDistinct: 2,
        minSentences: 6,
        message: 'El texto no le manda hacer nada al lector, y este tono le entrega un método.',
        fix: 'Terminar los pasos en imperativo de usted y con qué ejecutarlos: «anote», «sustituya», «practique». Pasarlo a «se recomienda» es perder el tono entero.',
        source: 'adria-sola-writing §5.1',
        checklist: [
          {
            skill: 'adria-sola-writing',
            item: '¿El texto le manda hacer algo al lector, con imperativo de usted y de forma sostenida, en lugar de exponerle el asunto y nada más?',
          },
        ],
      },
      {
        // El defecto propio de este registro, y el único de sus rasgos que la
        // skill prohíbe en vez de pedir. La §9.2 explica por qué: un texto que
        // ordena hacer algo tiende a prometer lo que pasará después, y la
        // promesa es el punto donde un método deja de poder juzgarse.
        //
        // La fórmula del corpus aparece 18 veces y es la primera de la lista.
        // Van las dos personas a propósito: la base ya prohíbe el tuteo, pero
        // «tu vida» no lleva marca de tuteo y se colaría entera.
        //
        // Avisa en vez de bloquear porque la primera admite lectura literal.
        // Un texto sobre una jerarquía, un videojuego o un sistema de grados
        // tiene niveles de verdad, y al que sube se lo dice sin vender nada.
        // Las demás no admiten esa lectura y podrían bloquear; separarlas en
        // dos reglas por eso sería partir en dos lo que la prosa declara junto.
        id: 'adria-sola-promesa-inflada',
        kind: 'forbidden-pattern',
        severity: 'warning',
        pattern: frases([
          'al nivel superior',
          'a un nivel superior',
          'cambiará su vida',
          'cambiará tu vida',
          'le cambiará la vida',
          'te cambiará la vida',
          'transformar su vida',
          'transformar tu vida',
          'la vida que sueña',
          'la vida que sueñas',
          'la vida de sus sueños',
          'la vida de tus sueños',
          'nunca volverá a ser igual',
        ]),
        message: 'Promesa de transformación: nombra el destino en vez de lo que el método produce.',
        fix: 'Decir qué va a poder hacer el lector que hoy no puede, en cuánto tiempo y con qué trabajo. Siempre es más pequeño y siempre es comprobable.',
        source: 'adria-sola-writing §9.2',
        checklist: [
          {
            skill: 'adria-sola-writing',
            item: '¿Queda fuera la promesa de transformación, la que nombra el destino al que el método lleva en lugar de lo que el método produce?',
          },
        ],
      },
    ],
  },
  // El primer tono del repositorio cuyas reglas de ritmo piden longitud en vez
  // de acotarla. Los otros doce topan la oración por arriba o exigen una mitad
  // breve; este declara un piso de oraciones largas y un piso de párrafo,
  // porque su forma no afirma a secas: cada oración lleva el dato, la reserva
  // sobre el dato y la consecuencia.
  //
  // Las cuatro avisan y ninguna bloquea. El motivo está en su §3: el corpus es
  // un solo documento, y aunque sus cinco bloques concuerdan entre sí, eso
  // sostiene una banda y no una precisión. La convención de esta casa es que
  // una cifra que no se puede contrastar entre archivos avisa.
  triangulacion: {
    id: 'triangulacion',
    skill: 'triangulacion-writing',
    rules: [
      {
        // §4.1: «El 34,3 % de las oraciones del corpus supera las treinta
        // palabras». El piso declarado es del 20 %, bastante por debajo de lo
        // medido, para que la regla acuse a un texto que abandonó el registro y
        // no a uno que respiró.
        id: 'triangulacion-oracion-larga',
        kind: 'sentence-length-band',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 31,
        max: Infinity,
        minShare: 0.2,
        minSentences: 12,
        message: 'Faltan oraciones largas: este registro sostiene el dato, la reserva y la consecuencia en un mismo periodo.',
        fix: 'Unir por subordinación lo que quedó en afirmaciones sueltas. Una oración de este tono suele llevar de qué se afirma, con qué se sostiene y qué se sigue de ello.',
        source: 'triangulacion-writing §4.1',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Una de cada tres oraciones supera las treinta palabras, o al menos una de cada cinco?',
          },
        ],
      },
      {
        // §4.2: «La media del corpus es de 26,5 palabras por oración, y los tres
        // apartados largos la sostienen entre 25,6 y 27,6». La banda declarada
        // va de 21 a 32, más ancha que lo medido y a propósito: con un solo
        // documento detrás, apretarla sería confundir lo medido con lo sabido.
        id: 'triangulacion-media-oracion',
        kind: 'sentence-length-mean',
        gobierna: 'ritmo-de-oracion',
        severity: 'warning',
        min: 21,
        max: 32,
        minSentences: 12,
        message: 'La media de oración se salió de la banda de este registro.',
        fix: 'Por debajo, el texto se quedó en la afirmación suelta y no está confrontando nada. Por encima, el periodo dejó de tener juntas y hay que partirlo.',
        source: 'triangulacion-writing §4.2',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿La media de palabras por oración cae entre veintiuna y treinta y dos?',
          },
        ],
      },
      {
        // §4.3, y es un piso donde los demás tonos ponen techo. La mediana de
        // párrafo del corpus es 136 palabras y el piso declarado es 40, que solo
        // dos de sus 87 párrafos bajan. Un párrafo de esta forma abre con lo que
        // va a sostener, trae la evidencia, la confronta y recién concluye; en
        // 40 palabras eso no cabe.
        id: 'triangulacion-parrafo-desarrolla',
        kind: 'paragraph-length',
        gobierna: 'ritmo-de-parrafo',
        severity: 'warning',
        min: 40,
        message: 'Párrafo demasiado corto para desarrollar: este registro no enuncia por párrafo, desarrolla.',
        fix: 'Traer al párrafo la evidencia que sostiene lo que afirma, o fundirlo con el que lo continúa.',
        source: 'triangulacion-writing §4.3',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Los párrafos desarrollan, con ninguno por debajo de cuarenta palabras?',
          },
        ],
      },
      {
        // §8: el 36,4 % de las oraciones del corpus abre con conector y ninguno
        // domina; los diez más usados se reparten entre trece y seis
        // apariciones. Lo que se comprueba es la variedad y no la densidad,
        // porque la densidad sin variedad es la muletilla que la base ya
        // prohíbe con `conectores-de-molde-seguidos`.
        //
        // Las dos reglas empujan juntas y por eso esta no repite aquella: la
        // base impide encadenar dos del mismo molde, y esta exige que el
        // repertorio sea ancho. Un texto que cumpla las dos tiene que variar.
        //
        // Del repertorio quedan fuera «en síntesis» y «en definitiva», que el
        // corpus sí usa. La base los prohíbe como `cierres-anunciados` con
        // severidad error, así que listarlos aquí era pedir con una regla lo
        // que otra castiga. Se descubrió generando una frase por alternativa y
        // corriéndolas contra la base; el censo dio dos, las dos de este tono,
        // y `evals/colision.test.ts` impide que vuelva a pasar en cualquiera.
        id: 'triangulacion-conectores-variados',
        kind: 'must-contain',
        severity: 'warning',
        pattern:
          /\b(?:en consecuencia|por consiguiente|por ello|por tanto|por lo tanto|no obstante|sin embargo|además|de hecho|asimismo|en efecto|en otras palabras|en suma|del mismo modo|de manera que|de modo que|por ende|con ello|adicionalmente|en este sentido|por un lado|por otro lado|en primer lugar|por último)\b/giu,
        minDistinct: 5,
        minSentences: 12,
        message: 'El repertorio de conectores es demasiado estrecho para este registro.',
        fix: 'Variar la relación que cada paso declara con el anterior. Repetir el mismo enlace no es cohesión, es una muletilla con aspecto de método.',
        source: 'triangulacion-writing §6.1',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Los conectores son muchos y variados, sin que ninguno se repita al abrir dos oraciones seguidas?',
          },
        ],
      },
      {
        // §6.3, y es lo mejor medido de esa sección porque son ceros contados
        // sobre 12.239 palabras. La base ya prohíbe «cabe destacar que», «es
        // importante destacar que», «en conclusión» y las aperturas de
        // calendario, así que aquí solo quedan las cuatro que se le escapan y
        // que este registro tampoco usa jamás.
        //
        // Va como regla de tono y no como propuesta a la base porque «se
        // observa que» es prosa española legítima en registros que este arnés
        // no mide, y una prohibición general sería más de lo que hay medido.
        // Sobre los diecisiete documentos de prueba y sobre el corpus, las
        // cuatro dan cero, de manera que la regla no puede marcar en falso nada
        // de lo que hay escrito hoy.
        id: 'triangulacion-andamiaje',
        kind: 'forbidden-pattern',
        severity: 'warning',
        pattern: frases([
          'se observa que',
          'se puede observar',
          'se puede apreciar',
          'como podemos ver',
        ]),
        message: 'Andamiaje escolar: este registro no anuncia que mira, dice qué encontró.',
        fix: 'Nombrar el sujeto que dice algo y el verbo con que lo dice. «Se observa que el daño fue desigual» es «El registro muestra un daño desigual».',
        source: 'triangulacion-writing §7.4',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿El texto está libre del andamiaje escolar, sin «se observa que», sin «cabe destacar» y sin «en conclusión»?',
          },
        ],
      },
      {
        // §5.2: el corpus dice la causa con «ya que» treinta y cuatro veces y
        // con «porque» cinco, siete a uno. Medido por oraciones, «porque» cae
        // en el 0,8 % de las 589 del corpus.
        //
        // El techo va en el 12 %, quince veces por encima de lo medido, y no
        // es un número de adorno: el primer documento que este arnés escribió
        // en este tono usaba «porque» en el 18 % de sus oraciones y «ya que» en
        // ninguna, de modo que la regla existe porque el defecto ya ocurrió. Un
        // texto de doce oraciones aguanta uno sin que la regla diga nada.
        //
        // Solo acota «porque». No exige «ya que», porque una regla que obligue
        // a una palabra concreta produce prosa que la repite, que es el defecto
        // contrario y peor.
        id: 'triangulacion-causa-llana',
        kind: 'pattern-ratio',
        severity: 'warning',
        pattern: /(?<!\p{L})porque(?!\p{L})/iu,
        max: 0.12,
        minSentences: 12,
        message: 'La causa se dice casi siempre con «porque»: este registro la dice con «ya que» o «puesto que».',
        fix: 'Cambiar la mayoría por «ya que», «puesto que» o «dado que», y dejar «porque» para donde la causa sea la respuesta directa a un por qué.',
        source: 'triangulacion-writing §5.2',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿La causa se dice con «ya que» y la consecuencia con «de manera que», antes que con «porque» y «así que»?',
          },
        ],
      },
      {
        // §4.4. El corpus reparte sus 87 párrafos entre 26 y 301 palabras, con
        // un coeficiente de variación del 48 %: el 21 % baja de ochenta y el
        // 20 % pasa de doscientas. No es descuido, es el ritmo.
        //
        // El piso va en el 20 %, menos de la mitad de lo medido, y es el número
        // que hace falta para que un texto tenga al menos un párrafo que rompa
        // el patrón: siete párrafos de 120 palabras y uno de 40 dan un 24 %.
        //
        // Existe porque el defecto ocurrió y lo encontró una persona leyendo.
        // Con la media, la mediana y el piso declarados, y sin esta regla, un
        // texto escrito con este tono salió con ocho párrafos de entre 104 y
        // 139 palabras: variación del 9 %, la más baja de los dieciséis
        // documentos de prueba del arnés. Una media y un piso no describen un
        // ritmo, y lo que no se pide, converge.
        id: 'triangulacion-parrafo-disperso',
        kind: 'paragraph-length-spread',
        gobierna: 'ritmo-de-parrafo',
        severity: 'warning',
        minVariation: 0.2,
        minParagraphs: 6,
        message: 'Los párrafos miden todos casi lo mismo, y este registro alterna el que desarrolla con el que gira en tres líneas.',
        fix: 'Partir el más denso donde cambia de asunto, o dejar en un párrafo corto el giro que hoy va enterrado dentro de uno largo. Al menos uno tiene que romper el patrón.',
        source: 'triangulacion-writing §4.4',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Los párrafos difieren de tamaño entre sí, con al menos uno que rompa el patrón, en vez de medir todos casi lo mismo?',
          },
        ],
      },
      {
        // §7.5. El corpus glosa 63 veces entre paréntesis, una cada 194
        // palabras: casi una por párrafo. Es el rasgo más denso del apartado
        // conceptual y el que menos se transmitía: el texto escrito con este
        // tono antes de existir esta regla traía CERO, y los otros quince
        // documentos de prueba del arnés también.
        //
        // El patrón va sin ignorar mayúsculas a propósito. Con la bandera `i`,
        // `[a-z]` y `{Ll}` cazan mayúsculas en JavaScript, y entonces
        // «(Ibid., p. 19)» y «(Koffka, 1935, p. 83)» entraban como glosas. Sin
        // ella, el censo sobre el corpus descarta los 67 paréntesis de
        // referencia y se queda con las 35 glosas, que es lo que se quería.
        // Es el cuarto delator de este repositorio que marcaba de más antes de
        // afinarse.
        id: 'triangulacion-glosa',
        kind: 'must-contain',
        severity: 'warning',
        pattern: /\((?!(?:op|cit|ibid|vid|cf|pp?)\b)[a-záéíóúüñ][^)0-9]{3,60}\)/gu,
        minDistinct: 2,
        minSentences: 12,
        message: 'Ningún término se explica entre paréntesis, y este registro glosa casi en cada párrafo.',
        fix: 'Poner al lado del término su traducción llana, su forma en la lengua de origen o el nombre alterno con que se lo conoce, entre paréntesis y sin abrir oración.',
        source: 'triangulacion-writing §7.5',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Los términos que lo necesitan traen su glosa entre paréntesis, sin abrir oración para explicarlos?',
          },
        ],
      },
      {
        // §7.6. Noventa y siete adverbios en -mente, uno cada 126 palabras, y
        // 63 formas distintas para esas 97 apariciones: casi no se repiten.
        //
        // El piso pide cuatro distintos. Con la densidad del corpus, un texto de
        // novecientas palabras traería unos siete, así que cuatro deja sitio de
        // sobra. Al escribirse esta regla, el texto que el arnés producía con
        // este tono traía uno solo en 949 palabras, y ninguno de los otros
        // quince documentos de prueba pasaba de cuatro.
        id: 'triangulacion-adverbio-variado',
        kind: 'must-contain',
        severity: 'warning',
        pattern: /(?<!\p{L})[a-záéíóúüñ]{4,}mente(?!\p{L})/gu,
        minDistinct: 4,
        minSentences: 12,
        message: 'Faltan adverbios en -mente: este registro los reparte cada pocas líneas y casi nunca repite el mismo.',
        fix: 'Graduar con ellos lo que se afirma, dentro de la oración y no al principio: «requiere inexorablemente», «delimita ciertamente», «se organiza instantáneamente».',
        source: 'triangulacion-writing §7.6',
        checklist: [
          {
            skill: 'triangulacion-writing',
            item: '¿Los adverbios en -mente aparecen cada pocas líneas, dentro de la oración y sin repetirse?',
          },
        ],
      },
    ],
  },
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
    // La otra mitad del patrón 32, y sin ella la pasada relevaría al tono
    // dejando un hueco: «No elimines todas las cortas: el objetivo es el
    // contraste, no una nueva uniformidad de frases largas». `staccato` impide
    // la cadena de breves y esta impide la cadena de largas.
    id: 'humanizar-varia-longitud',
    kind: 'sentence-length-spread',
    severity: 'error',
    shortWords: 10,
    longWords: 25,
    minSentences: 6,
    message: 'Sin contraste de longitud: la pasada exige alternancia, no una banda nueva.',
    fix: 'Dejar breves de seis a diez palabras junto a largas de veinticinco o más. Fundir no es alargarlo todo.',
    source: 'humanizar-espanol, patrón 32',
    checklist: p('Efectismo manufacturado, staccato y aforismos'),
  },
  {
    // La tercera pieza del patrón 32, y la que faltaba. `staccato` acota la
    // cadena de breves y `humanizar-varia-longitud` solo exige que las dos
    // bandas existan, así que una breve entre veinte bastaba para pasar. Un
    // juicio lo reprodujo: diecinueve oraciones de treinta y cinco palabras
    // seguidas salían limpias con la pasada puesta, que es exactamente lo que
    // el catálogo prohíbe: «el objetivo es el contraste, no una nueva
    // uniformidad de frases largas».
    //
    // Veinticinco es el umbral que la §4 fija para «larga». La cantidad de
    // seguidas no la declara ninguna prosa de esta pasada, así que avisa y no
    // bloquea, por la misma convención que el resto del archivo: un número
    // prestado no puede impedir una entrega. Las rachas que sí bloquean llevan
    // su cifra citada, como fonseca §4.2 con su «nunca cuatro largas seguidas».
    id: 'humanizar-uniformidad-larga',
    kind: 'long-sentence-run',
    severity: 'warning',
    longWords: 25,
    maxRun: 3,
    message: 'Cadena de oraciones largas: fundir no es alargarlo todo.',
    fix: 'Dejar caer una breve. El catálogo pide contraste, y una sucesión de largas es tan de fábrica como una de cortas.',
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

export type Pasada = {
  id: string;
  skill: string;
  rules: Rule[];
  /**
   * Qué le releva a la capa de tono cuando esta pasada se pide.
   *
   * Releva, no apaga: la pasada trae sus propias reglas para lo que asume. Si
   * se llevara por delante `oracion-maxima` sin poner nada en su lugar, el
   * ritmo quedaría sin gobierno, que no es lo que ninguna de las dos skills
   * dice. `staccato` y `humanizar-varia-longitud` son lo que pone en su lugar.
   *
   * La base nunca entra acá. `spanish-writing` §3.1 dice que ninguna capa de
   * encima puede contradecirla, y una pasada es una capa de encima.
   */
  anula: readonly Dominio[];
};

export const PASADAS: Record<string, Pasada> = {
  humanizar: {
    id: 'humanizar',
    skill: 'humanizar-espanol',
    rules: SENALES_IA,
    // `humanizar-espanol` §4: «variar el ritmo, y es la estrategia decisiva.
    // También es el punto donde esta skill se aparta de camus-writing».
    // `camus-writing` §3.1 dice lo mismo desde el otro lado.
    //
    // Solo el ritmo de oración. Sobre el párrafo, esa §4 dice «con la longitud
    // de los párrafos también variada» y no da ningún número, así que no tiene
    // con qué relevar el techo del tono y no lo releva.
    anula: ['ritmo-de-oracion'],
  },
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
    if (r.kind === 'sentence-length-band') {
      if (r.min > r.max) throw new Error(`la regla ${r.id} tiene la banda al revés`);
      if (r.minShare === undefined && r.maxShare === undefined) {
        throw new Error(`la regla ${r.id} no declara ni piso ni techo de proporción: no mide nada`);
      }
      for (const share of [r.minShare, r.maxShare]) {
        if (share !== undefined && (share <= 0 || share > 1)) {
          throw new Error(`la regla ${r.id} necesita una proporción entre 0 y 1`);
        }
      }
      if (r.minShare !== undefined && r.maxShare !== undefined && r.minShare > r.maxShare) {
        throw new Error(`la regla ${r.id} pide más de lo que tolera`);
      }
      // Sin piso de oraciones, un texto de dos dispara o no dispara por azar.
      if (r.minSentences < 4) throw new Error(`la regla ${r.id} necesita un piso de al menos 4 oraciones`);
    }
    if (r.kind === 'sentence-length-mean') {
      if (r.min > r.max) throw new Error(`la regla ${r.id} tiene la banda al revés`);
      if (r.minSentences < 4) throw new Error(`la regla ${r.id} necesita un piso de al menos 4 oraciones`);
    }
    if (r.kind === 'long-sentence-run' && r.maxRun < 1) {
      throw new Error(`la regla ${r.id} tiene que tolerar al menos una oración larga`);
    }
  }
}

/**
 * Toda regla de ritmo de un tono está marcada, y nada más lo está.
 *
 * Falla en las dos direcciones a propósito. Sin la primera, una regla de ritmo
 * nueva sobreviviría a la pasada y seguiría pidiendo lo contrario que ella, que
 * es el defecto que este mecanismo existe para cerrar. Sin la segunda, marcar
 * una regla que no es de ritmo la haría desaparecer al pedir humanizar, y nadie
 * se enteraría hasta leer un texto al que le falta un control.
 *
 * Las pasadas quedan fuera: son las que relevan, no las relevadas. Y la base
 * también, porque no cede nada.
 */
export function assertDominios(): void {
  const dominioDe = (kind: Rule['kind']): Dominio | undefined =>
    (DOMINIO_POR_CLASE as Record<string, Dominio>)[kind];

  for (const tono of Object.values(TONES)) {
    for (const r of tono.rules) {
      const suyo = dominioDe(r.kind);
      if (suyo !== undefined && r.gobierna !== suyo) {
        throw new Error(
          `la regla ${r.id} de ${tono.id} es de clase ${r.kind}, que gobierna ${suyo}, y declara ${r.gobierna ?? 'nada'}. ` +
            'Sin declararlo bien sobrevive a una pasada que debería relevarla, o desaparece ante una que no.',
        );
      }
      if (suyo === undefined && r.gobierna !== undefined) {
        throw new Error(`la regla ${r.id} de ${tono.id} declara un dominio y su clase no gobierna ninguno`);
      }
    }
  }

  for (const pasada of Object.values(PASADAS)) {
    for (const r of pasada.rules) {
      if (r.gobierna !== undefined) {
        throw new Error(`la regla ${r.id} de la pasada ${pasada.id} no puede declarar dominio: releva, no la relevan`);
      }
    }

    // Una pasada que releva un dominio tiene que traer con qué gobernarlo, y
    // por los dos lados. Antes bastaba con traer una regla cualquiera de la
    // familia, y con eso se coló el defecto que este gate existe para cerrar:
    // `staccato` acota la cadena de breves y nada acotaba la de largas, así que
    // un texto de diecinueve oraciones de treinta y cinco palabras seguidas
    // pasaba limpio. Es justo la «nueva uniformidad de frases largas» que el
    // patrón 32 de esa misma pasada prohíbe.
    for (const dominio of pasada.anula) {
      if (dominio !== 'ritmo-de-oracion') continue;
      const clases = new Set(pasada.rules.map((r) => r.kind));
      if (!clases.has('short-sentence-run')) {
        throw new Error(
          `la pasada ${pasada.id} releva el ritmo de oración y no acota la cadena de breves`,
        );
      }
      if (!clases.has('long-sentence-run')) {
        throw new Error(
          `la pasada ${pasada.id} releva el ritmo de oración y no acota la cadena de largas. ` +
            'Relevar solo por un lado deja pasar la uniformidad contraria.',
        );
      }
      if (!clases.has('sentence-length-spread')) {
        throw new Error(`la pasada ${pasada.id} releva el ritmo de oración y no exige contraste`);
      }
    }
  }

  for (const r of BASE_RULES) {
    if (r.gobierna !== undefined) {
      throw new Error(`la regla ${r.id} es de la base y la base no cede nada`);
    }
  }
}
