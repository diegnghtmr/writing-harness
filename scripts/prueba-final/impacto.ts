// La tabla de impacto: qué variantes alcanza cada cambio.
//
// Una corrida de un agente tarda minutos y cuesta: Grok tarda unos diez
// minutos y gasta medio dólar por variante. Volver a correr las quince
// variantes por un cambio en un tono gasta catorce corridas que no pueden
// decir nada nuevo; no volver a correr ninguna deja publicada una matriz que ya
// no describe el arnés. Esta tabla decide, ruta por ruta, cuál de cuatro
// efectos tiene un cambio:
//
// - todas: lo que lee o recibe toda variante, o lo que decide cómo corre;
// - una: la skill propia de una variante, que solo carga esa variante;
// - reevaluar: lo que solo juzga una corrida ya hecha, que `--reevaluar`
//   vuelve a aplicar sin correr ningún agente;
// - nada: lo que no da forma al uso.
//
// Lo que ninguna fila clasifica va a todas. Equivocarse por exceso gasta
// corridas; por defecto, publica como vigente una variante que nadie probó.
//
// La tabla vive solo aquí. `--afectadas` la usa para elegir qué corre, y el
// resumen para marcar las celdas que un cambio posterior dejó desactualizadas.

import { variantes, type Variante } from './variantes.ts';

export type Efecto = 'todas' | 'una' | 'reevaluar' | 'nada';

/**
 * De dónde es una ruta: del arnés, relativa a su raíz; de mix, las
 * instrucciones que se copian a cada corrida; o de la carpeta de la prueba.
 */
export type Origen = 'arnes' | 'mix' | 'carpeta';

export type Fila = { origen: Origen; patron: string; efecto: Efecto; motivo: string };

/**
 * La tabla. Va en orden y gana la primera fila que coincide: la base termina
 * en `-writing` igual que un tono, y por eso su fila va antes que la de los
 * tonos. En un patrón, `*` es cualquier nombre dentro de un segmento y `/**`
 * al final es la carpeta entera.
 */
