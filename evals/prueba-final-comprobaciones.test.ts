// Las comprobaciones de cada corrida de la prueba final, una por una.
//
// Son funciones puras: reciben lo que dejó la corrida y devuelven pasa, aviso o
// falla con su motivo. Cada una se prueba en las dos direcciones, con un caso
// que tiene que pasar y otro que tiene que caer, porque una comprobación que
// solo se vio pasar puede estar pasando porque no mira.
//
// Los umbrales viven en el código, con su porqué al lado. Acá se prueba que el
// borde caiga donde dice el nombre, no el valor exacto: cambiar un umbral con
// su motivo escrito no tiene que obligar a reescribir el test.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { anclasDe, faltantes, numerosDe, numerosEnLetras } from '../scripts/prueba-final/anclas.ts';
import {
  RAZON_AVISO_MAX,
  RAZON_AVISO_MIN,
  RAZON_FALLA_MAX,
  RAZON_FALLA_MIN,
  SHINGLE_DE_REPETICION,
  agenteMidio,
  aislamiento,
  cambiosDeGit,
  conIdenticas,
  datosConservados,
  docxIntacto,
  estadoDe,
  extensionRazonable,
  repeticionMasLarga,
  repositoriosIntactos,
  respuestaCorrecta,
  salidaLegible,
  salidasIdenticas,
  skillsDeLaVariante,
  verificadorLimpio,
} from '../scripts/prueba-final/comprobaciones.ts';
import { llamada, vacia, type Transcripcion } from '../scripts/prueba-final/transcripcion.ts';
import { variantes } from '../scripts/prueba-final/variantes.ts';

const v = (id: string) => variantes().find((x) => x.id === id) ?? assert.fail(id);
const bytes = (s: string) => new TextEncoder().encode(s);
const conComandos = (...cs: string[]): Transcripcion => ({
  ...vacia(),
  llamadas: cs.map((c, i) => llamada('powershell', { command: c }, i)),
});
const palabras = (n: number, base = 'palabra') => Array.from({ length: n }, (_, i) => `${base}${i}`).join(' ');

describe('1. base.docx intacto', () => {
  test('la misma huella pasa; otra falla', () => {
    assert.equal(docxIntacto('abc', 'abc').estado, 'pasa');
    const c = docxIntacto('abc', 'abd');
    assert.equal(c.estado, 'falla');
    assert.equal(c.numero, 1);
  });
});

describe('2. salida.md legible', () => {
  test('un texto en UTF-8 pasa, con marca de orden de bytes o sin ella', () => {
    assert.equal(salidaLegible(bytes('Un texto.')).estado, 'pasa');
    assert.equal(salidaLegible(Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes('Con marca.')])).estado, 'pasa');
  });

  test('ausente, vacío, UTF-16 o bytes que no son UTF-8, falla', () => {
    assert.match(salidaLegible(null).motivo, /no existe/u);
    assert.equal(salidaLegible(bytes('  \n')).estado, 'falla');
    assert.match(salidaLegible(Uint8Array.from([0xff, 0xfe, 0x41, 0x00])).motivo, /UTF-16/u);
    assert.equal(salidaLegible(Uint8Array.from([0x41, 0x00, 0x42, 0x00])).estado, 'falla');
    assert.equal(salidaLegible(Uint8Array.from([0x61, 0xe9, 0x62])).estado, 'falla');
  });
});

describe('3. el verificador del ejecutor', () => {
  test('sin errores pasa, y las advertencias se informan sin fallar', () => {
    assert.equal(verificadorLimpio({ codigo: 0, salida: 'salida.md: sin hallazgos' }).estado, 'pasa');
    const c = verificadorLimpio({ codigo: 0, salida: 'x\n\n0 error(es), 3 advertencia(s)' });
    assert.equal(c.estado, 'pasa');
    assert.match(c.motivo, /3 advertencias/u);
  });

  test('con errores, o sin poder leer, falla', () => {
    const c = verificadorLimpio({ codigo: 1, salida: 'x\n\n2 error(es), 1 advertencia(s)' });
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /2 errores/u);
    assert.match(verificadorLimpio({ codigo: 2, salida: 'error: parece UTF-16' }).motivo, /no pudo leer/u);
    assert.equal(verificadorLimpio(null).estado, 'falla');
  });
});

