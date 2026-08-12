// GENERADO por gen.ts. Registro de qué declara la prosa y todavía no tiene
// regla. Es el equivalente de KNOWN_FINDINGS: falla en las dos direcciones.
// Si una regla nueva cubre una declaración, hay que borrarla de acá o el test
// falla. Si la prosa cambia el texto, la entrada queda huérfana y el test falla.
//
//   mecanizable  se puede medir, falta construirlo
//   criterio     exige juicio sobre el contenido, ninguna regla lo va a cubrir
//   delegado     el ítem solo remite a la lista de otra skill
//
// `origen` dice de dónde salió: `checklist` de una lista de verificación del
// SKILL.md, `patron` de un catálogo numerado en `references/`.

export type Estado = 'mecanizable' | 'criterio' | 'delegado';
export type Origen = 'checklist' | 'patron';

export const SIN_REGLA: { skill: string; origen: Origen; item: string; estado: Estado }[] = [
  { skill: 'camus-writing', origen: 'checklist', item: "¿Se varía la longitud de las oraciones en lugar de igualarlas?", estado: 'mecanizable' },
  { skill: 'camus-writing', origen: 'checklist', item: "¿No hay dos oraciones consecutivas con la misma estructura?", estado: 'criterio' },
  { skill: 'camus-writing', origen: 'checklist', item: "¿Se usa tercera persona o primera del plural, sin tutear al lector?", estado: 'mecanizable' },
  { skill: 'camus-writing', origen: 'checklist', item: "¿El vocabulario es concreto y sin adjetivación decorativa?", estado: 'criterio' },
  { skill: 'camus-writing', origen: 'checklist', item: "¿La información nueva queda al final de la oración?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Todo concepto complejo está descompuesto en sus partes?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las ideas centrales se reformulan al menos dos veces?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Cada posición teórica se contrasta con su alternativa?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las citas llevan atribución (autor + obra), introducción con verbo de decir y comentario posterior?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las clasificaciones son exhaustivas y enumeradas?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿El texto tiene ubicación, descomposición, documentación y síntesis?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Se usa «nosotros» inclusivo y no «tú»?", estado: 'mecanizable' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Los dispositivos de reformulación («es decir», «por tanto») están presentes y variados?", estado: 'mecanizable' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿El metadiscurso hace explícita la estructura del texto?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las reglas gramaticales heredadas de «spanish-writing» se respetan?", estado: 'delegado' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿No hay coloquialismos, humor ni anécdotas personales?", estado: 'mecanizable' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las oraciones largas son sintácticamente claras?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿Las preguntas retóricas son analíticas y se responden?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿No hay markdown ni asteriscos en el texto entregado?", estado: 'mecanizable' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿El vocabulario técnico está definido en su primera aparición?", estado: 'criterio' },
  { skill: 'catedra-writing', origen: 'checklist', item: "¿No se usa español peninsular (sin «vosotros», sin «coger» con sentido de «tomar», sin «vale» como muletilla)?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿El texto tutea al lector de forma consistente?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Hay preguntas retóricas que activen al lector?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Cada concepto abstracto tiene al menos un ejemplo concreto?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Los autores citados están contextualizados brevemente?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Las citas llevan preparación y análisis posterior?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿El texto tiene apertura que enganche, desarrollo progresivo y cierre que resuene?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Se usa primera persona para opiniones y plural para recorridos argumentativos?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Se evitan los clichés de cierre genérico?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Pasó la lista de verificación normativa de «spanish-writing»?", estado: 'delegado' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿El registro es culto pero no solemne?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Se varía la longitud de oraciones para crear ritmo?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Las conexiones entre pensadores están argumentadas?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿El texto fluye como narración, no como lista de datos?", estado: 'criterio' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿No hay markdown ni asteriscos en el texto entregado?", estado: 'mecanizable' },
  { skill: 'fonda-writing', origen: 'checklist', item: "¿Las analogías están desarrolladas y no solo mencionadas?", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Énfasis indebido en notoriedad y cobertura mediática", estado: 'mecanizable' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Regla de tres", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Variación elegante (sinónimos cíclicos)", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Falsos rangos", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Pasiva e impersonal mecánico excesivos", estado: 'mecanizable' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Mayúsculas de título en encabezados", estado: 'mecanizable' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Exceso de atenuación", estado: 'mecanizable' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Conclusiones positivas genéricas", estado: 'mecanizable' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Colocación más previsible (perplejidad léxica baja)", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Antítesis simétrica y arquitectura repetida", estado: 'criterio' },
  { skill: 'humanizar-espanol', origen: 'patron', item: "Nombre suelto (media concreción)", estado: 'criterio' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿«Haber» impersonal está en singular?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿No hay coma entre sujeto y predicado (salvo inciso)?", estado: 'criterio' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Los signos ¿ y ¡ tienen apertura?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿No hay gerundios de posterioridad ni especificativos incorrectos?", estado: 'criterio' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Se prefiere voz activa o pasiva refleja sobre la pasiva perifrástica?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿No hay calcos del inglés?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿No hay dequeísmo ni queísmo?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Las mayúsculas son correctas (meses, días, gentilicios en minúscula)?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Se conserva toda la información original (al reescribir)?", estado: 'criterio' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿No se añadió información nueva (al reescribir)?", estado: 'criterio' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Los números siguen las convenciones del español?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Las comillas son angulares « » como primer nivel?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿La puntuación va fuera de las comillas de cierre?", estado: 'mecanizable' },
  { skill: 'spanish-writing', origen: 'checklist', item: "¿Los encabezados usan mayúscula solo en la primera palabra y en los nombres propios?", estado: 'mecanizable' },
];
