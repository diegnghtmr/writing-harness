// La tabla de impacto: qué variantes alcanza cada cambio.
//
// Una corrida de un agente tarda minutos y cuesta: Grok tarda unos diez
// minutos y gasta medio dólar por variante. Volver a correr las quince
// variantes por un cambio en un tono gasta catorce corridas que no pueden decir
// nada nuevo, y no volver a correr ninguna deja publicada una matriz que ya no
// describe el arnés. La tabla decide, ruta por ruta, si un cambio alcanza a
// todas las variantes, a una sola, solo al juicio o a nada. Lo que no clasifica
// va a todas: equivocarse por exceso cuesta dinero, y por defecto deja una
// variante sin probar.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { clasificar, IMPACTO, lineasDelImpacto, planDeImpacto, type Cambio } from '../scripts/prueba-final/impacto.ts';
import { variantes } from '../scripts/prueba-final/variantes.ts';

const delArnes = (ruta: string) => clasificar({ origen: 'arnes', ruta });
const ids = (vs: readonly { id: string }[]) => vs.map((v) => v.id);
/** El motivo de la fila de un patrón: un cambio clasificado por ella lo lleva tal cual. */
const motivoDe = (patron: string) => IMPACTO.find((f) => f.patron === patron)?.motivo;
/** Si un motivo es el de alguna fila, y no el de un último recurso. */
const deUnaFila = (motivo: string) => IMPACTO.some((f) => f.motivo === motivo);

describe('la tabla de impacto', () => {
  test('cada fila declara su efecto y su motivo', () => {
    assert.ok(IMPACTO.length > 0);
    for (const f of IMPACTO) {
      assert.ok(['todas', 'una', 'reevaluar', 'nada'].includes(f.efecto), f.patron);
      assert.ok(f.motivo.trim().length >= 20, `${f.patron}: el motivo no explica nada`);
    }
  });

  test('la base, la entrada, el verificador y las instrucciones del arnés alcanzan a todas', () => {
    for (const ruta of [
      'skills/spanish-writing/SKILL.md',
      'skills/spanish-writing/references/anglicismos.md',
      'skills/redactar-espanol/SKILL.md',
      'src/check.ts',
      'src/rules.ts',
      'AGENTS.md',
      'CLAUDE.md',
    ]) {
      const c = delArnes(ruta);
      assert.equal(c.efecto, 'todas', ruta);
      assert.equal(c.variante, null, ruta);
      assert.ok(deUnaFila(c.motivo), `${ruta} cae en una fila de la tabla, no en un último recurso: ${c.motivo}`);
    }
  });

  test('spanish-writing termina en -writing y sigue siendo la base, no un tono', () => {
    // Si la fila de los tonos fuera antes, la base caería en ella y, sin una
    // variante con ese nombre, en el último recurso: el efecto sería el mismo
    // y el motivo, otro.
    assert.equal(delArnes('skills/spanish-writing/SKILL.md').motivo, motivoDe('skills/spanish-writing/**'));
  });

  test('las instrucciones de mix y base.docx alcanzan a todas', () => {
    for (const c of [
      clasificar({ origen: 'mix', ruta: 'AGENTS.md' }),
      clasificar({ origen: 'mix', ruta: 'CLAUDE.md' }),
      clasificar({ origen: 'carpeta', ruta: 'base.docx' }),
    ]) {
      assert.equal(c.efecto, 'todas', c.ruta);
      assert.ok(deUnaFila(c.motivo), c.ruta);
    }
  });

  test('lo del ejecutor que da forma a la corrida alcanza a todas', () => {
    for (const nombre of ['prompts', 'copia', 'agentes', 'reales', 'proceso', 'resolver', 'ejecutor', 'variantes', 'docx', 'fragmento']) {
      const c = delArnes(`scripts/prueba-final/${nombre}.ts`);
      assert.equal(c.efecto, 'todas', nombre);
      assert.ok(deUnaFila(c.motivo), nombre);
    }
    assert.equal(delArnes('scripts/prueba-final.ts').efecto, 'todas');
  });

  test('la skill de un tono alcanza solo a la variante de ese tono, en cada tono del registro', () => {
    const tonos = variantes().filter((v) => v.clase === 'tono');
    assert.ok(tonos.length > 0);
    for (const v of tonos) {
      for (const ruta of [`skills/${v.skill}/SKILL.md`, `skills/${v.skill}/references/x.md`]) {
        const c = delArnes(ruta);
        assert.equal(c.efecto, 'una', ruta);
        assert.equal(c.variante, v.id, ruta);
      }
    }
  });

  test('la pasada alcanza solo a humanizar', () => {
    const c = delArnes('skills/humanizar-espanol/references/patrones-de-ia.md');
    assert.equal(c.efecto, 'una');
    assert.equal(c.variante, 'humanizar');
  });

  test('lo que solo juzga pide volver a juzgar, sin correr ningún agente', () => {
    for (const nombre of ['comprobaciones', 'anclas', 'transcripcion', 'resumen', 'carpeta', 'reevaluar']) {
      assert.equal(delArnes(`scripts/prueba-final/${nombre}.ts`).efecto, 'reevaluar', nombre);
    }
  });

  test('las pruebas, el README y CONTRIBUTING no alcanzan a ninguna, y dicen por qué', () => {
    for (const ruta of ['evals/reglas.test.ts', 'evals/fixtures/prueba-final/grok-stdout.jsonl', 'evals/registro.ts', 'README.md', 'CONTRIBUTING.md']) {
      const c = delArnes(ruta);
      assert.equal(c.efecto, 'nada', ruta);
      assert.ok(c.motivo.length >= 20, ruta);
    }
  });

  test('lo que la tabla no clasifica va a todas, y lo dice', () => {
    for (const ruta of ['package.json', 'detector/medir.py', 'scripts/instalar.ts', 'scripts/prueba-final/otro.ts', 'skills/README.md']) {
      const c = delArnes(ruta);
      assert.equal(c.efecto, 'todas', ruta);
      assert.match(c.motivo, /no la clasifica/u, ruta);
    }
  });

  test('un tono que ninguna variante declara va a todas, con su nombre en el motivo', () => {
    const c = delArnes('skills/inventado-writing/SKILL.md');
    assert.equal(c.efecto, 'todas');
    assert.match(c.motivo, /inventado-writing/u);
  });

  test('el origen cuenta: el AGENTS.md de la carpeta de la prueba no es el de mix', () => {
    assert.match(clasificar({ origen: 'carpeta', ruta: 'AGENTS.md' }).motivo, /no la clasifica/u);
  });
});

