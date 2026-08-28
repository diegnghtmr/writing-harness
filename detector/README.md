# Detector local de texto generado por IA (español)

Implementación local del criterio Fast-DetectGPT (Bao et al., ICLR 2024, variante
analítica sin muestreo) con modelos base en español. No depende de ningún servicio
web y el texto nunca sale de esta máquina.

Es una herramienta opcional del arnés y corre por fuera de él. Nada de `src/` la
importa, la suite no la invoca nunca y el arnés sigue siendo Node sin
dependencias. Quien no la instale pierde esta medición y nada más.


## El mapa de jueces

Dos señales y dos modelos distintos, y cuál va en cada punto no es una preferencia:
sale de comparar cinco candidatos sobre un corpus etiquetado. El estudio completo,
con los números y sus advertencias, está en
[`eval/RESULTADOS-MODELOS.md`](eval/RESULTADOS-MODELOS.md).

| Punto del trabajo | Señal | Juez | Por qué ese |
|---|---|---|---|
| Medir un texto entero, antes y después | curvatura | `DeepESP/gpt2-spanish-medium` (355M) | El único con separación holgada y sin solape frente a texto de LLM de frontera: gap medio +0,188 y brecha mínima +0,025. Además sostiene la escala de todas las mediciones anteriores |
| Elegir qué párrafos reescribir | curvatura normalizada | `DeepESP/gpt2-spanish-medium` | Mismo juez, dividido por `sqrt(tokens)` para que párrafos de distinta longitud se puedan comparar entre sí |
| Segunda opinión cuando la curvatura queda en duda | perplejidad | `utter-project/EuroLLM-1.7B` | Separa 4,3×, la mejor de las cinco: máquina 3,6-3,9 contra humano 15,9-17,7. Umbral práctico: por debajo de 8 es zona máquina |
| Decidir si un bloque se toca o se deja llano | las dos | los dos, en ensamble | Cada juez ve lo que el otro no. El ensamble fue lo que mantuvo el bloque de método fuera de la reescritura |
| Revalidar a los jueces, o probar uno nuevo | las dos | `comparar_modelos.py` sobre `eval/` | Recorre los cinco candidatos sobre el mismo corpus etiquetado |

Y las dos combinaciones que el estudio descartó, que importan tanto como las que
eligió:

- **Perplejidad con DeepESP, no.** Humano 29,6-76,0 contra máquina 22,3-36,8: se
  solapan, y el fragmento de Unamuno cae dentro del rango máquina.
- **Curvatura con Qwen2.5 o Salamandra-2b, no.** Sus brechas mínimas son
  negativas (−0,062, −0,088, −0,109), es decir que hay textos humanos puntuando
  como máquina. Concuerda con la literatura de Fast-DetectGPT: para curvatura, un
  puntuador chico y de distribución estrecha discrimina mejor en zero-shot que un
  multilingüe grande.

EuroLLM es el único de los cinco que separa por las dos señales a la vez, y por
eso es el segundo juez y no otro.


## Instalación

El entorno no está versionado, porque son 9,8 GB de los que 22 archivos son
nuestros. Se reconstruye:

```bash
python -m venv .venv
.venv/Scripts/pip install torch transformers huggingface_hub tokenizers
```

Los modelos se descargan solos la primera vez, a la caché de Hugging Face.
DeepESP son 355M y basta para `score_es.py` y `diagnostico.py`; EuroLLM-1.7B solo
hace falta para la segunda opinión y para `comparar_modelos.py`.

Corre en GPU si la hay y en CPU también, que con este tamaño de modelo alcanza.


## Uso

```bash
.venv/Scripts/python score_es.py escenarios/1-original/cuerpo.txt escenarios/2-solo-skill/cuerpo.txt
.venv/Scripts/python diagnostico.py escenarios/2-solo-skill/cuerpo.txt 12
.venv/Scripts/python comparar_modelos.py
```

`score_es.py` acepta cualquier lista de archivos `.txt` en UTF-8 y da una fila por
archivo. `diagnostico.py` toma uno solo y un tope opcional, y devuelve sus párrafos
ordenados del más máquina al más humano.


## Cómo se leen los números

- **Curvatura.** Cuanto más alta, más se parece el texto a lo que el modelo
  generaría. Cuanto más negativa, más humano. El polo máquina está en torno a
  +6,2; la prosa académica humana del corpus, entre −5 y −16 según la longitud.
- **Curvatura normalizada por párrafo.** Valores cercanos a 0 son zona de
  sospecha. En el documento de trabajo el peor párrafo original puntuaba −0,012 y
  el piso quedó en −0,13 después del loop.
- **Perplejidad.** Cuanto más alta, menos predecible. Con EuroLLM, por debajo de 8
  es zona máquina y los humanos del corpus están entre 15,9 y 17,7.

Tres advertencias que no son formalidades:

1. **Los umbrales absolutos no están calibrados para español.** Se usan de forma
   comparativa: mismo fragmento, antes y después.
2. **La curvatura agregada crece con la longitud.** No se comparan magnitudes
   entre fragmentos de tamaños distintos, solo entre versiones del mismo.
3. **Ningún detector es prueba de autoría**, este incluido. Es una señal
   estadística y se reporta como tal.


## El punto ciego

El texto muestreado a temperatura alta desde un modelo chico ajeno engaña la
curvatura de casi todos los jueces: puntúa como humano por errático. El detector
es fuerte contra salida directa de un LLM de frontera y débil contra
parafraseadores automáticos baratos. Es un límite conocido del zero-shot y está
medido en el estudio, no supuesto.


## Estructura

| Ruta | Qué es |
|---|---|
| `score_es.py` | El puntuador. Misma fórmula que `get_sampling_discrepancy_analytic` del repositorio oficial, agregada por ventanas de 1024 tokens |
| `diagnostico.py` | Puntúa párrafo por párrafo y los ordena. Es la herramienta que dirige la reescritura |
| `comparar_modelos.py` | Compara modelos base como puntuadores sobre el corpus etiquetado |
| `eval/` | El corpus etiquetado que valida a los jueces, y el estudio que salió de él |
| `escenarios/` | Los cinco escenarios de humanización del mismo documento, y sus resultados |

`eval/` es lo único de esta carpeta que no se reconstruye instalando de nuevo.
Son ocho textos elegidos a mano, tres humanos anteriores a la era LLM y cinco de
máquina, y uno de ellos se generó en una sesión que no vuelve. Setenta y seis
kilobytes que valen más que los 9,8 GB que no están.


## Origen

El modelo previsto al principio era `PlanTL-GOB-ES/gpt2-base-bne`, que fue
retirado de Hugging Face. Se usa el de DeepESP en su lugar.

El repositorio oficial de Fast-DetectGPT (MIT) no está clonado acá: son 5,3 GB de
los que 140 KB son código y el resto, resultados del paper. Se consulta en línea
cuando hace falta.
