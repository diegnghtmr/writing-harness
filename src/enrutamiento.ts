// El enrutamiento como dato, y el procedimiento que decide cuando nadie eligió.
//
// La tabla de la skill de entrada dice qué tono sirve para qué. Leerla es
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
// contra las reglas de cada tono, que sería lo propio de este repositorio.
//
// El motivo que se dio entonces fue contingente y ya caducó: ocho de los catorce
// tonos no tenían ninguna regla mecanizada, así que ganarían siempre por no
// poder incumplirse. Hoy los tiene cada uno de los doce y ese argumento no vale.
// Lo dijo su propio gate, que lo tenía escrito como condición de caducidad y
// falló el día en que dejó de ser cierto.
//
// El motivo que queda es estructural y no caduca: **el enrutamiento decide antes
// de que exista el texto**. `sugerirTono` responde qué forma le corresponde a una
// petición, y en ese momento no hay prosa que medir. Medir para enrutar exigiría
// escribir primero en algún tono, que es la decisión que se quería tomar. Por eso
// la entrada son rasgos declarados y no un texto, y por eso `Rasgos` solo admite
// booleanos: el día que alguien le meta una cadena, esto vuelve a estar en
// discusión y el gate lo va a decir.
//
// Queda además el hallazgo menor de aquel intento: comparar el perfil numérico
// que cada skill declara tampoco servía, porque la prosa no lo enuncia de forma
// uniforme y raspar cifras con expresiones regulares producía medias
// implausibles. Eso sí se resolvió, pero por el otro lado: las cifras se
// mecanizaron como reglas en vez de rasparlas al vuelo.

import { TONES } from './rules.ts';

/**
 * Lo que se sabe de una petición antes de saber el tono.
 *
 * Todos opcionales: el procedimiento tiene que dar una respuesta con lo que
 * haya, incluso con nada.
 */
export const RASGOS = [
  'academico',
  'relatoPropio',
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
  'metodoPersonal',
  'actualidad',
  'juridico',
  'evidenciaCruzada',
] as const;

export type Rasgos = {
  /** Tesis, artículo, informe, documentación, comunicación institucional. */
  academico?: boolean;
  /**
   * El usuario cuenta algo que le pasó a él: una experiencia, una anécdota, un
   * testimonio, una queja. No es `metodoPersonal`, que le entrega al lector un
   * procedimiento: acá nadie recibe instrucciones, alguien cuenta lo que vivió.
   */
  relatoPropio?: boolean;
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
  /** El lector recibe un procedimiento para ejecutarlo sobre sí mismo. */
  metodoPersonal?: boolean;
  /** Parte de un hecho reciente: actualidad, geopolítica, economía. */
  actualidad?: boolean;
  /** Derecho o política dirigidos a una comunidad. */
  juridico?: boolean;
  /** Hay evidencia de más de una clase sobre el mismo asunto, y teoría con que leerla. */
  evidenciaCruzada?: boolean;
};

/** Un rasgo que reclama una ruta, y el motivo que se da cuando la reclama. */
export type Reclamo = {
  si: (r: Rasgos) => boolean;
  /**
   * Fragmento literal de la misma celda «Cuándo se usa». Sin él, el motivo es
   * el `cuando` de la ruta. El gate lo busca en la fila igual que a ese.
   */
  cuando?: string;
};

