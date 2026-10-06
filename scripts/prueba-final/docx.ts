// El texto de un docx, sin dependencias.
//
// Un docx es un zip con un XML adentro. El zip se abre leyendo su directorio
// central y descomprimiendo cada entrada con el `zlib` de Node, que trae deflate.
// El XML se recorre etiqueta por etiqueta, con una pila, porque lo que importa
// es dónde está cada texto: un párrafo del cuerpo, una celda de tabla o un cuadro
// de texto dentro de un dibujo.
//
// Esa distinción es la razón de que esto no sea una expresión regular sobre
// `<w:t>`. En el documento de la prueba, el diagrama del apartado 2 está hecho de
// tablas, y Word guarda cada cuadro de texto dos veces, en la versión moderna y
// en la de respaldo. Juntar todos los `<w:t>` metía el diagrama en el texto, y
// lo que estuviera en un cuadro, repetido.

import { inflateRawSync } from 'node:zlib';
import { countWords } from '../../src/text.ts';

export type EntradaZip = {
  nombre: string;
  /** 0 es guardada sin comprimir y 8 es deflate. Son los dos que trae un docx. */
  metodo: number;
  comprimido: number;
  tamano: number;
  desplazamiento: number;
};

const FIRMA_CIERRE = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;
const LARGO_CIERRE = 22;

const vista = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Las entradas del zip, leídas del directorio central. */
export function entradasDelZip(bytes: Uint8Array): EntradaZip[] {
  const v = vista(bytes);
  // El cierre va al final, seguido de un comentario de hasta 65.535 bytes.
  const minimo = Math.max(0, bytes.length - LARGO_CIERRE - 0xffff);
  let cierre = -1;
  for (let i = bytes.length - LARGO_CIERRE; i >= minimo; i--) {
    if (v.getUint32(i, true) === FIRMA_CIERRE) {
      cierre = i;
      break;
    }
  }
  if (cierre < 0) throw new Error('no es un zip: no tiene el cierre del directorio central');
  const total = v.getUint16(cierre + 10, true);
  let pos = v.getUint32(cierre + 16, true);
  if (total === 0xffff || pos === 0xffffffff) throw new Error('es un zip64, y este lector no los abre');

  const out: EntradaZip[] = [];
  for (let n = 0; n < total; n++) {
    if (pos + 46 > bytes.length || v.getUint32(pos, true) !== FIRMA_CENTRAL) {
      throw new Error(`zip dañado: la entrada ${n + 1} del directorio central no está donde dice`);
    }
    const largoNombre = v.getUint16(pos + 28, true);
    const largoExtra = v.getUint16(pos + 30, true);
    const largoComentario = v.getUint16(pos + 32, true);
    out.push({
      nombre: new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + largoNombre)),
      metodo: v.getUint16(pos + 10, true),
      comprimido: v.getUint32(pos + 20, true),
      tamano: v.getUint32(pos + 24, true),
      desplazamiento: v.getUint32(pos + 42, true),
    });
    pos += 46 + largoNombre + largoExtra + largoComentario;
  }
  return out;
}

/** Los bytes de una entrada, descomprimidos. */
export function extraerDelZip(bytes: Uint8Array, nombre: string): Uint8Array {
  const entrada = entradasDelZip(bytes).find((e) => e.nombre === nombre);
  if (entrada === undefined) throw new Error(`el zip no tiene la entrada ${nombre}`);
  const v = vista(bytes);
  const local = entrada.desplazamiento;
  if (v.getUint32(local, true) !== FIRMA_LOCAL) throw new Error(`zip dañado: la cabecera de ${nombre} no está`);
  // El nombre y el campo extra de la cabecera local pueden medir distinto que
  // los del directorio central, así que se leen de acá.
  const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
  const datos = bytes.subarray(inicio, inicio + entrada.comprimido);
  if (entrada.metodo === 0) return Uint8Array.from(datos);
  if (entrada.metodo === 8) return new Uint8Array(inflateRawSync(datos));
  throw new Error(`${nombre} usa el método de compresión ${entrada.metodo}, que este lector no abre`);
}

export type Parrafo = {
  texto: string;
  /** 0 es un párrafo del cuerpo; 1, 2 y siguientes, un título de ese nivel. */
  nivel: number;
  estilo: string | null;
  /** Viene de una celda de tabla. En el documento de la prueba, eso es el diagrama. */
  enTabla: boolean;
};

/**
 * Cuántas palabras puede tener un rótulo en negrita para contar como título.
 *
 * El «Resumen» del documento real no tiene estilo de título: es un párrafo
 * normal, entero en negrita. Sin esta regla no se lo podía encontrar como
 * título, y elegirlo solo por el texto lo confundiría con cualquier párrafo que
 * dijera esa palabra. Ocho alcanza para un título de apartado y deja fuera el
 * título del documento, que también va en negrita y pasa de quince.
 */
export const PALABRAS_DE_ROTULO = 8;

/** Lo que guarda un dibujo: su texto no es del cuerpo, y Word lo guarda dos veces. */
const DIBUJO = new Set(['w:drawing', 'w:pict', 'w:object', 'mc:AlternateContent', 'w:txbxContent', 'v:textbox']);

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function desescaparXml(s: string): string {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(\w+));/giu, (todo, hex?: string, dec?: string, nombre?: string) => {
    if (hex !== undefined) return String.fromCodePoint(Number.parseInt(hex, 16));
    if (dec !== undefined) return String.fromCodePoint(Number.parseInt(dec, 10));
    return ENTIDADES[nombre ?? ''] ?? todo;
  });
}

