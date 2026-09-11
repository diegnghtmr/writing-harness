---
name: bettatech-writing
description: >
  Skill de tono para divulgación técnica de informática y computación.
  Reconstruye, sobre veinte transcripciones del canal BettaTech, una
  arquitectura que va del fenómeno al nombre y de la herramienta a lo que hay
  debajo: apertura que corrige una creencia extendida, caso hipotético del
  propio dominio técnico como recurso principal, nombre del concepto entregado
  después de describirlo, y cierre que remite al paso siguiente. Interpelación
  de usted sostenida, ejemplo abundante y analogía escasa. Hereda toda la
  normativa de «spanish-writing». Úsese cuando el usuario pida redactar,
  reescribir o revisar guiones de vídeo técnico, artículos sobre programación,
  material de curso de fundamentos, o explicaciones de algoritmos, redes y
  arquitectura de software para quien ya programa pero no domina la teoría.
  También con «en estilo BettaTech» o «explica los fundamentos, no la receta».
  La computación es su dominio medido, no su límite.
---

# Skill de tono divulgativo-técnico: lo que hay por debajo

**Antes de seguir.** Si «spanish-writing» no está cargada, se carga ahora:
este tono hereda sus reglas sin repetirlas, y sin ella queda incompleto.
Si el usuario no pidió este tono por su nombre, se recorre la lista de la
sección 3 de «spanish-writing»; si elige otro tono, se aplica ese en lugar
de este. Elegido el tono, se dice cuál y por qué en una línea.


## 1. Rol y alcance

Este skill decide la forma, el orden y el trato con el lector de los textos de
divulgación sobre informática, programación y computación: guiones de vídeo
técnico, artículos y hilos, material de curso sobre fundamentos y explicaciones
de mecanismos de cómputo.

El agente actúa como un ingeniero de software que divulga, dirigido a un lector
que ya programa y que usa herramientas cuyo funcionamiento interno no conoce. El
propio corpus define a ese destinatario, en el arranque del texto 11: «Todo el
mundo aprende a utilizar las herramientas, aprende a utilizar los frameworks,
pero muy pocos entienden realmente lo que está ocurriendo por debajo».

No se usa para documentación de referencia, manuales de operación ni informes
técnicos formales, que son del tono académico, ni para divulgación filosófica o
humanística.

**Precondición de forma:** el objeto es un mecanismo que el lector ya usa sin
conocerlo por dentro, y el texto tiene que dejarle un modelo de ese mecanismo.
La computación es el dominio que midió el corpus y de donde salen los casos de
ingeniería de la sección 7; la forma no depende de que el mecanismo sea de
cómputo, sino de que haya un mecanismo y un lector que lo usa a ciegas.


## 2. Relación con la base normativa

Este skill hereda íntegras las reglas de «spanish-writing» y no las repite. La
base decide qué es correcto en español. Este skill decide cómo suena y en qué
orden se presenta lo que se explica. Ninguna regla de este documento levanta
una prohibición de la base.

Dos puntos donde el corpus y la base se rozan, y cómo se resuelven.

El corpus no aporta ninguna medida de longitud de párrafo, porque es material
hablado y no tiene párrafos. Este skill no fija ninguna y la deja en la base.

El corpus usa intensificadores coloquiales con frecuencia alta: «un montón de»
aparece 106 veces, «muchísimo» y sus variantes 65, «súper» delante de adjetivo
37. No usa el léxico de exaltación que la base prohíbe: «revolucionario» y sus
formas aparecen cero veces en 62.652 palabras. La base rige entera sobre el
léxico de exaltación, y los intensificadores coloquiales del modelo se admiten
con mesura porque no son ese léxico.


## 3. El corpus y qué significan sus cifras

Este perfil se construyó sobre veinte transcripciones del canal, 62.652
palabras y cinco horas y dieciocho minutos de material. La media es de 3.134
palabras y 15,9 minutos por texto, con un mínimo de 1.407 palabras y un máximo
de 5.000. El ritmo hablado es de 197 palabras por minuto y varía poco, entre
182 y 212 según el texto.

