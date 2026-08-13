# Contrato de evidencia

Este archivo existe dos veces. Una acá y otra en el repositorio de diapositivas,
que llegó a las mismas cuatro casillas por su cuenta, midiendo cómo se presenta
un argumento. Las dos copias son idénticas en lo que importa y ninguna importa a
la otra.

**Lo que se comparte son cuatro nombres, no código.** No hay paquete, ni tipo
compartido, ni archivo que uno genere y el otro consuma. Cada repositorio aplica
el contrato con su propia máquina y sigue funcionando si el otro desaparece.

## Qué se firma y qué no

Solo el bloque marcado más abajo es normativo, y solo ese bloque se compara. El
resto de este archivo es explicación, y cada repositorio la escribe en su idioma:
acá en español, allá en inglés. Obligar a que la explicación coincidiera habría
significado que uno de los dos escribiera en el idioma del otro, y el contrato no
trata de eso.

Cada copia declara la huella de su bloque en su propia suite. Si alguien lo toca
de un lado, ese lado falla hasta que el cambio se declare a propósito, y las dos
huellas dejan de coincidir a la vista de cualquiera.

Nada avisa automáticamente de que el otro se movió. Ese es el precio de no
acoplarlos, y es el precio correcto: lo que se consigue es que el cambio no pueda
ser silencioso.

<!-- EVIDENCE-CONTRACT v1 BEGIN -->
A claim that cannot be checked is not evidence.

Every claim carries four fields.

claim    What is asserted, in the words a reader will read.

method   How the number was produced. It has to be repeatable by someone else:
         a command, or a rule stated precisely enough to run again. A statement
         of intent is not a method.

sources  What the number was produced from, identified precisely enough to be
         found again. Where the source can disappear, its identity is pinned by
         content and not by name.

unit     What the number counts. Required wherever there is a quantity; absent
         only where there is none.

claim, method and sources are always required. An absent field is a defect, not
a shorthand: it means the reader is being asked to take the number on faith.

The contract is copied, never imported. Each repository keeps its own copy and
its own check. Nothing is fetched at run time, and neither side depends on the
other.
<!-- EVIDENCE-CONTRACT v1 END -->

## Cómo se aplica acá

`src/mediciones.ts` es la aplicación del contrato en este repositorio. Cada
medición trae `afirmacion`, `regla`, `fuente` con `archivos`, y `unidad`, y
`evals/contrato.test.ts` comprueba que ninguna de las cuatro venga vacía.

Las fuentes están fijadas por contenido y no por nombre, que es lo que exige el
bloque: `src/corpus.ts` guarda el sha256 de cada archivo del corpus, y el corpus
se borró. Un nombre no habría sobrevivido a eso.
