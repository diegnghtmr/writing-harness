// Las cifras del detector contra los documentos que las citan.
//
// Mismo movimiento que el resto de este directorio: dos representaciones de un
// mismo hecho, comparadas, fallando en las dos direcciones. Acá las dos son el
// módulo `detector.ts`, que fija lo medido, y la prosa de `detector/`, que lo
// cuenta.
//
// La suite no corre el detector y no puede: hacen falta PyTorch y dos modelos
// descargados. Lo que sí puede es impedir que la prosa diga un número distinto
// del que se midió, que es exactamente el defecto que este repositorio lleva
// arreglado cinco veces en otros documentos.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';
import {
  CIFRAS,
  DESCARTADOS,
  DIRIGIDAS,
  ELEGIDOS,
  FRACCION_DE_PARADA,
  FUENTES,
  HAY_DETECTOR,
  JUECES,
  PASADAS,
  UMBRAL_MAQUINA_EUROLLM,
  documento,
  huella,
} from './detector.ts';

const README = () => documento('README.md');
const ESTUDIO = () => documento('eval/RESULTADOS-MODELOS.md');
const ESCENARIOS = () => documento('escenarios/RESULTADOS.md');

/** Un número como lo escribe la prosa en español, con coma decimal. */
const coma = (n: number) => n.toFixed(3).replace('.', ',');

describe('la herramienta está donde los documentos dicen', () => {
  test('el detector no desapareció de debajo de sus propias cifras', () => {
    // Si alguien borra `detector/`, los gates de abajo reventarían con ENOENT y
    // el mensaje no diría qué pasó. Este dice qué pasó.
    assert.ok(HAY_DETECTOR, 'falta detector/score_es.py y este archivo habla de él');
  });

  test('cada fuente sigue siendo el texto que se midió', () => {
    // Las cinco versiones del artículo viven también fuera de este repositorio y
    // se siguen editando ahí. Copiar encima una versión nueva con el mismo
    // nombre dejaría las cifras describiendo un texto que ya no está, y sin el
    // contenido fijado nada avisaría.
    const movidas = Object.entries(FUENTES)
      .filter(([ruta, sha]) => huella(ruta) !== sha)
      .map(([ruta]) => ruta);
    assert.deepEqual(movidas, [], 'el contenido de estas fuentes ya no es el que se midió');
  });
});

describe('el mapa de jueces dice lo que el estudio midió', () => {
  test('los dos elegidos están en el mapa del README, con su nombre completo', () => {
    const falta = ELEGIDOS.filter((j) => !README().includes(j.modelo)).map((j) => j.modelo);
    assert.deepEqual(falta, [], 'el README no nombra a estos jueces elegidos');
  });

  test('los tres descartados también, o el mapa solo cuenta la mitad', () => {
    // La otra dirección, y es la que importa más. Un mapa que solo nombra a los
    // ganadores no deja ver que la elección fue medida: parece una preferencia.
    const falta = DESCARTADOS.filter((j) => !README().includes(j.modelo.split('/')[1] as string))
      .map((j) => j.modelo);
    assert.deepEqual(falta, [], 'el README no dice que estos quedaron descartados');
  });

  test('lo que decide es la brecha mínima, no el promedio', () => {
    // El criterio real del estudio, escrito como aserción para que no se pueda
    // elegir un juez por su gap medio. Qwen2.5-0.5B tiene gap medio positivo
    // (+0,048) y aun así se descartó, porque su brecha mínima es negativa: hay
    // prosa humana suya puntuando como máquina.
    for (const j of ELEGIDOS) {
      assert.ok(j.brechaMinima > 0, `${j.modelo}: elegido con brecha mínima ${j.brechaMinima}`);
    }
    for (const j of DESCARTADOS) {
      assert.ok(j.brechaMinima < 0, `${j.modelo}: descartado con brecha mínima ${j.brechaMinima}`);
    }
    const conGapPositivoYDescartado = DESCARTADOS.filter((j) => j.gapMedio > 0);
    assert.equal(
      conGapPositivoYDescartado.length,
      1,
      'el caso que prueba que manda la brecha y no el promedio dejó de existir',
    );
  });

  test('una señal, un juez, y ninguna señal sin dueño', () => {
    const porSenal = ELEGIDOS.map((j) => j.senal).sort();
    assert.deepEqual(porSenal, ['curvatura', 'perplejidad']);
    assert.equal(new Set(JUECES.map((j) => j.modelo)).size, JUECES.length, 'un modelo repetido');
  });

  test('el estudio sigue respaldando las brechas que el módulo fija', () => {
    // El módulo no inventa: cada brecha tiene que aparecer en el informe del que
    // salió. Sin esto, `detector.ts` podría decir cualquier cosa y los tests de
    // arriba pasarían comparándolo consigo mismo.
    const texto = ESTUDIO();
    const ausentes = JUECES.filter((j) => !texto.includes(coma(j.brechaMinima).replace('-', '−')))
      .map((j) => `${j.modelo}: ${coma(j.brechaMinima)}`);
    assert.deepEqual(ausentes, [], 'estas brechas no están en eval/RESULTADOS-MODELOS.md');
  });

  test('el umbral de zona máquina está escrito donde se usa', () => {
    assert.match(README(), new RegExp(`por debajo de ${UMBRAL_MAQUINA_EUROLLM} es zona máquina`, 'u'));
  });
});

