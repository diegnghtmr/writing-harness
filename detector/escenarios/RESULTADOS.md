# Comparación de tres escenarios de humanización

**Documento:** «Voces que habitan la escuela» (estado del arte, 2020-2025)
**Fecha de medición:** 27 de agosto de 2026

## Escenarios

1. **`1-original/`**: la v2 tal como llegó, sin intervención.
2. **`2-solo-skill/`**: una pasada completa con la skill `humanizar-espanol`
   (48 de 127 párrafos reescritos), sin retroalimentación de ningún detector.
3. **`3-skill-mas-detector/`**: sobre el escenario 2, una única pasada dirigida:
   el detector local puntuó los 55 párrafos del cuerpo uno por uno, se
   reescribieron solo los 10 peor puntuados (P16, P22, P54, P63, P70, P71, P77,
   P85, P100, P101) aplicando las reglas de la skill, y se volvió a medir.

Los escenarios 1 a 3 traen los cuatro fragmentos (`cuerpo`, `seleccion14k`,
`teoria5k`, `casos`), idénticos en alcance entre sí. Los escenarios 4 y 5 traen
solo el cuerpo, que es lo único que el anexo de rendimientos decrecientes midió.

Los `.docx` de cada escenario no están acá: son el mismo texto con formato, se
regeneran desde estos `.txt` y pesan más que todo lo demás junto. La numeración
de párrafos de arriba sale de esos documentos y se conserva como referencia de
dónde se hizo el trabajo, no como algo que se pueda abrir desde este directorio.

## Medición local (Fast-DetectGPT analítico, modelo español)

Curvatura: más negativa = más humano. Referencia del polo máquina (texto
generado por el propio modelo): **curvatura +6,2, perplejidad 12,5**.

| Fragmento | Esc. 1 | Esc. 2 | Esc. 3 |
|---|---|---|---|
| Cuerpo completo | −14,2 | −16,4 | **−17,8** |
| Selección 14k | −10,6 | −12,3 | **−13,3** |
| Teoría 5k | −6,5 | −6,4 | **−7,4** |
| Casos | −4,8 | −6,9 | **−7,2** |

Distancia al polo máquina expresada en porcentaje de mejora respecto del
original (a mayor distancia, más lejos de lo que un modelo generaría):

| Fragmento | Esc. 2 vs. 1 | Esc. 3 vs. 1 |
|---|---|---|
| Cuerpo completo | +10,5 % | **+17,7 %** |
| Selección 14k | +10,2 % | **+16,0 %** |
| Teoría 5k | −1,1 % (estancado) | **+6,4 %** |
| Casos | +18,9 % | **+21,8 %** |

Perplejidad (cambio porcentual respecto del original; más alta = menos
predecible):

| Fragmento | Esc. 1 | Esc. 2 | Esc. 3 |
|---|---|---|---|
| Cuerpo completo | 60,7 | +17,5 % | **+24,2 %** |
| Selección 14k | 60,5 | +15,2 % | **+22,3 %** |
| Teoría 5k | 55,3 | +11,9 % | **+21,9 %** |
| Casos | 62,5 | +23,8 % | **+24,8 %** |

## Puntajes de detectores web (solo como referencia externa)

| Detector · fragmento | Esc. 1 | Esc. 2 | Esc. 3 |
|---|---|---|---|
| ZeroGPT · selección 14k | 3 % IA (3 oraciones marcadas) | 0 % IA | pendiente* |
| Smodin · teoría 5k | 87 % AI-Generated | 75 % | pendiente* |
| Smodin · casos | 95 % AI-Generated | 76 % | pendiente* |

\* Los límites gratuitos diarios de ambos sitios se agotaron durante la sesión
(Smodin dejó de responder tras 4 análisis anónimos; ZeroGPT, tras 2). Los
archivos del escenario 3 quedan listos en `3-skill-mas-detector/` para pegarlos
manualmente otro día: `seleccion14k.txt` en ZeroGPT (límite 15 000 caracteres)
y `teoria5k.txt` / `casos.txt` en Smodin.

## Verificación interna de la pasada dirigida

- El párrafo peor puntuado del escenario 2 (la pregunta por la agencia,
  curvatura normalizada −0,012, casi en el polo máquina) salió por completo del
  ranking de riesgo.
- Ocho de los diez párrafos reescritos abandonaron el top de sospecha; el peor
  valor del documento pasó de −0,012 a −0,075.
- Un caso quedó mixto: P77 mejoró en perplejidad (51,6 → 60,6) pero no en
  curvatura normalizada (−0,099 → −0,080).
- El detector detectó además un párrafo que la pasada de la skill había dejado
  sin tocar (P100, «Los resultados señalan la pertinencia…»), que era el segundo
  más marcado del documento. Ese hallazgo es el aporte diferencial del loop.

## Lecturas y advertencias

1. La skill sola ya mueve el resultado (+10 a +19 % de distancia al polo
   máquina; −12 a −19 puntos en Smodin), pero deja estancado el marco teórico.
2. La pasada dirigida por el detector destraba justamente ese fragmento
   (−1,1 % → +6,4 %) y mejora todo lo demás con solo 10 párrafos tocados.
3. El loop se cierra aquí: una pasada dirigida, no más. Iterar contra la
   métrica produce el parafraseo uniforme que los detectores marcan
   (Goodhart). Lo que queda de señal en el marco teórico es de contenido, no
   de forma, y solo baja con los datos que aportan los autores (recuentos de
   la matriz de 60 artículos, vacancias documentadas, el campo del Quindío).
4. La curvatura agregada escala con la longitud: comparar solo entre versiones
   del mismo fragmento. Ningún puntaje, local o web, es prueba de autoría.

## Anexo: escenarios 4 y 5 (prueba de rendimientos decrecientes)

Para responder si iterar más veces con un ensamble de jueces (curvatura DeepESP
más perplejidad EuroLLM-1.7B) produce «el mejor» resultado, se corrieron dos
iteraciones dirigidas adicionales sobre el escenario 3 (10 y 7 párrafos
reescritos; el bloque de método quedó fuera a propósito, porque los párrafos de
datos deben ser llanos). Curvatura normalizada del cuerpo completo y ganancia
de cada paso:

| Escenario | DeepESP (delta) | EuroLLM (delta) | Ppl EuroLLM |
|---|---|---|---|
| 1 original | −0,189 | +0,051 | 10,9 |
| 2 solo skill | −0,222 (−0,033) | +0,027 (−0,024) | 12,3 |
| 3 skill + detector | −0,241 (−0,019) | +0,013 (−0,014) | 13,0 |
| 4 iteración 2 | −0,255 (−0,014) | +0,009 (−0,004) | 13,9 |
| 5 iteración 3 | −0,260 (−0,004) | +0,008 (−0,001) | 14,3 |

La ganancia de cada iteración cae a la mitad o menos que la anterior; la
quinta ya es ruido, y la perplejidad sigue por debajo del piso humano de
EuroLLM (15,9). Costo cualitativo: en la iteración 5 las reescrituras
empezaron a gastar voz (léxico cada vez más ensayístico para un artículo
académico) y un párrafo se dejó sin tocar deliberadamente para no churnear la
pregunta de investigación. Conclusión: el ensamble de jueces sí mejora el
diagnóstico (evitó tocar el método y detectó lo que cada juez ve mejor), pero
iterar más allá de una pasada dirigida no produce el mejor resultado: produce
la asíntota. El único movimiento restante con ganancia real son los datos
de los autores.
