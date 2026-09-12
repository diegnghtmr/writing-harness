// El verificador daba por limpio un texto que no había podido leer.
//
// En Windows PowerShell 5.1, `node -e "console.log('acción')" > f.txt` escribe
// UTF-16LE con marca de orden de bytes (FF FE), y con los acentos ya rotos.
// `node src/cli.ts f.txt` lo leía como UTF-8, medía algo que no era el texto
// escrito y respondía «sin hallazgos» con salida 0. Un archivo en Windows-1252
// terminaba igual: cada acento se volvía U+FFFD y la medición seguía como si
// nada. Medir lo que no se pudo leer es peor que no medir, porque desde fuera
// se ve igual que un texto que pasó.
//
// Por eso el verificador mira los bytes antes de medir y se niega con salida 2,
// que ya era la de «no se pudo usar la entrada»: la del archivo inexistente y
// la de la opción mal escrita. El 1 sigue queriendo decir «el texto tiene
// errores».
//
// Lo que no se puede detectar queda fuera. La tubería de PowerShell 5.1 cambia
// cada acento por un `?` antes de que node vea nada, y un `?` es UTF-8 válido.
// Eso lo resuelve AGENTS.md, en «4. Verificar», pidiendo el texto como archivo.
//
// Los archivos se escriben byte a byte en un directorio temporal fuera del
// repositorio: el defecto vive en los bytes, y cualquier normalización de git o
// de un editor lo borraría.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts');

/** Sin hallazgos en la capa base, y con acentos para que la codificación importe. */
const LIMPIO = 'La acción terminó temprano y el equipo volvió a casa.\n';

/** El mismo texto con una raya, que la capa base rechaza con severidad error. */
const CON_ERROR = 'La acción terminó temprano — y el equipo volvió a casa.\n';

const BOM_UTF16LE = Buffer.from([0xff, 0xfe]);
const BOM_UTF16BE = Buffer.from([0xfe, 0xff]);

const utf8 = (t: string) => Buffer.from(t, 'utf8');
const utf16le = (t: string) => Buffer.from(t, 'utf16le');
const utf16be = (t: string) => Buffer.from(t, 'utf16le').swap16();

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'codificacion-'));
});

