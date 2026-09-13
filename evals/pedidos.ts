// Una batería de pedidos típicos, para medir a dónde los manda la lista.
//
// Son lo que le pide a quien escribe un estudiante, un docente o un oficinista
// de América Latina: correos, cartas, ensayos, informes, guías, publicaciones.
// Los veinticuatro primeros son los de la auditoría independiente que encontró
// camus en once de ellos. Los doce siguientes amplían la mezcla con textos de
// la casa, de la oficina, del colegio y de la universidad, y tres tienen que
// terminar en camus porque esa es su forma: un memorando, la introducción de
// una tesis y una reclamación a una aseguradora.
//
// Los rasgos de cada pedido son los que declararía un agente razonable que lee
// la ayuda de `--enrutar`: lo que el pedido dice, no lo que conviene. No se
// eligieron para mejorar las cifras, y no se cambian para eso. Si una ruta
// cambia y el reparto empeora, se discute la ruta o el techo, con su motivo
// escrito; nunca los rasgos de un pedido para que el gate vuelva a verde.
//
// El tono anotado es el que el enrutador da hoy con esos rasgos, así que la
// batería es además un registro: cuando una ruta cambia, `evals/sesgo.test.ts`
// dice qué pedidos cambiaron de tono.
//
// Vive en un módulo llano, y no dentro del test, porque la leen dos: el gate y
// `scripts/sesgo.ts`. Un archivo de test no se importa desde otro.

import { RASGOS, type Rasgos, RUTA_IDS, sugerirTono } from '../src/enrutamiento.ts';

export type Rasgo = (typeof RASGOS)[number];

export type Pedido = {
  /** Qué se pide, en una línea. */
  pedido: string;
  /** Los rasgos que un agente razonable declararía para ese pedido. */
  rasgos: readonly Rasgo[];
  /** El tono que el enrutador da hoy con esos rasgos. */
  tono: string;
};

/** Los de la auditoría, en su orden. Antes del cambio de rutas, once salían en camus. */
const AUDITORIA: readonly Pedido[] = [
  { pedido: 'Correo a un profesor para pedirle una prórroga en la entrega de un trabajo', rasgos: [], tono: 'camus' },
  { pedido: 'Carta de queja al banco por un cobro duplicado en la tarjeta', rasgos: ['relatoPropio'], tono: 'camus' },
  { pedido: 'Carta de presentación para una práctica profesional', rasgos: [], tono: 'camus' },
  { pedido: 'Reseña de unos audífonos para un blog', rasgos: ['divulgacion'], tono: 'fonda' },
  { pedido: 'Anécdota del día en que el usuario se perdió en una ciudad que no conocía', rasgos: ['relatoPropio'], tono: 'camus' },
  { pedido: 'Columna de opinión sobre la inteligencia artificial en los exámenes', rasgos: ['contraOtraTesis'], tono: 'catedra' },
  { pedido: 'Resumen de una clase de estadística', rasgos: [], tono: 'camus' },
  { pedido: 'Instrucciones para instalar Python', rasgos: ['metodoPersonal'], tono: 'adria-sola' },
  {
    pedido: 'Explicación de cómo funcionan las vacunas, para público general',
    rasgos: ['mecanismo', 'divulgacion'],
    tono: 'dotcsv',
  },
  { pedido: 'Discurso para la ceremonia de grado', rasgos: [], tono: 'camus' },
  { pedido: 'Publicación en redes para convocar a una jornada de donación de sangre', rasgos: ['mueveAActuar'], tono: 'camus' },
  { pedido: 'Entrada de blog sobre hábitos de estudio', rasgos: ['metodoPersonal'], tono: 'adria-sola' },
  { pedido: 'Resumen de una noticia reciente', rasgos: ['actualidad'], tono: 'fonseca' },
  { pedido: 'Ensayo sobre un personaje de una novela', rasgos: ['obraDeFiccion', 'personaje'], tono: 'atenas' },
  {
    pedido: 'Ensayo que refuta a un autor con nombre propio',
    rasgos: ['contraOtraTesis', 'adversarioConNombre'],
    tono: 'solitario',
  },
  { pedido: 'Crítica de la asistencia obligatoria a clase', rasgos: ['contraOtraTesis'], tono: 'catedra' },
  { pedido: 'Informe de investigación que cruza encuestas y entrevistas', rasgos: ['evidenciaCruzada'], tono: 'triangulacion' },
  { pedido: 'Tutorial de recursión', rasgos: ['fundamentos'], tono: 'bettatech' },
  {
    pedido: 'Explicación de los derechos de los inquilinos para los vecinos',
    rasgos: ['comunidadAfectada'],
    tono: 'schiavenato',
  },
  { pedido: 'Ensayo sobre la cultura del agotamiento', rasgos: ['epocal'], tono: 'han' },
  { pedido: 'Acta de una reunión del consejo estudiantil', rasgos: [], tono: 'camus' },
  {
    pedido: 'Texto para convencer a los compañeros de curso de ir a votar',
    rasgos: ['mueveAActuar', 'comunidadAfectada'],
    tono: 'schiavenato',
  },
  {
    pedido: 'La inflación después de la subida de las tasas de interés de esta semana',
    rasgos: ['actualidad'],
    tono: 'fonseca',
  },
  { pedido: 'Reflexión sobre una lectura de filosofía', rasgos: [], tono: 'camus' },
];

