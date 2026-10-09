---
name: humanizar-espanol
description: >
  Humaniza textos en español neutro académico: reescribe prosa de apariencia
  automática (generada por IA o demasiado uniforme) para que recupere la firma
  natural de un autor humano (variación de ritmo, imprevisibilidad léxica
  controlada, concreción y cohesión orgánica) sin perder el rigor ni la
  corrección de la RAE y la ASALE. Disparar ÚNICAMENTE cuando el usuario lo pida
  de forma explícita con fórmulas como «humaniza este texto», «hazlo más
  humano», «dale un estilo humano», «que suene a persona», «quita el tono
  robótico», «que no parezca escrito por IA» o «que no parezca de ChatGPT». NO
  disparar en peticiones generales de redacción, corrección, traducción o mejora
  de estilo sin mención explícita de lo humano: para esas tareas se usa
  «redactar-espanol».
metadata:
  author: diegnghtmr
  version: "1.0"
---

# Humanizar textos en español neutro académico

**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora:
esta pasada corre sobre sus reglas y nunca las sustituye.
Si «redactar-espanol» no está cargada, se carga también: ella decide si hay
tono y cómo se entrega el texto.
Después se leen enteras sus dos referencias, antes de tocar el texto:
`references/patrones-de-ia.md`, el catálogo con que empieza el flujo de la
sección 6, y `references/que-preservar.md`, que decide qué no se corrige. Esta
skill sin ellas es un resumen, y con un resumen no se identifica cada patrón.

Tu tarea es reescribir un texto para que deje de parecer producido por una
máquina y recupere las marcas de la escritura humana, sin alterar lo que el
texto dice. El registro de destino es el español neutro académico: culto,
preciso, impersonal en lo esencial, pero con el ritmo, la concreción y los
pequeños quiebres que distinguen a un autor real de un generador de texto.

Esta skill hereda y reorganiza las estrategias de dos fuentes: el catálogo de
«señales de escritura de IA» de la guía de Wikipedia (WikiProject AI Cleanup) y
las técnicas de humanización académica para hablantes no nativos. Todo se ha
adaptado al español; muchas señales de IA son distintas en inglés y en español,
de modo que el catálogo de referencia recoge las formas hispanas concretas.


## 1. Cuándo se activa esta skill

Actívala solo cuando el usuario pida de manera explícita humanizar un texto o
darle un estilo humano. Las formulaciones típicas son «humaniza esto», «hazlo
más humano», «que suene a persona», «que no parezca de IA» o «quita el tono
robótico». Si la petición es de redacción general, corrección ortográfica,
traducción o mejora de estilo sin mención de lo «humano», esta skill no
interviene: cede el paso a «redactar-espanol», que decide si corresponde un
tono.


## 2. Integridad y expectativas realistas

Conviene ser honesto con el usuario sobre dos cosas, porque cambian lo que esta
skill promete.

Primero, el propósito legítimo es mejorar la calidad y la naturalidad de un
texto que expresa las ideas propias del autor, no fabricar un engaño. Humanizar
sirve para que un trabajo bien pensado se lea como lo que es: obra de una
persona que escribe bien. No sirve para hacer pasar por propio un contenido que
el autor no entiende.

Segundo, ningún procedimiento garantiza «burlar» a un detector. Los sistemas
recientes, Turnitin entre ellos, ya marcan como «parafraseado por IA» el texto
retocado por humanizadores automáticos, así que el truco mecánico de cambiar
palabras es contraproducente. La única humanización robusta es la que mejora de
verdad la prosa, porque entonces no queda artificio que detectar. Y conviene
recordar que esos detectores son falibles: producen falsos positivos con
frecuencia, sobre todo con hablantes no nativos y con textos muy pulidos, hasta
el punto de que la literatura académica recomienda tratarlos como señal de
alerta para una conversación, nunca como prueba concluyente.

Tercero, la reescritura puramente estilística tiene un techo, y conviene decirlo
sin rodeos. Reordenar el ritmo y limpiar los tells puede bajar bastante el
veredicto de un detector, pero el contenido y su predecibilidad siguen ahí: si
el texto dice lo más esperable sobre el tema, con las palabras más esperables,
ningún reacomodo de comas lo vuelve indistinguible de un humano. En la práctica,
una buena reescritura formal suele mover la aguja desde un veredicto alto hasta
una zona intermedia, y ahí se estanca. Romper ese techo exige lo que solo el
autor posee: un ejemplo concreto, una fuente real, una digresión propia, un
matiz que nazca de haber pensado el asunto. Esa es la parte que el humanizador
acompaña, pero no puede fabricar sin inventar, y inventar es a la vez un tell y
una falta.


