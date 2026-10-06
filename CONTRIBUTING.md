# Cómo se mejora el arnés

Este archivo es el modo **mejorar**. El modo **usar**, que es escribir un texto
con las skills puestas, está en [AGENTS.md](AGENTS.md) y no toca ningún archivo
de acá.

Quien llegó buscando cómo escribir un texto tiene que volver a AGENTS.md. Si
hay que agregar un tono, mover una regla, incorporar un corpus o corregir una
cifra, es acá.


## Lo único que no se negocia

Cuatro reglas. Todo lo demás de este archivo son consecuencias de estas cuatro.

### 1. Un hecho vive una sola vez

Si un hecho está escrito en dos sitios, se van a desincronizar y nadie se va a
enterar. Ya pasó, y varias veces: la raya estaba prohibida en una skill,
permitida en otra y marcada como señal de IA en una tercera; la prohibición del
punto y coma se perdió al reescribir un ítem; el README afirmaba una cobertura
que había cambiado dos versiones antes.

Cuando dos gates necesitan el mismo dato, el dato se va a un módulo llano y los
dos lo leen. `evals/retiradas.ts` y `evals/registro.ts` existen por esto.

### 2. Todo gate falla en las dos direcciones

Un gate que solo comprueba que algo esté presente no distingue entre estar bien
y no mirar nada. Una regla nueva que cubre un ítem obliga a borrarlo del
registro de cobertura; borrar un ítem de la prosa obliga a sacar la regla. Las
dos direcciones, siempre.

### 3. Un gate se prueba rompiéndolo

Escribir el test y verlo pasar no prueba nada: puede estar pasando porque no
mira. **Antes de dar por bueno un gate, se rompe a propósito lo que dice vigilar
y se comprueba que falle.** Después se restaura.

Este repositorio tiene la costumbre de dejar el canario escrito como test, para
que el día que alguien afine el patrón se entere de si lo afinó de más. Ver
`evals/correspondencia.test.ts`, que caza cada clase de cita rota, y
`evals/separacion.test.ts`, que comprueba que su guardián siga disparando.

### 4. Lo generado se regenera, nunca se edita

| Archivo | Cómo se rehace | Qué lo protege |
|---|---|---|
| `evals/cobertura.ts` | `node --experimental-strip-types evals/gen.ts` | El CI lo regenera y compara |
| `src/corpus.ts` | `node --experimental-strip-types scripts/manifiesto.ts --desde <ruta>` | La huella del archivo entero |
| `src/mediciones.ts` | `node --experimental-strip-types scripts/medir.ts --desde <ruta>` | La huella del archivo entero |

Los dos últimos no se pueden regenerar sin el corpus, y el corpus se borra. Por
eso su gate es distinto: se comparan consigo mismos. Una edición a mano los
rompe, incluida la que sustituye un sha256 por otros sesenta y cuatro
hexadecimales con buena pinta.


## Antes de tocar nada

```bash
node --test "evals/*.test.ts"
```

Verde antes de empezar. Si ya estaba rojo, eso es lo primero, y ese rojo no
viene del cambio nuevo.


## Agregar un tono

Son ocho pasos y siete tienen gate. Correr la suite después de cada uno dice qué
falta, así que la lista es para saber qué viene, no para reemplazarla.

**El orden importa por una razón concreta:** el paso 6 mide contra el corpus cada
expresión que la prosa entrecomilla, así que el `SKILL.md` tiene que existir
antes de correr los generadores.

### 1. La skill

`skills/<id>-writing/SKILL.md`. El identificador del tono más `-writing`, y sin
acentos: varios gates lo buscan con `[a-z-]+`.

Lleva, en este orden: frontmatter con `name` y `description`; **el bloque
«Antes de seguir»** entre el título y la sección 1, tal cual está en
`evals/puerta.test.ts`; la sección 1 con qué decide ese tono y **la
precondición de forma al final**; la relación con la base; qué se midió y qué no
vale de esa medición; el ritmo en cifras; la voz; la estructura; los recursos;
el formato de entrega; **la lista de verificación numerada** con ítems
`N. ¿…?`; y las fuentes, con el corpus, las mediciones y lo que quedó sin
verificar.