describe('4. las skills de la variante', () => {
  const base = ['redactar-espanol', 'spanish-writing'];

  test('la base con la entrada y la base pasa; sin la base, falla', () => {
    assert.equal(skillsDeLaVariante(v('base'), base).estado, 'pasa');
    assert.match(skillsDeLaVariante(v('base'), ['redactar-espanol']).motivo, /spanish-writing/u);
  });

  test('en la base, cualquier tono es una falla', () => {
    const c = skillsDeLaVariante(v('base'), [...base, 'camus-writing']);
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /camus-writing/u);
  });

  test('un tono con su skill pasa; sin ella falla; con otro tono además, avisa', () => {
    assert.equal(skillsDeLaVariante(v('camus'), [...base, 'camus-writing']).estado, 'pasa');
    assert.equal(skillsDeLaVariante(v('camus'), base).estado, 'falla');
    const otro = skillsDeLaVariante(v('camus'), [...base, 'camus-writing', 'fonda-writing']);
    assert.equal(otro.estado, 'aviso');
    assert.match(otro.motivo, /fonda-writing/u);
  });

  test('humanizar con su skill pasa; con un tono además, avisa', () => {
    assert.equal(skillsDeLaVariante(v('humanizar'), [...base, 'humanizar-espanol']).estado, 'pasa');
    assert.equal(skillsDeLaVariante(v('humanizar'), [...base, 'humanizar-espanol', 'han-writing']).estado, 'aviso');
  });
});

describe('5. el agente midió', () => {
  test('sin ningún comando del verificador, falla', () => {
    assert.equal(agenteMidio(v('base'), vacia()).estado, 'falla');
    assert.equal(agenteMidio(v('base'), conComandos('node writing-harness/src/cli.ts --enrutar x')).estado, 'falla');
  });

  test('la base sin opciones pasa, con cualquier separador, y guarda el último código', () => {
    const c = agenteMidio(v('base'), conComandos('node writing-harness\\src\\cli.ts C:\\t\\salida.md'));
    assert.equal(c.estado, 'pasa');
    assert.deepEqual((c.detalle as { ultimoCodigo: number }).ultimoCodigo, 0);
  });

  test('el tono con su identificador, con el nombre de la skill o con -t', () => {
    for (const opcion of ['--tono camus', '--tono camus-writing', '-t "camus"']) {
      assert.equal(agenteMidio(v('camus'), conComandos(`node src/cli.ts s.md ${opcion}`)).estado, 'pasa', opcion);
    }
  });

  test('con las opciones de otra variante, avisa; decide la última medición', () => {
    assert.equal(agenteMidio(v('camus'), conComandos('node src/cli.ts s.md')).estado, 'aviso');
    assert.equal(agenteMidio(v('base'), conComandos('node src/cli.ts s.md --tono camus')).estado, 'aviso');
    assert.equal(
      agenteMidio(v('camus'), conComandos('node src/cli.ts s.md', 'node src/cli.ts s.md --tono camus; exit $LASTEXITCODE')).estado,
      'pasa',
    );
  });

  test('humanizar con la pasada y sin tono', () => {
    assert.equal(agenteMidio(v('humanizar'), conComandos('node src/cli.ts s.md --pasada humanizar-espanol')).estado, 'pasa');
    assert.equal(
      agenteMidio(v('humanizar'), conComandos('node src/cli.ts s.md --tono camus --pasada humanizar')).estado,
      'aviso',
    );
  });
});

