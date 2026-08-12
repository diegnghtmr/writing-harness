---
name: spanish-writing
description: >
  Base normativa y orquestador de las skills de redacción en español.
  Contiene las reglas que rigen todo texto en español, sin importar el tono:
  normas de la RAE, la Nueva gramática de la lengua española (2009), la
  Ortografía de la lengua española (2010) y el Diccionario panhispánico de
  dudas. Cubre corrección gramatical, puntuación, mayúsculas, números,
  anglicismos, léxico prohibido, citas y formato de entrega. Enruta hacia la
  skill de tono que corresponda, sea el registro general de camus-writing o
  una de las que reconstruyen la forma de exponer de un autor concreto.
  Úsese siempre que se redacte, reescriba, corrija o revise un texto en
  español.
---

# Base normativa del español y enrutamiento de tono


## 1. Rol y alcance

Este skill define las reglas que se aplican a todo texto en español que el agente
produzca o reescriba, sin importar el género ni el tono. Es la base. Ninguna
otra skill de redacción la sustituye.

El agente actúa como corrector y redactor profesional especializado en español
latinoamericano. Su función es producir prosa impecable en gramática,
ortografía, coherencia y cohesión, con estilo propio del español y sin
estructuras calcadas del inglés.

Lo que este skill NO decide: la longitud de las oraciones y los párrafos, la
persona gramatical, el uso de preguntas retóricas, la arquitectura del
argumento y el grado de cercanía con el lector. Todo eso lo decide la skill de
tono. Ver la sección 3.


## 2. Principio fundamental

El objetivo al reescribir es mejorar la gramática, la cohesión y el estilo SIN
añadir, inventar ni eliminar información. El contenido original se preserva
intacto. Solo se modifica la forma, nunca el fondo.

Al redactar texto nuevo, se aplican las mismas normas gramaticales, con la
libertad creativa que el contexto permita.


## 3. Enrutamiento de tono

Este skill es el orquestador. Las reglas de las secciones 4 a 13 se aplican
siempre. Encima de ellas se elige exactamente una skill de tono, que decide la
forma y la manera de presentar la información.

| Skill de tono | Cuándo se usa | Voz |
|---|---|---|
| `camus-writing` | Textos académicos, técnicos y formales: tesis, artículos, ensayos, marcos teóricos, informes, documentación, manuales, comunicaciones institucionales, propuestas, memorandos. Es el tono por defecto. | Impersonal, económica, oraciones breves |
| `fonda-writing` | Divulgación filosófica, humanística o cultural: guiones de video, ensayos didácticos, material de clase, blogs, pódcast. | Conversacional, interpelación de usted, entrada por algo concreto y glosa constante |
| `catedra-writing` | Exposición que sostiene una tesis contra otra: lecciones magistrales, cursos, análisis sistemáticos de un autor o una doctrina, economía y filosofía política. | Analítica y adversarial, «nosotros» de autor, sin interpelación al lector |
| `han-writing` | Diagnóstico epocal y ensayo filosófico breve, construido por oposición de conceptos. | Aforística, sin dato empírico, capítulo corto |
| `freddy-writing` | Divulgación tecnológica y educativa que busca mover a alguien a actuar. | El mecanismo antes del juicio, cifra repartida, imperativo frecuente |
| `dotcsv-writing` | Divulgación técnica de un mecanismo difícil para público general. | Reducción del problema a su versión mínima, entusiasmo repartido |
| `bettatech-writing` | Fundamentos de informática y computación antes que la receta práctica. | El nombre después del fenómeno, caso de ingeniería en vez de analogía |
| `fonseca-writing` | Actualidad internacional, geopolítica y economía a partir de un hecho reciente. | Entrada por el hecho, alternancia brusca de longitud, apodo burlón sostenido |
| `schiavenato-writing` | Divulgación jurídica y política dirigida a una comunidad. | «Ustedes» para lo colectivo y «usted» para el caso individual, definición por negación, imperativo de mirar más cifra |
| `medicendai-writing` | Análisis largo de una obra de ficción, recorrida en su orden. | Veredicto en el primer cuarto, juicio repartido en U, anclaje en escena recontada |
| `sekkyoku-writing` | Análisis narrativo unidad por unidad de una obra serializada. | Posición propia frente a la obra declarada de entrada, la obra misma como prueba |
| `kenway-writing` | Reseña crítica con sección de opinión marcada al final. | Veredicto global de entrada en esa sección, cierre en positivo, sin nota numérica |
| `atenas-writing` | Análisis de un personaje de ficción a partir de un concepto que lo nombra. | Conceptual, segunda del plural, corrección de la lectura corriente en la apertura |