Siete cosas que un gate va a rechazar: la raya o el guion largo en cualquier
parte, nombrar al verificador o a Node, nombrar un modelo o un fabricante,
hablar del desarrollo de este proyecto, no declarar la precondición de forma en
la sección que la entrada dice, una `description` de más de 1024 caracteres, y no
abrir con el bloque que manda a cargar la base.

**El bloque existe porque un anfitrión elige la skill por su descripción.** Uno
cargó un tono suelto, sin la base, y aplicó la forma sin la normativa ni el
enrutamiento que la eligen: el tono dice que hereda las reglas de la base y no
las repite, y heredar de algo que nadie cargó es no tener nada. La descripción
no podía arreglarlo, porque a los tonos más largos no les queda margen. El
primer párrafo del cuerpo sí, porque llega entero en cuanto la skill se carga.

**Y la que ningún gate mide del todo: la skill tiene que mostrar el registro,
no solo describirlo.** Es el defecto más caro de los que han pasado, porque el
verificador no lo ve y la skill parece completa. Un tono llegó con la mitad
cuantitativa impecable, medias y medianas y proporciones, todas medidas, y sin
un solo fragmento de prosa escrito en el registro que describía. Quien tenía
que usarlo no tenía contra qué contrastar lo que estaba escribiendo, y lo
encontró una persona leyendo, no la suite.

Una cifra dice cuánto y no dice cómo. «La mediana está en 25 palabras» no le
enseña a nadie a construir un periodo de este registro y no de otro. Al lado de
cada movimiento va la muestra: el par de versión mala contra versión buena, el
fragmento citado, la tabla de qué se dice en vez de qué. `evals/muestras.test.ts`
pide tres fragmentos como piso, y tres no hacen una buena skill: solo impiden la
que no muestra ninguno. Lo que hace útil a una skill sigue siendo lectura.

**Se lee el corpus primero y se cuenta después, nunca al revés.** Es la lección
más cara de este proyecto y costó tres rondas en el mismo tono. La primera
versión midió cuatro rasgos, todos de tamaño: longitud de oración, longitud de
párrafo, persona y densidad de conectores. Salió una skill con las cifras
correctas que describía el registro por fuera, y el usuario la rechazó dos veces
seguidas antes de que quedara claro por qué.

**Una medición de tamaño no descubre una maquinaria.** Un promedio dice cuánto
mide una oración; no dice con qué está pegada a la anterior, y eso último es lo
que hace que un registro suene como suena. Los cuatro rasgos que faltaban
aparecieron leyendo el corpus de corrido, no corriendo otro contador: que el
texto se reformula a sí mismo cada tantas páginas, que corrige reemplazando
dentro de la misma oración con «no X, sino Y», que enumera con ordinales dentro
del párrafo y jamás con viñetas, y que el léxico alto es deliberado y no un
descuido.

El orden que funciona es este. Primero se lee un apartado entero de corrido,
subrayando cada vez que una oración se engancha con la anterior de un modo que
uno no habría escrito. Después se convierte cada subrayado en algo contable y se
mide sobre el corpus completo. La lectura propone y la cuenta confirma o
desmiente; saltarse la lectura deja una skill que solo sabe de longitudes.

Los rasgos que casi siempre faltan cuando se midió sin leer: con qué nexos se
arma el periodo largo, qué par de formas elige el registro y cuál descarta, cómo
entra cada posición nueva respecto de la anterior, si el texto se traduce a sí
mismo, cómo corrige, cómo enumera, de qué altura es el léxico, y **qué es lo que
el corpus no dice nunca**, que es lo mejor medido de todo porque son ceros
contados y no proporciones interpretadas.

**Y una advertencia sobre el registro alto.** La tentación es tratar la palabra
culta como ruido del corpus y prohibirla. En este tono se hizo, y fue un error
que hubo que revertir: el corpus tiene una palabra de registro alto cada
trescientas, que es aproximadamente una por párrafo largo, y quitarlas todas
dejaba un resumen escolar con las longitudes correctas. Lo que sí se prohíbe es
el adjetivo que no cambia lo que la oración dice, porque la base ya lo rechaza.
La línea está en la clase de palabra: el registro alto de una prosa entra por el
sustantivo y por el verbo, casi nunca por el adjetivo.