## 3. Por qué la IA «suena» a IA

Para humanizar con criterio conviene saber qué delata al texto automático. Los
detectores no leen el sentido; miden patrones estadísticos. Tres señales
concentran casi todo su juicio, y las tres orientan la reescritura.

La perplejidad mide cuán predecible es cada palabra dada las anteriores. El
modelo tiende a elegir la continuación más probable, y eso produce texto
demasiado «esperable». La prosa humana escoge a veces la palabra menos obvia
pero más exacta, da un giro inesperado, rompe la línea recta de lo previsible.

La variabilidad de ráfaga, o burstiness, mide la oscilación en la longitud y la
estructura de las oraciones. Quien escribe a mano alterna frases breves con
frases largas y cambia el ritmo; la máquina produce oraciones de longitud pareja
y transiciones intercambiables.

El reconocimiento de patrones aprendidos cubre el resto: fórmulas de apertura y
cierre, conectores genéricos, estructuras de tres elementos, paralelismos
perfectos y un repertorio de palabras que el texto automático repite sin
descanso. El detector las conoce de memoria, y el lector atento también.

De aquí se sigue la lógica de toda la skill: subir la perplejidad y la
variabilidad sin volver el texto incorrecto ni confuso, y borrar las fórmulas
que delatan al generador.


## 4. Las estrategias centrales

Estas operaciones resuelven la mayor parte del trabajo. Las dos primeras
corresponden a las dos magnitudes que mide el detector, y conviene atender a las
dos: variar el ritmo sube la variabilidad de ráfaga, pero si no se sube también
la perplejidad léxica el texto se estanca en torno a dos tercios de probabilidad
de IA, como mostró la prueba real que motivó esta versión. El catálogo detallado
de patrones está en `references/patrones-de-ia.md`, con ejemplos de antes y
después. Léelo entero antes de reescribir, siempre: el flujo de la sección 6
empieza por identificar en el texto cada patrón que recoge, y eso no se hace de
memoria.

La primera es variar el ritmo, y es la estrategia decisiva. También es el punto
donde esta skill se aparta de «camus-writing», porque aquí no buscamos la
frase telegráfica y uniforme al estilo de Camus: una sucesión de oraciones
cortas e iguales es tan mecánica como una sucesión de largas e iguales. Lo
humano es el contraste. La base normativa «spanish-writing» no entra en este
conflicto: no dice nada sobre longitudes.

Atención al error más frecuente y al que más penaliza el detector: la cadena de
oraciones cortas y declarativas, cada una cerrada con punto y construida como un
remate o una sentencia. Es el patrón que un autor lee como «prosa literaria» y
que un detector lee como texto de IA, porque la perplejidad cae y la
variabilidad de ráfaga se aplana. Esa es, además, la queja típica del lector
humano: «hay demasiados puntos seguidos». La regla práctica es no encadenar más
de dos oraciones cortas: en cuanto aparezcan tres o más seguidas, funde la
mayoría en una o dos oraciones más largas mediante subordinación o coordinación,
y deja suelta solo una breve para el contraste. El problema nunca es tener una
frase corta; es tenerlas en racimo.

Para fundir esas frases usa conectores variados y, de preferencia, colocados
dentro de la oración, no siempre al inicio: «porque», «ya que», «de modo que»,
«aunque», «pero», «mientras que», «pues», «si bien», «de ahí que», «como». Así
se gana cohesión sin caer en el «Además, / Asimismo, / Por otro lado,» mecánico
que la IA pone al arranque de cada oración. La meta es alternar de verdad:
oraciones breves de seis a diez palabras junto a oraciones largas de veinticinco
o más, con la longitud de los párrafos también variada. Léelo en voz alta: si
suena a metrónomo, o si cuentas muchos puntos seguidos en pocas líneas, todavía
no está humanizado.

La segunda es subir la perplejidad léxica, y es la palanca decisiva que el ritmo
por sí solo no mueve. Si cada palabra sigue siendo la más previsible para el
tema, el detector mantiene su veredicto aunque las frases ya varíen de longitud.
La operación consiste en rehuir la colocación más probable y elegir la palabra
exacta aunque sea la menos esperada. Donde la IA encadena «marcados por la
exclusión», «reproducir la dominación» o «condiciones de equidad», busca la
formulación que usaría un autor concreto y que el modelo no predeciría: un verbo
menos genérico, un sustantivo más específico, un giro propio. No se trata de
rebuscar sinónimos raros ni de forzar rarezas, sino de quebrar la cadena de
términos centrales y previsibles que delata al generador. Es la operación más
difícil de fingir, porque exige decir las cosas con voz, no con la media
estadística del idioma.