Si el usuario no indica el tono y el texto es académico, técnico o formal, se
usa `camus-writing`. Si el género no encaja en ninguna fila, se aplica esta
base sola.

Los doce tonos que siguen a `camus-writing` reconstruyen la forma de exponer de
un autor concreto, medida sobre un corpus de transcripciones, y cada uno declara
en su sección de fuentes qué se midió, con qué números y qué no pudo
verificarse. Ninguno toma la variedad dialectal ni el tratamiento de su modelo:
la sección 9.1 y la sección 9.2 ganan siempre, aunque el corpus medido diga otra
cosa, y cada skill dice qué descarta y por qué. Varios de estos autores tutean a
su público y algunos son peninsulares. Eso se mide y se documenta, no se imita.

`humanizar-espanol` no es una skill de tono. Es una pasada que se ejecuta
después, sobre un texto ya redactado, y solo cuando el usuario la pide de forma
explícita. No sustituye a la skill de tono ni a esta base.

### 3.1. Regla de precedencia

Una skill de tono puede ampliar o restringir lo que esta base deja abierto.
Nunca puede contradecirla.

Si una skill de tono parece autorizar algo que las secciones 4 a 13 prohíben,
gana la prohibición, y esa skill de tono tiene un defecto que hay que corregir.
No se resuelve el conflicto en el momento de escribir.

### 3.2. Claridad absoluta (principio RAE)

La Real Academia Española, en la Ortografía de la lengua española (2010) y la
Nueva gramática (2009), establece que la escritura correcta persigue ante todo
la comprensión inequívoca del mensaje. Cada oración transmite una idea. Cada
párrafo desarrolla un argumento. El lector no debe releer para comprender.

Este principio rige en todos los tonos.

### 3.3. Rigor normativo (principio académico)

La escritura académica latinoamericana exige coherencia interna, cohesión entre
párrafos mediante conectores, y respeto estricto de las normas ortográficas y
gramaticales del español. Las fuentes normativas son la RAE y la ASALE, con
atención a las variantes del español americano.


## 4. Reglas gramaticales obligatorias

### 4.1. Haber impersonal: siempre singular

El verbo «haber» en uso impersonal no concuerda con el complemento directo.

Correcto: Había muchas personas. / Hubo problemas. / Ha habido cambios.
Incorrecto: Habían muchas personas. / Hubieron problemas. / Han habido cambios.

Referencia: Nueva gramática de la lengua española (RAE y ASALE, 2009), § 41.6.

### 4.2. Condicional en prótasis: nunca

En las oraciones condicionales, la prótasis (cláusula con «si») no admite
condicional ni condicional compuesto.

Correcto: Si tuviera tiempo, iría. / Si hubiera estudiado, habría aprobado.
Incorrecto: Si tendría tiempo, iría. / Si habría estudiado, habría aprobado.

Referencia: Nueva gramática (RAE y ASALE, 2009), § 23.15 y § 47.8.

### 4.3. Coma entre sujeto y verbo: nunca (salvo inciso)

No se interpone coma entre el sujeto y el predicado, sin importar la extensión
del sujeto.

Correcto: El presidente de la empresa anunció los resultados.
Incorrecto: El presidente de la empresa, anunció los resultados.

Excepción: incisos parentéticos delimitados por dos comas.
Correcto: El presidente, que llegó tarde, anunció los resultados.

Referencia: Ortografía de la lengua española (RAE y ASALE, 2010), § 3.4.2.2.

### 4.4. Signos de interrogación y exclamación: siempre dobles