**Los ejemplos son sobre el asunto del corpus.** Es la regla que faltaba y su
ausencia costó cinco rondas. Una skill se ilustró entera con ejemplos sobre un
terremoto, cuando su corpus era un informe sobre la mentira, y el daño fue doble.
El primero es de enseñanza: un ejemplo fuera del hábitat del registro no se puede
contrastar contra nada, porque nadie escribió nunca así sobre ese tema, y quien
lo lea aprende una imitación de segunda mano. El segundo es peor y se midió: el
asunto elegido coincidía con el de la batería de pruebas del proyecto, de modo
que quien tenía que escribir la prueba encontraba en la skill párrafos
terminados sobre ese mismo tema y los reusaba. Tres textos seguidos repitieron
sus frases casi palabra por palabra, y durante tres rondas eso se leyó como que
la skill transmitía bien.

La regla es corta: **los ejemplos tratan del mundo del corpus, y no son
transcripciones suyas.** Prosa nueva sobre el mismo asunto. Ni citas, ni
referencias, ni el documento nombrado, que eso es otra cosa y sigue prohibido.

`evals/asunto.test.ts` la comprueba, y conviene saber qué puede y qué no.
Comprueba que el asunto esté declarado en `evals/asuntos.ts` y que las muestras
lo toquen. No puede deducirlo: se intentó por el manifiesto del corpus y por una
lista escrita a ojo, y las dos fallaron sobre la medición, con el detalle
anotado en ese archivo. Por eso **el asunto lo declara quien construye el tono**,
que es el único que tiene el corpus delante. Un tono nuevo sin declaración no
pasa el gate, y la lista de los que quedaron sin declarar solo puede encoger.

**Un techo sin piso se lee como permiso.** Es el defecto que más veces se
repitió, y siempre con la misma forma: la prosa declara una media, o dice que un
rasgo «cabe holgado» bajo el límite de la base, y no pide un mínimo de nada. Lo
que no se pide, converge. Pasó tres veces en el mismo tono y en tres rasgos
distintos: los párrafos salieron todos del mismo tamaño porque había media y
piso pero ninguna exigencia de dispersión; el punto y coma cayó a una de cada
treinta oraciones porque la prosa decía dónde estaba el techo y nunca dónde
estaba el suelo; y los párrafos dejaron de abrir con conector porque la cifra
del corpus estaba escrita y nadie la exigía. **Todo rasgo que la prosa declare
como densidad necesita un piso medido, y el piso va lejos de lo medido para que
acuse al texto que abandonó el rasgo y no al que respiró.**

**Para extraer un tono conviene leerlo con ojos que no sean los propios.** El
riesgo de la tercera relectura del mismo corpus es encontrar lo que uno ya
escribió. Lo que funcionó fue mandar a leer el mismo apartado a varios lectores
independientes, cada uno con un encargo distinto —cómo está armada la oración,
cómo avanza el párrafo, qué léxico y qué fórmulas fijas—, sin acceso a la skill
existente y con la obligación de citar literal y de contar. Después se cruza:
lo que dos encuentran por separado es un rasgo, lo que dice uno solo es una
hipótesis, y **todo lo que entre a la skill se vuelve a contar con la mano
propia antes de escribirlo**. En esa ronda salieron cuatro rasgos que tres
lecturas anteriores no habían visto, y dos afirmaciones de la skill que había
que corregir porque contarlas las desmentía.

**Un tono no puede exigir lo que la base castiga.** Un tono se suma a la base y
no la corrige, así que cuando el corpus trae un rasgo que la base prohíbe, ese
rasgo se saca del tono y se dice en la prosa que se sacó. Pasó con dos enlaces
de cierre que el corpus usaba y que la base rechaza con severidad error: la
regla del tono los pedía y la de la base los castigaba, de modo que la
instrucción se contradecía a sí misma y el que la leyera no sabía cuál obedecer.
`evals/colision.test.ts` corre ese cruce sobre todas las listas de tono cada
vez.