const atributo = (atributos: string, nombre: string): string | null => {
  const m = new RegExp(`\\s${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'u').exec(atributos);
  return m ? (m[1] ?? m[2] ?? '') : null;
};

/** El nivel que declara un estilo por su identificador: `Heading2`, `Ttulo11`, `Título1`. */
function nivelDeEstilo(estilo: string | null): number | null {
  const m = /^(?:heading|t[ií]?tulo)\s*(\d)/iu.exec(estilo ?? '');
  return m ? Number(m[1]) : null;
}

type Trozo = { texto: string; negrita: boolean };

type EnCurso = {
  trozos: Trozo[];
  estilo: string | null;
  esquema: number | null;
  enTabla: boolean;
};

function cerrar(p: EnCurso): Parrafo | null {
  const texto = p.trozos.map((t) => t.texto).join('').trim();
  if (texto === '') return null;
  let nivel = nivelDeEstilo(p.estilo);
  if (nivel === null && p.esquema !== null && p.esquema < 9) nivel = p.esquema + 1;
  if (nivel === null) {
    const conTexto = p.trozos.filter((t) => t.texto.trim() !== '');
    const rotulo =
      conTexto.every((t) => t.negrita) && countWords(texto) <= PALABRAS_DE_ROTULO && !/[.:;,]$/u.test(texto);
    nivel = rotulo ? 1 : 0;
  }
  return { texto, nivel, estilo: p.estilo, enTabla: p.enTabla };
}

/**
 * Los párrafos del cuerpo, en orden.
 *
 * Un párrafo es un `<w:p>` que no está dentro de otro ni dentro de un dibujo.
 * Los de una tabla salen marcados con `enTabla`, para que quien los use decida;
 * los de un cuadro de texto no salen. Los vacíos tampoco.
 */
export function parrafosDelXml(xml: string): Parrafo[] {
  const desde = xml.indexOf('<w:body');
  const cuerpo = desde >= 0 ? xml.slice(desde) : xml;
  const out: Parrafo[] = [];
  const pila: string[] = [];
  let actual: EnCurso | null = null;
  let profundidadDelParrafo = -1;
  let dibujos = 0;
  let negrita = false;
  let enTexto = false;

  const re = /<(\/?)([^\s/>!?]+)([^>]*?)(\/?)>|([^<]+)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo)) !== null) {
    const [, cierra, nombre, atributos = '', solo, texto] = m;
    if (texto !== undefined) {
      if (enTexto && actual !== null && dibujos === 0) actual.trozos.push({ texto: desescaparXml(texto), negrita });
      continue;
    }
    if (nombre === undefined) continue;

    if (cierra === '/') {
      const i = pila.lastIndexOf(nombre);
      if (i < 0) continue;
      for (const quitado of pila.splice(i)) if (DIBUJO.has(quitado)) dibujos--;
      if (nombre === 'w:t') enTexto = false;
      if (nombre === 'w:p' && actual !== null && pila.length === profundidadDelParrafo) {
        const p = cerrar(actual);
        if (p !== null) out.push(p);
        actual = null;
      }
      continue;
    }

    const dentroDeUnRun = pila.at(-1) === 'w:r';
    if (actual !== null && dibujos === 0) {
      if (nombre === 'w:pStyle' && pila.includes('w:pPr')) actual.estilo = atributo(atributos, 'w:val');
      if (nombre === 'w:outlineLvl' && pila.includes('w:pPr')) actual.esquema = Number(atributo(atributos, 'w:val'));
      if (nombre === 'w:b' && pila.at(-1) === 'w:rPr' && pila.at(-2) === 'w:r') {
        negrita = !['0', 'false', 'off'].includes(atributo(atributos, 'w:val') ?? '');
      }
      if (dentroDeUnRun && nombre === 'w:tab') actual.trozos.push({ texto: ' ', negrita });
      if (dentroDeUnRun && nombre === 'w:noBreakHyphen') actual.trozos.push({ texto: '-', negrita });
      if (dentroDeUnRun && (nombre === 'w:br' || nombre === 'w:cr')) {
        // Un salto de página o de columna no separa nada dentro del párrafo.
        const tipo = atributo(atributos, 'w:type');
        if (tipo === null || tipo === 'textWrapping') actual.trozos.push({ texto: '\n', negrita });
      }
    }
    if (solo === '/') continue;

    if (nombre === 'w:p' && actual === null && dibujos === 0 && !pila.includes('w:p')) {
      actual = { trozos: [], estilo: null, esquema: null, enTabla: pila.includes('w:tbl') };
      profundidadDelParrafo = pila.length;
    }
    if (nombre === 'w:r') negrita = false;
    if (nombre === 'w:t') enTexto = true;
    if (DIBUJO.has(nombre)) dibujos++;
    pila.push(nombre);
  }
  return out;
}

/** Los párrafos de un docx: abre el zip y recorre `word/document.xml`. */
export function parrafosDelDocx(bytes: Uint8Array): Parrafo[] {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(extraerDelZip(bytes, 'word/document.xml'));
  return parrafosDelXml(xml);
}