El español exige signos de apertura (¿ ¡) y cierre (? !) en toda oración
interrogativa o exclamativa. No se coloca punto después del signo de cierre.

Correcto: ¿Cómo estás? / ¡Qué sorpresa!
Incorrecto: Cómo estás? / Que sorpresa!

Referencia: Ortografía (RAE y ASALE, 2010), § 3.4.1.

### 4.5. Gerundio: uso restringido

No usar gerundio de posterioridad. El gerundio expresa simultaneidad o
anterioridad, nunca una acción posterior a la del verbo principal.

Incorrecto: Firmó el decreto, entrando en vigor al día siguiente.
Correcto: Firmó el decreto, que entró en vigor al día siguiente.

No usar gerundio como adjetivo especificativo de sustantivos que no sean de
percepción o representación.

Incorrecto: Un sobre conteniendo documentos.
Correcto: Un sobre que contiene documentos.

Referencia: Nueva gramática (RAE y ASALE, 2009), § 27.3 y § 27.4.

### 4.6. Dequeísmo y queísmo: evitar ambos

Dequeísmo (añadir «de» incorrectamente antes de «que»):
Incorrecto: Pienso de que es correcto.
Correcto: Pienso que es correcto.

Queísmo (omitir «de» cuando el régimen verbal lo exige):
Incorrecto: Me olvidé que tenía clase.
Correcto: Me olvidé de que tenía clase.

Prueba de verificación: sustituir la cláusula subordinada por «eso» o «de eso».
Si la oración funciona con «de eso», se requiere «de que».
«Me olvidé de eso» → «Me olvidé de que tenía clase».
«Pienso eso» → «Pienso que es correcto».

Referencia: Diccionario panhispánico de dudas (RAE y ASALE, 2005), s. v.
«dequeísmo» y «queísmo».

### 4.7. Concordancia verbal con sujetos colectivos

Los sustantivos colectivos en singular (gente, mayoría, grupo, parte) admiten
concordancia en singular o plural, pero se recomienda mantener coherencia a lo
largo del texto.

Aceptable: La mayoría de los estudiantes aprobó el examen.
Aceptable: La mayoría de los estudiantes aprobaron el examen.
Preferible en contexto académico: mantener singular si el colectivo es el núcleo.

Referencia: Nueva gramática (RAE y ASALE, 2009), § 33.8.

### 4.8. Leísmo, laísmo, loísmo

Usar «le» como complemento indirecto y «lo/la» como complemento directo.
El leísmo de persona masculina singular está admitido por la RAE, pero se
recomienda el uso etimológico en textos académicos.

Correcto: Lo vi en la calle. / Le dije la verdad.
Evitar: La dije la verdad (laísmo). / Lo dije la verdad (loísmo).

Referencia: Diccionario panhispánico de dudas (RAE y ASALE, 2005), s. v.
«leísmo», «laísmo», «loísmo».


## 5. Reglas para evitar anglicismos

### 5.1. Voz pasiva perifrástica: limitar

El español prefiere la voz activa y la pasiva refleja. La pasiva perifrástica
(ser + participio) solo se justifica cuando el agente es relevante y se desea
enfatizar.

Anglicado: El estudio fue realizado por los investigadores.
Preferible: Los investigadores realizaron el estudio.
Preferible: Se realizó el estudio.

### 5.2. Posesivos con partes del cuerpo: no usar

En español, las partes del cuerpo se acompañan del artículo definido cuando
el poseedor se identifica por el contexto.

Anglicado: Me duele mi cabeza.
Correcto: Me duele la cabeza.

### 5.3. Pronombres personales innecesarios: omitir

El español es una lengua pro-drop. El pronombre personal sujeto se omite
cuando la desinencia verbal lo identifica.

Anglicado: Yo pienso que esto es correcto.
Correcto: Pienso que esto es correcto.

Excepción: cuando se requiere énfasis, contraste o desambiguación.

### 5.4. Adverbios en «mente» excesivos: reducir

El uso acumulado de adverbios terminados en «mente» produce pesadez. Preferir
construcciones equivalentes.

Anglicado: Completamente terminado exitosamente.
Correcto: Completado con éxito.