describe('6. la respuesta', () => {
  const SALIDA = 'C:\\temp\\pf-1\\salida.md';
  const texto = `${palabras(40)}.`;

  test('la base dice que no hubo tono y dónde quedó', () => {
    const r = 'Quedó en `C:\\temp\\pf-1\\salida.md`. No se aplicó ningún tono: el modo es corregir.';
    assert.equal(respuestaCorrecta(v('base'), r, texto, SALIDA).estado, 'pasa');
    assert.equal(respuestaCorrecta(v('base'), 'Quedó en salida.md con el tono camus.', texto, SALIDA).estado, 'falla');
  });

  test('un tono se nombra por su identificador o por su skill', () => {
    assert.equal(respuestaCorrecta(v('camus'), 'En salida.md, con camus-writing.', texto, SALIDA).estado, 'pasa');
    assert.equal(respuestaCorrecta(v('adria-sola'), 'En salida.md, tono Adrià Solà.', texto, SALIDA).estado, 'pasa');
    assert.equal(respuestaCorrecta(v('camus'), 'En salida.md, con fonda.', texto, SALIDA).estado, 'falla');
  });

  test('humanizar se nombra', () => {
    assert.equal(respuestaCorrecta(v('humanizar'), 'Lo humanicé; está en salida.md.', texto, SALIDA).estado, 'pasa');
  });

  test('sin decir dónde quedó, o sin respuesta, falla', () => {
    assert.match(respuestaCorrecta(v('camus'), 'Listo, tono camus.', texto, SALIDA).motivo, /dónde/u);
    assert.equal(respuestaCorrecta(v('camus'), null, texto, SALIDA).estado, 'falla');
  });

  test('repetir el texto falla; citar un trozo corto no', () => {
    const pegado = `En salida.md, tono camus. ${palabras(SHINGLE_DE_REPETICION)}`;
    const c = respuestaCorrecta(v('camus'), pegado, texto, SALIDA);
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /repite/u);
    const cita = `En salida.md, tono camus. Queda una advertencia en «${palabras(8)}».`;
    assert.equal(respuestaCorrecta(v('camus'), cita, texto, SALIDA).estado, 'pasa');
  });

  test('la repetición más larga se cuenta en palabras, sin mayúsculas ni puntuación', () => {
    assert.equal(repeticionMasLarga('Uno, dos tres. Cuatro', 'x uno dos TRES cuatro y'), 4);
    assert.equal(repeticionMasLarga('a b', 'c d'), 0);
  });
});

describe('7. los datos del original', () => {
  const ORIGINAL = [
    'En 2024 se encuestó a 120 estudiantes de la Universidad del Quindío; el 60 % no tenía internet.',
    'Cuarenta y tres respondieron. Ricoeur (1996) la llamó identidad narrativa (Moraes y Galiazzi, 2016).',
    'Desde los años noventa circula una idea. Dos decisiones se apartan.',
  ].join('\n\n');

  test('las anclas: cifras, citas y nombres propios que no abren oración', () => {
    assert.deepEqual(anclasDe(ORIGINAL), {
      numeros: ['2024', '120', '60', '43', '1996', '2016'],
      citas: [
        { autor: 'Ricoeur', anio: '1996' },
        { autor: 'Moraes', anio: '2016' },
      ],
      nombres: ['universidad', 'quindio', 'moraes', 'galiazzi'],
    });
  });

  test('los números con letra se leen como cifras, en las dos direcciones', () => {
    // La decisión: se convierten. Un tono puede pasar «cincuenta y ocho» a
    // «58» o al revés, y el dato es el mismo. Por debajo de diez no son ancla:
    // «dos decisiones» se reescribe como «ambas» sin perder nada.
    assert.deepEqual(faltantes(anclasDe('Reunimos cincuenta y ocho artículos.'), 'Reunimos 58 artículos.').numeros, []);
    assert.deepEqual(faltantes(anclasDe('Reunimos 58 artículos.'), 'Reunimos cincuenta y ocho artículos.').numeros, []);
    assert.deepEqual(anclasDe('Hay dos decisiones y seis categorías.').numeros, []);
  });

  test('la numeración de un título no es un dato', () => {
    // Un agente puede reescribir «1. Introducción» como «Introducción» sin
    // perder ningún hecho del texto.
    assert.deepEqual(anclasDe('1. Introducción\n\n2.1. Criterios\n\nEn 2020 eran 12.').numeros, ['2020', '12']);
  });

  test('el analizador de números con letra', () => {
    const valores = (t: string) => numerosEnLetras(t).map((n) => n.valor);
    assert.deepEqual(valores('dos mil veinte'), [2020]);
    assert.deepEqual(valores('ciento doce y veintitrés'), [112, 23]);
    assert.deepEqual(valores('Trescientos mil'), [300000]);
    assert.deepEqual(valores('una vieja pregunta, uno solo'), [], 'el artículo no es un número');
    assert.ok(numerosDe('el 60 % de 5.379').has('5379'));
  });

  test('una cita narrativa que pasa a paréntesis sigue estando', () => {
    const a = anclasDe('Ricoeur (1996) la llamó así.');
    assert.deepEqual(faltantes(a, 'La llamó así (Ricoeur, 1996).').citas, []);
    assert.deepEqual(faltantes(a, 'La llamó así Ricoeur.').citas, [{ autor: 'Ricoeur', anio: '1996' }]);
  });

  test('falta una cifra o una cita: falla; falta solo un nombre: avisa; nada: pasa', () => {
    const intacto = ORIGINAL.replace('Universidad del Quindío', 'universidad del quindio');
    assert.equal(datosConservados(ORIGINAL, intacto).estado, 'pasa');
    const sinCifra = datosConservados(ORIGINAL, ORIGINAL.replace('120', 'muchos'));
    assert.equal(sinCifra.estado, 'falla');
    assert.match(sinCifra.motivo, /120/u);
    assert.equal(datosConservados(ORIGINAL, ORIGINAL.replace('Galiazzi', 'otro')).estado, 'aviso');
    assert.equal(datosConservados(ORIGINAL, null).estado, 'falla');
  });
});