**Un tono es la forma de redactar, y nada más.** Es la confusión que más veces
se ha colado, siempre por el mismo camino: se mide un corpus, y con la forma se
arrastra de qué estaba hecho ese corpus. Un tono medido sobre un informe con
encuestas y entrevistas terminó pidiendo un testimonio citado y una referencia
para volver a cada dato. Ninguna de las dos cosas es la manera de escribir.

La prueba para saber de qué lado cae algo es corta. **Si cambiándolo la prosa
suena igual, no era tono.** Que la norma de cita pase de una a otra no cambia
ninguna oración; que el material sea una entrevista o una segunda serie de
medición tampoco. En cambio, que la cifra vaya sola o venga con de qué es
fracción sí cambia la oración, y por eso eso sí es tono.

De ahí salen dos maneras de decir lo mismo, y solo una sirve:

Incorrecto: ¿Cada testimonio trae su código para volver a él?
Correcto: ¿Cada cita dice de quién es la voz?

`evals/muestras.test.ts` lo vigila sobre las listas de verificación, que es
donde un tono dice qué hay que comprobar. Nombrar el corpus al decir de dónde
salieron las cifras es legítimo y varias skills lo hacen; pedirle al que escribe
que consiga ese material, no.

**Lo que no va en una skill:** cifras de errores contra las reglas, nombres de
gates, rutas de este proyecto, la palabra «repositorio» y cualquier cosa que
solo tenga sentido con el verificador delante. Una skill tiene que servir en una
máquina donde este programa no existe. Si al escribirla aparece una frase que
solo se entiende sabiendo cómo está hecho el arnés, esa frase va en
`CONTRIBUTING.md` o en un comentario del código, nunca en la skill.

**Ese último límite es del instalador de skills, no de este repositorio, y por
eso conviene saber de dónde sale.** Seis de las catorce skills fueron rechazadas
al subirlas por pasarlo, y ninguna lo sabía: la descripción es el único campo
que crece solo, cada vez que un tono aprende a distinguirse mejor de sus
hermanos. `evals/frontmatter.test.ts` lo vigila, y avisa además cuando una queda
a menos de sesenta caracteres del techo, para que agregar una frase sea una
decisión y no una sorpresa al subir. La cuenta es sobre el valor plegado del
escalar `>`, con las líneas unidas por un espacio, y en caracteres y no en
bytes: en español, los acentos y las comillas angulares ocupan dos bytes cada
uno.

### 2. Las reglas

La entrada en `TONES` de `src/rules.ts`. Cada regla es un objeto plano, sin
comportamiento, y cita en `source` la sección de la skill que la enuncia y en
`checklist` el ítem literal que hace cumplir.

Toda regla de ritmo declara su `gobierna` o `assertDominios` la caza. Toda regla
tiene que reclamar al menos un ítem que exista de verdad.

**Una regla que nadie puede incumplir no es una regla.** Hay un gate que le pasa
a cada tono un texto plano de doce oraciones iguales y exige que diga algo: un
tono mudo reparte texto entre skills que dan todas el mismo veredicto.

### 3. Los ítems que la base ya mide

Si la skill declara «sin tuteo» o «sin artefactos de canal», eso ya lo miden
reglas de la base. El ítem se agrega al `checklist` de esa regla, no se duplica
en una regla nueva.

**Este es el único paso sin gate, y por eso es el que esconde defectos.** Nada
automático dice que un ítem nuevo repite una prohibición existente: hay que
leerlo. Al escribir el duodécimo tono se encontró así un ítem de `solitario` que
llevaba tiempo anotado como criterio, es decir como algo que solo una persona
puede juzgar, cuando dos reglas ya lo medían.

### 4. La ruta

`src/enrutamiento.ts`: la entrada en `RUTAS` y el rasgo nuevo en `RASGOS` y en
`Rasgos` si hace falta uno.

El orden de `RUTAS` es la mitad del procedimiento. Va de lo más estrecho a lo más
amplio, y una ruta puesta después de otra más ancha no sale nunca. `camus` cierra
la lista aceptando cualquier cosa.

