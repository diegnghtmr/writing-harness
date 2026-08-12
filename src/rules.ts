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

export type Rule =
  | PatternRule
  | SentenceLengthRule
  | DensityRule
  | ParagraphLengthRule
  | ShortSentenceRunRule
  | SentenceStartRunRule
  | ParagraphOpeningRule;

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
    ],
  },
  fonda: { id: 'fonda', skill: 'fonda-writing', rules: [] },
  catedra: { id: 'catedra', skill: 'catedra-writing', rules: [] },
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
    if (r.kind === 'forbidden-pattern' || r.kind === 'pattern-density') {
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
    if (r.kind === 'sentence-start-run' || r.kind === 'paragraph-opening') {
      if (r.pattern.flags.includes('g')) {
        throw new Error(`la regla ${r.id} no puede llevar el flag g`);
      }
    }
    if (r.kind === 'paragraph-length' && r.min === undefined && r.max === undefined) {
      throw new Error(`la regla ${r.id} necesita al menos un límite`);
    }
  }
}
