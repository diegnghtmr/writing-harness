// Un docx mínimo, construido en memoria para las pruebas de la extracción.
//
// El documento real de la prueba final no vive en este repositorio: es de una
// persona y no se publica. Las pruebas necesitan uno con la misma forma, y
// guardarlo como binario dejaría sin revisar lo que importa, que es qué hay
// dentro. Acá se arma desde el XML, así que lo que la prueba lee está escrito
// a la vista: los títulos con su estilo, el rótulo en negrita, la tabla del
// diagrama y el cuadro de texto que no tiene que salir.
//
// El zip lleva una entrada guardada sin comprimir y otra comprimida con
// deflate, que son los dos métodos que el lector tiene que saber abrir.

import { crc32, deflateRawSync } from 'node:zlib';

export type EntradaDeZip = { nombre: string; datos: Uint8Array; comprimir: boolean };

const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** Un zip con sus cabeceras locales, el directorio central y el cierre. */
export function construirZip(entradas: readonly EntradaDeZip[]): Uint8Array {
  const partes: number[] = [];
  const central: number[] = [];
  for (const e of entradas) {
    const nombre = [...new TextEncoder().encode(e.nombre)];
    const datos = e.comprimir ? deflateRawSync(e.datos) : e.datos;
    const metodo = e.comprimir ? 8 : 0;
    const crc = crc32(e.datos);
    const desplazamiento = partes.length;
    partes.push(
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(metodo), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(datos.length), ...u32(e.datos.length), ...u16(nombre.length), ...u16(0),
      ...nombre, ...datos,
    );
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(metodo), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(datos.length), ...u32(e.datos.length), ...u16(nombre.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(desplazamiento), ...nombre,
    );
  }
  const inicioCentral = partes.length;
  return Uint8Array.from([
    ...partes,
    ...central,
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entradas.length), ...u16(entradas.length),
    ...u32(central.length), ...u32(inicioCentral), ...u16(0),
  ]);
}

const texto = (s: string) => new TextEncoder().encode(s);

/** Un docx con el cuerpo dado: los tipos de contenido guardados y el documento comprimido. */
export function construirDocx(cuerpo: string): Uint8Array {
  const documento =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
    `<w:body>${cuerpo}<w:sectPr/></w:body></w:document>`;
  return construirZip([
    { nombre: '[Content_Types].xml', datos: texto('<Types/>'), comprimir: false },
    { nombre: 'word/document.xml', datos: texto(documento), comprimir: true },
  ]);
}

type Opciones = { estilo?: string; negrita?: boolean };

/** Un párrafo con un run por cada trozo de texto. */
export function p(trozos: string | readonly string[], o: Opciones = {}): string {
  const estilo = o.estilo ? `<w:pPr><w:pStyle w:val="${o.estilo}"/></w:pPr>` : '';
  const negrita = o.negrita ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : '';
  const runs = (typeof trozos === 'string' ? [trozos] : trozos)
    .map((t) => `<w:r>${negrita}<w:t xml:space="preserve">${t}</w:t></w:r>`)
    .join('');
  return `<w:p>${estilo}${runs}</w:p>`;
}

/** Una tabla de una fila, como las que arman el diagrama del documento real. */
export function tabla(...celdas: string[]): string {
  const tcs = celdas.map((c) => `<w:tc>${p(c)}</w:tc>`).join('');
  return `<w:tbl><w:tblPr/><w:tr>${tcs}</w:tr></w:tbl>`;
}

/** Un párrafo que solo lleva un dibujo con un cuadro de texto, en sus dos versiones. */
export function dibujo(textoDelCuadro: string): string {
  const cuadro = `<w:txbxContent>${p(textoDelCuadro)}</w:txbxContent>`;
  return (
    '<w:p><w:r><mc:AlternateContent>' +
    `<mc:Choice Requires="wps"><w:drawing><wps:txbx>${cuadro}</wps:txbx></w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict>${cuadro}</w:pict></mc:Fallback>` +
    '</mc:AlternateContent></w:r></w:p>'
  );
}

/**
 * Un documento con la forma del real, en miniatura.
 *
 * Título largo en negrita, «Resumen» como rótulo en negrita con estilo de
 * párrafo, el resumen y sus palabras clave, el «Abstract» con sus «Keywords»,
 * la introducción con un subtítulo dentro, el apartado 2 con el diagrama hecho
 * de tablas y un cuadro de texto, y una sección final.
 */
export const CUERPO = [
  p('Voces que habitan la escuela: un estado del arte sobre narrativas de estudiantes en la escuela secundaria', {
    negrita: true,
  }),
  p(''),
  p('Resumen', { estilo: 'Prrafo', negrita: true }),
  p(['Revisamos cincuenta y ocho artículos ', 'publicados entre 2020 y 2025 en Scopus.'], { estilo: 'Prrafo' }),
  // Rótulo en negrita y el resto no: el párrafo no es un título.
  '<w:p><w:pPr><w:pStyle w:val="Prrafo"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Palabras clave:</w:t></w:r>' +
    '<w:r><w:t xml:space="preserve"> Narrativa; Escuela.</w:t></w:r></w:p>',
  p('Abstract', { estilo: 'Prrafo', negrita: true }),
  p('We reviewed fifty-eight articles.', { estilo: 'Prrafo' }),
  p('Keywords: Narrative; School.', { estilo: 'Prrafo' }),
  p('1. Introducción', { estilo: 'Ttulo11' }),
  p('Ricoeur (1996) la llamó identidad narrativa &amp; algo más.', { estilo: 'Prrafo' }),
  p('1.1. Un subtítulo', { estilo: 'Ttulo21' }),
  p('Bolívar (2014) puso la narrativa en el centro.', { estilo: 'Prrafo' }),
  p('2. Procedimiento de revisión', { estilo: 'Ttulo11' }),
  p('Buscamos durante 2025 en cuatro bases.', { estilo: 'Prrafo' }),
  tabla('Carácter autoorganizado', 'Del caos al orden'),
  dibujo('Texto del cuadro'),
  p('3. Conclusiones', { estilo: 'Ttulo11' }),
  p('Cerramos.', { estilo: 'Prrafo' }),
].join('');
