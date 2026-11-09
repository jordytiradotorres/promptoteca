# Promptoteca

Promptoteca es un proyecto educativo que estoy desarrollando mientras aprendo y practico técnicas de **ingeniería de prompts**. La idea es aplicar esos aprendizajes en una biblioteca web personal donde puedo guardar prompts, registrar cómo los probé y volver a ellos para seguir mejorándolos.

Este proyecto forma parte de mi proceso de aprendizaje: experimentar, iterar y descubrir cómo instrucciones más claras y técnicas distintas pueden ayudar a obtener mejores resultados con modelos de lenguaje.

## Técnicas de prompting que estoy aprendiendo

Como parte del curso, estoy aprendiendo y experimentando con técnicas como:

- **Zero-shot:** solicitar una tarea sin proporcionar ejemplos.
- **One-shot y few-shot:** incluir uno o varios ejemplos para orientar la respuesta.
- **Prompts estructurados:** especificar con claridad el formato y los requisitos de la respuesta.
- **Chain-of-Thought:** plantear tareas de razonamiento de forma ordenada.
- **Personas, delimitadores y etiquetas XML:** organizar el contexto y definir una perspectiva para la tarea.
- **Ubicación del contexto:** decidir dónde colocar instrucciones e información relevante.
- **Selección de modelos y future-proofing:** evaluar resultados y adaptar los prompts conforme cambian los modelos.

Estas técnicas forman parte de mi aprendizaje y del proceso de experimentación que acompaña el desarrollo de Promptoteca; no son funciones automáticas de la aplicación.

## ¿Qué permite hacer?

- Crear prompts con título, contenido y modelo utilizado.
- Indicar si el contenido del prompt es código.
- Calificar los prompts y agregar notas.
- Consultar metadatos, como las fechas y una estimación aproximada de tokens.
- Exportar la biblioteca a JSON e importar datos fusionándolos con los existentes o reemplazándolos.
- Elegir cómo resolver conflictos cuando se importan prompts con el mismo ID.

## Tecnologías

- **HTML5** para la estructura de la aplicación.
- **CSS3** para los estilos y el diseño adaptable.
- **JavaScript** para la interacción, validación e importación y exportación de datos.
- **`localStorage`** para guardar la biblioteca en el navegador.
- **JSON** como formato de respaldo e intercambio.

No utiliza frameworks ni requiere instalar dependencias.

## Cómo ejecutar

Abre `index.html` en un navegador moderno. También puedes abrir esta carpeta en Visual Studio Code y ejecutarla con una extensión de servidor local, como Live Server.

## Almacenamiento

Los prompts se guardan localmente en el navegador y no se envían a un servidor. Por lo tanto, no se sincronizan automáticamente entre dispositivos o navegadores. Puedes exportar la biblioteca a JSON para guardar una copia o trasladar tus datos.

La estimación de tokens es orientativa y puede diferir del conteo real de cada modelo.

## Objetivo de aprendizaje

Utilizo este proyecto para explorar y practicar conceptos como la claridad de las instrucciones, el uso de ejemplos, el registro del modelo empleado y la iteración de prompts. La aplicación también me permite conservar los resultados y observaciones de mis experimentos mientras continúo aprendiendo.
