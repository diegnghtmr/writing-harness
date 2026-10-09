---
name: camus-writing
description: >
  Skill de tono para español sobrio y formal. Aplica el principio de economía
  expresiva derivado de la prosa de Albert Camus: oraciones cortas y
  declarativas, vocabulario preciso y concreto, contención emocional y
  variación rítmica. Hereda toda la normativa de «spanish-writing». Úsese
  cuando el texto admita voz impersonal, cuando se dirija a alguien sin tuteo
  ni complicidad, como una carta, un correo o una comunicación institucional,
  o cuando sea el relato del propio usuario en primera persona. También cuando
  el usuario pida «tono académico», «tono formal» o «estilo sobrio».
metadata:
  author: diegnghtmr
  version: "1.0"
---

# Skill de tono académico-formal: economía expresiva

**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora:
este tono hereda sus reglas sin repetirlas, y sin ella queda incompleto.
Si «redactar-espanol» no está cargada, se carga también: ella dice cómo se
entrega el texto y, si el usuario no pidió este tono por su nombre, decide
si hay tono y cuál; si decide otro o ninguno, este no se aplica. Elegido el
tono, se dice cuál y por qué en una línea.


## 1. Rol y alcance

Este skill decide la forma y el ritmo de los textos académicos, técnicos y
formales. Se aplica a tesis, artículos, ensayos, marcos teóricos, informes,
documentación, manuales, comunicaciones institucionales, propuestas y
memorandos.

Es el último paso de la lista de «redactar-espanol». Se usa cuando el usuario
no pidió un tono y ningún paso anterior corresponde, y lo que lo decide es la
voz que el texto admite, no el ámbito del pedido. Si el texto no admite ninguna
de las tres voces de la precondición, como un discurso que pide calidez, esta
forma se aplica igual y la línea que anuncia el tono lo dice.

La carta, el correo y la comunicación que se dirigen a alguien caben en esta
forma. El trato es el de la sección 4: sin tuteo y sin buscar complicidad con
quien lee.

Recoge también el texto en que el usuario cuenta lo que le pasó. Ahí la voz es
la primera persona del singular, y la economía se mantiene. El hecho va antes
que el juicio. La emoción se deja inferir de los hechos, y el texto no nombra
ninguna que el usuario no haya nombrado. Ningún adjetivo califica lo que el
usuario no calificó.


**Precondición de forma:** el texto admite una de tres voces. La impersonal, en
tercera persona o en primera del plural. La que se dirige a alguien sin
tutearlo y sin buscar complicidad con él, como la de una carta, un correo o una
comunicación institucional. O la primera persona del singular del relato que el
usuario hace de lo que le pasó.

## 2. Relación con la base normativa

Este skill hereda íntegras las reglas de «spanish-writing» y no las repite.
La base decide qué es correcto en español. Este skill decide cómo suena.

Ninguna regla de este documento levanta una prohibición de la base. En
particular, la raya y el guion largo siguen prohibidos.


## 3. Filosofía estilística: economía expresiva

Albert Camus demostró que la profundidad no exige ornamento. Su prosa se
caracteriza por oraciones cortas y declarativas, vocabulario preciso y
concreto, descripción sensorial meticulosa sin adjetivación excesiva,
distancia emocional que genera impacto mediante la contención y variación
rítmica entre oraciones breves y pasajes más elaborados.

Camus no decora: observa. No explica emociones, las deja inferir de los hechos.
Esa disciplina es el modelo estilístico de este skill. La austeridad léxica no
es pobreza, es precisión.

Ejemplo del estilo (de El extranjero, traducción al español):
«Hoy ha muerto mamá. O quizá ayer. No lo sé.»

Tres oraciones. Ningún adverbio superfluo. Ningún adjetivo. El efecto es
devastador precisamente por su desnudez.

### 3.1. El límite de la economía

La brevedad es un recurso, no una métrica que haya que maximizar. Una sucesión
larga de oraciones cortas e iguales deja de ser contención y pasa a ser
monotonía. El modelo es la variación: la frase breve destaca porque a su
alrededor hay frases que no lo son.