describe('la asíntota es la razón de que el loop tenga tope', () => {
  test('las ganancias del módulo son las de la tabla del estudio', () => {
    const texto = ESCENARIOS();
    const ausentes = PASADAS.filter((p) => p.ganancia !== null)
      .filter((p) => !texto.includes(coma(p.ganancia as number).replace('-', '−')))
      .map((p) => `${p.escenario}: ${coma(p.ganancia as number)}`);
    assert.deepEqual(ausentes, [], 'estas ganancias no están en escenarios/RESULTADOS.md');
  });

  test('cada escenario del módulo existe en el disco', () => {
    // Un escenario que se renombra deja la cifra hablando de una carpeta que no
    // está, y eso no lo nota ningún gate de números.
    const sinCarpeta = PASADAS.filter((p) => huella(`escenarios/${p.escenario}/cuerpo.txt`) === null)
      .map((p) => p.escenario);
    assert.deepEqual(sinCarpeta, []);
  });

  test('la regla de la mitad aplicada a los deltas da el techo declarado', () => {
    // El techo no es una opinión: sale de aplicar la regla a los números. Si
    // alguien cambia un delta o la fracción, esto dice que el techo dejó de
    // seguirse de la evidencia en vez de dejarlo escrito como si nada.
    const ganancias = PASADAS.filter((p) => p.ganancia !== null).map((p) => p.ganancia as number);
    let dirigidas = 0;
    // La primera ganancia es la de la skill sola, que no es una pasada dirigida:
    // es el punto de comparación de la primera.
    for (let i = 1; i < ganancias.length; i++) {
      const razon = (ganancias[i] as number) / (ganancias[i - 1] as number);
      if (razon <= FRACCION_DE_PARADA) break;
      dirigidas++;
    }
    assert.equal(
      dirigidas,
      DIRIGIDAS.techo,
      'la regla de la mitad ya no da el techo que el módulo declara',
    );
  });

  test('AGENTS.md enseña el mismo tope que el módulo fija', () => {
    // La cifra que un agente va a leer y obedecer. Vivía solo en la prosa y la
    // prosa de este repositorio ya envejeció cinco veces por lo mismo: se
    // escribe una vez y nadie la vuelve a mirar. Va con letra porque la base lo
    // pide para las cantidades bajas, y que vaya con letra no la exime.
    const LETRA: Record<number, string> = { 1: 'una', 2: 'dos', 3: 'tres' };
    const agents = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8').replace(/\s+/gu, ' ');
    const defecto = /\*\*(\p{L}+) pasada dirigida y se cierra\.\*\*/u.exec(agents);
    const techo = /El techo que la evidencia numérica sostiene son (\p{L}+)/u.exec(agents);
    assert.ok(defecto, 'AGENTS.md dejó de enunciar cuántas pasadas dirigidas por defecto');
    assert.ok(techo, 'AGENTS.md dejó de enunciar el techo');
    assert.equal((defecto[1] as string).toLowerCase(), LETRA[DIRIGIDAS.porDefecto]);
    assert.equal((techo[1] as string).toLowerCase(), LETRA[DIRIGIDAS.techo]);
  });

  test('el techo y el valor por defecto no son el mismo número, y eso es a propósito', () => {
    // Si alguien los iguala, se está tirando una de las dos mediciones. La
    // numérica sostiene dos dirigidas; la cualitativa dice una, porque en la
    // iteración de más las reescrituras empezaron a gastar voz. Las dos se
    // hicieron y las dos cuentan.
    assert.ok(DIRIGIDAS.porDefecto < DIRIGIDAS.techo);
    assert.match(ESCENARIOS(), /Goodhart/u);
  });
});

describe('cada cifra trae con qué comprobarla', () => {
  test('las cuatro casillas del contrato, ninguna vacía', () => {
    const incompletas = CIFRAS.flatMap((c) =>
      (['afirmacion', 'regla', 'fuente', 'unidad'] as const)
        .filter((campo) => (c[campo] ?? '').trim() === '')
        .map((campo) => `${c.id}: falta ${campo}`),
    );
    assert.deepEqual(incompletas, []);
  });

  test('la regla es un método y no una intención', () => {
    // El contrato lo dice con todas las letras: «A statement of intent is not a
    // method». Una regla que no nombra el comando que la produce no se puede
    // repetir.
    const sinComando = CIFRAS.filter((c) => !/python \w+\.py/u.test(c.regla)).map((c) => c.id);
    assert.deepEqual(sinComando, [], 'estas reglas no nombran el comando que las produce');
  });

  test('toda cifra dice el día en que se midió', () => {
    const sinFecha = CIFRAS.filter((c) => !/^20\d\d-\d\d-\d\d$/u.test(c.medido)).map((c) => c.id);
    assert.deepEqual(sinFecha, []);
  });

  test('los identificadores no se repiten', () => {
    assert.equal(new Set(CIFRAS.map((c) => c.id)).size, CIFRAS.length);
  });
});
