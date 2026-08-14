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
// sostiene: 6 de los 11 tonos no tienen ninguna regla mecanizada
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
  'personaje',
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
  /** El asunto es un personaje, no la obra completa. */
  personaje?: boolean;
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
  /**
   * Cuándo la elección viene de un rasgo y no de quedarse sin filas.
   *
   * Solo lo necesita `camus`, que cierra la lista aceptando cualquier cosa. Sin
   * esto, `reclamado` se calculaba mirando si el tono era `camus`, y entonces
   * pedir el tono académico con el rasgo `academico` respondía «ningún rasgo
   * reclamó el texto», que es falso: el usuario declaró uno, y justamente el que
   * nombra el dominio de esa skill.
   */
  reclamaSi?: (r: Rasgos) => boolean;
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
    cuando: 'Textos académicos, técnicos y formales',
    // Recoge lo que nadie reclamó, y también lo académico dicho de frente.
    eligeSi: () => true,
    // Lo segundo es lo que `reclamaSi` distingue de lo primero.
    reclamaSi: (r) => Boolean(r.academico),
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
    // Reclamar es que un rasgo la haya elegido. Quedarse con el texto por ser
    // la última de la lista no es lo mismo, y el mensaje tiene que distinguirlo.
    const reclamado = (ruta.reclamaSi ?? ruta.eligeSi)(rasgos);
    return {
      tono: ruta.tono,
      skill: ruta.skill,
      porque: reclamado
        ? `${ruta.cuando}.`
        : 'Ningún rasgo reclamó el texto; se aplica el tono por defecto.',
      reclamado,
    };
  }
  // Inalcanzable: la última ruta acepta cualquier cosa. Queda por si alguien
  // reordena la lista y se lleva por delante el cierre.
  throw new Error('el enrutamiento se quedó sin rutas: la última tiene que aceptar todo');
}

/** Los tonos que este enrutamiento conoce, en el orden en que decide. */
export const RUTA_IDS = RUTAS.map((r) => r.tono);

/**
 * Rasgos que la lista acepta y que ninguna ruta consulta.
 *
 * `academico` estuvo así desde el principio: el CLI lo validaba, el usuario lo
 * escribía y ninguna condición lo leía. El resultado salía bien de casualidad,
 * porque `camus` cierra la lista, y el motivo salía mal siempre.
 *
 * Se lee el código de las condiciones, que es la única fuente que no se puede
 * desincronizar con el código. Tiene un límite y conviene que conste: si alguien
 * leyera un rasgo con notación de corchetes, `r['academico']`, esto no lo vería.
 * Ninguna condición se escribe así, y el gate lo comprueba también.
 */
export function rasgosSinRuta(): string[] {
  const fuente = RUTAS.map((r) => `${r.eligeSi};${r.reclamaSi ?? ''}`).join(' ');
  if (fuente.includes('[')) {
    throw new Error('una condición usa notación de corchetes y este análisis no la ve');
  }
  return RASGOS.filter((rasgo) => !new RegExp(`\\.${rasgo}(?![A-Za-z])`, 'u').test(fuente));
}

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
