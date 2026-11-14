# Segundo entregable · Órbita Campus

Versión candidata **v0.3.0-rc.6** para el Taller de Construcción de Software Web de la UNMSM.

[Descargar informe PDF desde Pages](https://andrey3210.github.io/orbita-campus/Informe-segundo-entregable.pdf)

[Evidencias por criterio de las fases I a III](cierre-fase-iii.md)

| Fase | Evidencia |
| --- | --- |
| 1. Análisis y prototipo | [Especificación, historias, BDD y arquitectura](especificacion.md) · [Prototipo actualizado en Figma](https://www.figma.com/design/NEfkdhD8dOUyIiAtHrAVWZ?node-id=37-3393) |
| 2. MVP full-stack | React, API Spring Boot, esquema MySQL, roles y flujo de atención verificable |
| 3. Seguridad y DevOps | JWT, correo institucional, autorización, Docker, API OpenAPI, pruebas HTTP y flujos de integración y despliegue |

El portal conecta por HTTPS con el gateway Caddy y la API de Railway. MySQL usa un volumen persistente y la red privada del proyecto. La base conserva las cuatro cuentas originales y doce cuentas nuevas repartidas entre los cuatro roles. La carga agrega 24 solicitudes, cuatro por cada estado, y 159 eventos de historial. Los accesos se entregan por separado. [Portal](https://andrey3210.github.io/orbita-campus/) · [Disponibilidad de la API](https://orbita-campus-production.up.railway.app/actuator/health) · [Ejecución local](../README.md#ejecutar-con-mysql)

El alta por Brevo se comprobó con un buzón UNMSM autorizado. El enlace llegó, activó la cuenta una sola vez y permitió iniciar sesión. La recuperación y la revocación de sesiones se probaron con el emisor simulado de integración. El alojamiento inicial usa el crédito de prueba de Railway.

La API usa validaciones en servidor, control por recurso, contraseñas con BCrypt, sesiones con JWT y revocación por versión. Los usuarios pueden recuperar o cambiar su contraseña y las sesiones anteriores se invalidan. El [contrato OpenAPI](openapi.yaml) documenta rutas y respuestas. [GitHub Actions](https://github.com/Andrey3210/orbita-campus/actions) conserva las ejecuciones.
