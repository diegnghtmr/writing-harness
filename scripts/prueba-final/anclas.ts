// Los datos del original que tienen que seguir en el texto del agente.
//
// Un agente que reescribe puede cambiar todo menos los hechos. Las anclas son
// los hechos que se pueden reconocer sin entender el texto: las cifras, los años,
// las citas de autor y los nombres propios. Se sacan del texto de entrada, y la
// comprobación busca cada una en la salida.
//
// Los números escritos con letra se convierten a cifras, en la entrada y en la
// salida. Es la decisión que pide el cambio de registro: un tono puede pasar
// «cincuenta y ocho» a «58», o al revés, y el dato es el mismo. Excluirlos
// dejaba sin vigilar justo las cifras del documento de la prueba, que van con
// letra. Por debajo de diez no son ancla: en español van con letra como
// cualquier palabra, y «dos decisiones» se reescribe como «ambas» sin perder
// nada.

/** Sin mayúsculas y sin tildes, para comparar «Quindío» con «quindio». */
export function normalizar(s: string): string {
  // NFC primero: así cada letra con tilde mide lo mismo antes y después, y las
  // posiciones en el texto normalizado sirven en el original.
  return s.normalize('NFC').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Desde qué valor un número con letra es ancla.
 *
 * Diez es donde la norma deja de pedir la letra para las cantidades bajas. Lo
 * que está por debajo es léxico corriente y se reformula; lo que está por encima
 * es un recuento que el texto informa.
 */
export const UMBRAL_NUMERO_EN_LETRAS = 10;

/**
 * Cuántos caracteres puede haber entre el autor y el año de una cita.
 *
 * Una cita narrativa, «Ricoeur (1996)», puede volver como parentética,
 * «(Ricoeur, 1996)», y una de dos autores mete el segundo en el medio. Sesenta
 * caracteres alcanzan para «Clandinin y Connelly (2000)» con holgura, y no
 * alcanzan para que un año suelto de la oración siguiente cuente como cita.
 */
export const VENTANA_DE_CITA = 60;

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};
const ESPECIALES: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29,
};
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
  seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

type Tipo = 'centena' | 'decena' | 'unidad' | 'mil';

const tipoDe = (p: string): Tipo | null => {
  if (p in CENTENAS) return 'centena';
  if (p in DECENAS) return 'decena';
  if (p in ESPECIALES || p in UNIDADES) return 'unidad';
  if (p === 'mil') return 'mil';
  return null;
};

const valorDe = (p: string): number => CENTENAS[p] ?? DECENAS[p] ?? ESPECIALES[p] ?? UNIDADES[p] ?? 0;

/** Qué puede seguir a cada tipo dentro de un mismo número. */
const SIGUE: Record<Tipo, readonly Tipo[]> = {
  centena: ['decena', 'unidad', 'mil'],
  decena: ['mil'],
  unidad: ['mil'],
  mil: ['centena', 'decena', 'unidad'],
};

export type NumeroEnLetras = { valor: number; inicio: number; fin: number };

/**
 * Los números escritos con letra, con su posición en el texto normalizado.
 *
 * «un», «uno» y «una» solos no cuentan: casi siempre son el artículo. Dentro de
 * un número sí, como en «treinta y uno».
 */