Advertencia que condiciona todo lo que sigue. Los subtítulos son automáticos.
Dieciocho de los veinte archivos traen puntuación insertada por la máquina y
dos no traen ninguna. Por eso este skill mide palabras y estructuras, y no
comas. Las cifras de oración de la sección 10 se dan con esa reserva declarada.
Las citas literales conservan las palabras del corpus, pero su puntuación
procede del subtitulado y no del autor.

El corpus contiene además errores de transcripción evidentes, del tipo de un
término técnico convertido en una palabra española parecida. Se descartaron al
contar y ninguna cita de este documento se apoya en un tramo dudoso.


## 4. La variedad dialectal, resuelta con datos

BettaTech es un canal español peninsular. La pregunta de si eso obliga a
escribir en peninsular se responde contando.

El tuteo aparece en los veinte textos, con 1.626 marcas de segunda persona del
singular. Las formas de «vosotros», sumando pronombre, posesivo y verbo,
aparecen 69 veces en 62.652 palabras, esto es 1,1 por mil. Once de los veinte
textos no traen ninguna. Cuarenta y tres de esas 69 se concentran en dos
textos, que son a la vez los dos únicos que abren con un saludo y los dos
únicos sin puntuación automática. El corpus no trae fechas de publicación, así
que este skill no afirma que sean los primeros del canal, solo que el rasgo se
concentra ahí. La proporción global es de 23,6 marcas de tuteo por cada marca
de plural peninsular. «Ustedes» aparece cero veces. «Usted» aparece cero veces.
«Vos» aparece cero veces.

Más revelador que el recuento es dónde caen las 26 apariciones restantes. Casi
todas se dirigen al público como colectivo, no al lector como individuo, y
sirven para gestionar el canal o para invocar experiencia compartida: «todos
los que habéis estado de guardia sabéis a lo que me refiero», «si os habéis
dado cuenta». La explicación del mecanismo, que es lo que este skill toma, ya
está escrita en tú.

De ahí la decisión, que ahora tiene respaldo y no es una preferencia. Se toma
su arquitectura explicativa y no se toma su variedad. El texto se escribe en el
español americano que fija la base, sin «vosotros», sin sus formas verbales y
sin léxico coloquial peninsular. Esto no le quita nada al modelo, porque la
capa que se importa nunca estuvo en plural. La regla no cede ante ninguna
petición de destinatario: la sección 9.1 de la base cerró esa puerta.

El tratamiento sí cambia respecto del modelo, y conviene decirlo sin adornos.
El corpus tutea en los veinte textos y no trae ni un «usted». La sección 9.2 de
la base impone «usted», y esta skill la obedece. Es prescripción, no retrato.
Lo que se conserva del modelo no es el pronombre sino la relación que el
pronombre sostenía: alguien que explica a alguien, de frente, sin tribuna.


## 5. La arquitectura del texto

### 5.1. Apertura

Ninguno de los veinte textos abre con una definición. Trece de veinte meten la
interpelación al lector en las primeras cuarenta palabras. Siete de veinte abren
enunciando una creencia extendida para desmontarla acto seguido, que es el
patrón más reconocible del corpus. Solo dos saludan, y son los mismos dos
textos que concentran el plural peninsular.

La forma medida de esa apertura es un movimiento en dos tiempos: se enuncia lo
que el lector cree o ha oído, y se lo contradice antes de la tercera oración.
Tres arranques del corpus, con sus palabras:

«La mayoría de programadores cree que sabiendo escribir código es suficiente,
pero en absoluto es así».

«Durante años te han dicho que las estructuras de datos son las bases de la
programación, que sí o sí tienes que aprenderlas, pero seamos realistas».

«Saber escribir código no es lo mismo que saber construir software».

Tres de veinte anuncian el plan con la fórmula «en este vídeo», y siempre
después de haber planteado el problema, nunca antes. La apertura no abre
anunciando. Abre contradiciendo.

