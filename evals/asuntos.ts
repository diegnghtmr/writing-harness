// De qué habla el corpus de cada tono, declarado a mano.
//
// EXISTE PORQUE EL DEFECTO OCURRIÓ. Una skill de tono ilustró todos sus
// movimientos con ejemplos sobre un asunto que no era el de su corpus, y el
// daño fue doble. El primero es de enseñanza: un ejemplo fuera del hábitat del
// registro no se puede contrastar contra nada, porque nadie escribió nunca así
// sobre ese tema. El segundo se midió: quien después tuvo que redactar sobre
// ese mismo asunto ajeno encontró en la skill párrafos ya hechos y los reusó,
// tres veces seguidas y casi palabra por palabra. Un ejemplo sobre otro tema no
// enseña la forma, entrega el texto.
//
// LA REGLA: los ejemplos de una skill de tono tratan del asunto del corpus con
// el que se midió esa skill. No son transcripciones suyas, que eso es otra cosa
// y está prohibido; son prosa nueva sobre el mismo mundo.
//
// POR QUÉ SE DECLARA Y NO SE INFIERE. Se intentaron dos maneras de que el arnés
// dedujera el asunto y las dos fallaron sobre la medición. La primera fue el
// manifiesto de `src/corpus.ts`: sus rutas son títulos, pero el vocabulario que
// dan reconoce el asunto en menos de la mitad de las muestras de la mejor skill
// y en ninguna de la peor. La segunda fue escribir las raíces a ojo para las
// trece: el resultado dio entre 0 % y 63 %, y al mirar los casos bajos resultó
// que el equivocado era quien escribía las raíces. `schiavenato-writing` puntúa
// 5 % con una lista de «auto, motor, vehículo» sacada del nombre del canal,
// cuando sus muestras hablan de política de ciudad. El corpus estaba borrado y
// no había con qué comprobar.
//
// De ahí la forma de este archivo: el asunto lo declara quien construye el
// tono, que es el único que tiene el corpus delante, y el gate comprueba la
// declaración contra las muestras. Nadie puede declarar por un corpus que no
// leyó, y por eso las skills anteriores a esta regla van en `SIN_DECLARAR` en
// vez de llevar una declaración inventada.

/** El asunto de un corpus, con las raíces que lo reconocen en una muestra. */
export type Asunto = {
  /** Carpeta de la skill. */
  skill: string;
  /** De qué habla el corpus, en una frase. Para quien lea, no para el gate. */
  asunto: string;
  /**
   * Raíces, no palabras: «percib» y no «percepción», para que valgan las
   * formas. Se prueban sin distinguir mayúsculas y como subcadena, así que una
   * raíz corta de más marca de más y hay que elegirlas largas.
   */
  raices: readonly string[];
};

export const ASUNTOS: readonly Asunto[] = [
  {
    skill: 'triangulacion-writing',
    asunto:
      'Un informe de investigación sobre la mentira: su definición frente a la verdad y al engaño, ' +
      'la percepción como proceso, los actos de habla, y una encuesta con entrevistas sobre lo mismo.',
    raices: [
      'mentira', 'mentir', 'miente', 'verdad', 'engañ', 'engan',
      'percep', 'percib', 'lenguaje', 'enunciad', 'hablante', 'oyente',
      'emisor', 'intención', 'creencia', 'creer',
      'saber', 'gestalt', 'pregnancia', 'estímul', 'concepto', 'sujeto',
      'aserción', 'respuesta',
    ],
  },
];

/**
 * Los tonos anteriores a esta regla, cuyo corpus ya no existe.
 *
 * Es el mismo trato que `evals/cobertura.ts` le da a los ítems sin regla y
 * `evals/muestras.test.ts` a las skills sin muestras: un registro de lo que
 * falta, que falla en las dos direcciones. **La lista solo puede encoger.** Un
 * tono nuevo no puede entrar acá, porque quien construye un tono tiene el
 * corpus delante y no tiene excusa para no declarar de qué habla.
 *
 * Sacar una skill de esta lista exige tener otra vez su corpus. Sin él, la
 * declaración sería una suposición con aspecto de dato, que es justamente lo
 * que este archivo viene a impedir.
 */
export const SIN_DECLARAR: readonly { skill: string; porque: string }[] = [
  { skill: 'adria-sola-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'atenas-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'bettatech-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'catedra-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'dotcsv-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'fonda-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'fonseca-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'freddy-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'han-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'schiavenato-writing', porque: 'corpus borrado antes de que existiera la regla' },
  { skill: 'solitario-writing', porque: 'corpus borrado antes de que existiera la regla' },
];

/**
 * Qué proporción de las muestras tiene que tocar el asunto declarado.
 *
 * Sale de medir, no de elegir. La skill que motivó esta regla puntuaba 25 % con
 * los ejemplos sobre un asunto ajeno y 51 % con los ejemplos reescritos sobre
 * el suyo, contadas las mismas ochenta y una muestras las dos veces. El piso
 * queda en medio, porque una muestra puede ser legítima y no nombrar el asunto:
 * «no X, sino Y» se ilustra igual con cualquier par.
 */
export const PISO = 0.35;

/**
 * Las muestras de prosa de una skill.
 *
 * Tres formas conviven en el repositorio y las tres cuentan: el bloque con `>`,
 * el fragmento entre comillas angulares dentro de una tabla o de un párrafo, y
 * el par `Incorrecto:` / `Correcto:`. Se piden seis palabras como mínimo para
 * dejar fuera las citas de una expresión suelta, que no ilustran un movimiento
 * sino que nombran una pieza.
 *
 * **Las líneas seguidas de un bloque son una sola muestra.** La primera versión
 * de esta función contaba una por línea, y con la prosa justificada a ochenta
 * columnas eso partía cada ejemplo en tres o cuatro. El efecto no era neutro:
 * inflaba el denominador y hundía la proporción, porque un ejemplo nombra su
 * asunto una vez y no en cada renglón. Lo encontró el test que prueba el
 * detector en las dos direcciones, que daba dos de cuatro sobre un texto donde
 * las dos muestras hablaban del asunto.
 */
export function muestrasDe(md: string): string[] {
  const angulares = [...md.matchAll(/«([^»]{25,})»/gu)].map((m) => m[1] as string);
  const bloques: string[] = [];
  let actual: string[] = [];
  for (const linea of md.split('\n')) {
    if (/^>\s/u.test(linea)) {
      actual.push(linea.slice(2).trim());
      continue;
    }
    if (actual.length > 0) {
      bloques.push(actual.join(' '));
      actual = [];
    }
  }
  if (actual.length > 0) bloques.push(actual.join(' '));
  const pares = [...md.matchAll(/^(?:Incorrecto|Correcto):\s*(.+)$/gmu)].map((m) => m[1] as string);
  return [...angulares, ...bloques, ...pares].filter((x) => x.split(/\s+/u).length >= 6);
}

/** Cuántas de esas muestras nombran el asunto. */
export function tocanElAsunto(
  md: string,
  raices: readonly string[],
): { total: number; tocan: number; fuera: string[] } {
  const muestras = muestrasDe(md);
  const bajo = (s: string) => s.toLowerCase();
  const dentro = (s: string) => raices.some((r) => bajo(s).includes(bajo(r)));
  return {
    total: muestras.length,
    tocan: muestras.filter(dentro).length,
    fuera: muestras.filter((m) => !dentro(m)),
  };
}