Un matiz que la documentación de GPTZero deja explícito y que conviene
aprovechar: la perplejidad se calcula por oración (qué tan probable es que una IA
eligiera exactamente esas palabras), y la variabilidad de ráfaga mide cuánto
varía esa perplejidad a lo largo del texto, porque los modelos escriben con un
nivel de «IA-idad» muy constante. De ahí se sigue el error que estanca a un texto
ya reescrito en torno al 50 %: subir la perplejidad de forma uniforme, dejándolo
todo igual de pulido o igual de literario, vuelve a ser constante, solo que en
otro nivel. Lo que el detector lee como humano es la varianza. Haz convivir, a
propósito, oraciones llanas y factuales, de perplejidad baja, con oraciones muy
particulares e idiosincrásicas, de perplejidad alta; el contraste entre ambas es
la señal, más que el promedio. Y desconfía de la primera metáfora o el primer
ejemplo que se te ocurra para el tema, porque suele ser el más previsible y, por
esperable, puntúa como IA: para «multiculturalismo», la imagen del «mosaico»;
para «identidad», la «esencia fija que se construye en la relación». Cámbialos
por una figura o un caso menos transitados, o por un dato concreto.

La tercera es anclar en lo concreto y verificable, y el caso real deja una
lección incómoda. No basta con nombrar: el texto que falló citaba a Catherine
Walsh y a Fidel Tubino, y aun así el detector marcó esas frases como las más
sospechosas, porque el nombre iba suelto, sin obra, sin año, sin un concepto en
los términos propios de los autores, sin un país ni un caso. Esa media
concreción es justamente lo que produce un modelo. El ancla que sube la
perplejidad y delata a una persona es el dato específico y comprobable: un año,
el título de una obra, el término exacto que acuñó el autor, un país, una
política, una cifra. Aquí hay un choque con la regla de no añadir información, y
se resuelve así: el humanizador no inventa datos ni citas, porque una cita falsa
es a la vez un tell (ver el patrón de relleno especulativo) y una falta
académica. Cuando el texto pide ese anclaje y el original no lo trae, pídeselo
al autor. Sin esos datos propios, la reescritura puramente formal tiene un techo.

La cuarta es romper la simetría y variar la arquitectura. El modelo construye
contrastes perfectamente equilibrados («la funcional promueve…, mientras que la
crítica cuestiona…»; «uno reconoce…, el otro pone en movimiento…») y repite en
cada párrafo el mismo movimiento retórico de tesis, desarrollo y síntesis. Esa
regularidad es una firma. Desequilibra los contrastes: que un miembro sea más
largo que el otro, que uno lleve un ejemplo y el otro no.

Dentro de esta estrategia hay un hábito del modelo que conviene erradicar por su
cuenta, porque es de los que más se repiten: abrir el texto, y después cada
párrafo, con una oración corta y declarativa que funciona como etiqueta del
tema, casi siempre con el verbo «ser» («La sociedad es la estructura», «La
cultura es el significado», «Un ejemplo aclara el contraste»). Esa apertura es
de las que más delatan, por dos motivos. La frase corta con cópula tiene una
perplejidad bajísima, porque es la continuación más previsible; y repetir el
mismo arranque en todos los párrafos es una firma estructural que el detector
reconoce, hasta el punto de que suele marcar en amarillo justo esas primeras
frases. La regla es no abrir con una frase corta de etiqueta, y menos hacerlo de
forma sistemática. Arranca la mayoría de los párrafos en marcha: con una
subordinada, con un dato o un caso concreto, con una oración media o larga que
ya esté metida en el asunto. Reserva la frase breve para el interior del
párrafo, donde crea contraste, no para el umbral, donde crea patrón. La primera
oración del texto entero es la más sensible: que no sea una etiqueta corta.

Y varía también cómo abre cada párrafo: no todos con la afirmación principal,
sino alguno con un caso, alguno con una objeción, alguno con una pregunta o un
dato. La prosa humana es más despareja, también al empezar.

La quinta es desmecanizar la cohesión. La IA enhebra ideas con conectores
genéricos colocados al inicio de cada oración, como si siguiera una plantilla.
Varía los conectores, no repitas «sin embargo» ni «además» en párrafos
contiguos, y recuerda que muchas transiciones pueden ser implícitas: la idea
siguiente retoma un término de la anterior, y eso basta.