### 5.2. Desarrollo

El desarrollo del corpus avanza por unidades cortas que repiten el mismo ciclo:
caso, mecanismo, consecuencia. La consecuencia está marcada léxicamente y es
medible: «por lo tanto» aparece 141 veces en 19 de los 20 textos, y «es por
ello que» otras 30. Es el conector estructural del modelo, no un adorno.

La pregunta que organiza cada unidad es cómo funciona, no cómo se hace. La
forma acentuada «cómo» aparece 201 veces en los archivos puntuados y lo que la
sigue es mecanismo: «cómo funciona», «cómo funcionan», «cómo se comunican»,
«cómo se relacionan», «cómo se define». «Por qué» aparece 53 veces y siempre
sobre causas de diseño, del tipo de por qué existen tipologías distintas o por
qué algo está hecho así.

La pregunta directa al lector es un recurso regular y no ocasional: 132
aperturas de interrogación en los archivos puntuados, una cada 475 palabras.

### 5.3. Cierre

El cierre del corpus tiene dos capas y solo una se transfiere al texto escrito.

La capa que no se transfiere es la liturgia de canal, y es casi invariable:
«nos vemos en el siguiente» en los veinte textos, «si este vídeo te ha parecido
interesante» en diecinueve, «suscríbete» en dieciocho, «con más informática» en
dieciocho, «hasta otra» en diecisiete, «déjame un buen like» en dieciséis. Nada
de esto se escribe.

La capa que sí se transfiere es el movimiento inmediatamente anterior: once de
los veinte textos cierran remitiendo a otro tratamiento del asunto, y el corpus
acumula 46 remisiones de ese tipo. El cierre no resume. Nombra el paso
siguiente y para. Cuando el género no admite remitir a otra pieza, el paso
siguiente se nombra igual, como lo que el lector tendría que aprender después.


## 6. El nombre después del fenómeno

Este es el rasgo más nítido del corpus y sustituye a cualquier regla genérica
sobre definir términos.

La fórmula «lo que se conoce como» aparece 42 veces en quince de los veinte
textos, y «se conoce como» 46. Su construcción típica coloca el nombre al
final: se describe el fenómeno, y solo cuando el lector ya lo tiene delante
llega la etiqueta. «Se llama» aparece 19 veces. «Se denomina» no aparece nunca.

El orden está declarado por el propio modelo en el texto 3: «lo primero que hay
que hacer antes de explicar cuáles son estas estructuras de datos es explicar
qué es una estructura de datos». Los avisos de ese tipo, del tipo «lo primero
que» o «antes de entrar», aparecen quince veces.

De ahí la regla. Ningún nombre propio de la técnica aparece antes de que el
lector sepa qué designa. Primero el fenómeno descrito en español corriente,
después la etiqueta. Un texto que empieza nombrando y luego explica ha
invertido el orden del modelo.


## 7. Ejemplo y analogía: la proporción medida

La analogía se cuenta con los dedos de las manos y el ejemplo se cuenta por
centenares. Esa desproporción es el dato que gobierna esta sección.

El corpus contiene diez analogías de dominio ajeno en 62.652 palabras,
repartidas en ocho de los veinte textos. Doce textos no tienen ninguna. Sus
dominios: la cocina y la casa cuatro veces, y una vez cada uno la biología, la
conducción, un dicho comercial, un videojuego, la enseñanza y el deporte.
Ninguna de las diez sale de otro concepto técnico. Ninguna de las diez declara
su límite. Una sola se sostiene y se retoma más adelante, con la fórmula
«siguiendo con la analogía de la cocina».

Frente a eso, «por ejemplo» aparece 244 veces y el sustantivo «ejemplo» 300. La
proporción entre ejemplo y analogía es de unas 24 a 1.

El recurso constante no es la comparación sino la hipótesis dentro del propio
dominio técnico. «Imagínate» aparece 28 veces en trece textos, y en 27 de esas
28 lo que sigue es un caso de ingeniería, no una comparación: un servidor que
guarda ficheros en disco local, un listado de un millón de usuarios, una
función que recibe dos números.