export type Ruta = {
  tono: string;
  skill: string;
  /**
   * Fragmento literal de la celda «Cuándo se usa» de la tabla de la entrada.
   *
   * Es lo que ata este dato a la prosa. El gate comprueba que siga estando ahí,
   * así que reescribir la tabla sin tocar esto rompe, y al revés también.
   */
  cuando: string;
  /** Qué rasgo lo elige. El primero que da verdadero gana. */
  eligeSi: (r: Rasgos) => boolean;
  /**
   * Cuándo la elección viene de un rasgo y no de quedarse sin filas, y con qué
   * motivo. El primer reclamo que da verdadero da el motivo. Sin reclamos,
   * reclama `eligeSi` con el `cuando` de la ruta.
   *
   * Solo lo necesita `camus`, que cierra la lista aceptando cualquier cosa. Sin
   * esto, `reclamado` se calculaba mirando si el tono era `camus`, y entonces
   * pedir el tono académico con el rasgo `academico` respondía «ningún rasgo
   * reclamó el texto», que es falso: el usuario declaró uno, y justamente el que
   * nombra el dominio de esa skill.
   *
   * Es una lista, y no un rasgo solo, porque el último paso lo reclaman dos y
   * cada uno con su motivo. Con un motivo único, un relato del propio usuario
   * salía justificado como texto académico, y un agente repitió esa
   * justificación falsa en la línea con que anunció el tono.
   */
  reclamos?: readonly Reclamo[];
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
    // Va antes que `freddy` porque es más estrecho, y la diferencia entre los
    // dos es de forma y no de tema: `freddy` explica un mecanismo para que el
    // lector se decida, y este le entrega un procedimiento para que lo ejecute.
    // Sin este orden, un método personal que además explica algo caería en
    // `freddy` y perdería la arquitectura de pasos, que es lo que lo define.
    tono: 'adria-sola',
    skill: 'adria-sola-writing',
    cuando: 'Texto que le entrega al lector un método para que lo ejecute',
    eligeSi: (r) => Boolean(r.metodoPersonal),
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
    // Va inmediatamente antes de `camus` y no antes, porque no compite con
    // ninguna de las filas de arriba: ninguna otra lee este rasgo. Lo que sí
    // hace falta es que gane a `camus`, que se llevaría todo informe de
    // investigación por la puerta de lo académico y le pondría un techo de
    // oración de treinta palabras, que es justo lo contrario de lo que esta
    // forma necesita.
    //
    // No pide además el rasgo `academico`. La precondición es sobre la
    // evidencia y no sobre el género: un texto periodístico con dos series y un
    // marco con que leerlas cumple esta forma igual que una tesis.
    tono: 'triangulacion',
    skill: 'triangulacion-writing',
    cuando: 'Texto que sostiene cada afirmación con evidencia de más de una clase',
    eligeSi: (r) => Boolean(r.evidenciaCruzada),
  },
  {
    tono: 'camus',
    skill: 'camus-writing',
    cuando: 'Textos académicos, técnicos y formales',
    // Recoge lo que nadie reclamó, y además dos cosas dichas de frente. Los
    // reclamos son lo que distingue lo segundo de lo primero.
    eligeSi: () => true,
    reclamos: [
      // El relato del propio usuario vive acá y no en un tono nuevo. `camus`
      // no salió de medir el corpus de ningún autor, así que no hay un registro
      // medido que la primera persona contradiga, y su prosa modelo es un
      // relato en primera persona. Va antes que lo académico porque cambia la
      // persona, y el motivo tiene que decirlo.
      {
        si: (r) => Boolean(r.relatoPropio),
        cuando: 'Relato de lo que le pasó al propio usuario, en primera persona del singular',
      },
      { si: (r) => Boolean(r.academico) },
    ],
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
    const reclamo = (ruta.reclamos ?? [{ si: ruta.eligeSi }]).find((c) => c.si(rasgos));
    return {
      tono: ruta.tono,
      skill: ruta.skill,
      porque: reclamo
        ? `${reclamo.cuando ?? ruta.cuando}.`
        : 'Ningún rasgo reclamó el texto; se aplica el tono por defecto.',
      reclamado: reclamo !== undefined,
    };
  }
  // Inalcanzable: la última ruta acepta cualquier cosa. Queda por si alguien
  // reordena la lista y se lleva por delante el cierre.
  throw new Error('el enrutamiento se quedó sin rutas: la última tiene que aceptar todo');
}

/** Los tonos que este enrutamiento conoce, en el orden en que decide. */
export const RUTA_IDS = RUTAS.map((r) => r.tono);

/** Un rasgo que, sumado a los dados, haría elegir una ruta concreta. */
export type Complemento = {
  rasgo: (typeof RASGOS)[number];
  tono: string;
  /** La posición de esa ruta en la lista, contando desde 1 como la entrada. */
  paso: number;
};

/**
 * Los rasgos sueltos que completarían una ruta gracias a los que ya se dieron.
 *
 * Existe porque cinco rutas piden dos rasgos, y quien pasaba uno solo recibía
 * el último paso sin ningún aviso, como si fuese una decisión. Ocho de los
 * quince rasgos, pasados solos, caían ahí.
 *
 * Un rasgo cuenta solo si la ruta que elige no la elegía él solo: sugerir
 * `actualidad` a quien dio `divulgacion` sería sugerir lo que ya se sabía, no
 * lo que le falta a la petición.
 */
export function rasgosQueCompletan(rasgos: Rasgos = {}): Complemento[] {
  // Solo hay algo que avisar si la petición cayó en el último paso. Si eligió
  // una ruta concreta, esa es la decisión: sumarle un rasgo que no la cambia no
  // es algo que le falte.
  if (RUTA_IDS.indexOf(sugerirTono(rasgos).tono) + 1 !== RUTAS.length) return [];
  const completan: Complemento[] = [];
  for (const rasgo of RASGOS) {
    if (rasgos[rasgo]) continue;
    const tono = sugerirTono({ ...rasgos, [rasgo]: true }).tono;
    const paso = RUTA_IDS.indexOf(tono) + 1;
    if (paso === RUTAS.length) continue;
    if ((RUTAS[paso - 1] as Ruta).eligeSi({ [rasgo]: true })) continue;
    completan.push({ rasgo, tono, paso });
  }
  return completan.sort((a, b) => a.paso - b.paso);
}

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
  const fuente = RUTAS.map((r) => [r.eligeSi, ...(r.reclamos ?? []).map((c) => c.si)].join(';')).join(' ');
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
