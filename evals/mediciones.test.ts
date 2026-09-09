// Las mediciones cuadran, y cuadran con la prosa que las enuncia.
//
// Mismo problema que el manifiesto y misma respuesta: `src/mediciones.ts` no se
// puede regenerar sin el corpus, el corpus no está en el repositorio y va a
// desaparecer, así que una edición a mano no la notaría nadie. La huella la
// caza.
//
// Lo demás es lo que este repositorio hace siempre: comparar las dos
// representaciones de un mismo hecho. Cada agregado tiene que salir de su
// detalle, cada archivo medido tiene que estar en el manifiesto, y cada cifra
// que una skill enuncia tiene que seguir siendo la que se midió.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { CORPUS } from '../src/corpus.ts';
import { EXPRESIONES, MEDICIONES, POR_ARCHIVO } from '../src/mediciones.ts';
import { redaccionDe } from '../src/mediciones-redaccion.ts';
import { REPO_ROOT, readSkill } from '../src/skills.ts';
import { DECLARADO, MINUTOS } from './registro.ts';
import { vive } from './retiradas.ts';

const valor = (id: string) => MEDICIONES.find((m) => m.id === id)?.valor;
const filasDe = (skill: string) => POR_ARCHIVO.filter((f) => f.skill === skill);

describe('las mediciones no se editaron a mano', () => {
  test('el archivo entero coincide con su huella', () => {
    // Para actualizarla: volver a correr `scripts/medir.ts` con el corpus
    // delante y pegar acá el valor que este test reporte como recibido.
    //
    // Esta huella se actualizó dos veces sin el corpus delante, y conviene decir
    // exactamente qué certifica desde entonces, porque la primera versión de
    // este comentario se atribuyó un mérito que no es suyo.
    //
    // Lo que se cambió las dos veces fueron campos de texto: la redacción de
    // seis filas que describían su material con las palabras de otro corpus, y
    // la cabecera que decía lo mismo. Ningún valor medido se tocó.
    //
    // Qué vigila cada cosa, que es lo que el comentario anterior decía mal:
    //
    // - La huella dice «este archivo no cambió desde aquella edición». Nada más.
    //   Después de regenerarla a mano ya no puede decir «esto es lo que produjo
    //   el script con el corpus delante», y no hay manera de que lo diga otra
    //   vez sin el corpus.
    // - Los NÚMEROS los vigila «las palabras, los signos y las marcas suman lo
    //   que dice el agregado», que rederiva cada total desde el detalle por
    //   archivo. Se comprobó rompiéndolo: alterar un agregado o una fila de
    //   detalle hace fallar ese test además de la huella. Lo que sigue sin
    //   cazarse es una edición que cambie los dos de forma coherente, y eso era
    //   igual de cierto antes de tocar el archivo.
    // - El TEXTO lo vigila el test que lo deriva, más abajo. Ese sí dice «es el
    //   correcto», no solo «no cambió».
    const bytes = readFileSync(join(REPO_ROOT, 'src', 'mediciones.ts'), 'utf8').replace(
      /\r\n/gu,
      '\n',
    );
    assert.equal(
      createHash('sha256').update(bytes, 'utf8').digest('hex'),
      '6c0092c45691d666ef9f47c533910c74df599d360a74916fb1a02416269732de',
    );
  });
});

