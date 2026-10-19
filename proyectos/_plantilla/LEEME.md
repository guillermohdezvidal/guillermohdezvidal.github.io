# Cómo añadir un proyecto nuevo

Cada proyecto es un **panel**: pestañas con gráficas que el navegador calcula a partir de una base de datos
SQLite reducida (`resultados.sqlite`), sin servidor. La plantilla trae tres pestañas (Resumen, Resultados y
Datos) y una base de ejemplo para que se vea funcionando.

1. **Copia esta carpeta** a `proyectos/<nombre-del-proyecto>/` (minúsculas y guiones, sin espacios ni tildes:
   por ejemplo `filtro-de-regimen`).
2. En la copia de `index.html`:
   - cambia `data-carpeta="_plantilla"` por el nombre de la carpeta;
   - borra la línea `<meta name="robots" content="noindex">`;
   - cambia el `<title>` y la `description` (se ven en buscadores y al compartir el enlace);
   - añade pestañas: un enlace `<a href="#id" data-pestana="id">` en la barra y una `<section data-panel="id">`
     con sus tarjetas y `<div class="grafica" id="g-...">`.
3. **Textos**: rellena `textos.js` en inglés y en español (cada clave en los dos idiomas).
4. **Base de datos**: escribe un script que genere `resultados.sqlite` y su copia comprimida
   `resultados.sqlite.gz` con los resultados agregados del proyecto (nunca datos brutos de terceros), como hace
   `publicacion/scripts/sitio.py` para el arbitraje. La plantilla espera las tablas `metrics`, `series`,
   `capital_daily` y `monthly_returns`; añade las que necesites. Si la tabla `schema_notes` existe, la pestaña
   Datos muestra la descripción de cada columna.
5. **Gráficas**: en `tablero.js`, una función `pintar` por pestaña que consulta la base con `PANEL.filas(...)` y
   dibuja con `GRAFICAS_COMUN.dibujar(...)` (aplica el tema oscuro/claro y el formato del móvil). Los filtros
   (`prueba`, `fechas`, `contrato`) se activan por pestaña; ejemplo completo en
   `proyectos/arbitraje-estadistico/tablero.js`.
6. **PDF**: copia el artículo como `articulo.pdf`; si no hay, pon `pdf: ""` en la entrada del proyecto.
7. **Inicio**: añade la entrada del proyecto al principio de `assets/proyectos.js` (título, resumen, estado,
   etiquetas y enlaces).
8. Ejecuta `python -m publicacion.scripts.sitio` (pone la huella `?v=` a los ficheros para que el navegador no
   use versiones viejas), comprueba el panel con el servidor local en los dos idiomas, en el móvil y con los dos
   temas, y publica (`publicacion/README-web.md` en el proyecto privado).

Antes de ejecutar cualquier prueba del proyecto, regístrala: commit con la hipótesis, los parámetros y la regla de
aprobado, y súbelo a GitHub para que la hora del registro quede guardada fuera de tu ordenador.