export function numerosEnLetras(texto: string): NumeroEnLetras[] {
  const norma = normalizar(texto);
  const palabras = [...norma.matchAll(/\p{L}+/gu)].map((m) => ({ p: m[0], i: m.index, f: m.index + m[0].length }));
  const juntas = (a: number, b: number) => /^\s+$/u.test(norma.slice(a, b));
  const out: NumeroEnLetras[] = [];
  let k = 0;
  while (k < palabras.length) {
    const primera = palabras[k] as { p: string; i: number; f: number };
    const inicial = tipoDe(primera.p);
    if (inicial === null) {
      k++;
      continue;
    }
    let tipo: Tipo = inicial;
    let total = inicial === 'mil' ? 1000 : 0;
    let grupo = inicial === 'mil' ? 0 : valorDe(primera.p);
    let fin = primera.f;
    let usadas = 1;
    let j = k + 1;
    while (j < palabras.length) {
      const w = palabras[j] as { p: string; i: number; f: number };
      if (!juntas(fin, w.i)) break;
      // «cuarenta y tres»: la «y» solo une una decena con una unidad.
      const siguiente = palabras[j + 1];
      if (w.p === 'y' && tipo === 'decena' && siguiente && siguiente.p in UNIDADES && juntas(w.f, siguiente.i)) {
        grupo += valorDe(siguiente.p);
        fin = siguiente.f;
        tipo = 'unidad';
        usadas += 2;
        j += 2;
        continue;
      }
      const t = tipoDe(w.p);
      if (t === null || !SIGUE[tipo].includes(t)) break;
      if (t === 'mil') {
        total += (grupo || 1) * 1000;
        grupo = 0;
      } else {
        grupo += valorDe(w.p);
      }
      tipo = t;
      fin = w.f;
      usadas++;
      j++;
    }
    const articulo = usadas === 1 && (primera.p === 'un' || primera.p === 'uno' || primera.p === 'una');
    if (!articulo) out.push({ valor: total + grupo, inicio: primera.i, fin });
    k = j;
  }
  return out;
}

/** Un número escrito con cifras, sin separador de miles: «5.379» es «5379». */
const CIFRA = /\d+(?:[.  ]\d{3})*(?:,\d+)?/gu;
const canonica = (s: string) => s.replace(/[.  ](?=\d{3}(?:\D|$))/gu, '');

/** Todos los números del texto, con cifras o con letra, como cadenas canónicas. */
export function numerosDe(texto: string): Set<string> {
  const out = new Set<string>();
  for (const m of texto.matchAll(CIFRA)) out.add(canonica(m[0]));
  for (const n of numerosEnLetras(texto)) out.add(String(n.valor));
  return out;
}

export type Cita = { autor: string; anio: string };

/** Las décadas van aparte de las cifras: «años noventa» y «década de 1990» son el mismo dato, y ninguno es la cantidad 90 ni el año 1990. */
export type Anclas = { numeros: string[]; citas: Cita[]; decadas: string[]; nombres: string[] };

