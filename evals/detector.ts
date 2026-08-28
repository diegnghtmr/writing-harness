// Las cifras del detector local, en un solo sitio y con qué las hace comprobables.
//
// El detector vive fuera del verificador y corre en otra máquina, con otro
// lenguaje y otros modelos. Nada de esto lo puede regenerar el CI: hacen falta
// PyTorch, dos modelos descargados y una tarjeta. Así que su gate es el mismo
// que el del corpus borrado. No se recalcula, se fija: las cifras quedan acá
// con su fuente pegada por sha256, y los documentos que las citan se comparan
// contra este archivo en vez de contra la memoria de quien los escribió.
//
// El defecto que esto cierra ya tiene nombre en este repositorio. `AGENTS.md`
// llegó a decir 95 declaraciones cuando había 282, y el README afirmaba una
// cobertura de dos versiones antes. Una cifra que no comprueba nadie envejece
// sola, y estas van a envejecer más rápido que ninguna: el día que alguien
// cambie un juez, cambian todas a la vez.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../src/skills.ts';

export const DETECTOR_DIR = join(REPO_ROOT, 'detector');

/** Una cifra del detector con las cuatro casillas del contrato de evidencia. */
export type Cifra = {
  /** Clave estable. */
  id: string;
  /** Qué se afirma, en las palabras que lee quien lo lea. */
  afirmacion: string;
  /** Cómo se produjo. Un comando, o una regla lo bastante precisa para repetirla. */
  regla: string;
  /** De qué se produjo. Los archivos están fijados por contenido más abajo. */
  fuente: string;
  unidad: string;
  valor: number;
  /** La fecha de la medición, no la de la última vez que se leyó este archivo. */
  medido: string;
};

/**
 * Qué juez se usa para qué señal.
 *
 * No es una preferencia y por eso lleva su evidencia al lado: `brechaMinima` es
 * la distancia entre el peor texto máquina y el mejor texto humano de la
 * comparación. En negativo significa que hay prosa humana puntuando como
 * máquina, es decir que ese modelo no separa por esa señal por mucho que su
 * promedio parezca bueno. Es la columna que decide, no `gapMedio`.
 */
export type Juez = {
  modelo: string;
  /** Para qué señal se eligió, o `null` si el estudio lo descartó. */
  senal: 'curvatura' | 'perplejidad' | null;
  gapMedio: number;
  brechaMinima: number;
};

export const JUECES: readonly Juez[] = [
  { modelo: 'DeepESP/gpt2-spanish-medium', senal: 'curvatura', gapMedio: 0.188, brechaMinima: 0.025 },
  { modelo: 'utter-project/EuroLLM-1.7B', senal: 'perplejidad', gapMedio: 0.105, brechaMinima: 0.012 },
  { modelo: 'Qwen/Qwen2.5-0.5B', senal: null, gapMedio: 0.048, brechaMinima: -0.062 },
  { modelo: 'Qwen/Qwen2.5-1.5B', senal: null, gapMedio: -0.005, brechaMinima: -0.088 },
  { modelo: 'BSC-LT/salamandra-2b', senal: null, gapMedio: -0.015, brechaMinima: -0.109 },
];

export const ELEGIDOS = JUECES.filter((j) => j.senal !== null);
export const DESCARTADOS = JUECES.filter((j) => j.senal === null);

/**
 * La ganancia de cada pasada, medida en curvatura normalizada del cuerpo.
 *
 * Cinco escenarios del mismo documento. El primero es el original y por eso no
 * tiene ganancia; los otros cuatro dicen cuánto movió la aguja el paso que los
 * produjo.
 */
export type Pasada = {
  escenario: string;
  /** Curvatura normalizada del cuerpo completo. Más negativa, más humano. */
  deepesp: number;
  /** Ganancia respecto del escenario anterior. `null` en el original. */
  ganancia: number | null;
};

export const PASADAS: readonly Pasada[] = [
  { escenario: '1-original', deepesp: -0.189, ganancia: null },
  { escenario: '2-solo-skill', deepesp: -0.222, ganancia: -0.033 },
  { escenario: '3-skill-mas-detector', deepesp: -0.241, ganancia: -0.019 },
  { escenario: '4-skill-detector-iter2', deepesp: -0.255, ganancia: -0.014 },
  { escenario: '5-skill-detector-iter3', deepesp: -0.260, ganancia: -0.004 },
];