export const IMPACTO: readonly Fila[] = [
  // Todas las variantes: lo que lee o recibe el agente en cualquiera de ellas.
  { origen: 'arnes', patron: 'skills/spanish-writing/**', efecto: 'todas', motivo: 'la base normativa rige cada variante, con tono o sin él' },
  { origen: 'arnes', patron: 'skills/redactar-espanol/**', efecto: 'todas', motivo: 'la skill de entrada decide el modo, el tono y la entrega de cada variante' },
  { origen: 'arnes', patron: 'src/**', efecto: 'todas', motivo: 'el verificador mide la salida de cada variante, y el agente lo corre' },
  { origen: 'arnes', patron: 'AGENTS.md', efecto: 'todas', motivo: 'son las instrucciones que lee el agente al entrar al arnés' },
  { origen: 'arnes', patron: 'CLAUDE.md', efecto: 'todas', motivo: 'apunta a las instrucciones que lee el agente al entrar al arnés' },
  { origen: 'mix', patron: 'AGENTS.md', efecto: 'todas', motivo: 'se copia a la carpeta de trabajo de cada corrida, y es lo primero que lee el agente' },
  { origen: 'mix', patron: 'CLAUDE.md', efecto: 'todas', motivo: 'se copia a la carpeta de trabajo de cada corrida, y es lo primero que lee el agente' },
  { origen: 'carpeta', patron: 'base.docx', efecto: 'todas', motivo: 'de ahí sale el texto que recibe cada corrida' },
  // Todas las variantes: lo del ejecutor que da forma a lo que recibe el agente o a cómo corre.
  { origen: 'arnes', patron: 'scripts/prueba-final.ts', efecto: 'todas', motivo: 'el comando arma cada corrida: los agentes, la copia y el límite de tiempo' },
  { origen: 'arnes', patron: 'scripts/prueba-final/prompts.ts', efecto: 'todas', motivo: 'es el pedido que recibe el agente en cada variante' },
  { origen: 'arnes', patron: 'scripts/prueba-final/copia.ts', efecto: 'todas', motivo: 'decide qué hay en la carpeta de trabajo del agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/agentes.ts', efecto: 'todas', motivo: 'decide con qué argumentos se lanza cada agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/reales.ts', efecto: 'todas', motivo: 'decide el entorno de la corrida y qué agente instalado se lanza' },
  { origen: 'arnes', patron: 'scripts/prueba-final/proceso.ts', efecto: 'todas', motivo: 'decide cómo se lanza el proceso del agente y cuándo se corta' },
  { origen: 'arnes', patron: 'scripts/prueba-final/resolver.ts', efecto: 'todas', motivo: 'decide qué ejecutable se lanza por cada agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/ejecutor.ts', efecto: 'todas', motivo: 'arma la carpeta de cada corrida, su prompt y su proyecto de Engram' },
  { origen: 'arnes', patron: 'scripts/prueba-final/variantes.ts', efecto: 'todas', motivo: 'decide qué variantes hay y con qué opciones se mide cada una' },
  { origen: 'arnes', patron: 'scripts/prueba-final/docx.ts', efecto: 'todas', motivo: 'extrae de base.docx el texto que recibe el agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/fragmento.ts', efecto: 'todas', motivo: 'elige qué parte del documento recibe el agente' },
  // Una variante: la skill que solo carga esa variante.
  { origen: 'arnes', patron: 'skills/humanizar-espanol/**', efecto: 'una', motivo: 'la pasada solo la carga la variante humanizar' },
  { origen: 'arnes', patron: 'skills/*-writing/**', efecto: 'una', motivo: 'la skill de un tono solo la carga la variante de ese tono' },
  // Solo reevaluar: lo que juzga una corrida ya hecha, sin cambiar lo que hizo el agente.
  { origen: 'arnes', patron: 'scripts/prueba-final/comprobaciones.ts', efecto: 'reevaluar', motivo: 'juzga la corrida y no cambia lo que hizo el agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/anclas.ts', efecto: 'reevaluar', motivo: 'compara los datos de la entrada con los de la salida, después de la corrida' },
  { origen: 'arnes', patron: 'scripts/prueba-final/transcripcion.ts', efecto: 'reevaluar', motivo: 'lee la sesión que el agente ya dejó escrita' },
  { origen: 'arnes', patron: 'scripts/prueba-final/resumen.ts', efecto: 'reevaluar', motivo: 'arma el resumen con los veredictos ya escritos' },
  { origen: 'arnes', patron: 'scripts/prueba-final/carpeta.ts', efecto: 'reevaluar', motivo: 'publica lo que ya corrió y arma el resumen de la raíz' },
  { origen: 'arnes', patron: 'scripts/prueba-final/reevaluar.ts', efecto: 'reevaluar', motivo: 'vuelve a juzgar lo publicado sin correr ningún agente' },
  { origen: 'arnes', patron: 'scripts/prueba-final/impacto.ts', efecto: 'reevaluar', motivo: 'es esta tabla, que decide qué celda del resumen queda desactualizada' },
  { origen: 'arnes', patron: 'scripts/prueba-final/traza.ts', efecto: 'reevaluar', motivo: 'decide qué celda del resumen queda desactualizada, con lo que anotó cada corrida' },
  // Nada: lo que no da forma al uso.
  { origen: 'arnes', patron: 'scripts/prueba-final/seleccion.ts', efecto: 'nada', motivo: 'elige qué vuelve a correr, y no cambia lo que recibe el agente ni cómo se juzga' },
  { origen: 'arnes', patron: 'scripts/prueba-final/instaladas.ts', efecto: 'nada', motivo: 'comprueba antes de correr que las skills instaladas sean las del repositorio' },
  { origen: 'arnes', patron: 'scripts/prueba-final/errores.ts', efecto: 'nada', motivo: 'es el error de uso del comando, que sale antes de correr nada' },
  { origen: 'arnes', patron: 'evals/**', efecto: 'nada', motivo: 'las pruebas y sus datos vigilan el arnés, pero no dan forma al uso' },
  { origen: 'arnes', patron: 'README.md', efecto: 'nada', motivo: 'es la portada para una persona, y no da forma al uso' },
  { origen: 'arnes', patron: 'CONTRIBUTING.md', efecto: 'nada', motivo: 'es el modo mejorar, y una corrida usa el arnés sin mejorarlo' },
  { origen: 'arnes', patron: 'odd/**', efecto: 'nada', motivo: 'es el documento de la tarea, que queda fuera de la copia de cada corrida' },
];

/** El motivo de lo que ninguna fila clasifica. */
const SIN_CLASIFICAR = 'la tabla no la clasifica, y por seguridad se corre todo';

export type Cambio = {
  origen: Origen;
  ruta: string;
  /** Por qué cuenta como cambio, cuando no es evidente: por ejemplo, una huella que nadie registró. */
  nota?: string;
};

export type Clasificado = Cambio & { efecto: Efecto; variante: string | null; motivo: string };