Ensanchar una condición la vuelve más amplia, y entonces la ruta baja.
`schiavenato`, `fonseca` y `fonda` acotaban por materia y ocupaban los pasos 5,
6 y 11. Al pasar a acotar por forma, con la frase de su propia skill, se
llevaban desde ahí lo que el método, las rutas de dos rasgos y la evidencia
cruzada resuelven mejor: una guía de estudio escrita a raíz de un hecho
reciente perdía sus pasos. Por eso cierran la lista, justo antes de `camus`.

Un rasgo que reclama el último paso sin abrir una ruta nueva, como
`relatoPropio`, va en los `reclamos` de `camus`, y su motivo cita literalmente
un fragmento de la misma fila. Un rasgo dice qué hace el texto por su lector,
nunca el ámbito del pedido. `academico` reclamaba el último paso y se retiró por
eso: para quien escribe desde una universidad nombraba el lugar y no la forma,
y casi todo pedido lo declaraba.

Un rasgo que ninguna condición lee es un rasgo decorativo, y `rasgosSinRuta` lo
caza. Las condiciones se escriben con punto (`r.metodoPersonal`), nunca con
corchetes: ese análisis no vería la notación de corchetes y prefiere romperse a
mentir.

La ayuda del comando sale de ese mismo análisis: imprime cada rasgo con los
pasos que lo leen y el `cuando` de cada uno. Ese campo es entonces lo que lee
quien enruta, y por eso describe la forma y no la materia.

**La batería de pedidos mide a dónde manda la lista lo que se suele pedir.**
`evals/pedidos.ts` trae pedidos típicos, cada uno con los rasgos que un agente
razonable declararía y el tono que el enrutador le da hoy, y
`evals/sesgo.test.ts` los pasa por `sugerirTono`: cada pedido tiene que salir
con su tono, `camus` no puede pasar de su techo ni otro tono del suyo, y la
lista tiene que llegar a casi todos los tonos. Los techos y sus motivos están
en el test, y `npm run sesgo` imprime el reparto en una tabla. Mide la lista y
el enrutador con esos rasgos. No mide cómo elige un agente los rasgos ni el
paso, que es la otra mitad de enrutar.

Al agregar un tono o mover una ruta, el test dice qué pedidos cambiaron de
tono. Si el cambio es a propósito, se anota el tono nuevo. Si el tono nuevo no
recibe ningún pedido, se suman pedidos de su forma, con los rasgos que el
pedido dice y nunca con los que arreglan la cifra.

### 5. La tabla de la entrada

`skills/redactar-espanol/SKILL.md`: la fila de la tabla y el paso de la lista
numerada. El campo `cuando` de la ruta cita literalmente un fragmento de la celda
«Cuándo se usa», y el gate lo comprueba en las dos direcciones.

Renumerar la lista es correcto. Renumerar archivos que ya existen no lo es: un
número que se corre arrastra al nombre a mentir.

### 6. El corpus

Si el tono se midió sobre un corpus, ese corpus entra al registro **antes de que
se borre**, con los dos generadores. La ruta que se pasa con `--desde` tiene que
contener solo carpetas de corpus, una por skill, porque el script recorre cada
subdirectorio entero.

```bash
node --experimental-strip-types scripts/manifiesto.ts --desde <ruta>
node --experimental-strip-types scripts/medir.ts --desde <ruta>
```

**Los archivos del corpus se numeran: `01-`, `02-`, y así.** No es cosmetica.
`scripts/medir.ts` selecciona por ese prefijo, y un archivo sin él no se mide.
Como el manifiesto sí lo registra, un corpus mal nombrado queda con su huella
puesta y sin ninguna medición detrás, que es la peor de las dos mitades.

Los dos conservan lo que no pueden volver a producir: el corpus que está en disco
se vuelve a medir y el que no está se copia tal cual, y la corrida imprime cuáles
heredó. `scripts/fusion.ts` tiene la regla y `evals/fusion.test.ts` la comprueba
en las dos direcciones.

Después hay que pegar las huellas nuevas en `evals/corpus.test.ts` y
`evals/mediciones.test.ts`. Los dos tests reportan el valor recibido cuando
fallan, y ese es el que va.

### 7. El registro de cobertura

```bash
node --experimental-strip-types evals/gen.ts
```

