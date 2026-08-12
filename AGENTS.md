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
node src/cli.ts <archivo> --tono <camus|fonda|catedra> [--pasada humanizar]
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

De las 258 declaraciones que hacen las skills, **183 exigen juicio sobre el
contenido** y ninguna regla las va a cubrir. Cosas como si se conservó toda la
información del original, si una analogía está desarrollada o solo mencionada,
o si una expresión es la colocación más previsible del tema.

El número creció con los doce tonos que reconstruyen a un autor: describir cómo
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
