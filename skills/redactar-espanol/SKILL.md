---
name: redactar-espanol
description: >
  Entrada de las skills de redacción en español. Decide si el pedido es
  redactar o corregir, si corresponde una skill de tono y cuál, y cómo se
  entrega el texto. Carga la base normativa «spanish-writing» y, cuando hay
  tono, la skill de ese tono. No contiene reglas de escritura: viven en la base
  y en cada tono. Úsese siempre que se pida escribir, redactar, reescribir,
  corregir, revisar, mejorar o pulir un texto en español, o traducir uno al
  español, con fórmulas como «redacta un texto», «escribe esto en español»,
  «corrige este texto», «revisa la redacción», «mejora este texto» o «traduce
  este texto al español», y cárguese antes que cualquier otra skill de
  redacción en español, incluida la base: es la que decide qué más se carga.
---

# Entrada: modo, tono y entrega de un texto en español

**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora:
sus reglas rigen todo texto en español, con tono o sin él, y esta skill no
agrega ninguna. Esta skill decide el modo, el tono y la entrega. Elegido el
tono, su skill se carga enseguida, antes de escribir una línea.


## 1. El modo

| Pedido | Modo | Qué rige |
|---|---|---|
| Corregir, revisar, mejorar o pulir un texto que ya existe, o traducir uno al español, sin pedir otro estilo, registro ni tono | Corregir | Solo la base |
| Reescribir un texto, darle un registro o un tono, o escribir uno nuevo | Redactar | La base y exactamente un tono |

Si el pedido no deja claro el modo, se decide por una sola cosa: si el usuario
pidió otra forma para el texto. Si no la pidió, se corrige.

Al corregir no se aplica ningún tono, y no es la ausencia de la que habla la
sección 2: la forma del texto ya la decidió su autor, y la base corrige lo que
está mal sin decidir cómo suena. Traducir un texto al español, sin pedir un
registro para la traducción, es corregir: la forma es de quien lo escribió en
el idioma original.

`humanizar-espanol` es una pasada, no un modo. Se carga además solo cuando el
usuario pide humanizar con esas palabras, y el resto del pedido decide el modo.


## 2. El tono, al redactar

Encima de las reglas de la base se elige exactamente una skill de tono, que
decide la forma y la manera de presentar la información.

| Skill de tono | Cuándo se usa | Voz |
|---|---|---|
| `camus-writing` | Texto de voz impersonal, o que se dirige a alguien sin tuteo ni complicidad: tesis, artículos, ensayos, marcos teóricos, informes, documentación, manuales, comunicaciones institucionales, propuestas, memorandos, cartas y correos formales. Relato de lo que le pasó al propio usuario, en primera persona del singular. Es el último paso de la lista. | Impersonal, económica, oraciones breves. Sin tuteo ni complicidad con quien lee. En el relato propio, primera persona del singular |
| `fonda-writing` | Texto que le explica algo a un lector que no es del oficio, entrando por algo concreto: guiones de video, ensayos didácticos, material de clase, blogs, pódcast. La filosofía y la cultura son de donde salió el corpus, y la misma forma sirve para cualquier asunto que se le pueda contar a alguien sentado enfrente. | Conversacional, interpelación de usted, entrada por algo concreto y glosa constante |
| `catedra-writing` | Exposición que sostiene una tesis contra otra: lecciones magistrales, cursos, análisis sistemáticos de un autor o una doctrina, economía y filosofía política. | Analítica y adversarial, «nosotros» de autor, sin interpelación al lector |
| `han-writing` | Diagnóstico epocal y ensayo filosófico breve, construido por oposición de conceptos. | Aforística, sin dato empírico, capítulo corto |
| `adria-sola-writing` | Texto que le entrega al lector un método para que lo ejecute: guías, manuales de procedimiento, protocolos de estudio y de trabajo, rutinas, cursos. | Oración corta, imperativo sostenido, pasos numerados que terminan en una instrucción |
| `freddy-writing` | Divulgación tecnológica y educativa que busca mover a alguien a actuar. | El mecanismo antes del juicio, cifra repartida, imperativo frecuente |
| `dotcsv-writing` | Divulgación técnica de un mecanismo difícil para público general. | Reducción del problema a su versión mínima, entusiasmo repartido |
| `bettatech-writing` | Fundamentos de informática y computación antes que la receta práctica. | El nombre después del fenómeno, caso de ingeniería en vez de analogía |
| `fonseca-writing` | Texto motivado por un acontecimiento concreto y reciente, que le pone fecha de caducidad: explicadores de noticias, análisis de coyuntura, boletines, hilos informativos. Que el hecho sea internacional o económico es de dónde se midió, no lo que la forma exige. Si el asunto es atemporal, conceptual o académico, corresponde otro tono. | Entrada por el hecho, alternancia brusca de longitud, apodo burlón sostenido |
| `schiavenato-writing` | Texto que le explica a una comunidad algo que la afecta, con un autor que firma lo que afirma: control político, rendiciones de cuentas, denuncias documentadas, derecho explicado a quien no es jurista. El derecho y la gestión pública son el dominio del corpus, y la forma se sostiene con cualquier materia que alguien tenga que explicarle a la gente a la que le toca. | «Ustedes» para lo colectivo y «usted» para el caso individual, definición por negación, imperativo de mirar más cifra |
| `atenas-writing` | Análisis de un personaje de ficción a partir de un concepto que lo nombra. | Conceptual, segunda del plural, corrección de la lectura corriente en la apertura |
| `solitario-writing` | Texto que sostiene una tesis contra quien la niega: ensayo polémico, alegato, réplica, crítica de una disciplina o de una práctica. | Tesis en la primera oración, adversario con turno de palabra, concesión antes de la refutación |
| `triangulacion-writing` | Texto que sostiene cada afirmación con evidencia de más de una clase: informes de investigación, marcos teóricos, metodologías, análisis de resultados, monografías, tesis, trabajos de grado, estados del arte. | Impersonal sin primera persona, oración larga que sostiene dato y consecuencia, la cita conserva la voz de quien habló |