/**
 * Cuántas pasadas dirigidas admite el loop, y por qué son dos números y no uno.
 *
 * Acá hay una tensión real entre las dos mitades del estudio, y se deja escrita
 * en vez de resolverse a favor de la que convenga.
 *
 * La regla mecánica es parar cuando una pasada rinde menos de la mitad que la
 * anterior. Aplicada a los deltas medidos, la segunda dirigida rinde el 74 % de
 * la primera y la tercera el 29 %: el número deja pasar **dos** dirigidas y
 * corta en la tercera.
 *
 * La conclusión en prosa del mismo estudio dice **una**, y no por los deltas.
 * Dice que en la iteración de más las reescrituras empezaron a gastar voz, con
 * léxico cada vez más ensayístico para un artículo académico, y que iterar
 * contra la métrica produce el parafraseo uniforme que los detectores marcan.
 * Eso es Goodhart y ninguna curvatura lo mide.
 *
 * Se codifican los dos. `porDefecto` es lo que hay que hacer; `techo` es lo
 * máximo que la evidencia numérica sostiene, para quien tenga un motivo y lo
 * diga. Colapsarlos en un solo número obligaría a tirar una de las dos
 * mediciones, y las dos se hicieron.
 */
export const DIRIGIDAS = { porDefecto: 1, techo: 2 } as const;

/** Debajo de esta proporción de la ganancia anterior, la pasada siguiente es ruido. */
export const FRACCION_DE_PARADA = 0.5;

/** Perplejidad EuroLLM por debajo de la cual el texto cae en zona máquina. */
export const UMBRAL_MAQUINA_EUROLLM = 8;

export const CIFRAS: readonly Cifra[] = [
  {
    id: 'curvatura-separa-deepesp',
    afirmacion: 'DeepESP separa humano de máquina por curvatura sin que los rangos se solapen',
    regla: 'python comparar_modelos.py; brecha mínima entre el peor texto máquina y el mejor humano, en curvatura normalizada por sqrt(tokens)',
    fuente: 'detector/eval/humano (3 textos) y detector/eval/maquina (3 de LLM de frontera)',
    unidad: 'curvatura normalizada',
    valor: 0.025,
    medido: '2026-08-27',
  },
  {
    id: 'perplejidad-separa-eurollm',
    afirmacion: 'EuroLLM encuentra el texto máquina 4,3 veces más predecible que el humano',
    regla: 'python comparar_modelos.py; cociente entre la perplejidad media humana y la media de los tres textos de LLM de frontera',
    fuente: 'detector/eval/humano y detector/eval/maquina',
    unidad: 'veces',
    valor: 4.3,
    medido: '2026-08-27',
  },
  {
    id: 'asintota-tercera-dirigida',
    afirmacion: 'La tercera pasada dirigida rinde menos de un tercio que la anterior',
    regla: 'python score_es.py sobre el cuerpo de los cinco escenarios; ganancia de curvatura normalizada de cada paso respecto del anterior',
    fuente: 'detector/escenarios/*/cuerpo.txt',
    unidad: 'curvatura normalizada',
    valor: -0.004,
    medido: '2026-08-27',
  },
];

/**
 * Los textos de los que salieron las cifras, fijados por contenido.
 *
 * El contrato de evidencia pide que una fuente que puede desaparecer se
 * identifique por su contenido y no por su nombre. Estos cinco pueden: son las
 * versiones de un artículo que sigue editándose fuera de este repositorio, y el
 * día que alguien copie encima una versión nueva con el mismo nombre, las
 * cifras de arriba pasarían a describir un texto que ya no está sin que nada
 * avisara.
 */
export const FUENTES: Record<string, string> = {
  'escenarios/1-original/cuerpo.txt':
    'c7afe8a58fcd8529b84ec1ec18f5e0b2d39699c31e3952a1b8d33751e8b43d3c',
  'escenarios/2-solo-skill/cuerpo.txt':
    '8605120d5f51bfeed00e813eecf953da048edd4ee6c13dc19f19cb2176f92ec2',
  'escenarios/3-skill-mas-detector/cuerpo.txt':
    '693269a5c0c4ea7f2cca7a47924eea17bdf1ed8958900643009f5696aa6b5ac4',
  'escenarios/4-skill-detector-iter2/cuerpo.txt':
    'bb5b4a95ac9149d554305dc0134fef8caf050a8dbdd654ca36f64ac0c09f54af',
  'escenarios/5-skill-detector-iter3/cuerpo.txt':
    'b0b364e321487646aa71b183db3eedd3cecbcfc97d1e1da5f59aa0002ed86079',
};

/** El sha256 de un archivo del detector, o `null` si la herramienta no está. */
export function huella(relativo: string): string | null {
  const p = join(DETECTOR_DIR, relativo);
  if (!existsSync(p)) return null;
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/** El detector es opcional: puede no estar, y eso no es un fallo. */
export const HAY_DETECTOR = existsSync(join(DETECTOR_DIR, 'score_es.py'));

/** Un documento del detector, con los espacios aplanados para leer una afirmación partida. */
export function documento(relativo: string): string {
  return readFileSync(join(DETECTOR_DIR, relativo), 'utf8').replace(/\s+/gu, ' ');
}
