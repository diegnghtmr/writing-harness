# writing-harness

Skills de redacción en español y el verificador que mide si un texto las cumple.

Este es el archivo canónico de instrucciones para cualquier agente que trabaje
en este repositorio. `CLAUDE.md` solo apunta acá. Si tu herramienta lee otro
nombre de archivo, hacé lo mismo: un puntero de una línea, nunca una copia.

## La separación que hay que respetar

Las skills declaran reglas. El verificador las mide. **No se mencionan entre
sí.**

Ninguna skill nombra al verificador, ni a Node, ni a este repositorio. Una
skill tiene que servir en una máquina donde este verificador no existe, y el
verificador tiene que servir sobre un texto escrito sin ninguna skill cargada.
Lo único que comparten es el conjunto de reglas, y viven una sola vez, en
`src/rules.ts`.

Si alguna vez hace falta que una skill invoque una herramienta, la respuesta no
es agregarle la invocación. Es preguntarse por qué la herramienta no puede
correr desde afuera.

La misma regla vale para el proveedor. Las skills no nombran a ningún modelo ni
a ningún fabricante. Dicen «el agente» y describen qué papel cumple.

## Regla operativa

Todo texto en español que se produzca trabajando en este repositorio pasa por
el verificador antes de entregarse.

```bash
node src/cli.ts <archivo> --tono <id> [--pasada humanizar]
```

Sin `--tono` corre solo la capa normativa, que rige siempre. Con `--tono` añade
las longitudes y el ritmo de ese registro. El tono se elige según la tabla de
enrutamiento de `skills/spanish-writing/SKILL.md` §3. Por defecto, `camus`.

`--pasada humanizar` añade el catálogo de señales de IA. No corre solo, igual
que la skill: `humanizar-espanol` se activa únicamente cuando se pide con esas
palabras. Correrlo siempre marcaría como defecto cosas que en un texto concreto
son la palabra exacta.

Sale con 1 si hay errores. Un texto con errores no se entrega. Las advertencias
no frenan la entrega: señalan lo que solo el contexto decide.

## Lo que el verificador no ve

De las 282 declaraciones que hacen las skills, **199 exigen juicio sobre el
contenido** y ninguna regla las va a cubrir. Cosas como si se conservó toda la
información del original, si una analogía está desarrollada o solo mencionada,
o si una expresión es la colocación más previsible del tema.

El número creció con los trece tonos que reconstruyen a un autor: describir cómo
argumenta una persona no lo mide ninguna clase de regla que exista hoy.

Las skills declaran de dos maneras y las dos cuentan: ítems numerados `N. ¿…?`
en las listas del `SKILL.md`, y patrones `### N. Título` en los catálogos de
`references/`. `humanizar-espanol` declara solo de la segunda manera, con sus
37 patrones.

`evals/cobertura.ts` los tiene listados uno por uno. Salir con 0 significa que
el texto pasó las reglas mecanizables, no que esté bien escrito. Esa segunda
parte sigue siendo lectura humana.

## Antes de tocar reglas

```bash
node --test "evals/*.test.ts"
```

El test de correspondencia falla en las dos direcciones. Agregar una regla que
cubre un ítem obliga a borrarlo de `evals/cobertura.ts`. Cambiar la redacción
de un ítem en un `SKILL.md` obliga a actualizar el dato. Es a propósito: las
dos veces que este repositorio perdió una regla fue porque nadie comparaba la
prosa con el dato.

`evals/cobertura.ts` no se edita a mano. Se regenera:

```bash
node --experimental-strip-types evals/gen.ts
```

Conserva la clasificación de los ítems que ya estaban, imprime los nuevos para
revisarlos uno por uno, y deja los recuentos que el test tiene grabados. Se
escribió a mano una vez y quedó mintiendo en cuanto una skill movió sus ítems.

## De dónde salieron las cifras

Las skills enuncian centenares de cifras medidas sobre un corpus que no vive acá
y no va a vivir. Son transcripciones ajenas y un libro; se juntaron para
construir las skills y se borran.

`src/corpus.ts` es lo que sobrevive: 13 corpus, 305 archivos, cada uno con su
tamaño, sus palabras y su sha256, en 60 KB. Una skill dice «medido sobre 20
transcripciones» y nunca dice cuáles. Acá está la lista, con el contenido exacto
fijado, así que una cifra puede nombrar su origen aunque el origen ya no exista.

`src/mediciones.ts` es la otra mitad: 63 mediciones sobre 280 archivos. El
manifiesto dice qué archivos había; esto dice qué contenían. Cada medición trae
las cuatro casillas que hacen comprobable una cifra: qué afirma, con qué regla se
produjo, sobre cuántos archivos y en qué unidad.

```bash
node --experimental-strip-types scripts/manifiesto.ts
node --experimental-strip-types scripts/medir.ts
node --experimental-strip-types scripts/medir.ts --desde <ruta>
```

