# writing-harness

Skills de redacción en español, organizadas en dos capas: una base normativa
y varias skills de tono que se enchufan encima.

El nombre del repositorio es provisional.

## La idea

Las reglas del español no dependen del tono. La forma sí.

Antes, cada skill de tono repetía a mano las reglas de la base en su sección 2.
Eso es herencia por copia y pega: cuando una regla cambia hay que acordarse de
tocar cuatro archivos, y basta con olvidar uno para que dos skills digan cosas
distintas sobre la misma norma. Pasó de verdad con la raya, que estaba prohibida
en una skill, permitida en otra y marcada como señal de IA en una tercera.

Ahora hay un solo lugar donde vive cada regla.

| Capa | Qué decide | Archivo |
|---|---|---|
| **Base normativa** | Qué es correcto en español: gramática RAE, anglicismos, puntuación, mayúsculas, números, léxico prohibido, citas, formato de entrega | `skills/spanish-writing` |
| **Tono** | Cómo suena: longitud de oración y párrafo, persona gramatical, conectores favorecidos, arquitectura del argumento, preguntas retóricas | `skills/camus-writing`, `skills/fonda-writing`, `skills/catedra-writing` |
| **Pasada** | Se ejecuta sobre un texto ya redactado, solo si el usuario la pide | `skills/humanizar-espanol` |

## Regla de precedencia

Una skill de tono puede ampliar o restringir lo que la base deja abierto.
Nunca puede contradecirla.

Si una skill de tono parece autorizar algo que la base prohíbe, gana la
prohibición, y esa skill de tono tiene un defecto que hay que corregir.

## Enrutamiento

`spanish-writing` es el orquestador. Se aplica siempre, y elige exactamente
una skill de tono.

| Tono | Género | Voz |
|---|---|---|
| `camus-writing` | Académico, técnico, formal. Es el tono por defecto. | Impersonal, económica, oraciones breves |
| `fonda-writing` | Divulgación filosófica, humanística, cultural | Conversacional, tuteo al lector |
| `catedra-writing` | Lección magistral, curso, análisis sistemático | Analítica, «nosotros» inclusivo, sin tuteo |

`humanizar-espanol` no es un tono y no compite con esta tabla. Corre después,
y solo cuando se pide.

## Lo que cambió respecto de las skills originales

El commit `fee3700` guarda las cuatro skills tal como llegaron, byte a byte.
Todo lo posterior es diffable contra ese punto.

1. La filosofía Camus salió de `spanish-writing` y se convirtió en
   `camus-writing`, una skill de tono más, hermana de las otras dos. Con ella
   se fueron las longitudes de oración y párrafo, la persona gramatical, la
   variación sintáctica y los dos ítems de la lista de verificación que medían
   longitudes.
2. `fonda-writing`, `catedra-writing` y `humanizar-espanol` dejaron de repetir
   las reglas de la base. Cada una conserva únicamente lo que de verdad le es
   propio: `fonda` mantiene su ampliación sobre el calco deliberado del inglés,
   `catedra` su tolerancia a la oración larga y la repetición pedagógica.
3. La raya y el guion largo quedaron prohibidos en todas las skills, sin
   excepción. La excepción conversacional de `fonda-writing` desapareció, y en
   su lugar quedó el mismo ejemplo resuelto con dos puntos.
4. `spanish-writing` recibió tres reglas que antes solo vivían en el catálogo
   de `humanizar-espanol` y que son normativas, no estilísticas: el andamiaje
   vacío, las aperturas de molde y la mayúscula de título calcada del inglés.

## El verificador

Las skills son prosa que lee un modelo. El verificador es lo que mide si un
texto entregado las cumple. No se importan entre sí: las reglas viven una vez,
como datos, en `src/rules.ts`.

```bash
node src/cli.ts documento.txt --tono camus
```

```bash
node --test "evals/*.test.ts"
```

Cero dependencias. Node 22.6 o superior corre TypeScript y tests sin instalar
nada, sin build y sin conexión.

| Archivo | Qué hace |
|---|---|
| `src/rules.ts` | Las reglas como objetos planos y tipados. La misma decisión que `ChartTheme` en open-slide |
| `src/text.ts` | Segmentador de texto plano. Sin AST, porque el entregable no lleva markdown |
| `src/check.ts` | Aplica las reglas y devuelve hallazgos con línea, columna y arreglo propuesto |
| `src/cli.ts` | Sale con 1 si hay errores, para encadenarlo en un hook o en CI |
| `evals/cobertura.ts` | El registro de qué falta. Generado por medición, no escrito a mano |

### El gate

Cada regla declara qué ítem de checklist de qué skill hace cumplir. El test de
correspondencia falla en las dos direcciones: si una regla apunta a un ítem que
la prosa ya no tiene, y si la prosa declara un ítem que ninguna regla cubre ni
el registro reconoce.

Existe porque el defecto ya ocurrió dos veces. La raya estaba prohibida en una
skill, permitida en otra y marcada como señal de IA en una tercera. Y la
prohibición del punto y coma se perdió entera al reescribir un ítem de
checklist. Las dos veces el error era invisible porque nadie comparaba las dos
representaciones.

### Cobertura declarada

| Estado | Ítems | Qué significa |
|---|---|---|
| cubierto | 2 | Tiene regla y test |
| mecanizable | 29 | Se puede medir, falta construirlo |
| criterio | 25 | Exige juicio sobre el contenido. Ninguna regla lo va a cubrir |
| delegado | 2 | El ítem solo remite a la lista de otra skill |

El techo real del verificador son **31 de 58**, no 58. Los 25 de criterio
incluyen cosas como «¿se conserva toda la información original?» o «¿las
analogías están desarrolladas?», que ningún linter decide. Queda escrito para
no confundir después una cobertura parcial con una completa.

## Procedencia de las skills

Las cuatro skills originales llegaron desde el plugin de skills instalado. Los
tres archivos de `humanizar-espanol` venían truncados a mitad de palabra y sin
salto de línea final, así que se recuperaron desde la bóveda de Obsidian.

Esa bóveda es la misma fuente sin cortar: sus copias de `spanish-writing`,
`fonda-writing` y `catedra-writing` tienen hash idéntico al del plugin, y solo
los tres archivos de `humanizar-espanol` difieren.

| archivo | plugin | Obsidian |
|---|---|---|
| `humanizar-espanol/SKILL.md` | 16 403 B, cortado | 22 502 B, completo |
| `references/patrones-de-ia.md` | 18 604 B, cortado | 25 260 B, completo |
| `references/que-preservar.md` | 4 874 B, cortado | 5 065 B, completo |

Con la recuperación volvieron los puntos 2 a 5 de la auditoría mecánica, el
ejemplo de aplicación, la lista de verificación de entrega, el formato de
entrega y los patrones 33 a 37 del catálogo, que es el bloque de perplejidad
semántica. Nada de ese final se reconstruyó ni se inventó.

La bóveda de Obsidian es de solo lectura para este repositorio. No se modifica.
