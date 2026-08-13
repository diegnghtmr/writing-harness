// El enrutamiento como dato, y el procedimiento que decide cuando nadie eligió.
//
// La tabla de `spanish-writing` §3 dice qué tono sirve para qué. Leerla es
// suficiente para una persona y no lo es para un procedimiento: hasta ahora, si
// el usuario no indicaba tono y el género no era académico, la base corría sola
// y el texto salía sin forma. Eso no es una decisión, es una ausencia.
//
// Acá está la misma tabla como dato, con un orden de preguntas que siempre
// termina en un tono. Es un procedimiento determinista, no una recomendación: la
// misma petición da siempre la misma respuesta, y la respuesta viene con el
// motivo, para que se pueda discutir.
//
// Lo que NO se hizo, y conviene que conste. Se intentó decidir midiendo el texto
// contra las reglas de cada tono, que sería lo propio de este repositorio. No se
// sostiene: seis de los catorce tonos no tienen ninguna regla mecanizada
// todavía, así que ganarían siempre por no poder incumplirse. También se
// intentó comparar el perfil numérico que cada skill declara, y tampoco: la
// prosa no lo enuncia de forma uniforme, y raspar cifras con expresiones
// regulares producía medias implausibles. Un gateway que decide por una medición
// que no existe es peor que uno que decide por rasgos declarados.

import { TONES } from './rules.ts';

/**
 * Lo que se sabe de una petición antes de saber el tono.
 *
 * Todos opcionales: el procedimiento tiene que dar una respuesta con lo que
 * haya, incluso con nada.
 */
export const RASGOS = [
  'academico',
  'divulgacion',
  'obraDeFiccion',
  'enSuOrden',
  'serializada',
  'personaje',
  'resena',
  'contraOtraTesis',
  'adversarioConNombre',
  'humanistico',
  'epocal',
  'mecanismo',
  'fundamentos',
  'mueveAActuar',
  'actualidad',
  'juridico',
] as const;

export type Rasgos = {
  /** Tesis, artículo, informe, documentación, comunicación institucional. */
  academico?: boolean;
  /** El texto explica algo a un público que no es del oficio. */
  divulgacion?: boolean;
  /** El asunto es una obra de ficción. */
  obraDeFiccion?: boolean;
  /** Se recorre la obra en su orden, entera. */
  enSuOrden?: boolean;
  /** La obra sale por entregas y se analiza unidad por unidad. */
  serializada?: boolean;
  /** El asunto es un personaje, no la obra completa. */
  personaje?: boolean;
  /** Hay un veredicto: vale la pena o no. */
  resena?: boolean;
  /** El texto sostiene una tesis contra otra que alguien defiende. */
  contraOtraTesis?: boolean;
  /** El adversario es una persona o un gremio, no una doctrina. */
  adversarioConNombre?: boolean;
  /** Filosofía, humanidades, cultura. */
  humanistico?: boolean;
  /** Diagnóstico de la época por oposición de conceptos. */
  epocal?: boolean;
  /** El asunto es un mecanismo técnico. */
  mecanismo?: boolean;
  /** Fundamentos de computación antes que la receta. */
  fundamentos?: boolean;
  /** El texto busca que alguien haga algo. */
  mueveAActuar?: boolean;
  /** Parte de un hecho reciente: actualidad, geopolítica, economía. */
  actualidad?: boolean;
  /** Derecho o política dirigidos a una comunidad. */
  juridico?: boolean;
};

export type Ruta = {
  tono: string;
  skill: string;
  /**
   * Fragmento literal de la celda «Cuándo se usa» de la tabla §3.
   *
   * Es lo que ata este dato a la prosa. El gate comprueba que siga estando ahí,
   * así que reescribir la tabla sin tocar esto rompe, y al revés también.
   */
  cuando: string;
  /** Qué rasgo lo elige. El primero que da verdadero gana. */
  eligeSi: (r: Rasgos) => boolean;
};

/**
 * El orden importa y es la mitad del procedimiento.
 *
 * Va de lo más específico a lo más general: quien pide el análisis de un
 * personaje concreto pide algo más estrecho que quien pide divulgación, y si
 * `atenas` no fuese antes que `fonda` nunca se elegiría. `camus` cierra la lista
 * porque es el que recoge lo que ninguna fila reclamó.
 */