Si el usuario no indica el tono, se recorre la lista siguiente en orden y se
toma la primera que corresponda. Va de lo más estrecho a lo más amplio, porque
un análisis de un personaje es algo más concreto que una divulgación y, al
revés, nunca se elegiría.

1. Si el asunto es un personaje de una obra de ficción, `atenas-writing`.
2. Si la tesis se sostiene contra alguien que la niega y ese alguien tiene
   nombre, `solitario-writing`.
3. Si la tesis se sostiene contra otra doctrina, `catedra-writing`.
4. Si es un diagnóstico de la época por oposición de conceptos, `han-writing`.
5. Si son fundamentos de computación antes que la receta, `bettatech-writing`.
6. Si el lector recibe un método para ejecutarlo sobre sí mismo,
   `adria-sola-writing`.
7. Si explica un mecanismo para mover a alguien a actuar, `freddy-writing`.
8. Si explica un mecanismo técnico a público general, `dotcsv-writing`.
9. Si hay evidencia de más de una clase sobre el mismo asunto y teoría con que
   leerla, `triangulacion-writing`.
10. Si un acontecimiento concreto y reciente motiva el texto y le pone fecha de
    caducidad, `fonseca-writing`.
11. Si el texto le explica a una comunidad algo que la afecta y el autor firma
    lo que afirma, `schiavenato-writing`.
12. Si el texto le explica algo a un lector que no es del oficio, entrando por
    algo concreto, `fonda-writing`.
13. Si el asunto admite voz impersonal, si el texto se dirige a alguien sin
    tuteo ni complicidad, si es el relato de lo que le pasó al propio usuario,
    en primera persona del singular, o en cualquier otro caso, `camus-writing`.

**La lista siempre termina en un tono.** Antes, un género que no encajaba en
ninguna fila dejaba correr la base sola, y eso no es una decisión sino una
ausencia: un texto sin tono no es un texto neutro, es un texto cuya forma no
decidió nadie.

**La lista enruta, no cerca.** Algunas filas nombran el caso donde ese tono se
encuentra casi siempre, que es además el caso que midió su corpus, y otras
piden ya lo que su forma necesita. Ninguna dice qué se puede escribir con esa
forma. Un tono es una forma, y una forma se pide
para cualquier asunto que cumpla su precondición, que cada skill de tono declara
al final de su sección 1. Si el usuario pide un tono, ese tono se aplica y esta
lista no se recorre.


## 3. La entrega

1. Se lee entera la skill del tono elegido, no su resumen; al corregir rige
   solo la base. Se escribe solo con los hechos que el usuario dio o que su
   pedido implica, sin inventar ninguno y sin atenuar los que dio.
2. Se relee el texto oración por oración contra el pedido. Se quita toda
   afirmación que el usuario no hizo y que su pedido no implica: el adjetivo
   que califica lo que el usuario no calificó, la consecuencia que no contó, el
   detalle que no dio. Cada hecho que dio conserva su fuerza: si escribió
   «me engañó», el texto no dice «me sentí engañado».
3. Se mide el texto con el verificador: con el tono elegido, sin tono al
   corregir, y con la pasada de humanizar solo si se pidió.
4. Se corrige y se vuelve a medir hasta que no quede ningún error. Un texto con
   errores no se entrega.
5. Se entrega el texto medido tal cual, en prosa llana y con el formato de
   entrega de la base.
6. Elegido el tono, se dice cuál y por qué en una línea. Si el usuario lo
   nombró, el porqué es su pedido. Si no, es el paso de la lista que lo eligió.
   Si fue el último, la línea dice por qué llegó ahí: porque ningún paso
   anterior correspondía o porque el texto es el relato del propio usuario. La
   línea nunca describe el texto como algo que no es. Una decisión que no se
   puede rebatir no es una decisión. Esa línea va aparte, fuera del texto. Al
   corregir, dice que no se aplicó ningún tono y por qué: la forma es de su
   autor.
7. Cada advertencia que quede se nombra aparte, con el motivo por el que el
   contexto la justifica.

Que el verificador no aparezca en la primera búsqueda no quiere decir que
falte. Si las instrucciones del proyecto dicen cómo dejarlo disponible, se
siguen y después se vuelve a buscar. Si aun así no está, el texto no se mide y
la entrega lo dice en una línea aparte, junto con lo que se intentó. Nunca se
afirma una medición que no corrió.