/** Un patrón de la tabla como expresión regular entera. */
function aRegex(patron: string): RegExp {
  const carpeta = patron.endsWith('/**');
  const cuerpo = (carpeta ? patron.slice(0, -3) : patron).replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '[^/]*');
  return new RegExp(`^${cuerpo}${carpeta ? '/.+' : ''}$`, 'u');
}

const FILAS = IMPACTO.map((f) => ({ ...f, regex: aRegex(f.patron) }));

/** Qué efecto tiene un cambio, con el motivo de su fila. */
export function clasificar(c: Cambio, vs: readonly Variante[] = variantes()): Clasificado {
  const ruta = c.ruta.replace(/\\/gu, '/');
  const fila = FILAS.find((f) => f.origen === c.origen && f.regex.test(ruta));
  if (fila === undefined) return { ...c, efecto: 'todas', variante: null, motivo: SIN_CLASIFICAR };
  if (fila.efecto !== 'una') return { ...c, efecto: fila.efecto, variante: null, motivo: fila.motivo };
  // Las filas de una variante están bajo skills/: el segundo segmento es la skill.
  const skill = ruta.split('/')[1] ?? '';
  const v = vs.find((x) => x.skill === skill);
  if (v === undefined) {
    return { ...c, efecto: 'todas', variante: null, motivo: `ninguna variante declara la skill ${skill}, y por seguridad se corre todo` };
  }
  return { ...c, efecto: 'una', variante: v.id, motivo: fila.motivo };
}

/** Si un cambio clasificado manda a correr de nuevo esa variante. */
export const afecta = (c: Clasificado, variante: string): boolean =>
  c.efecto === 'todas' || (c.efecto === 'una' && c.variante === variante);

/** Cómo se nombra un cambio en el plan y en el resumen. */
export const nombreDelCambio = (c: Cambio): string =>
  c.origen === 'arnes' ? c.ruta : c.origen === 'mix' ? `${c.ruta} de mix` : `${c.ruta} de la carpeta`;

export type PlanDeImpacto = {
  clasificados: Clasificado[];
  /** Las variantes que corren, en el orden del registro. */
  variantes: Variante[];
  /** Si algún cambio solo juzga, y lo publicado necesita `--reevaluar`. */
  reevaluar: boolean;
};

export function planDeImpacto(cambios: readonly Cambio[], vs: readonly Variante[] = variantes()): PlanDeImpacto {
  const clasificados = cambios.map((c) => clasificar(c, vs));
  return {
    clasificados,
    variantes: vs.filter((v) => clasificados.some((c) => afecta(c, v.id))),
    reevaluar: clasificados.some((c) => c.efecto === 'reevaluar'),
  };
}

/** El efecto como se imprime: el de una variante lleva su nombre. */
const etiqueta = (c: Clasificado) => (c.efecto === 'una' ? `una (${c.variante})` : c.efecto);

/** El plan como se imprime: cada cambio con su efecto y su motivo, qué corre y quién. */
export function lineasDelImpacto(p: PlanDeImpacto, o: { desde: string; agentes: readonly string[] }): string[] {
  const lineas = [`Cambios desde ${o.desde}, con su efecto según la tabla de impacto:`];
  if (p.clasificados.length === 0) lineas.push('  Ningún cambio.');
  const ancho = Math.max(0, ...p.clasificados.map((c) => etiqueta(c).length));
  for (const c of p.clasificados) {
    lineas.push(`  ${etiqueta(c).padEnd(ancho)}  ${nombreDelCambio(c)}: ${c.motivo}${c.nota ? `; ${c.nota}` : ''}.`);
  }
  lineas.push('');
  const total = variantes().length;
  if (p.variantes.length === 0) lineas.push('Variantes: ninguna. Nada que correr.');
  else if (p.variantes.length === total) lineas.push(`Variantes: todas (${total}).`);
  else lineas.push(`Variantes: ${p.variantes.map((v) => v.id).join(', ')}.`);
  lineas.push(`Agentes: ${o.agentes.join(', ')}.`);
  if (p.reevaluar) {
    lineas.push('Hay cambios que solo juzgan: para aplicarlos a lo publicado, sin correr ningún agente, --reevaluar.');
  }
  const nada = p.clasificados.filter((c) => c.efecto === 'nada').length;
  if (nada > 0) {
    lineas.push(`${nada === 1 ? 'Un cambio no corre' : `${nada} cambios no corren`} nada; para correr igual alguna variante, --variantes <lista> --agregar.`);
  }
  return lineas;
}