export const RUTAS: readonly Ruta[] = [
  {
    tono: 'atenas',
    skill: 'atenas-writing',
    cuando: 'Análisis de un personaje de ficción',
    eligeSi: (r) => Boolean(r.obraDeFiccion && r.personaje),
  },
  {
    tono: 'sekkyoku',
    skill: 'sekkyoku-writing',
    cuando: 'Análisis narrativo unidad por unidad de una obra serializada',
    eligeSi: (r) => Boolean(r.obraDeFiccion && r.serializada),
  },
  {
    tono: 'medicendai',
    skill: 'medicendai-writing',
    cuando: 'Análisis largo de una obra de ficción, recorrida en su orden',
    eligeSi: (r) => Boolean(r.obraDeFiccion && r.enSuOrden),
  },
  {
    tono: 'kenway',
    skill: 'kenway-writing',
    cuando: 'Reseña crítica con sección de opinión marcada al final',
    eligeSi: (r) => Boolean(r.resena),
  },
  {
    tono: 'solitario',
    skill: 'solitario-writing',
    cuando: 'Texto que sostiene una tesis contra quien la niega',
    eligeSi: (r) => Boolean(r.contraOtraTesis && r.adversarioConNombre),
  },
  {
    tono: 'catedra',
    skill: 'catedra-writing',
    cuando: 'Exposición que sostiene una tesis contra otra',
    eligeSi: (r) => Boolean(r.contraOtraTesis),
  },
  {
    tono: 'han',
    skill: 'han-writing',
    cuando: 'Diagnóstico epocal y ensayo filosófico breve',
    eligeSi: (r) => Boolean(r.epocal),
  },
  {
    tono: 'schiavenato',
    skill: 'schiavenato-writing',
    cuando: 'Divulgación jurídica y política dirigida a una comunidad',
    eligeSi: (r) => Boolean(r.juridico),
  },
  {
    tono: 'fonseca',
    skill: 'fonseca-writing',
    cuando: 'Actualidad internacional, geopolítica y economía',
    eligeSi: (r) => Boolean(r.actualidad),
  },
  {
    tono: 'bettatech',
    skill: 'bettatech-writing',
    cuando: 'Fundamentos de informática y computación antes que la receta',
    eligeSi: (r) => Boolean(r.fundamentos),
  },
  {
    tono: 'freddy',
    skill: 'freddy-writing',
    cuando: 'Divulgación tecnológica y educativa que busca mover a alguien a actuar',
    eligeSi: (r) => Boolean(r.mueveAActuar && (r.mecanismo || r.divulgacion)),
  },
  {
    tono: 'dotcsv',
    skill: 'dotcsv-writing',
    cuando: 'Divulgación técnica de un mecanismo difícil para público general',
    eligeSi: (r) => Boolean(r.mecanismo && r.divulgacion),
  },
  {
    tono: 'fonda',
    skill: 'fonda-writing',
    cuando: 'Divulgación filosófica, humanística o cultural',
    eligeSi: (r) => Boolean(r.humanistico && r.divulgacion),
  },
  {
    tono: 'camus',
    skill: 'camus-writing',
    cuando: 'Es el tono por defecto',
    // Recoge lo que nadie reclamó, y también lo académico dicho de frente.
    eligeSi: () => true,
  },
];

export type Sugerencia = {
  tono: string;
  skill: string;
  /** Por qué salió ese, en una línea que se pueda discutir. */
  porque: string;
  /** `false` cuando ningún rasgo reclamó el texto y ganó el de por defecto. */
  reclamado: boolean;
};

/**
 * Elige exactamente un tono. Siempre devuelve uno.
 *
 * Antes, una petición que no encajaba en ninguna fila se quedaba sin tono y el
 * texto salía solo con la base. La base dice qué es correcto en español; no dice
 * cómo suena nada. Un texto sin tono no es un texto neutro, es un texto cuya
 * forma no decidió nadie.
 */
export function sugerirTono(rasgos: Rasgos = {}): Sugerencia {
  for (const ruta of RUTAS) {
    if (!ruta.eligeSi(rasgos)) continue;
    const porDefecto = ruta.tono === 'camus';
    return {
      tono: ruta.tono,
      skill: ruta.skill,
      porque: porDefecto
        ? 'Ningún rasgo reclamó el texto; se aplica el tono por defecto.'
        : `${ruta.cuando}.`,
      reclamado: !porDefecto,
    };
  }
  // Inalcanzable: la última ruta acepta cualquier cosa. Queda por si alguien
  // reordena la lista y se lleva por delante el cierre.
  throw new Error('el enrutamiento se quedó sin rutas: la última tiene que aceptar todo');
}

/** Los tonos que este enrutamiento conoce, en el orden en que decide. */
export const RUTA_IDS = RUTAS.map((r) => r.tono);

/** Toda ruta tiene que apuntar a un tono que exista de verdad. */
export function assertRutas(): void {
  const huerfanas = RUTAS.filter((r) => !TONES[r.tono]).map((r) => r.tono);
  if (huerfanas.length) throw new Error(`rutas sin tono: ${huerfanas.join(', ')}`);
  const faltan = Object.keys(TONES).filter((t) => !RUTA_IDS.includes(t));
  if (faltan.length) throw new Error(`tonos sin ruta: ${faltan.join(', ')}`);
  if (RUTAS[RUTAS.length - 1]?.tono !== 'camus') {
    throw new Error('la última ruta tiene que ser la de por defecto');
  }
}