after(() => {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function archivo(nombre: string, bytes: Buffer): string {
  const ruta = join(dir, nombre);
  writeFileSync(ruta, bytes);
  return ruta;
}

function corre(args: string[], entrada: Buffer = Buffer.alloc(0)) {
  const r = spawnSync(process.execPath, [CLI, ...args], { input: entrada, encoding: 'utf8' });
  return { codigo: r.status, salida: r.stdout, errores: r.stderr };
}

/** Lo que tiene que pasar siempre que se rechaza una entrada. */
function rechazada(r: ReturnType<typeof corre>, entrada: string, causa: RegExp): void {
  assert.equal(r.codigo, 2, `salió con ${r.codigo}; stdout: ${r.salida}`);
  assert.equal(r.salida, '', 'no se midió nada, así que no puede haber veredicto');
  assert.ok(r.errores.includes(entrada), `el mensaje no nombra ${entrada}: ${r.errores}`);
  assert.match(r.errores, causa);
  assert.match(r.errores, /guardar[^\n]*UTF-8/u, 'el mensaje no dice qué hacer');
}

describe('el texto en UTF-8 se sigue midiendo como antes', () => {
  test('sin hallazgos cuando no los tiene', () => {
    const ruta = archivo('limpio.txt', utf8(LIMPIO));
    const r = corre([ruta]);
    assert.equal(r.codigo, 0, r.errores);
    assert.equal(r.salida.trim(), `${ruta}: sin hallazgos`);
  });

  test('con sus errores cuando los tiene', () => {
    const r = corre([archivo('con-error.txt', utf8(CON_ERROR))]);
    assert.equal(r.codigo, 1, r.errores);
    assert.match(r.salida, /:1:\d+ {2}error {2}no-raya/u);
  });
});

describe('la marca de UTF-8 no cuenta como texto', () => {
  // PowerShell 5.1 la escribe con `-Encoding utf8`, y el archivo es UTF-8
  // válido. Antes salía un error de carácter invisible en 1:1, que es un
  // hallazgo sobre algo que no forma parte del texto.
  const BOM_UTF8 = Buffer.from([0xef, 0xbb, 0xbf]);

  test('un texto limpio sigue limpio', () => {
    const ruta = archivo('marca-limpio.txt', Buffer.concat([BOM_UTF8, utf8(LIMPIO)]));
    const r = corre([ruta]);
    assert.equal(r.codigo, 0, r.salida);
    assert.equal(r.salida.trim(), `${ruta}: sin hallazgos`);
  });

  test('los hallazgos caen en la misma línea y columna que sin la marca', () => {
    const sin = archivo('sin-marca.txt', utf8(CON_ERROR));
    const con = archivo('con-marca.txt', Buffer.concat([BOM_UTF8, utf8(CON_ERROR)]));
    const a = corre([sin]);
    const b = corre([con]);
    assert.equal(b.codigo, a.codigo);
    assert.equal(b.salida.replaceAll(con, '<archivo>'), a.salida.replaceAll(sin, '<archivo>'));
  });
});

describe('lo que no es UTF-8 no se mide', () => {
  test('UTF-16LE con marca de orden de bytes', () => {
    const ruta = archivo('utf16le.txt', Buffer.concat([BOM_UTF16LE, utf16le(LIMPIO)]));
    rechazada(corre([ruta]), ruta, /UTF-16/u);
  });

  test('UTF-16BE con marca de orden de bytes', () => {
    const ruta = archivo('utf16be.txt', Buffer.concat([BOM_UTF16BE, utf16be(LIMPIO)]));
    rechazada(corre([ruta]), ruta, /UTF-16/u);
  });

  test('UTF-16 sin marca, que se delata por los bytes nulos', () => {
    const ruta = archivo('utf16-sin-marca.txt', utf16le(LIMPIO));
    rechazada(corre([ruta]), ruta, /bytes nulos/u);
  });

  test('Windows-1252, que no es UTF-8 válido', () => {
    // La «ó» es el byte F3, que en UTF-8 abre una secuencia de cuatro bytes, y
    // la «n» que sigue no la continúa. Leído como UTF-8, queda U+FFFD.
    const ruta = archivo('windows-1252.txt', Buffer.from(LIMPIO, 'latin1'));
    rechazada(corre([ruta]), ruta, /no son UTF-8/u);
  });
});

describe('la entrada estándar pasa por el mismo control', () => {
  test('UTF-16 por la entrada estándar no se mide', () => {
    const r = corre([], Buffer.concat([BOM_UTF16LE, utf16le(LIMPIO)]));
    rechazada(r, '(entrada estándar)', /UTF-16/u);
  });

  test('UTF-8 por la entrada estándar se sigue midiendo', () => {
    const r = corre([], utf8(LIMPIO));
    assert.equal(r.codigo, 0, r.errores);
    assert.equal(r.salida.trim(), '(entrada estándar): sin hallazgos');
  });
});

describe('con varios archivos, uno ilegible no deja un veredicto limpio', () => {
  // Se decide igual que con un archivo que no existe: no se mide ninguno. Medir
  // los legibles y salir con 2 dejaría en pantalla un «sin hallazgos» al lado de
  // un texto que nadie leyó, y un 2 que ya no diría si los medidos tenían errores.
  test('nombra cada archivo rechazado con su motivo, y no mide ninguno', () => {
    const bueno = archivo('varios-bueno.txt', utf8(LIMPIO));
    const utf16 = archivo('varios-utf16.txt', Buffer.concat([BOM_UTF16LE, utf16le(LIMPIO)]));
    const cp1252 = archivo('varios-1252.txt', Buffer.from(LIMPIO, 'latin1'));
    const r = corre([bueno, utf16, cp1252]);
    rechazada(r, utf16, /UTF-16/u);
    assert.ok(r.errores.includes(cp1252), `el mensaje no nombra ${cp1252}: ${r.errores}`);
    assert.match(r.errores, /no son UTF-8/u);
    assert.ok(!r.errores.includes(bueno), 'el archivo legible no tiene nada que rechazar');
  });
});
