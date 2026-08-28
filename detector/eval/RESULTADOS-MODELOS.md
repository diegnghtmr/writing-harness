# Comparación de modelos como detectores (español)

**Fecha:** 27 de agosto de 2026 · GPU: RTX 4050 (6 GB) · Script: `comparar_modelos.py`

## Diseño

Cinco modelos base sin registro, cargados uno por vez, puntuaron los mismos
once textos con el criterio Fast-DetectGPT (curvatura normalizada por
`sqrt(tokens)`) y perplejidad:

- **Humano verificado (3):** prosa académica española anterior a la era LLM
  (Bolívar 2014 y otro artículo de la RMIE 2014, bajados de SciELO) y un
  fragmento de *Niebla* de Unamuno (1914, dominio público).
- **Máquina verificada (5):** tres textos académicos generados por un LLM de
  frontera (Claude, sin humanizar) y dos muestreados a temperatura 1.0 por
  modelos locales (DeepESP y Qwen2.5-1.5B). Cada modelo excluye de su promedio
  el texto que generó él mismo.
- **Escenarios (3):** el cuerpo del artículo en sus tres versiones.

## Resultados

### Separación por curvatura frente a texto de LLM de frontera (los 3 de Claude)

| Modelo | Gap medio vs. humano | Brecha mínima | ¿Separa sin solaparse? |
|---|---|---|---|
| **DeepESP gpt2-spanish-medium (355M)** | **+0,188** | **+0,025** | **Sí** |
| EuroLLM-1.7B | +0,105 | +0,012 | Sí (margen fino) |
| Qwen2.5-0.5B | +0,048 | −0,062 | No |
| Qwen2.5-1.5B | −0,005 | −0,088 | No |
| Salamandra-2b | −0,015 | −0,109 | No |

### Separación por perplejidad frente al mismo set

| Modelo | Ppl humana (rango) | Ppl Claude (rango) | ¿Separa? |
|---|---|---|---|
| DeepESP | 29,6-76,0 | 22,3-36,8 | No (Unamuno se solapa) |
| Qwen2.5-0.5B | 17,7-19,4 | 5,2-6,1 | Sí (3,2×) |
| Qwen2.5-1.5B | 13,2-14,4 | 3,4-4,0 | Sí (3,7×) |
| **EuroLLM-1.7B** | 15,9-17,7 | 3,6-3,9 | **Sí (4,3×)** |
| Salamandra-2b | 13,7-19,0 | 4,2-4,8 | Sí (3,4×) |

### Orden de los tres escenarios (curvatura, más negativo = más humano)

**Los cinco modelos coinciden**: original > solo skill > skill + detector. La
conclusión del experimento de escenarios no depende del juez.

### El artículo frente al piso humano (perplejidad, jueces modernos)

| Juez | Original | Solo skill | Skill + detector | Piso humano |
|---|---|---|---|---|
| Qwen2.5-1.5B | 9,5 (69 %) | 10,9 (80 %) | 11,6 (85 %) | 13,2 |
| EuroLLM-1.7B | 10,9 (66 %) | 12,3 (75 %) | 13,0 (79 %) | 15,9 |
| Salamandra-2b | 11,9 (74 %) | 13,6 (85 %) | 14,3 (89 %) | 13,7 |

El porcentaje indica cuánta perplejidad tiene el artículo respecto de la media
humana de ese juez: la humanización lo acercó al piso humano en todos los
jueces, sin llegar a cruzarlo. Coincide con el techo de contenido ya
diagnosticado: lo que falta no es forma, son los datos propios de los autores.

## Hallazgos

1. **Para el criterio de curvatura, el modelo chico y puramente español gana.**
   DeepESP es el único con separación limpia y holgada frente a texto de LLM de
   frontera. Concuerda con la literatura de Fast-DetectGPT: modelos puntuadores
   pequeños y de distribución estrecha discriminan mejor en zero-shot que los
   grandes multilingües.
2. **Para perplejidad cruda, los modernos ganan.** A Qwen, EuroLLM y Salamandra
   el texto de Claude les resulta 3-4 veces más predecible que la prosa humana,
   con separación perfecta; a DeepESP no le alcanza esa señal sola.
3. **EuroLLM-1.7B es el único que separa por ambas señales**, aunque su margen
   de curvatura es fino.
4. **Punto ciego compartido:** el texto muestreado a temperatura alta desde un
   modelo chico ajeno (gen_qwen15) engaña la curvatura de casi todos los jueces
   (parece «humano» porque no está en los picos de probabilidad del puntuador).
   Es un límite conocido del zero-shot, relevante si el texto a examinar viene
   de parafraseadores automáticos.

## Recomendación

Detector de **dos señales complementarias**:

- **Curvatura con DeepESP** (`score_es.py`, sin cambios): el mejor juez de
  forma, y mantiene la escala de todas las mediciones previas.
- **Perplejidad con EuroLLM-1.7B** como segunda opinión: si un texto en español
  puntúa perplejidad < ~8 con EuroLLM, cae en la zona máquina (los humanos de
  este corpus están en 16-18).

Salamandra-2b y Qwen quedan descargados en la caché de Hugging Face por si se
quieren repetir las pruebas (`comparar_modelos.py` los recorre todos).

## Advertencias

- Corpus chico (3 humanos, 3 máquina de frontera): resultado direccional, no un
  benchmark. Ampliar el corpus cambia los números, difícilmente el patrón.
- DeepESP corrió en fp32 y los demás en bf16; es un confundidor menor que no
  explica las separaciones por perplejidad, pero existe.
- Los textos humanos de SciELO podrían estar en el corpus de entrenamiento de
  los modelos modernos, lo que inflaría su predecibilidad; aun así separaron
  con margen amplio.