Si dos adverbios en «mente» van coordinados, el sufijo se coloca solo en el
segundo: «lenta y cuidadosamente» (no «lentamente y cuidadosamente»).

Referencia: Nueva gramática (RAE y ASALE, 2009), § 7.14.

### 5.5. Calcos semánticos: sustituir

Incorrecto: Hacer sentido. → Correcto: Tener sentido.
Incorrecto: Aplicar para un trabajo. → Correcto: Postularse a un trabajo.
Incorrecto: En orden de lograr. → Correcto: Para lograr. / Con el fin de lograr.
Incorrecto: Evidencia (como prueba). → Preferible: Prueba, dato, indicio.
Incorrecto: Asumir (como suponer). → Correcto: Suponer, presuponer, dar por sentado.
Incorrecto: Reportar (como informar). → Preferible: Informar, notificar.

### 5.6. Construcciones calco

Incorrecto: Ser como (identidad). → «Es como un experto» en lugar de
«Es una especie de experto» o «Actúa como experto».

Incorrecto: Jugar un papel. → Correcto: Desempeñar un papel. /
Cumplir una función.

Incorrecto: Bajo circunstancias. → Correcto: En circunstancias. /
Dadas las circunstancias.


## 6. Reglas de puntuación

### 6.1. Coma

Usos obligatorios:
Separar elementos de una enumeración: perros, gatos y pájaros.
Aislar incisos: El director, que llegó tarde, habló primero.
Después de conectores al inicio de oración: Sin embargo, los datos confirman...
Antes de «pero», «aunque», «sino», «mas».

Prohibiciones:
Nunca entre sujeto y verbo (salvo inciso delimitado por dos comas).
Nunca antes de «y» en enumeraciones simples de dos elementos.

Excepción con «y»:
Cuando los elementos coordinados tienen distinto sujeto:
Juan estudia, y María trabaja.
En enumeraciones complejas con comas internas (coma de Oxford funcional).

### 6.2. Dos puntos

Antes de enumeraciones: Tres factores: clima, suelo y agua.
Antes de citas textuales: El autor afirma: «...»
Después de dos puntos, minúscula (salvo citas directas o nombres propios).

### 6.3. Comillas

Orden de uso según la RAE:
Primer nivel: comillas angulares (latinas) « »
Segundo nivel: comillas inglesas " "
Tercer nivel: comillas simples ' '

Ejemplo: Según el informe, «el autor señala que "la teoría 'X' es correcta"».

Los signos de puntuación van fuera de las comillas de cierre.
Correcto: «Esto es un ejemplo».
Incorrecto: «Esto es un ejemplo.»

Referencia: Ortografía (RAE y ASALE, 2010), § 3.4.8.

### 6.4. Puntos suspensivos

Siempre tres puntos, nunca más ni menos.
Indican interrupción, duda o enumeración incompleta.
Si preceden a una oración, esta comienza con mayúscula:
Llegó tarde... No importó a nadie.

### 6.5. Signos dobles (interrogación, exclamación)

No se coloca punto después del signo de cierre.
Correcto: ¿Vienes? Esperamos tu respuesta.
Incorrecto: ¿Vienes?. Esperamos tu respuesta.

### 6.6. La raya y el guion largo: prohibidos, sin excepción

No se usa la raya (—) ni el guion largo para incisos, en ningún tono y en
ningún género. Tampoco se usan las variantes espaciadas ( — ) ni el doble
guion ( -- ).

Es un calco del inglés y una de las señales más fiables de texto generado.
Sustituir, en este orden de preferencia: un punto y oración nueva, una coma
para un inciso breve, dos puntos para una explicación, paréntesis para un
inciso verdadero, o reestructurar la oración.

Incorrecto: La política —anunciada sin aviso— afecta a miles de trabajadores.
Correcto: La política, anunciada sin aviso, afecta a miles de trabajadores.

Ninguna skill de tono puede levantar esta prohibición. La raya de diálogo en
texto narrativo es el único uso que el español reserva para este signo, y no
aparece en los géneros que estas skills cubren.

### 6.7. El punto y coma: prohibido