La sexta es borrar las firmas del generador. Hay un repertorio de fórmulas que
delatan de inmediato: aperturas de molde («en la actualidad», «a lo largo de la
historia»), cierres anunciados («en conclusión», «en resumen»), andamiaje vacío
(«es importante destacar que», «cabe resaltar que»), inflación de significancia
(«juega un papel crucial», «marca un antes y un después»), lenguaje promocional
(«rico patrimonio», «vibrante», «imponente») y el racimo de palabras que la IA
adora en español. El catálogo las lista todas.

La séptima es modular la voz según el género, y aquí hay un matiz importante para
el español académico. En un texto académico, lo humano no es inyectar opiniones
ni primera persona: la impersonalidad es el registro correcto. Humanizar un
ensayo o una tesis consiste, sobre todo, en el ritmo, la concreción y la
limpieza de tells, no en tutear al lector ni en soltar «yo creo». Reserva la
matización con voz propia («conviene precisar», «hasta cierto punto», una
primera persona del plural discreta para recorrer el argumento) para los géneros
que la admiten, y aplícala con mesura. En cambio, en textos de divulgación o de
opinión, sí cabe más personalidad: ahí la voz, el juicio y el ritmo variado son
parte de lo humano.


## 5. Relación con la base normativa

Esta skill hereda íntegras las reglas de «spanish-writing» y no las repite.
Son obligatorias y nunca se sacrifican en nombre de la «naturalidad».

Humanizar no es introducir errores: un texto «mal escrito a propósito» no
engaña a nadie y arruina el trabajo del autor.

Esta skill no es un tono. Es una pasada que se ejecuta sobre un texto ya
redactado, y solo cuando el usuario la pide de forma explícita. No sustituye
a la skill de tono. Lo único que le está permitido sobrescribir es el ritmo:
si el texto viene de «camus-writing» y trae cadenas de oraciones cortas, esta
pasada puede fundirlas, porque la petición explícita de humanizar es lo que
autoriza ese cambio de criterio.


## 6. Flujo de trabajo

Sigue este ciclo de borrador, auditoría y versión final. Es el procedimiento que
mejor resultado da, porque la primera reescritura casi nunca elimina todos los
tells.

Primero, lee entero `references/patrones-de-ia.md`, después lee el texto e
identifica en él cada patrón del catálogo. Si el usuario aporta una muestra de
su propia escritura, analízala antes de reescribir y ajusta la voz a la suya, no
a una voz genérica.

Segundo, escribe un borrador. Comprueba que se lea con naturalidad en voz alta,
que la longitud de las oraciones varíe de verdad, que prefiera lo concreto a lo
vago y que conserve el registro adecuado.

Tercero, audítalo, y hazlo de forma mecánica, no impresionista. Los tells se
cuelan justo cuando uno se fía del «suena bien», así que no basta con releer:
hay que ejecutar comprobaciones concretas sobre el propio texto, en este orden.

1. Arranques de párrafo. Lee en fila, una tras otra, solo la primera oración de
cada párrafo. Si esa lista suena a índice de etiquetas cortas, y sobre todo si
varias empiezan con el verbo «ser» («La sociedad es…», «La cultura es otra
cosa»), reescribe esos arranques. Regla dura: ningún párrafo abre con una frase
corta y declarativa, y menos en serie; entra siempre en marcha, con una
subordinada, un dato o una oración media que ya desarrolle la idea. La primera
oración del texto entero es la más sensible de todas.

2. Puntos por línea. Si encuentras tres o más oraciones cortas seguidas, funde
la mayoría y deja una suelta para el contraste.

3. El carácter «—». Si aparece usado al modo inglés, elimínalo.

4. Pares simétricos. Marca las antítesis equilibradas («En una… En la otra…»,
«Mirar X… Mirar Y…», «La primera… La segunda…») y desequilibra al menos una:
fúndela en una sola oración o alarga un miembro más que el otro.

5. Colocaciones previsibles. Subraya las tres o cuatro expresiones más esperables
del tema y cámbialas por una formulación con voz o por un dato concreto.

Antes de auditar, lee entero `references/que-preservar.md` para no confundir
prosa humana legítima con señal de IA: la corrección perfecta, el vocabulario
culto o un conector formal aislado no son pruebas de nada, y sobrecorregir
destruye justo lo que hace humano a un texto.

Cuarto, reescribe la versión final atendiendo a todo lo anterior. Solo es
definitiva cuando pasa las cinco comprobaciones del paso anterior, no antes.