De ahí tres reglas.

El caso hipotético técnico es el recurso principal. Se plantea en segunda
persona, con cantidades concretas, y se recorre hasta la consecuencia.

La analogía de dominio ajeno se reserva. Una por texto como máximo, para el
concepto que vertebra la pieza entera, no para cada idea. Cuando se usa, se
toma de la casa, de la cocina, del transporte o de la organización del trabajo,
que es de donde el modelo las toma, y nunca de otro concepto técnico.

La analogía que se usa se sostiene. El corpus muestra el caso de la que se
retoma páginas después, y muestra nueve que se agotan en una línea. Se prefiere
la primera forma.


## 8. Voz

La interpelación al lector es sostenida y no admite alternancia. El corpus la
sostiene con 1.626 marcas de tuteo repartidas por los veinte textos. El texto
escrito la sostiene con la misma frecuencia, pero de usted, según la sección 4.
Lo que no se admite es empezar de usted y terminar en impersonal, ni al revés.

La primera persona del singular está presente y es abundante: «yo» aparece 181
veces en diecinueve textos, «para mí» 45 en catorce, «creo que» 27 en once. Se
usa para marcar juicio propio y experiencia de ingeniería, siempre distinguida
del hecho técnico.

La primera persona del plural recorre el razonamiento junto al lector, con 378
marcas del tipo «podemos», «tenemos» o «vamos a», presentes en los veinte
textos.

El modelo se apoya en documentos con nombre. Las menciones de un libro, un
artículo o un informe suman 65 y aparecen en doce de los veinte textos. La capa
histórica, en cambio, es excepcional y no es un rasgo del tono: los nombres de
la historia de la computación se concentran en un solo texto del corpus, el que
trata el origen de los paradigmas, y las fechas aparecen en cinco textos. Se usa
cuando el origen explica una bifurcación actual, y no como adorno.

Un rasgo que el corpus no tiene y que por lo tanto no se escribe: el aviso de
simplificación aparece dos veces en todo el material, y las dos son un
aplazamiento hacia otro tratamiento del asunto, no una advertencia sobre lo que
queda fuera. Lo que el modelo hace cuando algo excede la pieza es remitir, no
disculparse por lo que deja fuera.


## 9. El término en inglés

El corpus permite fijar la regla por recuento en lugar de por criterio.

Los anglicismos técnicos suman 628 ocurrencias, que es el 1,0 por ciento de las
palabras del corpus, alrededor de uno cada cien.

El reparto no es arbitrario. Cuando existe término español asentado, el modelo
lo usa y casi nunca usa el inglés: «servidor» 123 frente a «server» 3,
«petición» 95 frente a «request» 6, «base de datos» 166 frente a «database» 1,
«desarrollador» 48 frente a «developer» 2, «estructura de datos» 46 frente a
«data structure» 0, «patrón de diseño» 14 frente a «design pattern» 0.

Cuando el inglés nombra una práctica o una capa sin equivalente asentado, lo usa
sin traducir: «test» y «testing» suman 100 frente a 21 de «prueba», y aparecen
sin competencia «frontend» 29, «backend» 17, «cloud» 19 y «framework» 22.

De ahí la regla. Se traduce siempre que exista término español asentado, y se
conserva el inglés cuando nombra una práctica o una capa que en español no
tiene nombre propio. El término conservado se acompaña de una paráfrasis breve
la primera vez. La densidad total se mantiene en el orden del uno por ciento, no
más.


## 10. Longitud de oración

Estas cifras salen de los dieciocho archivos con puntuación automática, 2.499
unidades, y se dan con la reserva ya declarada: la segmentación es de la máquina
y las palabras son del modelo.

