# Mini-Trello
Trabajo evaluativo de Kellys Bellanger, Raúl Valverde, Jimmy Selva, Erick Arana y Jesser Rodriguez.

## Uso

- Abre `Index.html` en tu navegador (doble clic o desde el editor con "Open File").
- Login: usuario `admin`, contraseña `1234`.
- Agrega tareas en el campo superior y muévelas entre columnas:
	- Puedes arrastrar y soltar las tarjetas.
	- También puedes usar los botones ⬅️ ➡️ o las teclas: Enter/Space (avanzar), ArrowRight (avanzar), ArrowLeft (retroceder), Delete (eliminar).

Las tareas se guardan en el almacenamiento local del navegador (localStorage) y persistirán después de recargar la página.

### Export / Import

- Usa el botón `Exportar` en el header para descargar un JSON con el estado actual del tablero.
- Usa `Importar` y selecciona un archivo JSON exportado previamente para recuperar el tablero.
- También existe el botón `Limpiar` para vaciar todas las tareas (solicita confirmación).