describe('las expresiones contadas están bien formadas', () => {
  // A propósito NO se comprueba que cada expresión siga entrecomillada en su
  // SKILL.md, aunque de ahí salieron. Sería atar la prosa futura a un corpus que
  // ya no va a existir: reescribir un giro rompería el gate y nadie podría
  // arreglarlo, porque arreglarlo exige volver a medir. La tabla es una prueba
  // de lo que hubo, no una restricción sobre lo que se escriba después.

  test('1291 expresiones, 904 aparecen en su corpus', () => {
    assert.equal(EXPRESIONES.length, 1291);
    assert.equal(EXPRESIONES.filter((e) => e.veces > 0).length, 904);
  });

  test('cada expresión pertenece a un corpus medido', () => {
    const medidos = new Set(MEDICIONES.map((m) => m.skill));
    assert.deepEqual([...new Set(EXPRESIONES.map((e) => e.skill))].filter((s) => !medidos.has(s)), []);
  });

  test('ninguna expresión se cuenta dos veces en la misma skill', () => {
    const claves = EXPRESIONES.map((e) => `${e.skill} :: ${e.expresion}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('un cero es una medición, no un hueco', () => {
    // Las 387 que dan cero no son fallos de conteo: son nombres de skill y
    // frases de invocación que la prosa entrecomilla y que nunca estuvieron en
    // el corpus. Que consten evita que alguien las cuente después como si
    // fueran giros del autor.
    assert.equal(EXPRESIONES.filter((e) => e.veces === 0).length, 387);
    assert.ok(
      EXPRESIONES.some((e) => e.expresion === 'spanish-writing' && e.veces === 0),
      'el nombre de la base tendría que dar cero en todos los corpus',
    );
  });
});

describe('cada agregado sale de su detalle', () => {
  test('71 mediciones sobre 302 archivos', () => {
    assert.equal(MEDICIONES.length, 71);
    assert.equal(POR_ARCHIVO.length, 302);
  });

  test('las palabras, los signos y las marcas suman lo que dice el agregado', () => {
    for (const corpus of CORPUS) {
      const filas = filasDe(corpus.skill);
      const suma = (f: (x: (typeof filas)[number]) => number) => filas.reduce((n, x) => n + f(x), 0);

      assert.equal(valor(`${corpus.skill}/archivos`), filas.length, corpus.skill);
      assert.equal(valor(`${corpus.skill}/palabras`), suma((x) => x.palabras), corpus.skill);
      assert.equal(
        valor(`${corpus.skill}/signos-terminales`),
        suma((x) => x.signos),
        corpus.skill,
      );

      const marcas = valor(`${corpus.skill}/marcas-de-tiempo`);
      if (marcas !== undefined) assert.equal(marcas, suma((x) => x.cues), corpus.skill);

      const segundos = valor(`${corpus.skill}/segundos`);
      if (segundos !== undefined) assert.equal(segundos, suma((x) => x.segundos ?? 0), corpus.skill);
    }
  });

  test('cada archivo medido está en el manifiesto', () => {
    // Sin esto, una medición podría apuntar a un archivo que nunca se fichó, y
    // entonces su cifra no tendría origen comprobable: exactamente lo que las
    // dos mitades existen para evitar.
    const enManifiesto = new Set(
      CORPUS.flatMap((c) => c.archivos.map((a) => `${c.skill}/${a.ruta}`)),
    );
    assert.deepEqual(
      POR_ARCHIVO.map((f) => `${f.skill}/${f.archivo}`).filter((k) => !enManifiesto.has(k)),
      [],
    );
  });

  test('un corpus sin transcripción se mide entero, y lo dice', () => {
    // Las fichas de han no tienen «## Transcripción», así que se cuenta el
    // archivo completo. Lo mismo el corpus de `triangulacion`, que no es habla
    // transcrita sino un documento escrito. Las dos excepciones tienen que
    // verse en el dato en lugar de estar escondidas en el script.
    const completos = [...new Set(MEDICIONES.filter((m) => m.fuente === 'archivo-completo').map((m) => m.skill))];
    assert.deepEqual(completos.sort(), ['han-writing', 'triangulacion-writing']);
    assert.equal(
      filasDe('han-writing').reduce((n, f) => n + f.cues, 0),
      0,
      'han no debería tener marcas de tiempo',
    );
  });
});

describe('la prosa y la medición dicen lo mismo', () => {
  const enProsa = (skill: string): number | null => {
    const cifras = [...readSkill(skill).matchAll(/(\d{1,3}(?:[.,]\d{3})+)\s+palabras/gu)].map((m) =>
      Number((m[1] as string).replace(/[.,]/gu, '')),
    );
    return cifras.length ? Math.max(...cifras) : null;
  };

  test('la cifra que enuncia cada skill sigue siendo la registrada', () => {
    // Las retiradas conservan su fila en el manifiesto y ya no tienen prosa
    // que leer. `evals/corpus.test.ts` comprueba que ese permiso no tape a una
    // que desapareció por descuido.
    for (const [skill, esperado] of Object.entries(DECLARADO).filter(([s]) => vive(s))) {
      assert.equal(enProsa(skill), esperado.prosa, `${skill} cambió la cifra de su prosa`);
    }
  });

  test('la redacción de cada medición es la que se deriva de qué mide y sobre qué texto', () => {
    // ESTE GATE SUSTITUYE A UN DEFECTO QUE ESTUVO VIVO Y NO SE VEÍA.
    //
    // `scripts/medir.ts` elegía el texto de `afirmacion` y `regla` con un
    // condicional escrito dentro del propio script, y la rama de los corpus sin
    // transcripción la redactó el primero que cayó en ella, que eran fichas de
    // libro. Un informe de investigación medido después heredó esas palabras y
    // quedó registrado como fichas. Las cuatro casillas del contrato estaban
    // llenas, así que ningún gate se quejó, y dos describían otro material.
    //
    // Lo que lo cierra no es haber cambiado las palabras: es que ya no se
    // escriban dos veces. `src/mediciones-redaccion.ts` las deriva de qué mide
    // la fila y sobre qué texto, el script las pide al generar y este test las
    // vuelve a pedir al comprobar. Una fila con redacción escrita a mano falla
    // acá aunque la huella del archivo cuadre, porque la huella dice «no
    // cambió» y esto dice «es la correcta».
    for (const m of MEDICIONES) {
      const medicion = m.id.split('/')[1] as string;
      const esperada = redaccionDe(medicion, m.fuente);
      assert.ok(esperada, `${m.id}: no hay redacción derivable para «${medicion}»`);
      assert.equal(m.afirmacion, esperada.afirmacion, `${m.id}: afirmación escrita a mano`);
      assert.equal(m.regla, esperada.regla, `${m.id}: regla escrita a mano`);
    }
  });

  test('la redacción distingue de verdad las dos fuentes', () => {
    // El canario. Si `redaccionDe` devolviera el mismo texto para las dos
    // fuentes, el test de arriba pasaría en verde con el defecto puesto, que es
    // exactamente lo que pasaba antes.
    const conTranscripcion = redaccionDe('palabras', 'cuerpo-de-transcripcion');
    const completo = redaccionDe('palabras', 'archivo-completo');
    assert.notEqual(conTranscripcion?.afirmacion, completo?.afirmacion);
    assert.notEqual(conTranscripcion?.regla, completo?.regla);

    // Y la mitad que importa: ninguna rama nombra un material que el script no
    // puede conocer. Sabe si el archivo trae cabecera de transcripción; no sabe
    // si es una ficha, un informe o una carta.
    for (const medicion of ['archivos', 'palabras', 'signos-terminales']) {
      const r = redaccionDe(medicion, 'archivo-completo');
      assert.doesNotMatch(`${r?.afirmacion} ${r?.regla}`, /ficha|transcripci[óo]n trae/iu, medicion);
    }
  });

  test('una medición desconocida no pasa sin redacción', () => {
    // La otra dirección: agregar una clase de medición al script obliga a
    // redactarla en el módulo. Sin esto, una fila nueva entraría con los dos
    // campos vacíos y el bucle de arriba no tendría contra qué compararla.
    assert.equal(redaccionDe('inventada', 'archivo-completo'), undefined);
  });

  test('la medición sigue siendo la registrada', () => {
    for (const [skill, esperado] of Object.entries(DECLARADO)) {
      assert.equal(valor(`${skill}/palabras`), esperado.medido, `${skill} cambió su medición`);
    }
  });

  test('el total que enuncia la prosa cuadra con las partes que enuncia', () => {
    // Esta es la razón por la que las cifras de la prosa NO se alinearon con la
    // medición aunque difieran. Tres de ellas se descomponen exactamente en
    // otras cifras del mismo documento: cambiar el total habría roto una
    // aritmética que hoy está bien, para ganar 0,1 % de exactitud en otra.
    //
    // Son dos sistemas coherentes que no coinciden entre sí. El de la prosa
    // cuadra por dentro; el de la medición se puede volver a producir. Se
    // conservan los dos y se congela la diferencia, que es lo honesto cuando no
    // hay manera de decidir cuál método usó el original: se probaron cuatro
    // variantes de conteo y ninguna reprodujo las diez cifras.
    const DESCOMPONE: Record<string, [number, number, number]> = {
      'fonseca-writing': [80073, 34440, 114513],
      'freddy-writing': [44322, 55222, 99544],
      'medicendai-writing': [96448, 1459, 97907],
    };
    for (const [skill, [a, b, total]] of Object.entries(DESCOMPONE).filter(([s]) => vive(s))) {
      assert.equal(a + b, total, `${skill}: la descomposición dejó de cuadrar`);
      // El separador de millar se escribe siempre, también en las de cuatro
      // cifras: la prosa escribe «1.459» y `toLocaleString` da «1459».
      const conPunto = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/gu, '\\.');
      const src = readSkill(skill);
      for (const n of [a, b, total]) {
        assert.match(src, new RegExp(conPunto(n), 'u'), `${skill}: falta ${n} en la prosa`);
      }
    }
  });

  test('tres corpus dan exacto y nueve caen dentro del 0,5 %', () => {
    const con = Object.entries(DECLARADO).filter(([, d]) => d.prosa !== null);
    /**
     * Contra qué se compara la cifra de la prosa.
     *
     * Contra el agregado, salvo que el renglón diga qué archivo mira. Ese campo
     * existe porque un corpus de dos archivos, el informe entero y el
     * subconjunto medido, hacía que el agregado sumara los dos mientras la prosa
     * hablaba de uno. Sin él, la comparación daba un 197 % que no medía un error
     * sino dos magnitudes distintas puestas una contra otra.
     */
    const contra = (skill: string, d: { medido: number; archivo?: string }) => {
      if (!d.archivo) return d.medido;
      const fila = POR_ARCHIVO.find((f) => f.skill === skill && f.archivo === d.archivo);
      assert.ok(fila, `${skill}: el renglón nombra un archivo que no está medido: ${d.archivo}`);
      return fila.palabras;
    };
    const desvio = ([skill, d]: [string, { prosa: number | null; medido: number; archivo?: string }]) =>
      Math.abs((contra(skill, d) - (d.prosa as number)) / (d.prosa as number));
    assert.equal(con.filter((e) => desvio(e) === 0).length, 3);
    assert.equal(con.filter((e) => desvio(e) > 0 && desvio(e) <= 0.005).length, 9);
    // han es el único que se sale, y por eso está nombrado: mide un corpus de
    // fichas y su prosa enuncia palabras del libro, dos textos y dos cifras.
    //
    // `triangulacion` estuvo un rato en esta lista y no le correspondía. Se
    // comparaba su prosa contra el agregado de dos archivos, el informe entero y
    // el subconjunto medido, lo que daba un 197 % que no medía ningún error sino
    // dos magnitudes distintas puestas una contra otra. Comparada contra el
    // archivo que la prosa enuncia, la desviación es del 0,245 % y entra con los
    // demás. Declararla excepción era esconder un dato que estaba a mano.
    assert.deepEqual(
      con.filter((e) => desvio(e) > 0.005).map(([s]) => s).sort(),
      ['han-writing'],
    );
  });

  test('los minutos de habla coinciden donde la skill los enuncia', () => {
    // Acá no hay desvío: los cuatro que declaran el total dan el mismo número
    // que la suma de las cabeceras. kenway declara 337 y mide 338, un minuto de
    // redondeo.
    for (const [skill, minutos] of Object.entries(MINUTOS).filter(([s]) => vive(s))) {
      const segundos = valor(`${skill}/segundos`) as number;
      assert.equal(Math.round(segundos / 60), minutos, skill);
      assert.match(readSkill(skill), new RegExp(`${minutos}\\s+minutos`, 'u'), skill);
    }
  });
});