/** La ampliación: tres de la oficina, tres de la casa, tres del colegio y tres de la universidad. */
const AMPLIACION: readonly Pedido[] = [
  {
    pedido: 'Memorando a la gerencia para pedir dos computadores nuevos para el área de contabilidad',
    rasgos: [],
    tono: 'camus',
  },
  {
    pedido: 'Instructivo para que los empleados nuevos pidan vacaciones en la plataforma de recursos humanos',
    rasgos: ['metodoPersonal'],
    tono: 'adria-sola',
  },
  {
    pedido: 'Hilo para redes sobre la reforma pensional aprobada ayer y lo que cambia para los trabajadores',
    rasgos: ['actualidad', 'comunidadAfectada'],
    tono: 'fonseca',
  },
  {
    pedido: 'Reclamación a una aseguradora que se niega a cubrir el choque del carro del usuario',
    rasgos: ['relatoPropio'],
    tono: 'camus',
  },
  {
    pedido: 'Explicación para los vecinos del edificio de por qué subió la cuota de administración y en qué se gasta',
    rasgos: ['comunidadAfectada'],
    tono: 'schiavenato',
  },
  {
    pedido: 'Entrada del blog del colegio que les explica a los padres qué es la dislexia, a partir de un caso de clase',
    rasgos: ['divulgacion'],
    tono: 'fonda',
  },
  {
    pedido: 'Reseña de una película para la clase de cine, sobre la película entera y no sobre un personaje',
    rasgos: ['obraDeFiccion'],
    tono: 'camus',
  },
  {
    pedido: 'Texto para la cartelera del colegio que explica qué pasa con el plástico en el relleno sanitario y pide reciclar',
    rasgos: ['mueveAActuar', 'divulgacion'],
    tono: 'freddy',
  },
  {
    pedido: 'Guion de un video para explicarles a estudiantes de colegio cómo funciona el GPS',
    rasgos: ['mecanismo', 'divulgacion'],
    tono: 'dotcsv',
  },
  {
    pedido: 'Introducción del primer capítulo de una tesis de derecho sobre la prescripción de las deudas',
    rasgos: [],
    tono: 'camus',
  },
  {
    pedido: 'Explicación para la clase de programación de cómo funciona por dentro una tabla hash',
    rasgos: ['fundamentos', 'mecanismo'],
    tono: 'bettatech',
  },
  {
    pedido: 'Informe de un proyecto de aula que cruza una encuesta a los estudiantes con sus notas para explicar la deserción',
    rasgos: ['evidenciaCruzada'],
    tono: 'triangulacion',
  },
];

export const PEDIDOS: readonly Pedido[] = [...AUDITORIA, ...AMPLIACION];

/** Los rasgos de un pedido con la forma que recibe el enrutador. */
export function rasgosDe(p: Pedido): Rasgos {
  return Object.fromEntries(p.rasgos.map((r) => [r, true])) as Rasgos;
}

/** Cuántos pedidos le tocan a un tono, qué parte de la batería son y cuáles. */
export type Fila = { tono: string; cuenta: number; porcentaje: number; pedidos: string[] };

/**
 * El reparto de una batería entre los tonos, según lo que responde el enrutador.
 *
 * Cuenta lo que devuelve `sugerirTono` y no el tono anotado: si contara lo
 * anotado, los techos del gate vigilarían la batería y no la lista. Trae todos
 * los tonos de la lista, también los que no reciben ningún pedido, de más a
 * menos y, en los empates, en el orden de la lista.
 */
export function reparto(pedidos: readonly Pedido[] = PEDIDOS): Fila[] {
  const porTono = new Map<string, string[]>(RUTA_IDS.map((tono) => [tono, []]));
  for (const p of pedidos) porTono.get(sugerirTono(rasgosDe(p)).tono)?.push(p.pedido);
  const total = pedidos.length;
  return [...porTono]
    .map(([tono, lista]) => ({
      tono,
      cuenta: lista.length,
      porcentaje: total === 0 ? 0 : Math.round((lista.length / total) * 100),
      pedidos: lista,
    }))
    .sort((a, b) => b.cuenta - a.cuenta);
}