describe('el plan por impacto', () => {
  const cambio = (ruta: string, origen: Cambio['origen'] = 'arnes'): Cambio => ({ origen, ruta });

  test('un cambio en un tono corre solo ese tono', () => {
    const p = planDeImpacto([cambio('skills/camus-writing/SKILL.md')]);
    assert.deepEqual(ids(p.variantes), ['camus']);
    assert.equal(p.reevaluar, false);
  });

  test('dos tonos y la pasada corren esas tres, en el orden del registro', () => {
    const p = planDeImpacto([
      cambio('skills/humanizar-espanol/SKILL.md'),
      cambio('skills/han-writing/SKILL.md'),
      cambio('skills/camus-writing/SKILL.md'),
    ]);
    const orden = ids(variantes()).filter((id) => ['camus', 'han', 'humanizar'].includes(id));
    assert.deepEqual(ids(p.variantes), orden);
  });

  test('un cambio que alcanza a todas gana a los demás', () => {
    const p = planDeImpacto([cambio('skills/camus-writing/SKILL.md'), cambio('base.docx', 'carpeta'), cambio('README.md')]);
    assert.deepEqual(ids(p.variantes), ids(variantes()));
  });

  test('lo que solo juzga no corre ninguna variante y manda a --reevaluar', () => {
    const p = planDeImpacto([cambio('scripts/prueba-final/comprobaciones.ts')]);
    assert.deepEqual(p.variantes, []);
    assert.equal(p.reevaluar, true);
    assert.ok(lineasDelImpacto(p, { desde: 'abc1234', agentes: ['grok'] }).some((l) => l.includes('--reevaluar')));
  });

  test('lo que no cambia el uso se lista igual, con la salida por --variantes', () => {
    const p = planDeImpacto([cambio('README.md')]);
    assert.deepEqual(p.variantes, []);
    const lineas = lineasDelImpacto(p, { desde: 'abc1234', agentes: ['grok'] }).join('\n');
    assert.match(lineas, /README\.md/u);
    assert.match(lineas, /--variantes/u);
  });

  test('las líneas dicen cada ruta con su efecto y su motivo, las variantes y los agentes', () => {
    const p = planDeImpacto([cambio('skills/camus-writing/SKILL.md'), cambio('AGENTS.md', 'mix')]);
    const lineas = lineasDelImpacto(p, { desde: '1c0581d', agentes: ['copilot', 'grok'] }).join('\n');
    assert.match(lineas, /1c0581d/u);
    assert.match(lineas, /skills\/camus-writing\/SKILL\.md/u);
    assert.match(lineas, /AGENTS\.md de mix/u);
    for (const c of p.clasificados) assert.ok(lineas.includes(c.motivo), c.motivo);
    assert.match(lineas, /^Variantes: todas \(\d+\)/mu);
    assert.match(lineas, /^Agentes: copilot, grok\.$/mu);
  });

  test('sin cambios no corre nada, y lo dice', () => {
    const p = planDeImpacto([]);
    assert.deepEqual(p.variantes, []);
    assert.match(lineasDelImpacto(p, { desde: 'abc1234', agentes: ['grok'] }).join('\n'), /[Nn]ingún cambio/u);
  });
});
