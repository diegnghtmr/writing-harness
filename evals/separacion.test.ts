// La separación entre las skills y el verificador.
//
// Ninguna skill nombra al verificador, ni a Node, ni a este repositorio: una
// skill tiene que servir en una máquina donde este verificador no existe. Y
// nada de `src/` nombra el directorio de un anfitrión: el verificador tiene que
// servir sobre un texto escrito sin ninguna skill cargada.
//
// Esto vivía en el CI como dos `grep -r` y se trajo acá después de que uno
// disparara sobre la expresión «Tengo un precursor.», que contiene «cursor».
// Marcaba contenido legítimo, que es la manera más rápida de que un guardián
// deje de leerse. Es la misma disciplina que el repositorio aplica a las
// reglas, y la segunda vez que una comprobación del CI se corrige moviéndola a
// la suite; la primera fue la de la raya.
//
// Hay una sola excepción: la skill de entrada puede nombrar al verificador,
// porque es la única que describe cuándo se usa y cómo entrega el texto. La
// excepción es del archivo exacto, no de la carpeta: un catálogo dentro de esa
// skill, o una carpeta con un nombre parecido, no la heredan.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { ENTRADA, REPO_ROOT, SKILLS_DIR } from '../src/skills.ts';

function archivos(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return archivos(p, extension);
    return statSync(p).isFile() && p.endsWith(extension) ? [p] : [];
  });
}

const relativo = (p: string) => p.slice(REPO_ROOT.length).replace(/\\/gu, '/');

/**
 * Los delatores del desarrollo del arnés, para el archivo dado.
 *
 * `/el verificador/iu` se excluye solo para el archivo exacto de la skill de
 * entrada: es la única autorizada a nombrarlo. `relativo` ya normaliza a
 * barras, así que la comparación es exacta también en Windows, y no cubre un
 * catálogo dentro de esa carpeta ni una carpeta con un nombre parecido.
 */
function delatoresDeDesarrollo(archivo: string): RegExp[] {
  const comunes = [
    /este repositorio/iu,
    /(?<!\p{L})un gate(?!\p{L})/iu,
    /(?<!\p{L})los gates(?!\p{L})/iu,
    /(?<!\p{L})evals\//u,
    /(?<!\p{L})src\//u,
    /la capa base/iu,
  ];
  if (relativo(archivo) === `skills/${ENTRADA}/SKILL.md`) return comunes;
  return [...comunes, /el verificador/iu];
}

/**
 * Un identificador de modelo del catálogo de Hugging Face: `organizacion/modelo`.
 *
 * Se exige que el lado derecho parezca un modelo, y no basta con la barra:
 * `org/nombre` a secas es la mitad de cualquier URL y las skills citan decenas,
 * como `org/wiki`, `com/index.php` o `SecretodeAtenas/videos`. La mirada atrás
 * descarta lo que viene pegado a un dominio o a otra ruta, que es donde viven
 * todas esas.
 *
 * Lo que marca al modelo es el tamaño en parámetros, `1.7B` o `2b`, o un `gpt`
 * con versión pegada. Se probó antes con una lista de familias y se retiró: con
 * la comparación sin distinguir mayúsculas, `salamandra` es un animal, `llama`
 * es un verbo y `bert` está dentro de «Alberto». Un delator que marca prosa
 * española legítima dura hasta el segundo día.
 */
const MODELO =
  /(?<![\w/.:-])[A-Za-z][\w.-]{1,30}\/(?=[A-Za-z])[\w.-]*(?:\d+(?:\.\d+)?[Bb]\b|gpt\d|gpt-)[\w.-]*/iu;

