// Con qué palabras se describe cada medición.
//
// EXISTE PORQUE LA REDACCIÓN ESTABA MAL Y NO SE PODÍA COMPROBAR. `scripts/medir.ts`
// elegía entre dos textos según el corpus tuviera transcripción o no, y la rama
// del «no» la escribió el primer corpus que cayó en ella, que eran fichas de
// libro. El texto decía «Palabras de las fichas» y «Estas fichas no tienen
// transcripción». Cuando después se midió un informe de investigación, que
// tampoco trae transcripción, heredó esas palabras y quedó descrito como fichas.
//
// Las cuatro casillas del contrato de evidencia estaban llenas, así que ningún
// gate se quejó, y dos de ellas describían otro material. Quien leyera el
// registro para comprobar la cifra quedaba mal informado sobre qué se contó.
//
// La corrección de fondo no es cambiar una palabra por otra: es que el texto
// **no nombre un material que el script no puede conocer**. El script sabe que el
// archivo no trae cabecera de transcripción; no sabe si es una ficha, un informe
// o una carta. Así que eso es lo que dice ahora.
//
// Y vive acá, en un módulo que leen los dos, porque el mismo texto lo escribe
// `scripts/medir.ts` al generar y lo comprueba `evals/mediciones.test.ts` al
// verificar. Escrito dos veces se habría separado a la primera corrección, que
// es la primera regla de CONTRIBUTING.md.

import type { Fuente } from './mediciones.ts';

/** Qué afirma cada medición y con qué regla se produjo. */
export type Redaccion = { afirmacion: string; regla: string };

/**
 * La redacción de una medición, derivada de qué mide y sobre qué texto.
 *
 * Devuelve `undefined` para un identificador que no conoce, y el gate trata eso
 * como fallo: una medición sin redacción derivable es una que alguien escribió a
 * mano, y volver a poder escribirlas a mano es exactamente lo que reabre esto.
 */
export function redaccionDe(medicion: string, fuente: Fuente): Redaccion | undefined {
  const deTranscripcion = fuente === 'cuerpo-de-transcripcion';
  switch (medicion) {
    case 'archivos':
      return {
        afirmacion: deTranscripcion
          ? 'Transcripciones que componen el corpus.'
          : 'Archivos que componen el corpus.',
        regla: 'Archivos del manifiesto cuyo nombre empieza por dos dígitos.',
      };
    case 'palabras':
      return {
        afirmacion: deTranscripcion
          ? 'Palabras del cuerpo de las transcripciones.'
          : 'Palabras del archivo completo.',
        regla: deTranscripcion
          ? 'Texto posterior a «## Transcripción», sin las marcas **[mm:ss]**, partido por espacio en blanco.'
          : 'Archivo entero partido por espacio en blanco. Estos archivos no traen cabecera de transcripción.',
      };
    case 'signos-terminales':
      return {
        afirmacion: 'Signos terminales del mismo texto.',
        // La rama del archivo completo decía «la transcripción» sobre textos que
        // por definición no la tienen, que era el mismo descuido en pequeño.
        regla: deTranscripcion
          ? 'Apariciones de «.», «?», «!» o «…». Mide si la transcripción trae puntuación, no si la trae bien.'
          : 'Apariciones de «.», «?», «!» o «…». Mide si el texto trae puntuación, no si la trae bien.',
      };
    case 'marcas-de-tiempo':
      return {
        afirmacion: 'Marcas de tiempo de las transcripciones.',
        regla: 'Apariciones de **[mm:ss]**. Una por línea de subtítulo.',
      };
    case 'segundos':
      return {
        afirmacion: 'Duración declarada del material.',
        regla:
          'Suma de «- Duration:» de cada cabecera, o del campo «duration» del manifest.json donde la cabecera no lo trae.',
      };
    default:
      return undefined;
  }
}