No se usa el punto y coma. Se sustituye por un punto y oración nueva, por una
coma cuando la relación entre los miembros es breve, o por dos puntos cuando
el segundo miembro explica al primero.

Incorrecto: La austeridad léxica no es pobreza; es precisión.
Correcto: La austeridad léxica no es pobreza, es precisión.

La RAE admite el punto y coma, así que esta prohibición no es normativa sino
una decisión de casa: el signo separa mal en pantalla, y casi siempre esconde
una oración que debía partirse en dos. Se aplica igual en todos los tonos.


## 7. Mayúsculas y minúsculas

Se escriben con minúscula:
Días de la semana: lunes, martes, miércoles.
Meses: enero, febrero, marzo.
Estaciones: primavera, verano, otoño, invierno.
Gentilicios: español, mexicano, colombiano.
Idiomas: español, inglés, francés.
Disciplinas genéricas: filosofía, matemáticas, ingeniería.
Cargos y títulos: el presidente, la directora, el papa.

Se escriben con mayúscula:
Inicio de oración.
Nombres propios de personas, lugares, instituciones.
Siglas: ONU, RAE, ASALE.
Títulos de obras (solo primera palabra y nombres propios):
Cien años de soledad. / El extranjero.

Mayúscula de respeto: solo cuando el cargo sustituye al nombre propio.
El Papa visitó México. / El papa Francisco visitó México.

En títulos y encabezados no se usa la mayúscula de título del inglés. Solo van
en mayúscula la primera palabra y los nombres propios.
Incorrecto: Negociaciones Estratégicas Y Alianzas Globales
Correcto: Negociaciones estratégicas y alianzas globales

Referencia: Ortografía (RAE y ASALE, 2010), cap. IV.


## 8. Números en el texto

Escribir con letra: del uno al nueve en texto corrido, cantidades redondas
(mil, un millón), al inicio de oración.

Escribir con cifra: a partir de 10, datos estadísticos, fechas (15 de enero
de 2024), porcentajes (25 %), unidades de medida (5 km).

Separador de miles: espacio fino o punto (según convención local). En Colombia
se usa el punto: 1.000, 10.000, 100.000.

Separador decimal: coma. En Colombia: 3,14.

Referencia: Ortografía (RAE y ASALE, 2010), cap. VIII.


## 9. Variedad, tratamiento y construcciones impersonales

### 9.1. Variedad del español: americana, nunca peninsular

Todo texto se escribe en español americano. Queda prohibida la segunda persona
del plural peninsular en cualquiera de sus formas, sin excepción y sin importar
el destinatario:

El pronombre «vosotros» y «vosotras». Los posesivos «vuestro», «vuestra»,
«vuestros» y «vuestras». El pronombre átono «os». Las formas verbales en «áis»,
«éis» e «ís» de segunda del plural: «podéis», «tenéis», «sabéis», «habéis»,
«sois», «estáis», «queréis», «hacéis», «vais», «veis». El imperativo de segunda
del plural: «mirad», «fijaos», «apoyadlo», «dadle», «escribidme».

En su lugar va siempre «ustedes» con verbo en tercera del plural: «pueden»,
«tienen», «saben», «han», «son», «están», «quieren», «hacen», «van», «ven».
El imperativo correspondiente es «miren», «fíjense», «apóyenlo», «denle»,
«escríbanme».

También se descarta el léxico marcadamente peninsular cuando existe una forma
panhispánica: «vale» como muletilla de asentimiento, «coger» con el sentido de
«tomar», «ordenador» por «computador», «móvil» por «celular», «tío» como
vocativo, «guay», «currar», «flipar», «chaval».

Esta regla no admite excepción por destinatario. Un texto dirigido a España se
escribe igual: el español americano se entiende en toda la lengua, y la
alternativa reabre la puerta que esta base cierra.

### 9.2. Tratamiento al lector: «usted» y «ustedes»

Cuando el texto se dirige al lector, el tratamiento es «usted» en singular y
«ustedes» en plural, con el verbo en tercera persona. Quedan prohibidos el tuteo
y el voseo: «tú», «ti», «contigo», «tuyo», «tienes», «puedes», «sabes»,
«fíjate», y también «vos», «sos», «tenés», «podés», «sabés», «fijate»,
«acordate».

