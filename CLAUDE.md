# writing-harness

Skills de redacción en español y el verificador que mide si un texto las cumple.

## La separación que hay que respetar

Las skills declaran reglas. El verificador las mide. **No se mencionan entre
sí.**

Ninguna skill nombra a `src/cli.ts`, ni a Node, ni a este repositorio. Una
skill tiene que servir en una máquina donde este verificador no existe, y el
verificador tiene que servir sobre un texto escrito sin ninguna skill cargada.
Lo único que comparten es el conjunto de reglas, y viven una sola vez, en
`src/rules.ts`.

Si alguna vez hace falta que una skill invoque una herramienta, la respuesta no
es agregarle la invocación. Es preguntarse por qué la herramienta no puede
correr desde afuera.

## Regla operativa

Todo texto en español que se produzca trabajando en este repositorio pasa por
el verificador antes de entregarse.

```bash
node src/cli.ts <archivo> --tono <camus|fonda|catedra>
```

Sin `--tono` corre solo la capa normativa, que rige siempre. Con `--tono` añade
las longitudes y el ritmo de ese registro. El tono se elige según la tabla de
enrutamiento de `skills/spanish-writing/SKILL.md` §3. Por defecto, `camus`.

Sale con 1 si hay errores. Un texto con errores no se entrega.

## Lo que el verificador no ve

De los 58 ítems de checklist que declaran las skills, **25 exigen juicio sobre
el contenido** y ninguna regla los va a cubrir. Cosas como si se conservó toda
la información del original, o si una analogía está desarrollada o solo
mencionada.

`evals/cobertura.ts` los tiene listados uno por uno. Salir con 0 significa que
el texto pasó las reglas mecanizables, no que esté bien escrito. Esa segunda
parte sigue siendo lectura humana.

## Antes de tocar reglas

`node --test "evals/*.test.ts"`

El test de correspondencia falla en las dos direcciones. Agregar una regla que
cubre un ítem obliga a borrarlo de `evals/cobertura.ts`. Cambiar la redacción
de un ítem en un `SKILL.md` obliga a actualizar el dato. Es a propósito: las
dos veces que este repositorio perdió una regla fue porque nadie comparaba la
prosa con el dato.

## Las skills instaladas son enlaces

`~/.claude/skills/` apunta acá con junctions. Editar el repositorio cambia lo
instalado en el momento. No copiar nunca: dos copias divergen.

`node scripts/instalar.ts --verificar` informa el estado sin tocar nada.
