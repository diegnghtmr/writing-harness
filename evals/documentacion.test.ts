// La documentación es ejecutable, o no es documentación.
//
// `docs.test.ts` vigila las cifras. Esto vigila lo otro que un agente hace con
// estos archivos: copiar un comando y correrlo, o seguir un enlace.
//
// Existe porque el defecto ya ocurrió, aunque fuera del repositorio. Dos scripts
// de la batería de prueba tenían la ruta del verificador escrita como absoluta,
// y quedaron apuntando a la nada en cuanto los repositorios se movieron. La
// batería entera dejó de poder rehacerse y no lo dijo nadie, porque para
// enterarse había que volver a correrla. Un comando que la documentación enseña
// y que no existe es la misma avería con más público.
//
// Y vigila la división entre los dos modos, que es lo primero que un agente lee.
// Usar el arnés no toca ningún archivo del arnés; mejorarlo es otro trabajo con
// otro procedimiento. Si esa división se borra de la portada, un agente que
// venía a escribir un texto termina ablandando la regla que le molesta.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { REPO_ROOT } from '../src/skills.ts';

const DOCUMENTOS = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CLAUDE.md'] as const;

const lee = (nombre: string) => readFileSync(join(REPO_ROOT, nombre), 'utf8');

/**
 * Las rutas de archivo que aparecen dentro de un comando en un bloque `bash`.
 *
 * Se toma el primer argumento que parece un archivo del repositorio, que es lo
 * que se puede comprobar. Los marcadores tipo `<archivo>` y `<ruta>` quedan
 * fuera a propósito: son huecos que el lector rellena, no rutas.
 */