Un texto que no interpela al lector cumple esta regla por omisión. La regla no
obliga a dirigirse a nadie: obliga a que, si el texto se dirige a alguien, lo
haga de usted.

Esta es la forma cortés y neutra de la lengua, la que funciona en todos los
países del ámbito hispanohablante sin arrastrar una marca regional. El tuteo
reparte lectores según la costumbre de cada país y el voseo los reparte todavía
más. El «usted» no reparte a nadie.

Una skill de tono puede restringir esto todavía más, por ejemplo prohibiendo
toda interpelación directa y escribiendo en impersonal. Ninguna puede
sustituirlo por tuteo ni por voseo. Si una skill de tono parece autorizarlo,
gana esta prohibición y esa skill tiene un defecto, según la sección 3.1.

### 9.3. Construcciones impersonales

El español dispone de tres construcciones para eliminar el agente. Su forma es
normativa y se describe aquí. Cuál de ellas domina el texto, o si el texto
prefiere la voz personal, lo decide la skill de tono.

Pasiva refleja (el verbo concuerda con el sujeto paciente):
Se analizaron los datos. / Se observa un incremento.

Impersonal con SE (tercera persona singular, sin sujeto):
Se considera necesario actuar. / Se espera que los resultados mejoren.

Construcciones con «haber», «hacer», «ser»:
Hay evidencia suficiente. / Hace años que se estudia el fenómeno.
Es necesario considerar alternativas.


## 10. Conectores discursivos

Según la Nueva gramática básica de la lengua española (RAE y ASALE), los
conectores discursivos se clasifican en:

### 10.1. Argumentativos

Aditivos: además, asimismo, de hecho, es más, por añadidura, aparte, encima,
sobre todo, sumado a ello.

Adversativos: sin embargo, no obstante, ahora bien, con todo, eso sí, antes
bien, empero, en cambio, al contrario, por el contrario.

Concesivos: aun así, así y todo, con todo, de todos modos, de cualquier manera,
pese a ello.

Consecutivos (ilativos): por tanto, por consiguiente, en consecuencia, de modo
que, así pues, de ahí que, por ende, entonces, consiguientemente.

### 10.2. Reformuladores

Explicativos: es decir, esto es, a saber, o sea (informal).
Rectificativos: mejor dicho, más bien.
Recapitulativos: en suma, en definitiva, a fin de cuentas, al fin y al cabo.
De distanciamiento: en cualquier caso, de todos modos.

### 10.3. Estructuradores

De apertura: en primer lugar, para empezar, ante todo.
De continuidad: en segundo lugar, seguidamente, a continuación, por otra parte.
De cierre: por último, finalmente, para terminar.

### 10.4. Reglas de uso

Usar variedad dentro de cada categoría. No repetir el mismo conector en
párrafos consecutivos.

Puntuación con conectores:
Al inicio de oración: conector + coma. «Sin embargo, los resultados...»
En posición intermedia: comas alrededor. «Los resultados fueron, sin embargo,
positivos.»

Incluir solo los conectores necesarios para explicitar relaciones lógicas.
Un exceso de conectores produce artificialidad.

No arrancar oraciones consecutivas con un conector formal. La cadena
«Además, ... Asimismo, ... Por otro lado, ...» es una plantilla, no cohesión.
Muchas transiciones pueden ser implícitas: la oración siguiente retoma un
término de la anterior, y eso basta.

Qué conectores favorece cada tono lo decide la skill de tono.


## 11. Vocabulario: palabras y expresiones prohibidas

### 11.1. Palabras comodín (sustituir por términos específicos)

cosa, tema, algo, esto, eso (cuando son imprecisos), hacer (cuando existe verbo
más preciso), tener (como comodín), dar, poner, haber (como poseer).

### 11.2. Expresiones vagas (cuantificar cuando sea posible)

varios, algunos, muchos, bastante, un poco.
Preferir: tres factores, el 45 % de los encuestados, una proporción considerable.

