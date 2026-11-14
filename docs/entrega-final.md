# Órbita Campus · Entrega final del Grupo 7

Versión **1.0.1** para el Taller de Construcción de Software Web de la UNMSM.

- [Portal](https://andrey3210.github.io/orbita-campus/) · [Estado de la API](https://orbita-campus-production.up.railway.app/actuator/health)
- [Evidencias de las fases I a III](cierre-fase-iii.md) · [Diseño actual en Figma](https://www.figma.com/design/NEfkdhD8dOUyIiAtHrAVWZ?node-id=37-3393)
- [Manual de usuario](manual-usuario.md) · [Manual técnico](manual-tecnico.md) · [Guion de sustentación](sustentacion.md)
- [Contrato OpenAPI](openapi.yaml) · [Registro de uso de IA](registro-ia.md) · [Ejecuciones de calidad](https://github.com/Andrey3210/orbita-campus/actions/workflows/integracion.yml)
- [Monitoreo de disponibilidad](https://github.com/Andrey3210/orbita-campus/actions/workflows/monitoreo.yml)
- [Informe final en Drive](https://drive.google.com/file/d/1Igksxy_7uKhAOYAcLzEo3uE8jE8aLZQs/view) · [Plantilla para registrar validación con usuarios](validacion-usuarios.md)

La fase IV agrega pruebas de aceptación de navegador, análisis estático con SpotBugs y FindSecBugs, pruebas DAST de caja negra y mediciones de carga, estrés y recuperación sobre MySQL. Las ejecuciones automatizadas conservan resultados que permiten identificar el escenario y la respuesta observada.

Los registros HTTP incluyen una referencia de soporte, estado, duración y ruta de plantilla. Micrometer y Brave correlacionan las peticiones con sus trazas. Actuator permite revisar la salud y métricas. El monitoreo de Actions comprueba periódicamente el portal y la salud de la API, reintenta y genera una alerta de fallo tras tres resultados consecutivos insatisfactorios.

Los casos con prefijo `[HIST-G7-…]` son solicitudes de evaluación. Cubren 18 fechas en un lapso de 45 días, con tres casos por estado y registros de prioridad, asignación, atención y cierre. Las cuatro cuentas originales intervienen como solicitante, técnico asignado, supervisor y administrador.