const DECADA_EN_LETRAS: Record<string, number> = {
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

/**
 * Las formas de nombrar una década, sobre el texto normalizado. El grupo 1 es
 * la década con letra; el 2, con cifras, de dos o de cuatro.
 *
 * En la corrida completa, Copilot pasó «los años noventa» a «la década de
 * 1990». Sin esto, la salida perdía una década y ganaba un año.
 */
const DECADA = new RegExp(
  [
    `\\b(?:anos|decada\\s+de(?:\\s+los)?)\\s+(?:(${Object.keys(DECADA_EN_LETRAS).join('|')})|((?:19|20)?\\d0))\\b`,
    `\\b((?:19|20)\\d0)s\\b`,
  ].join('|'),
  'gu',
);

/** Una década de un texto: su año canónico y dónde está, para no contarla también como cifra. */
type Decada = { decada: string; inicio: number; fin: number };

function decadasConPosicion(texto: string): Decada[] {
  const norma = normalizar(texto);
  const out: Decada[] = [];
  for (const m of norma.matchAll(DECADA)) {
    const letra = m[1];
    const cifra = m[2] ?? m[3];
    let anio: number;
    if (letra !== undefined) anio = 1900 + (DECADA_EN_LETRAS[letra] as number);
    else if ((cifra as string).length === 2) anio = 1900 + Number(cifra);
    else anio = Number(cifra);
    out.push({ decada: String(anio), inicio: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/** Las décadas de un texto, cada una una vez, como el año con que empiezan: «1990». */
export function decadasDe(texto: string): string[] {
  return [...new Set(decadasConPosicion(texto).map((d) => d.decada))];
}

const AUTOR = String.raw`(\p{Lu}[\p{L}'’-]+)(?:\s+(?:y|e|&)\s+\p{Lu}[\p{L}'’-]+|\s+et\s+al\.)?`;
const NARRATIVA = new RegExp(String.raw`${AUTOR}\s*\((\d{4})[a-z]?\)`, 'gu');
const PARENTETICA = new RegExp(String.raw`(?<=[(;]\s*)${AUTOR},\s*(\d{4})[a-z]?`, 'gu');

/** Si una palabra abre oración: después de un punto, de dos puntos o al principio de una línea. */
function abreOracion(texto: string, indice: number): boolean {
  const antes = texto.slice(0, indice);
  if (/(?:^|\n)[\s«“"'(¿¡[]*$/u.test(antes)) return true;
  const sinApertura = antes.replace(/[\s«“"'(¿¡[]*$/u, '');
  return /[.?!…:;]$/u.test(sinApertura);
}

export function anclasDe(original: string): Anclas {
  const texto = original.normalize('NFC');
  const decadas = decadasConPosicion(texto);
  // Lo que es parte de una década no es una cifra: «1990» en «la década de 1990».
  const enDecada = (i: number) => decadas.some((d) => i >= d.inicio && i < d.fin);
  const numeros: { valor: string; en: number }[] = [];
  for (const m of texto.matchAll(CIFRA)) {
    // La numeración de un título o de una lista, «1. » o «2.1. » al principio
    // de la línea, es estructura y no dato.
    const numeracion =
      /(?:^|\n)[ \t]*(?:\d+\.)*$/u.test(texto.slice(0, m.index)) &&
      /^(?:\.\d+)*[.)]\s/u.test(texto.slice(m.index + m[0].length));
    if (!numeracion && !enDecada(m.index)) numeros.push({ valor: canonica(m[0]), en: m.index });
  }
  for (const n of numerosEnLetras(texto)) {
    // «los años noventa» es una década, no una cantidad.
    if (n.valor >= UMBRAL_NUMERO_EN_LETRAS && !enDecada(n.inicio)) numeros.push({ valor: String(n.valor), en: n.inicio });
  }

  const citas: { cita: Cita; en: number }[] = [];
  for (const patron of [NARRATIVA, PARENTETICA]) {
    for (const m of texto.matchAll(patron)) citas.push({ cita: { autor: m[1] as string, anio: m[2] as string }, en: m.index });
  }

  const nombres: string[] = [];
  for (const m of texto.matchAll(/\p{L}[\p{L}\p{M}'’-]*/gu)) {
    const w = m[0];
    if (w.length < 2 || !/^\p{Lu}/u.test(w) || abreOracion(texto, m.index)) continue;
    const n = normalizar(w);
    if (!nombres.includes(n)) nombres.push(n);
  }

  const unicos = <T>(xs: T[], clave: (x: T) => string) => xs.filter((x, i) => xs.findIndex((y) => clave(y) === clave(x)) === i);
  return {
    numeros: unicos(numeros.sort((a, b) => a.en - b.en), (x) => x.valor).map((x) => x.valor),
    citas: unicos(citas.sort((a, b) => a.en - b.en), (x) => `${x.cita.autor} ${x.cita.anio}`).map((x) => x.cita),
    decadas: [...new Set(decadas.map((d) => d.decada))],
    nombres,
  };
}

/** Las palabras de un texto normalizado, con guiones y apóstrofos internos. */
const palabrasDe = (texto: string) => new Set(normalizar(texto).match(/[\p{L}\d]+(?:['’-][\p{L}\d]+)*/gu) ?? []);

/** Las anclas que no aparecen en la salida. */
export function faltantes(anclas: Anclas, salida: string): Anclas {
  const numeros = numerosDe(salida);
  const norma = normalizar(salida);
  const palabras = palabrasDe(salida);
  const citaPresente = (c: Cita): boolean => {
    const autor = normalizar(c.autor);
    for (let i = norma.indexOf(autor); i >= 0; i = norma.indexOf(autor, i + 1)) {
      if (norma.slice(i, i + autor.length + VENTANA_DE_CITA).includes(c.anio)) return true;
    }
    return false;
  };
  const decadas = decadasDe(salida);
  return {
    numeros: anclas.numeros.filter((n) => !numeros.has(n)),
    citas: anclas.citas.filter((c) => !citaPresente(c)),
    decadas: anclas.decadas.filter((d) => !decadas.includes(d)),
    nombres: anclas.nombres.filter((n) => !palabras.has(n)),
  };
}