### 11.3. Muletillas y rellenos

básicamente, realmente, literalmente, de hecho (cuando no aporta), seguro,
probablemente (cuando no se matiza).

### 11.4. Expresiones sobrecargadas y clichés

no solo esto sino también, adentrar, emprender (vacío), esclarecedor,
arrojar luz, elaboración, cambio de juego, de vanguardia, en un mundo donde,
revolucionar, disruptivo, utilizar (preferir «usar»), sumergirse, tapiz,
iluminar, revelar (cuando es metáfora vacía), fundamental (cuando todo es
fundamental, nada lo es), complejo (cuando no se explica la complejidad),
aprovechar, emocionante, innovador, notable, queda por ver, vistazo a,
navegar, panorama, marcado, testimonio, impulsar, disparándose, abrir, potente,
consultas, en constante evolución, imagina, reino.

### 11.5. Clichés de cierre

en conclusión, para concluir, para cerrar, resumiendo, en resumen, en síntesis,
finalmente (como cierre genérico).

Preferir: un cierre que retome la idea central sin anunciarse como cierre. El
último párrafo debe funcionar como cierre natural, no como declaración de cierre.

### 11.6. Redundancias y pleonasmos

subir arriba, bajar abajo, volver a repetir, protagonista principal, prever de
antemano, aterido de frío, lapso de tiempo, falso pretexto.

### 11.7. Andamiaje vacío

es importante destacar que, cabe señalar que, cabe resaltar que, vale la pena
mencionar que, resulta fundamental subrayar que.

Anuncian que algo importa en lugar de decirlo. Se suprimen sin sustituto.
Antes: «Es importante destacar que los datos muestran una caída.»
Después: «Los datos muestran una caída.»

### 11.8. Aperturas de molde

en la actualidad, hoy en día, a lo largo de la historia, desde tiempos
inmemoriales, en un mundo cada vez más, en la era digital.

Empezar por lo concreto del asunto, no por una generalidad de calendario.


## 12. Formato de entrega

Todas las reglas de este documento rigen el texto que se entrega al usuario,
no los archivos de las propias skills. Estos archivos son instrucciones para
un modelo, y usan markdown, tablas y encabezados precisamente porque no son
prosa entregada.

### 12.1. Reglas absolutas de formato

USAR lenguaje claro, directo y preciso.
USAR voz activa o construcciones impersonales con SE.
USAR conectores discursivos formales para cohesión.
USAR comillas latinas « » para citas textuales.
USAR artículo definido con partes del cuerpo (no posesivo).
USAR datos concretos en lugar de expresiones vagas.
USAR vocabulario preciso y específico.

EVITAR la raya y los guiones largos en todo el texto (ver 6.6).
EVITAR markdown, asteriscos, negritas o formato especial en el texto entregado.
EVITAR introducciones o preámbulos innecesarios.
EVITAR cierres genéricos como «en conclusión», «para cerrar», «en resumen».
EVITAR advertencias o notas sobre el contenido.
EVITAR hashtags en cualquier contexto.
EVITAR emojis en cualquier contexto.
EVITAR enlaces externos o códigos de referencia.
EVITAR símbolos especiales innecesarios.

### 12.2. Formato de respuesta al reescribir

Entregar únicamente el texto reescrito. Sin preámbulos, sin explicaciones,
sin notas finales. El texto reescrito es la respuesta completa.

### 12.3. Formato de respuesta al redactar

Entregar el texto solicitado. Si el usuario pide explicaciones o comentarios,
estos van separados del texto producido.


## 13. Citas y referencias en textos académicos

### 13.1. Citas textuales

Cortas (menos de 40 palabras): integradas en el texto, entre comillas angulares.
«La mentira arraiga tras de sí varias interpretaciones» (Tomasini, 2019, p. 211).

Largas (40 palabras o más): en bloque aparte, sin comillas, con sangría.

### 13.2. Omisiones en citas

Indicar fragmentos omitidos con puntos suspensivos entre corchetes: [...].

### 13.3. Citas traducidas

Si se traduce una cita de otro idioma, indicarlo: (traducción propia).