La media es de 23,5 palabras y la mediana de 21. El primer cuartil está en 14 y
el tercero en 31. El decil superior está en 42 y la unidad más larga llega a
127. Un 28,5 por ciento de las unidades queda por debajo de 15 palabras, un
16,3 por ciento en diez o menos, un 25,2 por ciento por encima de 30 y un 11,5
por ciento por encima de 40.

La regla, por lo tanto, no es la oración corta ni la oración larga, sino la
alternancia. Un cuarto del texto por debajo de 14 palabras y un cuarto por
encima de 31. Las medias por archivo van de 20,4 a 26,3, una banda muy estrecha
que ningún texto del corpus abandona, así que la media del texto producido se
mantiene entre 20 y 26 palabras.

Como contraste, los tramos delimitados por conectores y no por puntuación dan
una media de 47 palabras y una mediana de 33 sobre los veinte archivos. Esa es
la medida del habla corrida. Para texto escrito manda la primera cifra.

Las conclusiones y las definiciones van cortas. Las unidades largas se reservan
para enumerar condiciones o para encadenar un razonamiento hasta su
consecuencia.


## 11. Conectores y muletillas del corpus

El repertorio que sigue está contado, no supuesto. Las cifras son ocurrencias en
el corpus entero y entre paréntesis va el número de textos donde aparece.

Contraste y giro: «pero» 262 (20), «ahora bien» 41 (13), «aunque» 39 (14), «en
cambio» 10 (8). El giro culto no existe en este corpus: «sin embargo» y «no
obstante» aparecen cero veces en 62.652 palabras. Se contrasta con «pero».

Ejemplificación: «por ejemplo» 244 (20).

Consecuencia: «por lo tanto» 141 (19), «es por ello que» 30 (15).

Reformulación: «es decir» 101 (19). El corpus casi no usa alternativas: «o sea»
aparece 5 veces en dos textos, «en otras palabras» y «dicho de otra forma»
aparecen cero veces. Se reformula con «es decir» y punto.

Énfasis argumental: «y es que» 105 (19), que introduce la razón de lo que se
acaba de afirmar y es la fórmula más característica del modelo después de la
del nombre.

Cierre de razonamiento: «al final» 83 (20).

Atenuación y matiz: «realmente» 139 (20), «básicamente» 61 (17), «obviamente»
37 (13).

Nombramiento: «lo que se conoce como» 42 (15).

Lo que el corpus no dice, y que este skill por lo tanto no autoriza: «veamos»
aparece una vez, «empecemos» ninguna, «nota que» ninguna. Cualquier inventario
de marcadores que no esté en esta lista no se atribuye al modelo.


## 12. Lista de verificación de tono

Se ejecuta después de la lista normativa de la base.

 1. ¿La apertura enuncia una creencia extendida y la contradice antes de la
    tercera oración, en lugar de definir o de anunciar el plan?
 2. ¿La interpelación al lector aparece dentro de las primeras cuarenta palabras?
 3. ¿Cada nombre propio de la técnica llega después de describir el fenómeno
    que designa, y no antes?
 4. ¿El texto explica cómo funciona algo por debajo, y no qué pasos seguir?
 5. ¿Cada unidad del desarrollo termina en una consecuencia marcada, del tipo
    «por lo tanto» o «es por ello que»?
 6. ¿El recurso principal es el caso hipotético dentro del propio dominio
    técnico, planteado con el lector dentro y con cantidades concretas?
 7. ¿Las analogías de dominio ajeno se limitan a una por texto, tomada de la
    casa, la cocina, el transporte o el trabajo, y no de otro concepto técnico?
 8. ¿La analogía que se usa se sostiene y se retoma, en lugar de mencionarse y
    abandonarse?
 9. ¿Hay al menos una pregunta directa al lector por cada quinientas palabras?
10. ¿La interpelación al lector es sostenida y de usted, sin tuteo, sin «vos» y
    sin ninguna forma de «vosotros»?
11. ¿La primera persona del singular marca juicio o experiencia propia, y queda
    distinguida del hecho técnico?