`medir.ts` comprueba el sha256 de cada archivo contra el manifiesto antes de
contar nada, y aborta si uno solo difiere. Medir un corpus distinto del que quedó
fichado daría cifras que parecen trazables y no lo son, que es peor que no tener
ninguna.

**El texto que cuenta no es el archivo entero.** Una transcripción trae cabecera
de metadatos y una marca `**[mm:ss]**` por línea; contar eso infla el recuento
alrededor de un 15 %. Se cuenta lo que viene después de «## Transcripción», sin
las marcas. Las fichas de han no tienen transcripción y se cuentan enteras, y el
dato lo dice en su campo `fuente`.

Ninguno de los dos es un derivado, y su gate es distinto por eso. El CI no puede
regenerarlos ni compararlos, porque en esa máquina el corpus no está; así que
`evals/corpus.test.ts` y `evals/mediciones.test.ts` comparan cada archivo contra
su propia huella. Cualquier edición a mano los rompe, incluida la que sustituye
un sha256 por otros sesenta y cuatro hexadecimales con buena pinta, que es justo
lo que ningún otro gate podría notar una vez borrado el corpus.

Además, la prosa y la medición se comparan entre sí. Dos corpus dan exacto, ocho
caen dentro del 0,5 % y han se sale porque sus cifras salen del libro y no de las
fichas. Las diferencias están congeladas como dato: impedir que crezcan sin que
nadie lo note es distinto de fingir que no existen.

Ninguna skill nombra el manifiesto ni las mediciones, igual que ninguna nombra
una regla. La skill declara, el verificador mide.

## Que el gate no dependa de que alguien se acuerde

Dos redes, y las dos corren lo mismo.

```bash
node scripts/instalar-hook.ts     # aviso temprano, aborta el commit
node scripts/instalar-hook.ts --desinstalar
```

El hook se copia en vez de enlazarse, porque Git no sigue enlaces en todas las
plataformas y un hook que no corre es peor que no tenerlo: da la sensación de
estar cubierto. El precio es reinstalarlo cuando el archivo cambia. Para saltarlo
en un caso concreto, `git commit --no-verify`, que existe a propósito.

`.github/workflows/gate.yml` es la red de verdad, la que no se puede saltar.
Corre la suite, comprueba que `evals/cobertura.ts` esté regenerado y verifica la
separación entre las skills y el verificador.

Un juicio encontró diez defectos en este repositorio, y los encontró porque los
buscamos a mano. Estas dos redes existen para que la próxima vez no dependa de
eso.

Dos comprobaciones más, que sostienen la separación de arriba:

```bash
grep -rn "cli\.ts\|node \|--tono\|writing-harness" skills/   # tiene que dar vacío
grep -rn "\.claude\|cursor\|copilot" src/                     # tiene que dar vacío
```

## Requisitos

Node 22.6 o superior, nada más. El repositorio no tiene dependencias, ni build,
ni `package-lock`. Corre offline.

## Las skills instaladas son enlaces

`node scripts/instalar.ts` enlaza cada skill desde el directorio del anfitrión
hacia este repositorio, con una junction en Windows y un symlink en el resto.
Editar el repositorio cambia lo instalado en el momento. No copiar nunca: dos
copias divergen, y eso es el defecto que este repositorio existe para evitar.

El destino por defecto es `~/.agents/skills`, la convención entre clientes.
Cada herramienta mantiene además su propio directorio.

```bash
node scripts/instalar.ts                   # solo ~/.agents/skills
node scripts/instalar.ts --todos           # además, cada anfitrión que exista
node scripts/instalar.ts --destino <ruta>  # uno concreto, repetible
node scripts/instalar.ts --verificar
node scripts/instalar.ts --desinstalar
```

El script nunca borra nada. Si el nombre está ocupado por un directorio real,
se detiene y sale con 1. Con `--reemplazar` lo renombra a
`<nombre>.reemplazado` y enlaza al lado, así que siempre se puede volver atrás.

El formato `SKILL.md`, markdown con frontmatter YAML, lo lee cualquier
herramienta. Si la tuya no tiene un directorio de skills, las skills siguen
sirviendo como documentos: se leen y se aplican igual.

**Cuidado con las copias sueltas.** Una skill enlazada y una copia vieja del
mismo nombre en otro directorio de anfitrión son dos reglas distintas con el
mismo título. Ya pasó: había un `spanish-writing` en `~/.agents/skills` idéntico
al primer commit de este repositorio, con la filosofía Camus todavía dentro de
la base. `--verificar` sobre cada anfitrión es lo que las encuentra.

## Qué archivo lee cada anfitrión

| Anfitrión | Archivo |
|---|---|
| Cualquiera que siga la convención AGENTS.md | `AGENTS.md` |
| Claude Code | `CLAUDE.md`, que apunta a `AGENTS.md` |
| Otro | Agregá un puntero de una línea, no una copia |

Un puntero no se desincroniza. Una copia sí.