export function comandosDe(texto: string): { linea: string; ruta: string }[] {
  const bloques = [...texto.matchAll(/```bash\n([\s\S]*?)```/gu)].map((m) => m[1] as string);
  const out: { linea: string; ruta: string }[] = [];
  for (const b of bloques) {
    for (const linea of b.split('\n')) {
      // Una línea marcada como de otro repositorio no se puede comprobar contra
      // este disco, y buscarla acá daría un error que parece del arnés. La marca
      // es explícita a propósito: el README enseña un canal de dos repositorios
      // y la mitad de ese canal no vive acá.
      if (/#[^\n]*en otro repositorio/u.test(linea)) continue;
      const limpia = linea.replace(/#.*$/u, '').trim();
      // `python` entró con el detector. Era un agujero del tamaño exacto de lo
      // que se acababa de documentar: la sección que enseña a medir la señal de
      // IA trae dos comandos, y ninguno de los dos lo comprobaba nadie porque el
      // extractor solo miraba los de Node.
      if (!limpia.startsWith('node ') && !limpia.startsWith('python ')) continue;
      const ruta = limpia
        .split(/\s+/u)
        .slice(1)
        .find((a) => /\.(?:ts|mjs|js|py)$/u.test(a) && !a.startsWith('<') && !a.includes('*'));
      if (ruta !== undefined) out.push({ linea: limpia, ruta });
    }
  }
  return out;
}

/** Los enlaces relativos de un documento. Los externos y las anclas no se miran. */
export function enlacesDe(texto: string): string[] {
  return [...texto.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)]
    .map((m) => m[1] as string)
    .filter((h) => !/^(?:https?:|#|mailto:)/u.test(h))
    .map((h) => h.split('#')[0] as string)
    .filter(Boolean);
}

describe('los comandos que la documentación enseña existen', () => {
  test('cada script invocado está en el repositorio', () => {
    const rotos: string[] = [];
    for (const doc of DOCUMENTOS) {
      for (const { linea, ruta } of comandosDe(lee(doc))) {
        if (!existsSync(join(REPO_ROOT, ruta))) rotos.push(`${doc}: ${linea}`);
      }
    }
    assert.deepEqual(rotos, [], 'la documentación enseña comandos que apuntan a un archivo que no está');
  });

  test('se enseña algún comando, o este gate no comprueba nada', () => {
    // Sin esto, borrar todos los bloques de ejemplo dejaría el test en verde.
    const total = DOCUMENTOS.reduce((n, d) => n + comandosDe(lee(d)).length, 0);
    assert.ok(total >= 8, `solo se encontraron ${total} comandos con ruta`);
  });

  test('el extractor caza un comando roto y no se traga uno bueno', () => {
    // El canario. Prueba el extractor, no los archivos.
    const roto = '```bash\nnode scripts/inventado.ts --desde x\n```';
    assert.deepEqual(comandosDe(roto), [
      { linea: 'node scripts/inventado.ts --desde x', ruta: 'scripts/inventado.ts' },
    ]);
    // Un marcador no es una ruta, y un glob tampoco: los dos aparecen de verdad
    // en la documentación y ninguno se puede comprobar contra el disco.
    assert.deepEqual(comandosDe('```bash\nnode src/cli.ts <archivo> --tono <id>\n```'), [
      { linea: 'node src/cli.ts <archivo> --tono <id>', ruta: 'src/cli.ts' },
    ]);
    assert.deepEqual(comandosDe('```bash\nnode --test "evals/*.test.ts"\n```'), []);
    // Los del detector, que son de Python y viven fuera de `src/`.
    assert.deepEqual(comandosDe('```bash\npython detector/score_es.py <archivo>\n```'), [
      { linea: 'python detector/score_es.py <archivo>', ruta: 'detector/score_es.py' },
    ]);
    assert.deepEqual(comandosDe('```bash\npip install torch\n```'), []);
    // Y la marca de otro repositorio se respeta, que es la única puerta de
    // salida de este gate y por eso se prueba.
    assert.deepEqual(
      comandosDe('```bash\nnode scripts/ajeno.mjs > x   # en otro repositorio\n```'),
      [],
    );
  });
});

describe('los enlaces entre documentos no apuntan a la nada', () => {
  test('cada enlace relativo resuelve', () => {
    const rotos: string[] = [];
    for (const doc of DOCUMENTOS) {
      for (const destino of enlacesDe(lee(doc))) {
        if (!existsSync(join(REPO_ROOT, destino))) rotos.push(`${doc} -> ${destino}`);
      }
    }
    assert.deepEqual(rotos, []);
  });

  test('el extractor distingue lo que puede comprobar', () => {
    assert.deepEqual(enlacesDe('[a](AGENTS.md) [b](https://x.com) [c](#seccion) [d](README.md#x)'), [
      'AGENTS.md',
      'README.md',
    ]);
  });
});

describe('los dos modos están declarados donde un agente los va a leer', () => {
  // Es lo primero que se lee al abrir un chat, y es la decisión que ordena todo
  // lo demás. Si se pierde, se pierde en silencio.
  const AGENTS = lee('AGENTS.md');
  const CLAUDE = lee('CLAUDE.md');

  test('AGENTS.md nombra los dos y manda el segundo a su archivo', () => {
    assert.match(AGENTS, /\*\*usar\*\*/u, 'AGENTS.md dejó de nombrar el modo usar');
    assert.match(AGENTS, /\*\*mejorar\*\*/u, 'AGENTS.md dejó de nombrar el modo mejorar');
    assert.match(AGENTS, /\[CONTRIBUTING\.md\]\(CONTRIBUTING\.md\)/u);
  });

  test('AGENTS.md dice qué separa a un modo del otro', () => {
    // Nombrarlos no alcanza. Lo que hace falta es el criterio, porque el error
    // que esto previene es cruzar de modo sin darse cuenta.
    assert.match(AGENTS, /Usar el arnés no modifica\s+ningún archivo del arnés/u);
  });

  test('CLAUDE.md sigue siendo un puntero, y apunta a los dos', () => {
    assert.ok(CLAUDE.length < 500, 'CLAUDE.md creció: una copia se desincroniza, un puntero no');
    assert.match(CLAUDE, /AGENTS\.md/u);
    assert.match(CLAUDE, /CONTRIBUTING\.md/u);
  });

  test('el README manda a los agentes a otro lado', () => {
    // El README explica por qué existe esto y no sirve para trabajar. Sin la
    // advertencia, un agente lo lee entero y no encuentra el procedimiento.
    assert.match(lee('README.md'), /Si sos un agente, no leas este archivo/u);
  });
});

describe('CONTRIBUTING.md cubre lo que dice cubrir', () => {
  const CONTRIBUTING = lee('CONTRIBUTING.md');

  test('trae un procedimiento por cada cosa que se le puede hacer al arnés', () => {
    // La lista sale de lo que este repositorio ya hizo al menos una vez. Si
    // mañana se hace algo nuevo y no queda escrito, la próxima vez se vuelve a
    // descubrir desde cero, que es lo que este archivo vino a evitar.
    for (const seccion of [
      '## Agregar un tono',
      '## Agregar una regla',
      '## Retirar una skill',
      '## Tocar la documentación',
    ]) {
      assert.ok(CONTRIBUTING.includes(seccion), `CONTRIBUTING.md perdió «${seccion}»`);
    }
  });

  /** El cuerpo de una sección `##`, hasta la siguiente. */
  const seccion = (titulo: string): string => {
    const desde = CONTRIBUTING.indexOf(titulo);
    assert.notEqual(desde, -1, `CONTRIBUTING.md perdió «${titulo}»`);
    const hasta = CONTRIBUTING.indexOf('\n## ', desde + titulo.length);
    return CONTRIBUTING.slice(desde, hasta === -1 ? undefined : hasta);
  };

  test('los ocho pasos de agregar un tono siguen siendo ocho', () => {
    // La prosa dice el número y la lista lo tiene; se comparan. Contar los `###`
    // de todo el archivo no servía: las reglas innegociables también van
    // numeradas y daban doce. Un recuento que abarca de más no vigila nada.
    const pasos = [...seccion('## Agregar un tono').matchAll(/^### \d+\. /gmu)].length;
    assert.equal(pasos, 8);
    assert.match(CONTRIBUTING, /Son ocho pasos y siete tienen gate/u);
  });

  test('nombra las cuatro reglas que no se negocian, y son cuatro', () => {
    const reglas = [...seccion('## Lo único que no se negocia').matchAll(/^### \d+\. /gmu)].length;
    assert.equal(reglas, 4);
    assert.match(CONTRIBUTING, /Cuatro reglas\./u);
  });
});
