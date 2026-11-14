# Revisión UX de Órbita Campus

Se revisó el portal con perfiles de estudiante, técnico, supervisor y administrador. Las vistas se inspeccionaron en Chromium a 1440 px y en móvil a 320 y 390 px. La prueba del navegador ejecutó un caso de principio a fin en una base MySQL aislada.

| Pantalla | Qué se observó | Mejora aplicada |
| --- | --- | --- |
| Inicio de sesión | El dominio requerido aparecía en el texto de ejemplo y los errores se mostraban arriba del formulario. | Ayuda visible junto al correo, foco en el campo al rechazar el dominio externo y enlace de reenvío visible cuando falta verificar el buzón. |
| Crear cuenta | La contraseña se explicaba con una unidad técnica. | Reglas de contraseña en lenguaje claro. El aviso de registro indica también dónde buscar el mensaje de verificación. |
| Recuperar contraseña | El formato institucional dependía del texto de ejemplo. | Ayuda junto al correo y error asociado al campo. |
| Reenviar verificación | El error del correo quedaba separado de la acción. | Validación junto al campo y aviso que indica revisar el buzón y el correo no deseado. |
| Verificar correo | En móvil, al abrir un enlace era fácil perder el contexto de la página. | El foco pasa al título del formulario. Se mantiene disponible la acción de pedir un enlace nuevo. |
| Nueva contraseña | Las instrucciones mezclaban el mínimo con el límite técnico de longitud. | Reglas en lenguaje claro, error de longitud específico y acceso directo a recuperación desde enlaces inválidos. |
| Inicio | La acción principal era la misma para todos. Las categorías del gráfico y su leyenda podían diferir. | El estudiante puede registrar desde Inicio. El técnico ve el alcance de sus asignaciones. El gráfico y su leyenda usan el mismo conjunto de categorías. |
| Solicitudes | Al volver desde una ficha se perdían la búsqueda y el estado seleccionado. Los plazos vencidos no destacaban. | Se conservan los filtros al volver, se pueden limpiar juntos y se añadió «Solo vencidas». Las filas muestran el aviso de plazo y abren enlaces. |
| Nueva solicitud | La descripción ofrecía poca orientación y un envío en curso solo deshabilitaba el botón. | Ejemplo de qué información escribir, botón «Registrando…» y confirmación con acceso a la ficha. |
| Detalle e historial | Al recargar se perdía la ficha. El estado siguiente aparecía preseleccionado y era posible pulsar Guardar sin cambios. | Cada ficha tiene un enlace directo protegido. El estado actual queda seleccionado hasta que se elija uno nuevo. Guardar se habilita al hacer un cambio. El historial separa eventos y mantiene los saltos de línea. |
| Seguimiento | El estado se repetía en todas las fichas y las columnas vacías ocupaban espacio. | Estado en el encabezado de etapa, contador y opción para ocultar etapas vacías. Volver desde una ficha lleva a Seguimiento. |
| Indicadores | El periodo de los indicadores no se podía cambiar. | Filtro por fecha de registro que actualiza todos los indicadores y muestra el tamaño de la muestra. |
| Administración de usuarios | Había que recorrer toda la lista para ubicar a alguien. | Búsqueda por nombre o correo, filtro por rol y contador de resultados. |
| Administración de categorías, áreas, prioridades y estados | Los controles de alta competían con los registros existentes. | Búsqueda por catálogo y altas de categorías y áreas en un panel desplegable. |
| Mi cuenta | Nombre, rol y correo estaban en una sola línea. El cierre de sesiones tras cambiar la clave podía sorprender. | Ficha de perfil con campos separados y explicación antes de pulsar «Guardar y cerrar sesión». |
| Navegación móvil y teclado | La barra inferior comprimía todas las secciones en una pantalla estrecha. | La barra se desliza horizontalmente con el dedo, muestra parte de la siguiente sección y desplaza la opción activa al área visible. Conserva enlaces accesibles, campos de 16 px y foco en el título al navegar o abrir una ficha. |

La aceptación automatizada es evidencia técnica del recorrido. La ficha del grupo queda como registro para las observaciones de sus participantes.
