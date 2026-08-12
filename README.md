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

## Estado conocido

Los tres archivos de `skills/humanizar-espanol` llegaron truncados a mitad de
palabra, sin salto de línea final. No es un problema de la copia: los bytes
coinciden con el origen.

| archivo | bytes | termina en |
|---|---|---|
| `SKILL.md` | 16 403 | «índice de etiquetas » |
| `references/patrones-de-ia.md` | 18 604 | «conectores variados y col» |
| `references/que-preservar.md` | 4 874 | «más variado en su rit» |

Falta, entre otras cosas, la lista de comprobaciones mecánicas del flujo de
trabajo, que empieza en el punto 1 y se corta. Ese final no se ha reconstruido
ni inventado. Hay que recuperarlo del origen antes de trabajar sobre esa skill.