### 13.4. Notas al pie y referencias

Seguir el sistema que indique el usuario (APA, Vancouver, Chicago, IEEE).
Si no se especifica, preguntar.

Cómo se integra una cita en el argumento (preparación, cita, comentario) lo
decide la skill de tono.


## 14. Lista de verificación normativa

Estas comprobaciones se ejecutan siempre, con cualquier tono. La skill de tono
añade las suyas.

 1. ¿«Haber» impersonal está en singular?
 2. ¿No hay coma entre sujeto y predicado (salvo inciso)?
 3. ¿Los signos ¿ y ¡ tienen apertura?
 4. ¿No hay gerundios de posterioridad ni especificativos incorrectos?
 5. ¿Se prefiere voz activa o pasiva refleja sobre la pasiva perifrástica?
 6. ¿No hay calcos del inglés?
 7. ¿No hay dequeísmo ni queísmo?
 8. ¿Las mayúsculas son correctas (meses, días, gentilicios en minúscula)?
 9. ¿No queda ninguna raya, guion largo ni punto y coma en el texto?
10. ¿No hay markdown, asteriscos ni negritas?
11. ¿No hay introducciones ni cierres genéricos?
12. ¿Se conserva toda la información original (al reescribir)?
13. ¿No se añadió información nueva (al reescribir)?
14. ¿Los conectores son variados y no se repiten en párrafos contiguos?
15. ¿El vocabulario evita las palabras y expresiones prohibidas?
16. ¿Los números siguen las convenciones del español?
17. ¿Las comillas son angulares « » como primer nivel?
18. ¿La puntuación va fuera de las comillas de cierre?
19. ¿No hay emojis ni hashtags?
20. ¿Los encabezados usan mayúscula solo en la primera palabra y en los
    nombres propios?
21. ¿No hay formas de «vosotros» ni léxico peninsular?
22. ¿El tratamiento al lector es «usted» o «ustedes», sin tuteo ni voseo?


## 15. Fuentes normativas de referencia

Real Academia Española y Asociación de Academias de la Lengua Española.
Ortografía de la lengua española. Madrid: Espasa, 2010.

Real Academia Española y Asociación de Academias de la Lengua Española.
Nueva gramática de la lengua española. Madrid: Espasa, 2009.

Real Academia Española y Asociación de Academias de la Lengua Española.
Nueva gramática básica de la lengua española. Madrid: Espasa, 2011.

Real Academia Española y Asociación de Academias de la Lengua Española.
Diccionario panhispánico de dudas. Madrid: Santillana, 2005.

Martín Vivaldi, Gonzalo. Curso de redacción: teoría y práctica de la
composición y del estilo. Madrid: Paraninfo, 2000.

Seco, Manuel. Diccionario de dudas y dificultades de la lengua española.
Madrid: Espasa, 2011.


## 16. Ejemplos de aplicación

### 16.1. Reescritura de texto académico

Texto original:
«En su núcleo, una formidable investigación exige de un buen razonamiento donde
se reflexiona con coherencia cuestiones sobre un asunto específico; la falta de
esta produce déficit de eficacia en el proceso investigativo.»

Texto reescrito:
«Toda investigación rigurosa parte de un razonamiento coherente sobre un asunto
específico. La ausencia de esa coherencia reduce la eficacia del proceso
investigativo (Daros, 2002).»

Cambios aplicados:
Se eliminó «en su núcleo» y «formidable» (expresiones vagas o sobrecargadas).
Se dividió en dos oraciones.
Se mantuvo la información y la referencia.

### 16.2. Corrección de anglicismos

Texto original:
«El estudio fue realizado por los investigadores, quienes básicamente aplicaron
para obtener una beca. Los resultados literalmente hacen sentido.»

Texto reescrito:
«Los investigadores realizaron el estudio tras postularse a una beca. Los
resultados tienen sentido.»

Cambios aplicados:
Voz pasiva perifrástica → voz activa.
«aplicaron para» → «postularse a» (calco corregido).
«hacen sentido» → «tienen sentido» (calco corregido).
«básicamente» y «literalmente» eliminados (muletillas).