describe('las skills y el verificador no se nombran', () => {
  test('ninguna skill nombra al verificador', () => {
    // «node » con el espacio a propósito: una skill puede hablar del nodo de un
    // grafo o de un nodo narrativo sin estar invocando nada.
    const delatores = [/cli\.ts/u, /(?<!\p{L})node\s/iu, /--tono/u, /writing-harness/u];
    const hallazgos = archivos(SKILLS_DIR, '.md').flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return delatores.filter((d) => d.test(src)).map((d) => `${relativo(f)} :: ${d.source}`);
    });
    assert.deepEqual(hallazgos, []);
  });

  test('ninguna skill habla del desarrollo del arnés', () => {
    // La doctrina dice que una skill tiene que servir en una máquina donde el
    // verificador no existe. Los cuatro delatores de arriba cubren que no lo
    // invoque; este cubre que no hable de él.
    //
    // Entró porque pasó. El decimotercer tono llegó con una tabla de los ciento
    // veintiún errores de norma que su corpus comete contra la capa base, y con
    // frases sobre «este repositorio» y sobre lo que un gate puede o no separar.
    // Nada de eso le sirve a quien escribe un texto, y ninguno de los cuatro
    // delatores anteriores lo vio, porque ninguno busca esas palabras.
    //
    // Lo encontró una persona leyendo la skill. Este test existe para que la
    // próxima vez no dependa de eso.
    const hallazgos = archivos(SKILLS_DIR, '.md').flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return delatoresDeDesarrollo(f)
        .filter((d) => d.test(src))
        .map((d) => `${relativo(f)} :: ${d.source}`);
    });
    assert.deepEqual(hallazgos, []);
  });

  test('el guardián del desarrollo no marca prosa legítima', () => {
    // El canario, y hace falta: «base» sola aparece en todas las catorce skills
    // hablando de la base normativa, que es una skill y no una capa de un
    // programa. Lo que se caza es «la capa base», que solo tiene sentido dentro
    // del verificador.
    const d = [/este repositorio/iu, /(?<!\p{L})un gate(?!\p{L})/iu, /la capa base/iu];
    const dispara = (t: string) => d.some((r) => r.test(t));
    assert.ok(dispara('la tabla de este repositorio'));
    assert.ok(dispara('un gate lo comprueba'));
    assert.ok(dispara('incumple la capa base'));
    assert.ok(!dispara('hereda de la base normativa «spanish-writing»'));
    assert.ok(!dispara('la base decide qué es correcto en español'));
    assert.ok(!dispara('un gato entra por la ventana'));
  });

  test('ninguna skill nombra un modelo concreto', () => {
    // La otra mitad de la misma doctrina, y estuvo sin gate hasta que algo
    // caminó por el hueco. Se escribió una skill que nombraba cinco modelos,
    // tres scripts y un entorno de Python, y los cuatro delatores de arriba la
    // dejaron pasar en verde: ninguno mira los nombres de modelo.
    //
    // Una skill tiene que servir en una máquina donde el modelo que la lee es
    // otro. Dice «el agente» y describe qué papel cumple. El día que nombra un
    // modelo, deja de ser una regla de escritura y pasa a ser la configuración
    // de una instalación concreta.
    //
    // Lo que este gate NO hace es juzgar si un fabricante mencionado es el que
    // ejecuta. `humanizar-espanol` cita «que no parezca de ChatGPT» como frase
    // con la que el usuario la invoca, y nombra GPTZero y Turnitin porque habla
    // de detectores: las tres son legítimas y ninguna expresión regular las
    // distingue de una instrucción. Eso sigue siendo lectura.
    const hallazgos = archivos(SKILLS_DIR, '.md')
      .map((f) => [relativo(f), MODELO.exec(readFileSync(f, 'utf8'))] as const)
      .filter(([, m]) => m !== null)
      .map(([f, m]) => `${f} :: ${(m as RegExpExecArray)[0]}`);
    assert.deepEqual(hallazgos, []);
  });

  test('el guardián de los modelos caza los de verdad y deja pasar la prosa', () => {
    // El canario, y acá hacía más falta que en ningún otro sitio. «llama»
    // aparece veinticinco veces repartidas en nueve skills y ni una sola es el
    // modelo de Meta: son el verbo y el animal. Un delator escrito como lista
    // de fabricantes habría marcado nueve skills el primer día y lo habrían
    // apagado el segundo.
    const dispara = (t: string) => MODELO.test(t);
    // Los cuatro que traía la skill que no entró.
    assert.ok(dispara('el juez es DeepESP/gpt2-spanish-medium'));
    assert.ok(dispara('perplejidad con utter-project/EuroLLM-1.7B'));
    assert.ok(dispara('descartado: Qwen/Qwen2.5-1.5B'));
    assert.ok(dispara('descartado: BSC-LT/salamandra-2b'));
    // Prosa española legítima y rutas que las skills citan de verdad.
    assert.ok(!dispara('la llama se llama así'));
    assert.ok(!dispara('ver `references/patrones-de-ia.md`'));
    assert.ok(!dispara('https://es.wikipedia.org/wiki/Ensayo'));
    assert.ok(!dispara('youtube.com/@SecretodeAtenas/videos'));
    assert.ok(!dispara('«que no parezca de ChatGPT»'));
    assert.ok(!dispara('la documentación de GPTZero'));
    // Los tres que tumbaron la lista de familias. Van como test porque el día
    // que alguien la reponga, esto se lo dice antes de que lo diga una skill.
    assert.ok(!dispara('la salamandra de Alberto, que se llama así'));
    assert.ok(!dispara('revista/salamandra'));
    assert.ok(!dispara('autores/alberto-llamas'));
  });

  test('el verificador no nombra el directorio de ningún anfitrión', () => {
    // Con el punto delante, que es lo que se quería decir: el directorio
    // `.cursor`, no cualquier palabra que termine en «cursor». `copilot` va con
    // frontera de letra por la misma razón.
    const delatores = [/\.claude/u, /\.cursor/u, /(?<!\p{L})copilot(?!\p{L})/iu];
    const hallazgos = archivos(join(REPO_ROOT, 'src'), '.ts').flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return delatores.filter((d) => d.test(src)).map((d) => `${relativo(f)} :: ${d.source}`);
    });
    assert.deepEqual(hallazgos, []);
  });

  test('la excepción de «el verificador» es exacta a la ruta de la skill de entrada', () => {
    // La excepción no es una carpeta, es un archivo. Un catálogo dentro de la
    // entrada, o una carpeta con un nombre parecido, no la heredan.
    const disparaVerificador = (archivo: string) =>
      delatoresDeDesarrollo(archivo).some((d) => d.test('el verificador'));

    assert.ok(disparaVerificador(join(SKILLS_DIR, 'camus-writing', 'SKILL.md')));
    assert.ok(disparaVerificador(join(SKILLS_DIR, ENTRADA, 'references', 'x.md')));
    assert.ok(disparaVerificador(join(SKILLS_DIR, `${ENTRADA}-bis`, 'SKILL.md')));
    assert.ok(!disparaVerificador(join(SKILLS_DIR, ENTRADA, 'SKILL.md')));

    // La excepción es solo de «el verificador»: los demás delatores del
    // desarrollo del arnés siguen vigilando la skill de entrada.
    assert.ok(
      delatoresDeDesarrollo(join(SKILLS_DIR, ENTRADA, 'SKILL.md')).some((d) => d.test('lo dice un gate')),
    );
  });

  test('el guardián sigue disparando sobre lo que tiene que disparar', () => {
    // Una comprobación que se afina corre el riesgo de dejar de comprobar. Estos
    // dos casos prueban que sigue viva, y el tercero, que la afinación funcionó.
    const anfitrion = [/\.claude/u, /\.cursor/u, /(?<!\p{L})copilot(?!\p{L})/iu];
    const dispara = (texto: string) => anfitrion.some((d) => d.test(texto));
    assert.ok(dispara('leer desde .cursor/rules'));
    assert.ok(dispara('el plugin de Copilot'));
    assert.ok(!dispara('Tengo un precursor.'));
  });

  /**
   * Lo que la entrada no puede decir aunque nombre al verificador.
   *
   * La excepción de arriba le permite decir «el verificador», pero no cómo se
   * invoca. Un flag de línea de comandos, el ejecutable que corre un script o
   * la extensión del script siguen siendo desarrollo del arnés, aunque vayan
   * pegados a la palabra permitida.
   */
  const INVOCACION = [/--(?=[A-Za-z])/u, /(?<!\p{L})(?:node|python)\s/iu, /\.(?:ts|js|py)\b/iu];

  test('la entrada no invoca al verificador aunque lo nombre', () => {
    const src = readFileSync(join(SKILLS_DIR, ENTRADA, 'SKILL.md'), 'utf8');
    const hallazgos = INVOCACION.filter((d) => d.test(src)).map((d) => d.source);
    assert.deepEqual(hallazgos, []);
  });

  test('el guardián de la invocación caza lo que tiene que cazar', () => {
    const dispara = (t: string) => INVOCACION.some((d) => d.test(t));
    assert.ok(dispara('--tono camus'));
    assert.ok(dispara('node src/cli.ts'));
    assert.ok(dispara('python detector/score_es.py'));
    assert.ok(dispara('el verificador de `cli.ts`'));
    assert.ok(!dispara('el doble guion ( -- )'));
    assert.ok(!dispara('un nodo del grafo'));
    assert.ok(!dispara('el verificador mide el texto'));
  });
});