describe('8. la extensión', () => {
  const entrada = palabras(100);
  const de = (razon: number) => extensionRazonable(entrada, palabras(Math.round(100 * razon)));

  test('cerca del original pasa; los bordes caen donde dicen sus nombres', () => {
    assert.equal(de(1).estado, 'pasa');
    assert.equal(de(RAZON_AVISO_MIN + 0.01).estado, 'pasa');
    assert.equal(de(RAZON_AVISO_MIN - 0.01).estado, 'aviso');
    assert.equal(de(RAZON_FALLA_MIN - 0.01).estado, 'falla');
    assert.equal(de(RAZON_AVISO_MAX + 0.01).estado, 'aviso');
    assert.equal(de(RAZON_FALLA_MAX + 0.01).estado, 'falla');
  });

  test('los umbrales están ordenados, o el aviso nunca saldría', () => {
    assert.ok(RAZON_FALLA_MIN < RAZON_AVISO_MIN && RAZON_AVISO_MIN < 1);
    assert.ok(1 < RAZON_AVISO_MAX && RAZON_AVISO_MAX < RAZON_FALLA_MAX);
  });

  test('sin salida, falla', () => {
    assert.equal(extensionRazonable(entrada, null).estado, 'falla');
  });
});

describe('9. los repositorios', () => {
  test('el estado de git sin lo que la prueba deja a propósito', () => {
    const porcelana = [' M src/cli.ts', '?? test-final/', '?? test-final/copilot/x', 'R  a.ts -> b.ts', '?? odd/', '?? "con espacio.md"'].join('\n');
    assert.deepEqual(cambiosDeGit(porcelana, ['test-final/', 'odd/']), [' M src/cli.ts', 'R  a.ts -> b.ts', '?? "con espacio.md"']);
    assert.equal(cambiosDeGit(null, []), null);
  });

  const SIN_CAMBIOS = { modificados: [], borrados: [], nuevos: [] };
  const ctx = {
    staging: 'C:\\temp\\pf-1',
    raices: ['C:\\r\\mix', 'C:\\r\\mix\\writing-harness'],
    // El agente trabaja en la copia, dentro de la carpeta de la corrida.
    cwd: 'C:\\temp\\pf-1\\mix',
    paralelas: false,
    copia: SIN_CAMBIOS,
    propias: [] as string[],
  };

  test('sin cambios y sin escrituras afuera, pasa', () => {
    const c = repositoriosIntactos({ 'C:\\r\\mix': [] }, { 'C:\\r\\mix': [] }, ['C:\\temp\\pf-1\\salida.md'], ctx);
    assert.equal(c.estado, 'pasa');
  });

  test('un cambio en un repositorio falla, y dice si hubo corridas en paralelo', () => {
    const c = repositoriosIntactos({ 'C:\\r\\mix': [] }, { 'C:\\r\\mix': ['?? basura.md'] }, [], { ...ctx, paralelas: true });
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /basura\.md/u);
    assert.match(c.motivo, /paralelo/u);
  });

  test('una escritura dentro de un repositorio real falla; en otro sitio, avisa', () => {
    assert.equal(repositoriosIntactos({}, {}, ['C:\\r\\mix\\writing-harness\\src\\rules.ts'], ctx).estado, 'falla');
    assert.equal(repositoriosIntactos({}, {}, ['C:\\Users\\p\\scratch\\a.txt'], ctx).estado, 'aviso');
  });

  test('una escritura relativa cae en la copia, y ahí decide la huella de cada archivo', () => {
    assert.equal(repositoriosIntactos({}, {}, ['writing-harness/src/rules.ts'], ctx).estado, 'pasa');
  });

  test('un archivo de la copia modificado o borrado falla, con su ruta', () => {
    const c = repositoriosIntactos({}, {}, [], {
      ...ctx,
      copia: { modificados: ['writing-harness/src/rules.ts'], borrados: ['CLAUDE.md'], nuevos: [] },
    });
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /writing-harness\/src\/rules\.ts/u);
    assert.match(c.motivo, /CLAUDE\.md/u);
  });

  test('un archivo nuevo en la copia avisa, con su ruta', () => {
    const c = repositoriosIntactos({}, {}, [], { ...ctx, copia: { ...SIN_CAMBIOS, nuevos: ['notas/borrador.md'] } });
    assert.equal(c.estado, 'aviso');
    assert.match(c.motivo, /notas\/borrador\.md/u);
  });

  test('lo que el agente escribe en su propio estado no es escribir fuera', () => {
    // Antigravity guarda borradores en la carpeta de su conversación. En la
    // primera corrida de humo eso salió como escritura fuera de la corrida.
    const brain = 'C:\\Users\\p\\.gemini\\antigravity-cli\\brain\\conv-1';
    const propio = { ...ctx, propias: [brain] };
    assert.equal(repositoriosIntactos({}, {}, [`${brain}\\scratch\\borrador.md`], propio).estado, 'pasa');
    const ajena = repositoriosIntactos({}, {}, ['C:\\Users\\p\\.gemini\\antigravity-cli\\brain\\conv-2\\x.md'], propio);
    assert.equal(ajena.estado, 'aviso');
  });

  test('cada ruta sale una sola vez en el motivo, la escriba como la escriba', () => {
    const ruta = 'C:\\Users\\p\\scratch\\borrador.md';
    const c = repositoriosIntactos({}, {}, [ruta, ruta, 'c:/users/p/scratch/borrador.md'], ctx);
    assert.equal(c.estado, 'aviso');
    assert.equal(c.motivo.match(/borrador\.md/giu)?.length, 1, c.motivo);
  });

  test('sin git, no se puede afirmar nada y se avisa', () => {
    assert.equal(repositoriosIntactos({ 'C:\\r\\mix': null }, { 'C:\\r\\mix': null }, [], ctx).estado, 'aviso');
  });
});