Imprime los ítems nuevos para revisarlos uno por uno. Todos entran como
`criterio`, y ascender uno a `mecanizable` es una decisión que se toma leyendo,
no algo que el generador haga solo.

### 8. Las cifras

Los recuentos grabados de `correspondencia`, `alcance`, `ritmo`, `mediciones` y
`corpus`, y las cifras del README y de AGENTS.md.

**Y la regla que hace que esto no se repita: una cifra que aparece en la
documentación se lee del sitio donde se mide, no se copia.** Si no hay gate para
la cifra que se escribe, el trabajo incluye ponerlo. Cinco afirmaciones
envejecieron por no tenerlo.


## Agregar una regla

Una regla nueva sale de una declaración que ya está en la prosa y nadie mide. El
camino inverso, inventar la regla y después escribir el ítem, produce reglas que
no gobiernan nada.

1. Se busca el ítem en `evals/cobertura.ts`. Si está como `criterio` y se puede
   medir, ese es el candidato.
2. Se escribe la regla en `src/rules.ts` con su `source` y su `checklist`.
3. Se regenera `cobertura.ts`: el ítem tiene que desaparecer de ahí solo.
4. Se escribe el test en las dos direcciones y **se rompe la regla para verlo
   fallar**.
5. Se actualizan los recuentos.

Si ninguna clase de regla existente sirve, se agrega una clase. Están en
`src/rules.ts` como variantes de la unión `Rule`, y `assertRules` comprueba la
forma de cada una antes de usarla.

**La severidad se elige con cuidado.** Un error no se entrega. Una advertencia
sí, si quien escribe puede decir por qué el contexto la justifica. La convención
de este repositorio es que una cifra prestada o una que admite lectura literal
avisa, y solo bloquea lo que la prosa declara con su propio número.


## Retirar una skill

El corpus no se toca. `src/corpus.ts` y `src/mediciones.ts` son el registro de lo
que se midió el día que se midió, y ese registro no se corrige borrando filas,
porque entonces deja de decir lo que pasó. Retirar una skill retira la skill, no
la historia de su medición.

1. Se borra `skills/<id>-writing/`.
2. Se agrega el nombre a `evals/retiradas.ts`.
3. Se quita su entrada de `TONES` y su ruta.
4. Se quita su fila de la tabla de `redactar-espanol` y su paso de la lista.
5. Se regenera `cobertura.ts` y se actualizan los recuentos.

`evals/corpus.test.ts` comprueba la lista de retiradas en tres direcciones: que
ningún corpus quede huérfano sin declararse, que ninguna declarada siga viva, y
que toda declarada tenga corpus que justificar. Sin la tercera, la lista crece
con nombres sin respaldo y el permiso se vuelve un agujero.


## La skill de entrada

`skills/redactar-espanol/SKILL.md` decide el modo (redactar o corregir), si
corresponde un tono y cuál, y cómo se entrega el texto. No declara ninguna
regla propia: pedirle sus declaraciones da una lista vacía, y
`evals/correspondencia.test.ts` lo comprueba.

Un gate la rechaza si trae un ítem de checklist `N. ¿…?`, un catálogo en
`references/`, la raya o el guion largo, una opción con `--`, `node` o
`python` seguidos de un espacio, las extensiones `.ts`, `.js` y `.py`, o las
rutas `src/` y `evals/`. Puede nombrar «el verificador» sin que ningún gate
falle: es la única skill con ese permiso, y `evals/separacion.test.ts` lo
acota a su archivo exacto.

La leen `evals/puerta.test.ts`, `evals/enrutamiento.test.ts`,
`evals/alcance.test.ts`, `evals/correspondencia.test.ts`,
`evals/frontmatter.test.ts`, `evals/separacion.test.ts` y
`evals/entrega.test.ts`, que exige que el paso 5 diga dónde va el texto;
`src/cli.ts` la nombra a través de `ENTRADA`, declarada en `src/skills.ts`.

Renombrarla no es mover un directorio. Hay que cambiar `ENTRADA`, los catorce
bloques «Antes de seguir» de los tonos y de `humanizar-espanol` que la cargan
por nombre, y el párrafo de `spanish-writing` que redirige a ella. Lo que
quede después de esos cambios lo encuentra `rg -n redactar-espanol`.


