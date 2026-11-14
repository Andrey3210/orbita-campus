# Segundo entregable · Órbita Campus

Versión candidata **v0.3.0-rc.6** para el Taller de Construcción de Software Web de la UNMSM.

[Descargar informe PDF desde Pages](https://andrey3210.github.io/orbita-campus/Informe-segundo-entregable.pdf)

[Evidencias por criterio de las fases I a III](cierre-fase-iii.md)

| Fase | Evidencia |
| --- | --- |
| 1. Análisis y prototipo | [Especificación, historias, BDD y arquitectura](especificacion.md) |
| 2. MVP full-stack | React, API Spring Boot, esquema MySQL, roles y flujo de atención verificable |
| 3. Seguridad y DevOps | JWT, correo institucional, autorización, Docker, API OpenAPI, pruebas HTTP y flujos de integración y despliegue |

El portal en [GitHub Pages](https://andrey3210.github.io/orbita-campus/) conecta por HTTPS con la API de Railway. La API usa MySQL con volumen persistente y red privada. Se comprobó el acceso público con cuatro cuentas, una por rol, y el flujo completo de una solicitud. [Disponibilidad de la API](https://orbita-campus-production.up.railway.app/actuator/health) · [Ejecución local](../README.md#ejecutar-con-mysql)

Las pruebas de integración usan un emisor simulado. El registro y la recuperación con un buzón real requieren configurar un remitente de correo transaccional. El alojamiento inicial usa el crédito de prueba de Railway.

La API usa validaciones en servidor, control por recurso, contraseñas con BCrypt, sesiones con JWT y revocación por versión. Los usuarios pueden recuperar o cambiar su contraseña y las sesiones anteriores se invalidan. El [contrato OpenAPI](openapi.yaml) documenta rutas y respuestas. [GitHub Actions](https://github.com/Andrey3210/orbita-campus/actions) conserva las ejecuciones.