describe('10. el aislamiento', () => {
  const PROPIA = 'C:\\temp\\pf-00000000-0000-4000-8000-000000000001';
  const OTRA = 'C:\\temp\\pf-00000000-0000-4000-8000-000000000002';
  const ctx = {
    staging: PROPIA,
    carpeta: 'C:\\r\\mix\\test-final',
    mix: 'C:\\r\\mix',
    reales: ['C:\\r\\mix', 'C:\\r\\mix\\writing-harness'],
  };
  const leyendo = (...rutas: string[]): Transcripcion => ({
    ...vacia(),
    llamadas: rutas.map((r) => llamada('read_file', { target_file: r })),
  });
  const corriendo = (...cs: string[]): Transcripcion => ({
    ...vacia(),
    llamadas: cs.map((c) => llamada('run_terminal_command', { command: c })),
  });

  test('leer lo propio y la copia pasa, con rutas absolutas o relativas', () => {
    const t = leyendo(
      `${PROPIA}\\entrada.md`,
      `${PROPIA}\\mix\\writing-harness\\AGENTS.md`,
      'writing-harness/src/cli.ts',
    );
    assert.equal(aislamiento(t, ctx).estado, 'pasa');
  });

  test('una ruta absoluta a un repositorio real avisa, con la ruta, en cualquier forma', () => {
    // Una búsqueda sobre el arnés real entero recorre el código de la prueba sin
    // nombrar ninguno de sus archivos.
    for (const [t, enElMotivo] of [
      [{ ...vacia(), llamadas: [llamada('grep', { pattern: 'inventar', path: 'C:\\r\\mix\\writing-harness' })] }, 'C:/r/mix/writing-harness'],
      [leyendo('c:/R/MIX/writing-harness/AGENTS.md'), 'c:/R/MIX/writing-harness/AGENTS.md'],
      [leyendo('C:\\r\\mix\\AGENTS.md'), 'C:/r/mix/AGENTS.md'],
      [corriendo('node -e "readFileSync(\'C:\\\\r\\\\mix\\\\writing-harness\\\\src\\\\cli.ts\')"'), 'C:/r/mix/writing-harness/src/cli.ts'],
    ] as const) {
      const c = aislamiento(t, ctx);
      assert.equal(c.estado, 'aviso', enElMotivo);
      assert.ok(c.motivo.includes(enElMotivo), `${enElMotivo}: ${c.motivo}`);
    }
  });

  test('lo que cae en la copia propia no avisa, aunque la carpeta temporal esté dentro de una raíz real', () => {
    const conTemporalAdentro = { ...ctx, reales: [...ctx.reales, 'C:\\temp'] };
    assert.equal(aislamiento(leyendo(`${PROPIA}\\mix\\writing-harness\\src\\cli.ts`), conTemporalAdentro).estado, 'pasa');
  });

  test('las raíces reales salen del contexto: sin raíces, una ruta absoluta no avisa', () => {
    assert.equal(aislamiento(leyendo('C:\\r\\mix\\writing-harness\\AGENTS.md'), { ...ctx, reales: [] }).estado, 'pasa');
  });

  test('el código de la prueba sigue fallando y no se repite como aviso', () => {
    const anclas = 'C:\\r\\mix\\writing-harness\\scripts\\prueba-final\\anclas.ts';
    const c = aislamiento(leyendo(anclas, 'C:\\r\\mix\\test-final\\resumen.md', 'C:\\r\\mix\\writing-harness\\README.md'), ctx);
    assert.equal(c.estado, 'falla');
    assert.equal(c.motivo.match(/anclas\.ts/gu)?.length, 1, c.motivo);
    assert.equal(c.motivo.match(/resumen\.md/gu)?.length, 1, c.motivo);
    assert.match(c.motivo, /README\.md/u, 'el resto de la referencia al repositorio real se informa igual');
  });

  test('las rutas reales salen una vez y una lista larga se corta con la cuenta', () => {
    const repetida = leyendo('C:\\r\\mix\\writing-harness\\README.md', 'c:/r/mix/writing-harness/readme.md');
    assert.equal(aislamiento(repetida, ctx).motivo.match(/readme\.md/giu)?.length, 1);
    const muchas = leyendo(...Array.from({ length: 13 }, (_, i) => `C:\\r\\mix\\writing-harness\\src\\m${i}.ts`));
    assert.match(aislamiento(muchas, ctx).motivo, /y 3 más/u);
  });

  test('otra corrida, la carpeta de la prueba o el código de la prueba: falla, con la ruta', () => {
    for (const [r, enElMotivo] of [
      [`${OTRA}\\salida.md`, 'pf-00000000-0000-4000-8000-000000000002/salida.md'],
      ['C:\\r\\mix\\test-final\\grok\\base\\salida.md', 'test-final/grok/base/salida.md'],
      ['test-final/resumen.md', 'test-final/resumen.md'],
      ['../test-final/base.docx', 'test-final/base.docx'],
      ['writing-harness/odd/tasks/x.md', 'writing-harness/odd/tasks/x.md'],
      ['C:\\r\\mix\\writing-harness\\scripts\\prueba-final\\comprobaciones.ts', 'scripts/prueba-final/comprobaciones.ts'],
      ['C:\\r\\mix\\writing-harness\\evals\\prueba-final-ejecutor.test.ts', 'evals/prueba-final-ejecutor.test.ts'],
    ] as const) {
      const c = aislamiento(leyendo(r), ctx);
      assert.equal(c.estado, 'falla', r);
      assert.ok(c.motivo.includes(enElMotivo), `${r}: ${c.motivo}`);
    }
  });

  test('lo que hizo Grok en la corrida de humo: buscar, leer e importar el ejecutor', () => {
    const grep = { ...vacia(), llamadas: [llamada('grep', { pattern: 'inventar|hecho|conserv', path: 'C:\\r\\mix\\writing-harness\\scripts\\prueba-final' })] };
    assert.equal(aislamiento(grep, ctx).estado, 'falla');
    const importar = corriendo(
      'node --input-type=module -e "\nimport { anclasDe, faltantes } from \'./writing-harness/scripts/prueba-final/anclas.ts\';\nconsole.log(1)"',
    );
    const c = aislamiento(importar, ctx);
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /writing-harness\/scripts\/prueba-final\/anclas\.ts/u);
  });

  test('con barras dobles, como quedan dentro de una cadena escapada', () => {
    const c = aislamiento(corriendo('node -e "readFileSync(\'C:\\\\r\\\\mix\\\\writing-harness\\\\scripts\\\\prueba-final.ts\')"'), ctx);
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /scripts\/prueba-final\.ts/u);
  });

  test('cada ruta una vez, y una lista larga se corta con la cuenta de lo que falta', () => {
    const repetida = leyendo(
      'C:\\r\\mix\\writing-harness\\scripts\\prueba-final\\anclas.ts',
      'c:/r/mix/writing-harness/scripts/prueba-final/anclas.ts',
      'C:\\r\\mix\\writing-harness\\scripts\\prueba-final\\anclas.ts',
    );
    assert.equal(aislamiento(repetida, ctx).motivo.match(/anclas\.ts/gu)?.length, 1);
    const muchas = leyendo(...Array.from({ length: 13 }, (_, i) => `writing-harness/scripts/prueba-final/m${i}.ts`));
    const c = aislamiento(muchas, ctx);
    assert.match(c.motivo, /y 3 más/u);
    assert.equal(c.motivo.match(/\.ts/gu)?.length, 10);
  });

  test('dos salidas idénticas fallan, y cada una nombra a la otra', () => {
    const iguales = salidasIdenticas([
      { clave: 'copilot/base', huella: 'h1' },
      { clave: 'grok/base', huella: 'h2' },
      { clave: 'agy/base', huella: 'h1' },
      { clave: 'agy/camus', huella: null },
    ]);
    assert.deepEqual(iguales.get('copilot/base'), ['agy/base']);
    assert.deepEqual(iguales.get('agy/base'), ['copilot/base']);
    assert.equal(iguales.has('grok/base'), false);
    const c = conIdenticas(aislamiento(leyendo(), ctx), ['agy/base']);
    assert.equal(c.estado, 'falla');
    assert.match(c.motivo, /agy\/base/u);
  });
});

describe('el estado de una corrida', () => {
  test('la peor de sus comprobaciones', () => {
    const c = (estado: 'pasa' | 'aviso' | 'falla') => ({ numero: 0, nombre: '', estado, motivo: '' });
    assert.equal(estadoDe([c('pasa'), c('pasa')]), 'pasa');
    assert.equal(estadoDe([c('pasa'), c('aviso')]), 'aviso');
    assert.equal(estadoDe([c('aviso'), c('falla'), c('pasa')]), 'falla');
  });
});