## Tocar la documentación

`README.md` es para una persona que llega y quiere entender qué es esto.
`AGENTS.md` es para un agente que va a trabajar, y se divide en usar y mejorar.
`CLAUDE.md` es un puntero de una línea y tiene que seguir siéndolo: un gate
comprueba que no crezca.

Toda cifra que la documentación enuncia la comprueba `evals/docs.test.ts`, y **se
comprueba dentro de su afirmación, no suelta en el archivo**. La primera versión
de ese gate buscaba el número en cualquier parte y pasó limpio con el README
envejecido a mano.

Dos trampas que este repositorio ya pisó:

- **Una afirmación retirada no nombra una cantidad.** Hubo una guarda que
  prohibía la frase «doce tonos», correcta cuando eran catorce, y que quedó
  prohibiendo una verdad al llegar el duodécimo tono. Las afirmaciones retiradas
  describen una forma de decir las cosas que se abandonó, no un número.
- **Un archivo de test no se importa desde otro.** Sus `describe` vuelven a
  correr en el proceso del importador y el recuento de la suite miente sobre
  cuánto se comprueba. El dato compartido va a un módulo llano.


## Antes de entregar el cambio

```bash
node --test "evals/*.test.ts"
node --experimental-strip-types evals/gen.ts     # y que no quede diferencia
```

Y las tres preguntas que no las hace ningún gate:

1. ¿Rompí a propósito cada gate nuevo y lo vi fallar?
2. ¿Queda alguna cifra escrita en dos sitios?
3. ¿El comentario dice **por qué**, y no qué? El código ya dice qué hace. Lo que
   no se puede recuperar leyéndolo es qué defecto concreto vino a cerrar, y este
   repositorio nombra ese defecto en casi todos sus comentarios a propósito.

Cuando el cambio toca una skill, el enrutamiento o la entrega, falta una capa que
la suite no cubre: la prueba final con agentes reales, descrita en
[AGENTS.md](AGENTS.md#la-prueba-final-con-agentes-reales). Sus comprobaciones y
sus umbrales viven en `scripts/prueba-final/comprobaciones.ts`, cada uno con su
motivo al lado. Un umbral se cambia ahí, con el motivo nuevo escrito, y nunca
para que pase una corrida concreta.

Las corridas no ven el código de la prueba. Cada agente trabaja en una copia de
mix armada en la carpeta temporal de su corrida, con las instrucciones de mix y
lo que git rastrea del arnés, y sin el ejecutor, sus pruebas, sus datos de
prueba ni `odd/`. La razón salió de una corrida de humo: un agente buscó en el
ejecutor cómo se comprueban los hechos, importó la función que los compara y
revisó con ella su propia salida antes de entregarla. Su resultado dejó de medir
las skills y pasó a medir que el agente había encontrado el oráculo.

Lo que queda fuera de la copia se declara una sola vez, en
`scripts/prueba-final/copia.ts`, y la comprobación de aislamiento lee esa misma
lista: leer, buscar, importar o ejecutar algo de ella desde una corrida es una
falla. Un archivo nuevo de la prueba tiene que caer dentro de esos patrones, o
entra a la copia y queda al alcance de los agentes. La copia se arma con lo que
git rastrea, así que un archivo nuevo del arnés que todavía no se agregó a git no
llega a las corridas.

Una comprobación nueva o un umbral corregido se prueban primero con
`--reevaluar` sobre la carpeta publicada, antes de gastar otra corrida.
Recalcula cada veredicto con el código de hoy sin correr ningún agente. Lo que
no se puede volver a medir, que es la huella del documento y el estado de los
repositorios y de la copia, se conserva marcado. El resumen y cada veredicto
anterior quedan en `historial/`, bajo la fecha de la reevaluación.

Cada corrida guarda sus memorias en un proyecto de Engram propio, cuyo nombre
empieza con `prueba-final` y queda anotado en el veredicto. Con un proyecto
común, una corrida leyó lo que había guardado otra. Esos proyectos no se borran
solos: `engram projects list` los muestra, y `engram delete project <nombre>`
borra cada uno; con `--hard`, también sus sesiones.