Conserva siempre el contenido del original: si el borrador sostiene cinco
párrafos y tres ideas, la versión humanizada sostiene esos mismos cinco párrafos
y esas mismas tres ideas. Cambia la forma, no el fondo.


## 7. Ejemplo de aplicación

Texto original (con firma de IA):

«En la actualidad, la inteligencia artificial está revolucionando múltiples
sectores de manera significativa. Es importante destacar que esta tecnología
ofrece numerosos beneficios. En primer lugar, mejora la eficiencia. En segundo
lugar, reduce los costes. En tercer lugar, permite tomar mejores decisiones. En
conclusión, la inteligencia artificial juega un papel fundamental para el
futuro.»

Texto humanizado:

«Que la inteligencia artificial esté transformando muchos sectores a la vez es,
a estas alturas, difícil de discutir. Lo que ofrece cabe en una frase: hace el
mismo trabajo en menos tiempo, lo abarata y permite decidir mejor. De ahí que el
lugar que ocupe en el futuro vaya a ser central.»

Qué cambió: se eliminó la apertura de molde («en la actualidad») y el cierre
anunciado («en conclusión»); la fórmula «juega un papel fundamental» se cambió
por una afirmación llana del mismo contenido, porque el peso futuro es un dato
del original y se conserva; la enumeración mecánica «en primer lugar… en segundo
lugar…» quedó integrada en una sola oración; el párrafo entra en marcha, con
una subordinada, en lugar de abrir con una etiqueta; y se varió la longitud de
las oraciones. No se agregó ningún dato: las tres ventajas y el peso futuro son
los del original, y nada más.


## 8. Lista de verificación antes de entregar

Antes de entregar el texto humanizado, verifica que se conserva intacto el
contenido del original, sin añadir ni quitar información; que la longitud de las
oraciones varía de verdad, con contraste entre breves y largas, y que también
varía la de los párrafos; que no quedan tres o más oraciones cortas y
declarativas encadenadas (la cadena de «frases-remate» con muchos puntos
seguidos es el tell que más penaliza); que el texto no empieza, ni los párrafos
arrancan en serie, con una frase corta de etiqueta, sobre todo con el verbo
«ser» (tipo «La sociedad es la estructura»); que las palabras no son la
colocación más previsible del tema, sino las de un autor con voz (perplejidad
léxica); que los nombres y datos van anclados en algo verificable (año, obra,
término, país, caso) y no sueltos; que los contrastes no son perfectamente
simétricos ni todos los párrafos abren con la afirmación principal; que ninguna
oración glosa lo que el material ya mostraba; que se eliminaron las aperturas de
molde y los cierres anunciados; que se quitó el andamiaje vacío y la inflación
de significancia; que hay concreción donde el original tenía vaguedad; que los
conectores son variados y no se repiten en párrafos contiguos; que no queda
ninguna raya al modo inglés ni estructura de tres elementos repetida; que se
respetan todas las reglas gramaticales heredadas de «spanish-writing»; que el
registro sigue siendo neutro académico, sin caer ni en lo robótico ni en lo
coloquial; que el texto suena natural leído en voz alta; y que no introdujiste
errores ni sobrecorregiste prosa humana legítima (consulta
`references/que-preservar.md`).


## 9. Formato de entrega

Al humanizar, entrega únicamente la versión final humanizada, sin preámbulos ni
explicaciones, salvo que el usuario pida el detalle de los cambios. Si los pide,
el borrador, los tells detectados y el resumen de cambios van después del texto,
claramente separados. El texto humanizado, por sí solo, es la respuesta.


## Archivos de referencia

`references/patrones-de-ia.md`: catálogo completo de señales de escritura de IA
en español, numeradas y con ejemplos de antes y después. Se lee entero antes de
cada reescritura, porque el primer paso del flujo (sección 6) es identificar sus
patrones en el texto.

`references/que-preservar.md`: guía de falsos positivos (qué NO marcar como IA) y
de señales de escritura humana que conviene preservar. Se lee entero antes de la
auditoría, para no sobrecorregir.


## Fuentes

Para la gramática y la ortografía: la skill «spanish-writing» y, tras ella, la
Ortografía de la lengua española (RAE y ASALE, 2010), la Nueva gramática de la
lengua española (RAE y ASALE, 2009) y el Diccionario panhispánico de dudas. Para
el catálogo de señales de IA: la guía «Signs of AI writing» de Wikipedia
(WikiProject AI Cleanup), adaptada al español. Para la lógica de la detección
automática y sus límites: la investigación sobre el funcionamiento de Turnitin y
otros detectores recopilada por el usuario.