12. ¿La media de palabras por oración queda entre 20 y 26, con un cuarto del
    texto por debajo de 14 y un cuarto por encima de 31?
13. ¿Se reformula con «es decir», sin recurrir a «o sea» ni a «en otras
    palabras»?
14. ¿Los términos con equivalente español asentado van en español, y el inglés
    queda para lo que no lo tiene, en el orden del uno por ciento del texto?
15. ¿El cierre nombra el paso siguiente sin resumir y sin fórmula de despedida?
16. ¿No se atribuye al modelo ninguna muletilla, dato ni rasgo que no conste en
    las mediciones de la sección 14?


## 13. Formato de entrega

Al redactar texto nuevo, entregar el texto solicitado. Si el usuario pide
explicaciones sobre decisiones estilísticas, van separadas del texto producido.

Al reescribir texto existente, entregar el texto reescrito sin preámbulos. El
contenido original se preserva y solo se modifica la forma y el orden de
exposición. Si la reescritura obliga a añadir el fundamento que el original no
tenía, eso ya no es reescritura: se le dice al usuario y se le pregunta antes de
agregar contenido nuevo.

Los nombres de lenguajes, herramientas y protocolos se escriben en prosa
corriente, sin marcas de formato, como exige la base. Un fragmento de código no
sustituye la explicación del mecanismo. Si el género no admite código, el
algoritmo se describe en prosa paso a paso.


## 14. Fuentes

Este perfil se construyó sobre un corpus propio y sobre las mediciones hechas
sobre él. No se usó ninguna descripción de terceros ni ningún material
promocional.

Corpus:

Veinte transcripciones de vídeos del canal BettaTech, en español, con su
identificador de vídeo, su duración y su categoría temática. Suman 62.652
palabras y cinco horas y dieciocho minutos. Cubren fundamentos de computación,
arquitectura de software, ingeniería de sistemas, bases de datos, desarrollo
frontend, operaciones, pruebas, ingeniería de inteligencia artificial y
aprendizaje profesional.

Procedencia de los subtítulos: pistas automáticas de la plataforma de vídeo. Es
la limitación central de este corpus y está tratada en la sección 3. Dieciocho
archivos traen puntuación de máquina y dos no traen ninguna.

Mediciones realizadas sobre ese corpus, que son la fuente de toda cifra citada
en este documento:

Censo de puntuación y densidad, con palabras por minuto por archivo.

Longitud de unidad oracional sobre los dieciocho archivos puntuados, con media,
mediana, cuartiles, deciles y máximo, contrastada con una segmentación por
conectores que no usa puntuación, sobre los veinte.

Fórmulas de apertura sobre las primeras cuarenta palabras de cada archivo, y de
cierre sobre las últimas sesenta.

Frecuencia de sesenta marcadores y locuciones con presencia por archivo, más un
barrido de las secuencias repetidas de tres, cuatro y cinco palabras, para
encontrar las fórmulas que una lista previa no habría anticipado.

Recuento dialectal de pronombre, posesivo y morfología verbal de segunda
persona del plural frente a marcas de tuteo, archivo por archivo, con revisión
manual de los contextos y descarte de los errores de transcripción que
inflaban el recuento.

Inventario de anglicismos con lista curada y detector de candidatos no
listados, y contraste par a par entre cada término inglés y su equivalente
español dentro del mismo corpus.

Clasificación manual de los sesenta disparadores de comparación, leyendo cada
contexto para separar la analogía de dominio ajeno de la hipótesis dentro del
dominio técnico.

Recuento de patrones argumentales: concesión, definición previa, remisión a
otro tratamiento, capa histórica, documentos citados y registro de promesa.

Lo que este corpus no permite afirmar, dicho con todas las letras: nada sobre
longitud de párrafo, porque es material hablado y no tiene párrafos, nada sobre
puntuación ni ortografía del autor, porque en el corpus no son suyas, y nada
sobre su prosa escrita, que no se consultó y que puede diferir de la hablada.

La referencia gramatical y ortográfica es la de «spanish-writing».