Cuando el usuario pide de forma explícita humanizar un texto, la pasada de
«humanizar-espanol» decide el ritmo y puede fundir cadenas de oraciones cortas.
Esa petición explícita es lo que resuelve el conflicto: quien la hace acepta
ese criterio rítmico por encima de este.


## 4. Voz y registro

### 4.1. Persona gramatical

Tercera persona (preferida) o primera persona del plural (nosotros inclusivo,
aceptable).
El estudio analiza los factores... / Consideramos que los datos...

Evitar primera persona del singular salvo en tres casos: las posiciones autorales
explícitas, el relato que el usuario hace de lo que le pasó, que va entero en
esa persona, y la correspondencia formal que el usuario firma, como una carta o
un correo, donde quien escribe habla en esa persona sin tutear a quien lee.

No se tutea al lector.

### 4.2. Registro

Formal e impersonal. Se prefieren las construcciones impersonales que la base
describe: la pasiva refleja y el impersonal con «se».

No se busca cercanía emocional ni complicidad con el lector. Se busca claridad
y precisión.

### 4.3. Conectores

Se usan los conectores formales del inventario de la base, con variación.
Se evitan los marcadores conversacionales («bueno», «pues», «fíjate»,
«¿te das cuenta?»).


## 5. Estructura del texto

### 5.1. Estructura de párrafos

Un tema por párrafo.
Extensión recomendada: 50 a 100 palabras.
Máximo: 150 palabras en casos excepcionales.
Oración temática preferiblemente al inicio.
Desarrollo con argumentos, datos o ejemplos.
Cierre o transición al párrafo siguiente (opcional, nunca genérico).

### 5.2. Estructura de oraciones

Extensión recomendada: máximo 25 palabras.
Dividir oraciones que superen 30 palabras.
Variar la longitud para mantener ritmo.
Colocar la información nueva al final de la oración (foco informativo).

### 5.3. Variación sintáctica

No comenzar dos oraciones consecutivas con la misma estructura.
Alternar entre oraciones simples, compuestas coordinadas y subordinadas.
Evitar cadenas de subordinadas que dificulten la comprensión.
Mover circunstanciales y complementos para variar el orden oracional.


## 6. Lista de verificación de tono

Se ejecuta después de la lista normativa de la base.

1. ¿Las oraciones no superan las 30 palabras?
2. ¿Los párrafos tienen entre 50 y 150 palabras?
3. ¿Se varía la longitud de las oraciones en lugar de igualarlas?
4. ¿No hay dos oraciones consecutivas con la misma estructura?
5. ¿Se usa tercera persona o primera del plural, o primera del singular si es el relato del propio usuario o la correspondencia formal que él firma, sin tutear al lector?
6. ¿El vocabulario es concreto y sin adjetivación decorativa?
7. ¿La información nueva queda al final de la oración?


## 7. Formato de entrega

Al redactar texto nuevo, entregar el texto solicitado. Si el usuario pide
explicaciones o comentarios sobre decisiones estilísticas, estos van separados
del texto producido.

Al reescribir texto existente, entregar el texto reescrito sin preámbulos ni
explicaciones, salvo que el usuario las solicite. El contenido original se
preserva, solo se modifica la forma.


## 8. Ejemplo de aplicación

La prosa académica no debe ser seca, sino precisa. El modelo enseña que se
puede mantener el interés sin sacrificar rigor.

Antes (prosa sobrecargada):
«Es fundamentalmente importante señalar que la complejidad inherente de este
innovador enfoque revolucionario arroja luz sobre el panorama cambiante de las
dinámicas socioculturales en constante evolución.»

Después (estilo disciplinado):
«Este enfoque modifica la comprensión de las dinámicas socioculturales. Su
aporte radica en tres observaciones concretas.»


## 9. Fuente estilística de referencia

Camus, Albert. El extranjero (traducción de José Ángel Valente). Madrid:
Alianza, 1971. Referencia estilística: prosa directa, económica y sensorial.

La referencia gramatical y ortográfica es la de «spanish-writing».
